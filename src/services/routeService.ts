/// <reference types="google.maps" />

import { selectBestWaypoints, sequenceWaypoints } from './waypointOptimizer';
import { calculateElevationProfile, getTerrainInfo, calculateRouteDifficulty } from './routeOptions';
import type { RouteDifficulty, ElevationProfile } from '../types/routeEnhancements';

// ─── Interfaces & Types ─────────────────────────────────────────────────────────

export interface Place {
  name: string;
  coordinates: [number, number]; // [lng, lat]
  type: string;
  address?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  description?: string;
  source?: 'google' | 'custom';
  externalId?: string;
}

export type PoiCategory =
  | 'cafe' | 'park' | 'shop' | 'restaurant' | 'museum'
  | 'library' | 'place_of_worship' | 'beach' | 'lake' | 'river' | 'custom' | 'tourist_attraction';

export interface RouteWaypoint {
  location: [number, number]; // [lat, lng]
  name: string;
  type: PoiCategory;
  address?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  description?: string;
  source?: 'google' | 'custom';
}

export interface RouteResult {
  points: [number, number][]; // [lat, lng]
  waypoints: RouteWaypoint[];
  distanceKm: number;
  estimatedTimeMinutes: number;
  locations: string[];
  difficulty?: RouteDifficulty;
  elevation?: ElevationProfile;
  terrainTypes?: string[];
}

export interface RouteFilterOptions {
  routeMode: "exploration" | "point_to_point";
  categories: string[];
  desiredPoiCount: number;
  targetDistanceKm: number;
  minRating: number;
}

const EXTENDED_POI_TYPES = [
  'cafe', 'park', 'restaurant', 'store', 'museum', 'library', 
  'tourist_attraction', 'point_of_interest', 'church', 'natural_feature'
];

const PLACE_TYPE_MAPPING: Record<string, string> = {
  'парк': 'park',
  'кав\'ярня': 'cafe',
  'кафе': 'cafe',
  'ресторан': 'restaurant',
  'магазин': 'store',
  'музей': 'museum',
  'бібліотека': 'library',
  'церква': 'church',
  'пляж': 'natural_feature',
  'озеро': 'natural_feature',
  'річка': 'natural_feature',
};

// ─── Google Maps API Wrappers ───────────────────────────────────────────────────

function getPlacesService(): google.maps.places.PlacesService {
  if (!window.google || !window.google.maps || !window.google.maps.places) {
    throw new Error("Google Maps Places API is not loaded.");
  }
  return new google.maps.places.PlacesService(document.createElement('div'));
}

export async function findPlaceByName(placeName: string, userLocation: [number, number]): Promise<Place | null> {
  return new Promise((resolve) => {
    const service = getPlacesService();
    const request: google.maps.places.TextSearchRequest = {
      query: placeName,
      location: new google.maps.LatLng(userLocation[1], userLocation[0]),
      radius: 50000,
    };

    service.textSearch(request, (results: google.maps.places.PlaceResult[] | null, status: any) => {
      if (status === 'OK' && results && results.length > 0) {
        const place = results[0];
        resolve({
          name: place.name || placeName,
          coordinates: [place.geometry!.location!.lng(), place.geometry!.location!.lat()],
          type: place.types?.[0] || 'custom',
          address: place.formatted_address,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          source: 'google',
          externalId: place.place_id,
        });
      } else {
        resolve(null);
      }
    });
  });
}

async function findPlacesByGoogleType(center: [number, number], type: string, radius: number): Promise<Place[]> {
  return new Promise((resolve) => {
    const service = getPlacesService();
    const request: google.maps.places.PlaceSearchRequest = {
      location: new google.maps.LatLng(center[1], center[0]),
      radius: radius,
      type: type,
    };

    service.nearbySearch(request, (results: google.maps.places.PlaceResult[] | null, status: any) => {
      if (status === 'OK' && results) {
        const places: Place[] = results.map((p: google.maps.places.PlaceResult) => ({
          name: p.name || 'Unknown',
          coordinates: [p.geometry!.location!.lng(), p.geometry!.location!.lat()],
          type: type,
          address: p.vicinity,
          rating: p.rating,
          userRatingsTotal: p.user_ratings_total,
          source: 'google',
          externalId: p.place_id,
        }));
        resolve(places);
      } else {
        resolve([]);
      }
    });
  });
}

