import { Place } from '../services/routeService';

export type RouteDifficulty = "Easy" | "Moderate" | "Challenging";

export interface RouteEnhancementOptions {
  avoidSteepHills?: boolean;
  preferScenic?: boolean;
  targetDifficulty?: RouteDifficulty;
}

export interface WaypointScore {
  place: Place;
  qualityScore: number;
  positionScore: number;
  combinedScore: number;
}

export interface TerrainInfo {
  surfaceType: "paved" | "gravel" | "natural" | "mixed";
  scenicScore: number;
  difficultyMultiplier: number;
}

export interface ElevationProfile {
  totalGain: number;
  totalLoss: number;
  points: { distance: number; elevation: number; lat: number; lng: number }[];
}

export interface RouteAnalysis {
  difficulty: RouteDifficulty;
  elevation?: ElevationProfile;
  averageScenicScore: number;
  terrainTypes: string[];
}