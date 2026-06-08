/// <reference types="google.maps" />

import {
  selectBestWaypoints, sequenceWaypoints,
  getDistanceKm, timeToDistanceKm,
} from './waypointOptimizer';
import { geocodeAddress } from './placesService';
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
  externalId?: string;
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

export interface RouteDestination {
  coords?: [number, number]; // [lng, lat]
  address?: string;
  name?: string;
}

export interface RouteFilterOptions {
  routeMode: "exploration" | "point_to_point";
  categories: string[];
  targetTimeMinutes: number;
  destination?: RouteDestination;
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

// ─── Послідовний пошук POI: одна категорія за раз, від кожної зупинки ─────────

function placeKey(place: Place): string {
  return place.externalId || `${place.name}_${place.coordinates[0].toFixed(3)}`;
}

async function findSequentialWaypoints(
  startLocation: [number, number],
  options: {
    categories: string[];
    targetTimeMinutes: number;
    routeMode: 'exploration' | 'point_to_point';
    endLocation?: [number, number];
  }
): Promise<Place[]> {
  const { categories, targetTimeMinutes, routeMode, endLocation } = options;
  const searchCategories = categories.length > 0 ? categories : ['park', 'cafe', 'tourist_attraction'];
  const maxAllowedKm = timeToDistanceKm(targetTimeMinutes) * 1.15;
  const isCircular = routeMode === 'exploration';
  const finalEnd = endLocation ?? startLocation;

  const selected: Place[] = [];
  const visited = new Set<string>();
  let current = startLocation;
  let totalDistKm = 0;
  let categoryIndex = 0;
  const MAX_STOPS = 20;

  while (selected.length < MAX_STOPS && totalDistKm < maxAllowedKm) {
    const remainingBudgetKm = maxAllowedKm - totalDistKm;
    if (remainingBudgetKm < 0.15) break;

    const targetCategory = searchCategories[categoryIndex % searchCategories.length];
    categoryIndex++;

    const searchRadiusM = Math.max(
      400,
      Math.min(2500, Math.floor(remainingBudgetKm * 1000 * 0.5))
    );

    const batch = await findPlacesByGoogleType(current, targetCategory, searchRadiusM);

    const candidates: Place[] = [];
    for (const place of batch) {
      const key = placeKey(place);
      if (!visited.has(key)) {
        candidates.push(place);
      }
    }

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      const distA = getDistanceKm(current, a.coordinates);
      const distB = getDistanceKm(current, b.coordinates);
      if (Math.abs(distA - distB) < 0.05) {
        return (b.rating || 0) - (a.rating || 0);
      }
      return distA - distB;
    });

    let picked: Place | null = null;
    for (const candidate of candidates) {
      const legKm = getDistanceKm(current, candidate.coordinates);
      const returnKm = isCircular
        ? getDistanceKm(candidate.coordinates, startLocation)
        : getDistanceKm(candidate.coordinates, finalEnd);

      const fitsBudget = isCircular
        ? totalDistKm + legKm + returnKm <= maxAllowedKm
        : totalDistKm + legKm + returnKm <= maxAllowedKm;

      if (fitsBudget) {
        picked = candidate;
        break;
      }
    }

    if (!picked) continue;

    visited.add(placeKey(picked));
    totalDistKm += getDistanceKm(current, picked.coordinates);
    selected.push(picked);
    current = picked.coordinates;
  }

  return selected;
}

function placesToWaypoints(places: Place[]): RouteWaypoint[] {
  return places.map(wp => {
    const terrain = getTerrainInfo(wp.type);
    return {
      location: [wp.coordinates[1], wp.coordinates[0]] as [number, number],
      name: wp.name,
      type: wp.type as PoiCategory,
      address: wp.address,
      rating: wp.rating,
      userRatingsTotal: wp.userRatingsTotal,
      photoUrl: wp.photoUrl,
      externalId: wp.externalId,
      description: `Покриття: ${terrain.surfaceType} | Мальовничість: ${terrain.scenicScore}`,
      source: 'google' as const,
    };
  });
}

