import { RouteWaypoint } from '../services/routeService';
import { WaypointScore } from '../types/routeEnhancements';
import { loadGoogleMaps } from './googleMapsLoader';
import {
  haversineKm,
  haversineLatLngKm,
  isLoopRoute,
  latLngToLngLat,
  LngLat,
  waypointToLngLat,
} from '../utils/coordinates';

export async function selectBestWaypoints(
  allPois: RouteWaypoint[],
  desiredCount: number,
  userLocation: LngLat,
  destination: LngLat
): Promise<RouteWaypoint[]> {
  if (allPois.length === 0) return [];
  if (allPois.length <= desiredCount) return allPois;

  const scores: Map<RouteWaypoint, WaypointScore> = new Map();

  for (const poi of allPois) {
    const qualityScore = calculateQualityScore(
      poi.rating || 0,
      poi.userRatingsTotal || 0
    );

    const positionScore = calculatePositionScore(
      poi.location,
      userLocation,
      destination
    );

    const combinedScore = qualityScore * 0.6 + positionScore * 0.4;

    scores.set(poi, {
      qualityScore,
      positionScore,
      combinedScore,
      rating: poi.rating || 0,
      reviewCount: poi.userRatingsTotal || 0,
      popularity: poi.rating ? Math.min((poi.userRatingsTotal || 0) / 100, 1) : 0,
    });
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1].combinedScore - a[1].combinedScore)
    .slice(0, desiredCount)
    .map((entry) => entry[0]);
}

function calculateQualityScore(rating: number, reviewCount: number): number {
  const normalizedRating = Math.min(rating / 5, 1);
  const normalizedReviews = Math.min(reviewCount / 200, 1);

  if (rating === 0) return 0.3;
  return normalizedRating * 0.7 + normalizedReviews * 0.3;
}

function calculatePositionScore(
  poiLocation: RouteWaypoint['location'],
  userLocation: LngLat,
  destination: LngLat
): number {
  const poiLngLat = latLngToLngLat(poiLocation);
  const distToUser = haversineKm(userLocation, poiLngLat);
  const distToDest = haversineKm(destination, poiLngLat);
  const distUserToDest = haversineKm(userLocation, destination);

  if (isLoopRoute(userLocation, destination)) {
    const idealRadius = 0.5;
    const spreadScore = Math.max(0, 1 - Math.abs(distToUser - idealRadius) / idealRadius);
    return spreadScore;
  }

  const directPathLength = Math.max(distUserToDest, 0.001);
  const deviationLength = distToUser + distToDest;
  const detourRatio = deviationLength / directPathLength;
  const detourPenalty = Math.min(detourRatio, 3);

  return Math.max(0, 1 - (detourPenalty - 1) * 0.2);
}

export async function sequenceWaypoints(
  waypoints: RouteWaypoint[],
  userLocation: LngLat,
  destination: LngLat
): Promise<RouteWaypoint[]> {
  if (waypoints.length === 0) return [];
  if (waypoints.length === 1) return waypoints;

  try {
    const distanceMatrix = await buildDistanceMatrix(
      waypoints,
      userLocation,
      destination
    );

    if (isLoopRoute(userLocation, destination)) {
      return loopTwoOptImprovement(waypoints, distanceMatrix);
    }

    return openPathTwoOptImprovement(waypoints, distanceMatrix);
  } catch (error) {
    console.warn('Distance matrix API failed, using greedy sequencing:', error);
    return greedySequence(waypoints, userLocation, destination);
  }
}

async function buildDistanceMatrix(
  waypoints: RouteWaypoint[],
  userLocation: LngLat,
  destination: LngLat
): Promise<number[][]> {
  const maps = await loadGoogleMaps(['places']);
  const service = new maps.DistanceMatrixService();

  const origins = [
    new maps.LatLng(userLocation[1], userLocation[0]),
    ...waypoints.map((wp) => new maps.LatLng(wp.location[0], wp.location[1])),
    new maps.LatLng(destination[1], destination[0]),
  ];

  const destinations = [...origins];

  return new Promise((resolve, reject) => {
    service.getDistanceMatrix(
      {
        origins,
        destinations,
        travelMode: maps.TravelMode.WALKING,
      },
      (response: any, status: any) => {
        if (status === maps.DistanceMatrixStatus.OK) {
          const matrix: number[][] = [];
          for (let i = 0; i < response.rows.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < response.rows[i].elements.length; j++) {
              const element = response.rows[i].elements[j];
              matrix[i][j] = element.distance ? element.distance.value : 999999;
            }
          }
          resolve(matrix);
        } else {
          reject(new Error(`Distance Matrix API error: ${status}`));
        }
      }
    );
  });
}

/** Matrix index 0 = start, 1..n = waypoints, n+1 = destination */
function openPathTwoOptImprovement(
  waypoints: RouteWaypoint[],
  matrix: number[][]
): RouteWaypoint[] {
  const n = waypoints.length;
  let sequence = nearestNeighborOpenPath(n, matrix);
  let improved = true;
  let iterations = 0;
  const maxIterations = 100;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        const delta = openPathSwapDelta(sequence, matrix, i, j);
        if (delta < -0.01) {
          sequence = reverseSegment(sequence, i + 1, j);
          improved = true;
        }
      }
    }
  }

  return sequence.map((idx) => waypoints[idx]);
}