// ─── Новий метод: Генерація за фільтрами ────────────────────────────────────────

export async function generateRouteByFilters(
  userLocation: [number, number],
  options: RouteFilterOptions
): Promise<RouteResult> {
  const { categories, desiredPoiCount, routeMode, minRating } = options;

  const searchCategories = categories.length > 0 ? categories : ['park', 'cafe', 'tourist_attraction'];
  const allResults: Place[] = [];
  const searchRadius = Math.max(2000, options.targetDistanceKm * 600); 

  for (const cat of searchCategories) {
    const places = await findPlacesByGoogleType(userLocation, cat, searchRadius);
    allResults.push(...places);
  }

  const uniquePlaces = new Map<string, Place>();
  for (const place of allResults) {
    const key = place.externalId || `${place.name}_${place.coordinates[0].toFixed(3)}`;
    if (!uniquePlaces.has(key) && (place.rating || 0) >= minRating) {
      uniquePlaces.set(key, place);
    }
  }

  const filteredPois = Array.from(uniquePlaces.values());

  if (filteredPois.length === 0) {
    throw new Error(`Не знайдено місць із рейтингом від ${minRating}★ у радіусі ${searchRadius}м. Спробуйте обрати інші категорії.`);
  }

  const potentialDestination = filteredPois[filteredPois.length - 1];
  const targetEndCoord = routeMode === 'exploration' ? userLocation : potentialDestination.coordinates;

  const selectedPois = selectBestWaypoints(
    filteredPois, 
    Math.min(desiredPoiCount, filteredPois.length), 
    userLocation, 
    targetEndCoord
  );

  const sequencedPois = sequenceWaypoints(selectedPois, userLocation, targetEndCoord);
  const waypointCoords: [number, number][] = sequencedPois.map(p => p.coordinates);

  const route = await buildRoute(userLocation, targetEndCoord, waypointCoords);

  route.waypoints = sequencedPois.map(wp => {
    const terrain = getTerrainInfo(wp.type);
    return {
      location: [wp.coordinates[1], wp.coordinates[0]] as [number, number],
      name: wp.name,
      type: wp.type as PoiCategory,
      address: wp.address,
      rating: wp.rating,
      userRatingsTotal: wp.userRatingsTotal,
      description: `Покриття: ${terrain.surfaceType} | Мальовничість: ${terrain.scenicScore}`,
      source: 'google'
    };
  });

  route.locations = sequencedPois.map(wp => wp.name);
  return route;
}

// ─── Enhanced POI Discovery & Filtering (Text Mode) ───────────────────────────

export async function searchComprehensivePois(
  center: [number, number], 
  desiredTypes: string[], 
  radius: number = 3000
): Promise<Place[]> {
  const allResults: Place[] = [];
  const searchTypes = desiredTypes.length > 0 ? desiredTypes : EXTENDED_POI_TYPES;
  
  for (const type of searchTypes) {
    const places = await findPlacesByGoogleType(center, type, radius);
    allResults.push(...places);
  }

  const uniquePlaces = new Map<string, Place>();
  for (const place of allResults) {
    const key = place.externalId || `${place.name}_${place.coordinates[0].toFixed(3)}`;
    if (!uniquePlaces.has(key)) {
      uniquePlaces.set(key, place);
    }
  }

  const finalPois = Array.from(uniquePlaces.values());
  return filterPoisByDiversity(finalPois);
}

function filterPoisByDiversity(pois: Place[]): Place[] {
  const categoryCounts: Record<string, number> = {};
  const diversePois: Place[] = [];
  const sortedPois = pois.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  for (const poi of sortedPois) {
    const cat = poi.type || 'custom';
    if (!categoryCounts[cat]) categoryCounts[cat] = 0;
    
    if (categoryCounts[cat] < 2) {
      diversePois.push(poi);
      categoryCounts[cat]++;
    }
  }
  return diversePois;
}

