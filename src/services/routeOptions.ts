import { loadGoogleMaps } from './googleMapsLoader';
import { RouteResult, RouteWaypoint } from './routeService';
import {
  ElevationProfile,
  ElevationPoint,
  RouteDifficulty,
  TerrainInfo,
  RouteOptions,
} from '../types/routeEnhancements';
import { haversineLatLngKm, LatLng } from '../utils/coordinates';

const TERRAIN_DIFFICULTY_MAP: Record<string, { difficulty: number; scenicValue: number }> = {
  paved: { difficulty: 0.5, scenicValue: 1 },
  natural: { difficulty: 1.5, scenicValue: 2.5 },
  gravel: { difficulty: 1, scenicValue: 1.5 },
  mixed: { difficulty: 0.8, scenicValue: 1.8 },
  unknown: { difficulty: 0.7, scenicValue: 1 },
};

const POI_SCENIC_SCORES: Record<string, number> = {
  cafe: 0.5,
  restaurant: 0.6,
  park: 2.0,
  shop: 0.3,
  museum: 1.5,
  library: 0.8,
  place_of_worship: 1.5,
  beach: 2.5,
  lake: 2.5,
  river: 2.3,
  viewpoint: 2.8,
  landmark: 2.0,
  attraction: 2.2,
  natural_feature: 2.4,
  custom: 1.0,
};

export async function calculateElevationProfile(
  points: [number, number][]
): Promise<ElevationProfile> {
  try {
    const maps = await loadGoogleMaps(['places']);
    const elevator = new maps.ElevationService();

    const pathPoints = points.map(([lat, lng]) => new maps.LatLng(lat, lng));

    const results = await new Promise<any[]>((resolve, reject) => {
      elevator.getElevationAlongPath(
        {
          path: pathPoints,
          samples: Math.min(points.length * 2, 512),
        },
        (results: any, status: any) => {
          if (status === maps.ElevationStatus.OK) {
            resolve(results);
          } else {
            reject(new Error(`Elevation API error: ${status}`));
          }
        }
      );
    });

    const elevationPoints: ElevationPoint[] = results.map((result: any) => ({
      lat: result.location.lat(),
      lng: result.location.lng(),
      elevation: result.elevation,
    }));

    let totalGain = 0;
    let totalLoss = 0;
    let maxElevation = elevationPoints[0]?.elevation || 0;
    let minElevation = elevationPoints[0]?.elevation || 0;

    for (let i = 1; i < elevationPoints.length; i++) {
      const diff =
        elevationPoints[i].elevation - elevationPoints[i - 1].elevation;
      if (diff > 0) {
        totalGain += diff;
      } else {
        totalLoss -= diff;
      }
      maxElevation = Math.max(maxElevation, elevationPoints[i].elevation);
      minElevation = Math.min(minElevation, elevationPoints[i].elevation);
    }

    const totalDistance = calculatePathDistance(points);
    const averageGradient =
      totalDistance > 0 ? (totalGain / (totalDistance * 1000)) * 100 : 0;

    return {
      totalGain: Math.round(totalGain),
      totalLoss: Math.round(totalLoss),
      maxElevation: Math.round(maxElevation),
      minElevation: Math.round(minElevation),
      averageGradient: Math.round(averageGradient * 10) / 10,
      points: elevationPoints,
    };
  } catch (error) {
    console.warn('Elevation API failed, returning default profile:', error);
    return {
      totalGain: 0,
      totalLoss: 0,
      maxElevation: 0,
      minElevation: 0,
      averageGradient: 0,
      points: [],
    };
  }
}

export function getTerrainInfo(waypoint: RouteWaypoint): TerrainInfo {
  const poiType = waypoint.type;
  const terrainMap: Record<string, keyof typeof TERRAIN_DIFFICULTY_MAP> = {
    park: 'natural',
    beach: 'natural',
    lake: 'mixed',
    river: 'natural',
    cafe: 'paved',
    restaurant: 'paved',
    shop: 'paved',
    museum: 'paved',
    library: 'paved',
    place_of_worship: 'mixed',
    viewpoint: 'mixed',
    landmark: 'paved',
    attraction: 'mixed',
    natural_feature: 'natural',
  };

  const terrainType = terrainMap[poiType] || 'unknown';
  const terrainData = TERRAIN_DIFFICULTY_MAP[terrainType];

  return {
    type: terrainType as any,
    difficulty: terrainData.difficulty,
    scenicValue: terrainData.scenicValue,
    accessibility: calculateAccessibility(waypoint),
  };
}