function nearestNeighborOpenPath(n: number, matrix: number[][]): number[] {
  const remaining = new Set(Array.from({ length: n }, (_, i) => i));
  const sequence: number[] = [];
  let current = 0; // start index in matrix

  while (remaining.size > 0) {
    let nearest = -1;
    let minDist = Infinity;

    for (const idx of remaining) {
      const wpMatrixIdx = idx + 1;
      const dist = matrix[current][wpMatrixIdx];
      if (dist < minDist) {
        minDist = dist;
        nearest = idx;
      }
    }

    if (nearest === -1) break;
    sequence.push(nearest);
    remaining.delete(nearest);
    current = nearest + 1;
  }

  return sequence;
}

function openPathSwapDelta(
  sequence: number[],
  matrix: number[][],
  i: number,
  j: number
): number {
  const destIdx = sequence.length + 1;
  const toMatrixIdx = (seqIdx: number) => seqIdx + 1;

  const b = toMatrixIdx(sequence[i]);
  const c = toMatrixIdx(sequence[i + 1]);
  const d = toMatrixIdx(sequence[j]);
  const e = j === sequence.length - 1 ? destIdx : toMatrixIdx(sequence[j + 1]);

  const removed = matrix[b][c] + matrix[d][e];
  const added = matrix[b][d] + matrix[c][e];

  return added - removed;
}

/** Loop route: start === destination, optimize waypoint order as a cycle returning home */
function loopTwoOptImprovement(
  waypoints: RouteWaypoint[],
  matrix: number[][]
): RouteWaypoint[] {
  const n = waypoints.length;
  let sequence = nearestNeighborLoop(n, matrix);
  let improved = true;
  let iterations = 0;
  const maxIterations = 100;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        const delta = loopSwapDelta(sequence, matrix, i, j);
        if (delta < -0.01) {
          sequence = reverseSegment(sequence, i + 1, j);
          improved = true;
        }
      }
    }
  }

  return sequence.map((idx) => waypoints[idx]);
}

function nearestNeighborLoop(n: number, matrix: number[][]): number[] {
  const remaining = new Set(Array.from({ length: n }, (_, i) => i));
  const sequence: number[] = [];
  let current = 0;

  while (remaining.size > 0) {
    let nearest = -1;
    let minDist = Infinity;

    for (const idx of remaining) {
      const wpMatrixIdx = idx + 1;
      const dist = matrix[current][wpMatrixIdx];
      if (dist < minDist) {
        minDist = dist;
        nearest = idx;
      }
    }

    if (nearest === -1) break;
    sequence.push(nearest);
    remaining.delete(nearest);
    current = nearest + 1;
  }

  return sequence;
}

function loopSwapDelta(
  sequence: number[],
  matrix: number[][],
  i: number,
  j: number
): number {
  const destIdx = 0;
  const toMatrixIdx = (seqIdx: number) => seqIdx + 1;

  const b = toMatrixIdx(sequence[i]);
  const c = toMatrixIdx(sequence[i + 1]);
  const d = toMatrixIdx(sequence[j]);
  const e = j === sequence.length - 1 ? destIdx : toMatrixIdx(sequence[j + 1]);

  const removed = matrix[b][c] + matrix[d][e];
  const added = matrix[b][d] + matrix[c][e];

  return added - removed;
}

function reverseSegment(sequence: number[], start: number, end: number): number[] {
  const newSeq = [...sequence];
  while (start < end) {
    [newSeq[start], newSeq[end]] = [newSeq[end], newSeq[start]];
    start++;
    end--;
  }
  return newSeq;
}

function greedySequence(
  waypoints: RouteWaypoint[],
  userLocation: LngLat,
  destination: LngLat
): RouteWaypoint[] {
  const result: RouteWaypoint[] = [];
  const remaining = [...waypoints];
  let current: LngLat = userLocation;

  while (remaining.length > 0) {
    let nearest = 0;
    let minDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(current, latLngToLngLat(remaining[i].location));
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }

    result.push(remaining[nearest]);
    current = latLngToLngLat(remaining[nearest].location);
    remaining.splice(nearest, 1);
  }

  return result;
}

export function validateRoute(
  waypoints: RouteWaypoint[],
  userLocation: LngLat,
  destination: LngLat,
  maxBacktrackingRatio: number = 1.5
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (waypoints.length === 0) {
    return { valid: true, issues: [] };
  }

  const pathPoints: LngLat[] = [
    userLocation,
    ...waypoints.map(waypointToLngLat),
    destination,
  ];

  let totalDistance = 0;
  for (let i = 0; i < pathPoints.length - 1; i++) {
    totalDistance += haversineKm(pathPoints[i], pathPoints[i + 1]);
  }

  if (isLoopRoute(userLocation, destination)) {
    const lats = waypoints.map((w) => w.location[0]);
    const lngs = waypoints.map((w) => w.location[1]);
    const spanKm =
      haversineLatLngKm(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ) || 0.001;

    const loopRatio = totalDistance / spanKm;
    if (loopRatio > 4) {
      issues.push(
        `Loop route is excessively long (${loopRatio.toFixed(2)}x area span)`
      );
    }
  } else {
    const directDistance = Math.max(haversineKm(userLocation, destination), 0.001);
    const backtrackingRatio = totalDistance / directDistance;

    if (backtrackingRatio > maxBacktrackingRatio) {
      issues.push(
        `Route has excessive backtracking (${backtrackingRatio.toFixed(2)}x longer than direct)`
      );
    }
  }

  if (!checkPointSpread(waypoints)) {
    issues.push('Waypoints are clustered in one area');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function checkPointSpread(waypoints: RouteWaypoint[]): boolean {
  if (waypoints.length < 2) return true;

  const lats = waypoints.map((w) => w.location[0]);
  const lngs = waypoints.map((w) => w.location[1]);

  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lngSpan = Math.max(...lngs) - Math.min(...lngs);

  return latSpan + lngSpan > 0.02;
}