// ─── Route Building (Google Directions) ─────────────────────────────────────────

export async function buildRoute(
  userLocation: [number, number], // [lng, lat]
  destination: [number, number], // [lng, lat]
  waypoints: [number, number][] = [] // [lng, lat]
): Promise<RouteResult> {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
      return reject(new Error("Google Maps DirectionsService is not loaded."));
    }

    const directionsService = new google.maps.DirectionsService();
    
    const request: google.maps.DirectionsRequest = {
      origin: new google.maps.LatLng(userLocation[1], userLocation[0]),
      destination: new google.maps.LatLng(destination[1], destination[0]),
      waypoints: waypoints.map(wp => ({
        location: new google.maps.LatLng(wp[1], wp[0]),
        stopover: true
      })),
      travelMode: google.maps.TravelMode.WALKING,
      optimizeWaypoints: false, 
    };

    directionsService.route(request, async (result: google.maps.DirectionsResult | null, status: any) => {
      if (status === 'OK' && result) {
        const route = result.routes[0];
        
        let totalDistanceMeters = 0;
        let totalDurationSeconds = 0;
        const points: [number, number][] = [];

        route.legs.forEach((l: google.maps.DirectionsLeg) => {
          totalDistanceMeters += l.distance?.value || 0;
          totalDurationSeconds += l.duration?.value || 0;
          l.steps.forEach((step: google.maps.DirectionsStep) => {
            step.path.forEach((latLng: google.maps.LatLng) => {
              points.push([latLng.lat(), latLng.lng()]);
            });
          });
        });

        const distanceKm = parseFloat((totalDistanceMeters / 1000).toFixed(2));
        const estimatedTimeMinutes = Math.round(totalDurationSeconds / 60);

        const elevationProfile = await calculateElevationProfile(points);
        const difficulty = calculateRouteDifficulty(distanceKm, elevationProfile, 1.0);

        const waypointsWithNames = waypoints.map((wp, index) => ({
          location: [wp[1], wp[0]] as [number, number],
          name: `Stop ${index + 1}`,
          type: 'custom' as PoiCategory,
        }));

        resolve({
          points,
          waypoints: waypointsWithNames,
          distanceKm,
          estimatedTimeMinutes,
          locations: [],
          difficulty,
          elevation: elevationProfile || undefined
        });
      } else {
        reject(new Error(`Failed to build route: ${status}`));
      }
    });
  });
}

// ─── Route Generation Orchestrators (Text Mode) ─────────────────────────────────

export async function generateExplorationRoute(
  userLocation: [number, number], 
  options: {
    types: string[];
    desiredPoiCount?: number;
    targetDistanceKm?: number;
  }
): Promise<RouteResult> {
  const { types, desiredPoiCount = 6 } = options;
  const nearbyPois = await searchComprehensivePois(userLocation, types, 3000);

  if (nearbyPois.length === 0) {
    throw new Error('Поруч не вдалося знайти цікаві місця для прогулянки. Спробуйте інший район.');
  }

  const destinationPoi = nearbyPois[nearbyPois.length - 1]; 
  const selectedPois = selectBestWaypoints(nearbyPois, desiredPoiCount, userLocation, destinationPoi.coordinates);
  const sequencedPois = sequenceWaypoints(selectedPois, userLocation, userLocation); 
  const waypointCoords: [number, number][] = sequencedPois.map(p => p.coordinates);

  const route = await buildRoute(userLocation, userLocation, waypointCoords); 

  route.waypoints = sequencedPois.map(wp => {
    const terrain = getTerrainInfo(wp.type);
    return {
      location: [wp.coordinates[1], wp.coordinates[0]] as [number, number],
      name: wp.name,
      type: wp.type as PoiCategory,
      address: wp.address,
      rating: wp.rating,
      userRatingsTotal: wp.userRatingsTotal,
      description: `Покриття: ${terrain.surfaceType} | Мальовничість: ${terrain.scenicScore}`,
      source: 'google'
    };
  });

  route.locations = sequencedPois.map(wp => wp.name);
  return route;
}

