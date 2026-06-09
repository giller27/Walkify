import { RouteAnalysis, RouteDifficulty, ElevationProfile, TerrainInfo } from '../types/routeEnhancements';
import { Place } from './routeService';

// Fetch elevation data using Google Maps Elevation API
export async function calculateElevationProfile(points: [number, number][]): Promise<ElevationProfile | null> {
  if (!window.google || !window.google.maps || !window.google.maps.ElevationService) {
    console.warn("Google Maps ElevationService not available");
    return null;
  }

  const elevator = new google.maps.ElevationService();
  const path = points.map(p => ({ lat: p[0], lng: p[1] }));

  try {
    const response = await elevator.getElevationAlongPath({
      path: path,
      samples: Math.min(256, points.length) // Google max is 512, 256 is safe
    });

    let totalGain = 0;
    let totalLoss = 0;
    const profilePoints = [];

    for (let i = 0; i < response.results.length; i++) {
      const current = response.results[i].elevation;
      profilePoints.push({
        distance: i, // Placeholder for actual distance tracking
        elevation: current,
        lat: response.results[i].location!.lat(),
        lng: response.results[i].location!.lng()
      });

      if (i > 0) {
        const diff = current - response.results[i - 1].elevation;
        if (diff > 0) totalGain += diff;
        else totalLoss += Math.abs(diff);
      }
    }

    return { totalGain, totalLoss, points: profilePoints };
  } catch (error) {
    console.error("Elevation request failed:", error);
    return null;
  }
}

export function getTerrainInfo(waypointType: string): TerrainInfo {
  switch (waypointType) {
    case 'park':
    case 'forest':
      return { surfaceType: 'natural', scenicScore: 2.0, difficultyMultiplier: 1.2 };
    case 'beach':
    case 'lake':
    case 'river':
      return { surfaceType: 'mixed', scenicScore: 2.5, difficultyMultiplier: 1.1 };
    case 'museum':
    case 'landmark':
      return { surfaceType: 'paved', scenicScore: 1.5, difficultyMultiplier: 1.0 };
    default: // shops, cafes, urban
      return { surfaceType: 'paved', scenicScore: 0.5, difficultyMultiplier: 1.0 };
  }
}

export function calculateRouteDifficulty(
  distanceKm: number, 
  elevation: ElevationProfile | null, 
  terrainMultiplier: number
): RouteDifficulty {
  let score = distanceKm * 10; // Base score purely on distance
  
  if (elevation) {
    // Add difficulty based on steepness (gain per km)
    const steepness = elevation.totalGain / Math.max(distanceKm, 1);
    score += steepness * 0.5;
  }

  score *= terrainMultiplier;

  if (score < 40) return "Easy";        // ~ < 4km flat
  if (score < 80) return "Moderate";    // ~ 4-8km or hilly
  return "Challenging";                 // ~ > 8km or very steep
}