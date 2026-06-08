import { Place } from './routeService';
import { WaypointScore } from '../types/routeEnhancements';

// Helper: Haversine distance in km
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getDistanceKm(from: [number, number], to: [number, number]): number {
  return getDistance(from[1], from[0], to[1], to[0]);
}

/** Оцінка місця: пріоритет рейтингу, відстань — другорядний фактор */
export function scorePlaceOnPath(
  place: Place,
  from: [number, number],
  maxDistKm: number
): number {
  const dist = getDistanceKm(from, place.coordinates);
  const rating = place.rating ?? 3.0;
  const reviews = Math.min((place.userRatingsTotal ?? 0) / 100, 1.5);
  const ratingScore = rating * 3 + reviews;
  const distNorm = maxDistKm > 0 ? dist / maxDistKm : 0;
  return ratingScore - distNorm * 0.8;
}

export function pickBestRatedPlace(places: Place[], near?: [number, number]): Place | null {
  if (places.length === 0) return null;
  const origin = near ?? places[0].coordinates;
  const maxDist = Math.max(...places.map(p => getDistanceKm(origin, p.coordinates)), 0.1);
  return [...places].sort((a, b) =>
    scorePlaceOnPath(b, origin, maxDist) - scorePlaceOnPath(a, origin, maxDist)
  )[0];
}

function placeKey(place: Place): string {
  return place.externalId || `${place.name}_${place.coordinates[0].toFixed(3)}`;
}

export const WALKING_SPEED_KMH = 4.8;
const MAX_TIME_TOLERANCE = 1.15;

export function timeToDistanceKm(minutes: number): number {
  return (minutes / 60) * WALKING_SPEED_KMH;
}

export function distanceToTimeMinutes(km: number): number {
  return Math.round((km / WALKING_SPEED_KMH) * 60);
}

// Послідовний вибір: від поточної точки — найближчий POI, з урахуванням ліміту часу
export function selectSequentialWaypoints(
  allPois: Place[],
  start: [number, number],
  end: [number, number],
  targetTimeMinutes: number,
  isCircular: boolean,
  categories: string[] = []
): Place[] {
  const maxAllowedKm = timeToDistanceKm(targetTimeMinutes) * MAX_TIME_TOLERANCE;
  const remaining = [...allPois];
  const selected: Place[] = [];
  let current = start;
  let totalDistKm = 0;
  let categoryIndex = 0;
  const MAX_STOPS = 20;

  while (selected.length < MAX_STOPS && remaining.length > 0 && totalDistKm < maxAllowedKm) {
    let pool = remaining;
    if (categories.length > 0) {
      const targetCat = categories[categoryIndex % categories.length];
      categoryIndex++;
      pool = remaining.filter(p => p.type === targetCat);
      if (pool.length === 0) continue;
    }

    pool.sort((a, b) => {
      const distA = getDistanceKm(current, a.coordinates);
      const distB = getDistanceKm(current, b.coordinates);
      if (Math.abs(distA - distB) < 0.05) {
        return (b.rating || 0) - (a.rating || 0);
      }
      return distA - distB;
    });

    let picked: Place | null = null;
    for (const candidate of pool) {
      const legKm = getDistanceKm(current, candidate.coordinates);
      const returnKm = isCircular
        ? getDistanceKm(candidate.coordinates, start)
        : getDistanceKm(candidate.coordinates, end);
      const projectedKm = totalDistKm + legKm + (isCircular ? returnKm : 0);

      if (isCircular) {
        if (projectedKm <= maxAllowedKm) {
          picked = candidate;
          break;
        }
      } else if (totalDistKm + legKm <= maxAllowedKm) {
        picked = candidate;
        break;
      }
    }

    if (!picked) break;

    const pickedIndex = remaining.findIndex(p => placeKey(p) === placeKey(picked!));
    if (pickedIndex !== -1) remaining.splice(pickedIndex, 1);
    totalDistKm += getDistanceKm(current, picked.coordinates);
    selected.push(picked);
    current = picked.coordinates;
  }

  return selected;
}

// Tier 1: Select best POIs based on quality and geographic distribution
export function selectBestWaypoints(
  allPois: Place[], 
  desiredCount: number, 
  userLocation: [number, number],
  destination: [number, number]
): Place[] {
  const scores: WaypointScore[] = allPois.map(poi => {
    // Quality Score (0 to 5)
    const rating = poi.rating || 3.0;
    const reviews = Math.min((poi.userRatingsTotal || 0) / 100, 1.0); // normalize reviews
    const qualityScore = (rating * 0.7) + (reviews * 1.5); 

    // Position Score (Penalize points that are completely out of the general direction)
    // We want points roughly inside the bounding box of start/end, but with some bulge
    const distFromStart = getDistance(userLocation[1], userLocation[0], poi.coordinates[1], poi.coordinates[0]);
    const distToEnd = getDistance(destination[1], destination[0], poi.coordinates[1], poi.coordinates[0]);
    const totalDirect = getDistance(userLocation[1], userLocation[0], destination[1], destination[0]);
    
    // Ideal ellipse: distFromStart + distToEnd should be close to totalDirect
    const detourRatio = (distFromStart + distToEnd) / (totalDirect || 0.1);
    const positionScore = Math.max(0, 5 - (detourRatio * 2)); 

    return {
      place: poi,
      qualityScore,
      positionScore,
      combinedScore: (qualityScore * 0.6) + (positionScore * 0.4)
    };
  });

  // Sort by highest combined score and take the desired count
  scores.sort((a, b) => b.combinedScore - a.combinedScore);
  return scores.slice(0, desiredCount).map(s => s.place);
}

// Tier 2: Sequence Waypoints using 2-opt Algorithm for TSP
export function sequenceWaypoints(
  waypoints: Place[], 
  start: [number, number], 
  end: [number, number]
): Place[] {
  if (waypoints.length <= 1) return waypoints;

  // Initial greedy route
  let currentRoute = [...waypoints];
  let bestDistance = calculateTotalPathDistance(start, currentRoute, end);
  let improved = true;

  // 2-opt swap algorithm to untangle crossed paths
  while (improved) {
    improved = false;
    for (let i = 0; i < currentRoute.length - 1; i++) {
      for (let j = i + 1; j < currentRoute.length; j++) {
        const newRoute = [
          ...currentRoute.slice(0, i),
          ...currentRoute.slice(i, j + 1).reverse(),
          ...currentRoute.slice(j + 1)
        ];
        
        const newDist = calculateTotalPathDistance(start, newRoute, end);
        if (newDist < bestDistance) {
          bestDistance = newDist;
          currentRoute = newRoute;
          improved = true;
        }
      }
    }
  }

  return currentRoute;
}

function calculateTotalPathDistance(start: [number, number], route: Place[], end: [number, number]): number {
  let dist = 0;
  let curr = start;
  for (const wp of route) {
    dist += getDistance(curr[1], curr[0], wp.coordinates[1], wp.coordinates[0]);
    curr = wp.coordinates;
  }
  dist += getDistance(curr[1], curr[0], end[1], end[0]);
  return dist;
}