export async function generateRouteFromText(
  userLocation: [number, number],
  text: string,
  options?: { routeMode?: "point_to_point" | "exploration" }
): Promise<RouteResult> {
  const parsed = parseRouteRequest(text);
  const forceExploration = options?.routeMode === "exploration";
  const forcePointToPoint = options?.routeMode === "point_to_point";

  if (!forcePointToPoint && (parsed.isExplorationMode || forceExploration)) {
    const allTypes = [...new Set([...parsed.waypointTypes, parsed.destinationType].filter(Boolean) as string[])];
    return generateExplorationRoute(userLocation, {
      types: allTypes,
      desiredPoiCount: parsed.desiredPoiCount,
      targetDistanceKm: parsed.targetDistance,
    });
  }

  let destination: Place | null = null;
  if (parsed.destinationName) {
    destination = await findPlaceByName(parsed.destinationName, userLocation);
  } else if (parsed.destinationType) {
    const pois = await searchComprehensivePois(userLocation, [parsed.destinationType], 5000);
    if (pois.length > 0) destination = pois[0];
  }

  if (!destination) {
    throw new Error('Не вдалося визначити пункт призначення. Спробуйте уточнити запит.');
  }

  let waypointPlaces: Place[] = [];
  for (const wName of parsed.waypointNames) {
    const wp = await findPlaceByName(wName, userLocation);
    if (wp) waypointPlaces.push(wp);
  }

  if (parsed.waypointTypes.length > 0) {
    const extraPois = await searchComprehensivePois(userLocation, parsed.waypointTypes, 3000);
    waypointPlaces = [...waypointPlaces, ...selectBestWaypoints(extraPois, 2, userLocation, destination.coordinates)];
  }

  const sequencedWaypoints = sequenceWaypoints(waypointPlaces, userLocation, destination.coordinates);
  const wayCoords: [number, number][] = sequencedWaypoints.map(w => w.coordinates);

  const route = await buildRoute(userLocation, destination.coordinates, wayCoords);

  route.locations = [destination.name, ...sequencedWaypoints.map(wp => wp.name)];
  route.waypoints = sequencedWaypoints.map(wp => ({
    location: [wp.coordinates[1], wp.coordinates[0]] as [number, number],
    name: wp.name,
    type: wp.type as PoiCategory,
  }));

  return route;
}

export function parseRouteRequest(text: string): {
  destinationType: string | null;
  destinationName: string | null;
  waypointTypes: string[];
  waypointNames: string[];
  targetDistance?: number;
  isExplorationMode?: boolean;
  desiredPoiCount?: number;
} {
  const lowerText = text.toLowerCase();
  let destinationType: string | null = null;
  let destinationName: string | null = null;
  const waypointTypes: string[] = [];
  const waypointNames: string[] = [];

  const containsBaseForm = (txt: string, baseForm: string): boolean => {
    return txt.includes(baseForm.toLowerCase());
  };

  const specificNamePatterns = [
    /до\s+([А-Яа-яІіЇїЄєҐґA-Za-z0-9\s]{3,})/i,
    /через\s+([А-Яа-яІіЇїЄєҐґA-Za-z0-9\s]{3,})/i
  ];

  for (const pattern of specificNamePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (!destinationName) destinationName = name;
      else waypointNames.push(name);
    }
  }

  for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
    if (containsBaseForm(lowerText, key)) {
      if (!destinationType) destinationType = value;
      else waypointTypes.push(value);
    }
  }

  const isExplorationMode = lowerText.includes('прогулянка') || lowerText.includes('прогулятись');

  let desiredPoiCount = 6;
  const countMatch = text.match(/(\d+)\s*(зупинок|місць|точок)/i);
  if (countMatch && countMatch[1]) {
    desiredPoiCount = Math.max(2, Math.min(parseInt(countMatch[1]), 10));
  }

  return { destinationType, destinationName, waypointTypes, waypointNames, isExplorationMode, desiredPoiCount };
}