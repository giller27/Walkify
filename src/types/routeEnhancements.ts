export type RouteDifficulty = 'Easy' | 'Moderate' | 'Challenging';

export interface WaypointScore {
  qualityScore: number;
  positionScore: number;
  combinedScore: number;
  rating: number;
  reviewCount: number;
  popularity: number;
}

export interface RouteOptions {
  difficulty?: RouteDifficulty;
  elevationGain?: number;
  elevationLoss?: number;
  maxElevation?: number;
  avgGradient?: number;
  terrainTypes?: string[];
  scenicScore?: number;
  walkability?: number;
}

export interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
}

export interface ElevationProfile {
  totalGain: number;
  totalLoss: number;
  maxElevation: number;
  minElevation: number;
  averageGradient: number;
  points: ElevationPoint[];
}

export interface TerrainInfo {
  type: 'paved' | 'natural' | 'gravel' | 'mixed' | 'unknown';
  difficulty: number;
  scenicValue: number;
  accessibility: number;
}

export interface DistanceMatrix {
  distances: number[][];
  durations: number[][];
  origins: [number, number][];
  destinations: [number, number][];
}