function calculateAccessibility(waypoint: RouteWaypoint): number {
  const poiType = waypoint.type;

  const accessibilityMap: Record<string, number> = {
    cafe: 0.9,
    restaurant: 0.85,
    park: 0.7,
    shop: 0.95,
    museum: 0.85,
    library: 0.9,
    place_of_worship: 0.75,
    beach: 0.6,
    lake: 0.5,
    river: 0.4,
    viewpoint: 0.6,
    landmark: 0.7,
    attraction: 0.8,
    natural_feature: 0.5,
    custom: 0.7,
  };

  return accessibilityMap[poiType] || 0.7;
}

export function calculateRouteDifficulty(
  route: RouteResult,
  elevationProfile: ElevationProfile
): RouteDifficulty {
  const distanceKm = route.distanceKm;
  const elevationGainMeters = elevationProfile.totalGain;

  const elevationDifficulty =
    (elevationGainMeters / (distanceKm * 1000)) * 100;
  const lengthDifficulty = calculateLengthDifficulty(distanceKm);
  const terrainDifficulty = route.waypoints
    ? route.waypoints.reduce((sum, wp) => sum + getTerrainInfo(wp).difficulty, 0) /
      Math.max(route.waypoints.length, 1)
    : 0;

  const totalDifficulty =
    elevationDifficulty * 0.4 + lengthDifficulty * 0.3 + terrainDifficulty * 0.3;

  if (totalDifficulty < 1.5) {
    return 'Easy';
  } else if (totalDifficulty < 3) {
    return 'Moderate';
  } else {
    return 'Challenging';
  }
}

function calculateLengthDifficulty(distanceKm: number): number {
  if (distanceKm < 2) return 0.5;
  if (distanceKm < 3) return 1;
  if (distanceKm < 7) return 2;
  if (distanceKm < 12) return 3;
  return 4;
}

export function scoreForScenicness(
  route: RouteResult
): { score: number; description: string } {
  if (!route.waypoints || route.waypoints.length === 0) {
    return { score: 1, description: 'Standard urban route' };
  }

  const poiScores = route.waypoints.map((wp) => {
    const baseScore = POI_SCENIC_SCORES[wp.type] || 1;
    const ratingBoost = wp.rating ? (wp.rating - 3) * 0.2 : 0;
    return baseScore + Math.max(0, ratingBoost);
  });

  const averageScore =
    poiScores.reduce((sum, s) => sum + s, 0) / poiScores.length;
  let description = 'Standard route';

  if (averageScore > 2.2) {
    description = 'Highly scenic - parks, water features, landmarks';
  } else if (averageScore > 1.8) {
    description = 'Scenic - mix of parks and cultural sites';
  } else if (averageScore > 1.2) {
    description = 'Moderately interesting - shops and cafes mixed in';
  }

  return {
    score: Math.min(averageScore, 3),
    description,
  };
}

export async function enrichRouteWithAdvancedOptions(
  route: RouteResult
): Promise<RouteOptions> {
  const elevationProfile = await calculateElevationProfile(route.points);
  const difficulty = calculateRouteDifficulty(route, elevationProfile);
  const scenic = scoreForScenicness(route);

  const terrainTypes = route.waypoints
    ? [
        ...new Set(
          route.waypoints.map((wp) => getTerrainInfo(wp).type as string)
        ),
      ]
    : [];

  const walkability = calculateWalkability(route);

  return {
    difficulty,
    elevationGain: elevationProfile.totalGain,
    elevationLoss: elevationProfile.totalLoss,
    maxElevation: elevationProfile.maxElevation,
    avgGradient: elevationProfile.averageGradient,
    terrainTypes,
    scenicScore: scenic.score,
    walkability,
  };
}

function calculateWalkability(route: RouteResult): number {
  const baseWalkability = 0.7;

  const terrainFactor = route.waypoints
    ? route.waypoints.reduce((sum, wp) => sum + getTerrainInfo(wp).accessibility, 0) /
      Math.max(route.waypoints.length, 1)
    : 1;

  const distanceFactor = Math.min(1, route.distanceKm / 10);

  return Math.round(baseWalkability * terrainFactor * distanceFactor * 100) / 100;
}

function calculatePathDistance(points: LatLng[]): number {
  let distance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    distance += haversineLatLngKm(points[i], points[i + 1]);
  }
  return distance;
}