async function buildRouteWithTimeFill(
  userLocation: [number, number],
  options: RouteFilterOptions,
  endCoord: [number, number],
  initialPois: Place[]
): Promise<RouteResult> {
  const minTimeMinutes = options.targetTimeMinutes * 0.85;
  let pois = [...initialPois];
  let route: RouteResult | null = null;
  let attempts = 0;

  while (attempts < 6) {
    const waypointCoords = options.routeMode === 'exploration'
      ? pois.map(p => p.coordinates)
      : pois.map(p => p.coordinates);

    route = await buildRoute(userLocation, endCoord, waypointCoords);
    route.waypoints = placesToWaypoints(pois);
    route.locations = pois.map(wp => wp.name);

    if (route.estimatedTimeMinutes >= minTimeMinutes || pois.length >= 20) break;

    const extra = await findSequentialWaypoints(
      pois.length > 0 ? pois[pois.length - 1].coordinates : userLocation,
      {
        categories: options.categories,
        targetTimeMinutes: options.targetTimeMinutes - route.estimatedTimeMinutes,
        routeMode: options.routeMode,
        endLocation: endCoord,
      }
    );

    const existingKeys = new Set(pois.map(placeKey));
    const newOnes = extra.filter(p => !existingKeys.has(placeKey(p)));
    if (newOnes.length === 0) break;

    pois = [...pois, ...newOnes];
    attempts++;
  }

  return route!;
}

// ─── Новий метод: Генерація за фільтрами ────────────────────────────────────────

export async function resolveDestination(
  userLocation: [number, number],
  destination?: RouteDestination
): Promise<{ coords: [number, number]; name: string; address?: string } | null> {
  if (!destination) return null;

  if (destination.coords) {
    return {
      coords: destination.coords,
      name: destination.name || destination.address || 'Пункт призначення',
      address: destination.address,
    };
  }

  if (destination.address) {
    const geocoded = await geocodeAddress(destination.address);
    if (!geocoded) return null;
    return {
      coords: geocoded.coords,
      name: destination.name || geocoded.formattedAddress,
      address: geocoded.formattedAddress,
    };
  }

  return null;
}

export async function generateRouteByFilters(
  userLocation: [number, number],
  options: RouteFilterOptions
): Promise<RouteResult> {
  const { routeMode } = options;

  if (routeMode === 'point_to_point' && (!options.destination?.coords && !options.destination?.address)) {
    throw new Error('Для прямого маршруту вкажіть адресу або оберіть точку на карті.');
  }

  let endCoord: [number, number];
  let destinationPlace: Place | null = null;

  if (routeMode === 'exploration') {
    endCoord = userLocation;
  } else {
    const resolved = await resolveDestination(userLocation, options.destination);
    if (!resolved) {
      throw new Error('Не вдалося знайти вказану адресу. Перевірте правильність написання.');
    }
    endCoord = resolved.coords;
    destinationPlace = {
      name: resolved.name,
      coordinates: resolved.coords,
      type: 'custom',
      address: resolved.address,
      source: 'custom',
    };
  }

  const sequencedPois = await findSequentialWaypoints(userLocation, {
    categories: options.categories,
    targetTimeMinutes: options.targetTimeMinutes,
    routeMode,
    endLocation: endCoord,
  });

  if (sequencedPois.length === 0 && routeMode === 'exploration') {
    throw new Error(
      `Не знайдено місць обраних категорій за ~${options.targetTimeMinutes} хв прогулянки. Спробуйте інші категорії або збільште час.`
    );
  }

  if (sequencedPois.length === 0 && routeMode === 'point_to_point') {
    const directRoute = await buildRoute(userLocation, endCoord, []);
    if (destinationPlace) {
      directRoute.waypoints = [{
        location: [destinationPlace.coordinates[1], destinationPlace.coordinates[0]],
        name: destinationPlace.name,
        type: 'custom',
        address: destinationPlace.address,
        source: 'custom',
      }];
      directRoute.locations = [destinationPlace.name];
    }
    return directRoute;
  }

  const route = await buildRouteWithTimeFill(
    userLocation,
    options,
    endCoord,
    sequencedPois
  );

  if (destinationPlace) {
    route.waypoints.push({
      location: [destinationPlace.coordinates[1], destinationPlace.coordinates[0]],
      name: destinationPlace.name,
      type: 'custom',
      address: destinationPlace.address,
      source: 'custom',
    });
    route.locations.push(destinationPlace.name);
  }

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
    targetTimeMinutes?: number;
  }
): Promise<RouteResult> {
  const { types, targetTimeMinutes = 60 } = options;

  return generateRouteByFilters(userLocation, {
    routeMode: 'exploration',
    categories: types,
    targetTimeMinutes,
  });
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
      targetTimeMinutes: parsed.targetTimeMinutes ?? 60,
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
  targetTimeMinutes?: number;
  isExplorationMode?: boolean;
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

  let targetTimeMinutes: number | undefined;
  const timeMatch = text.match(/(\d+)\s*(хв|хвилин|min)/i);
  if (timeMatch?.[1]) {
    targetTimeMinutes = Math.max(15, Math.min(parseInt(timeMatch[1]), 240));
  }

  return { destinationType, destinationName, waypointTypes, waypointNames, isExplorationMode, targetTimeMinutes };
}