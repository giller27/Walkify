// Сервіс для пошуку місць та побудови маршрутів

import { loadGoogleMaps } from "./googleMapsLoader";
import type { RouteOptions } from "../types/routeEnhancements";

export interface Place {
  name: string;
  coordinates: [number, number]; // [lng, lat]
  type: string;
  address?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  description?: string;
  source?: PoiSource;
  externalId?: string;
}

export interface RoutePoint {
  coordinates: [number, number]; // [lng, lat]
  type: 'start' | 'waypoint' | 'end';
  name?: string;
}

export type PoiSource = 'google' | 'mapbox' | 'osm' | 'google_like' | 'custom';

export type PoiCategory =
  | 'cafe'
  | 'park'
  | 'shop'
  | 'restaurant'
  | 'museum'
  | 'library'
  | 'place_of_worship'
  | 'beach'
  | 'lake'
  | 'river'
  | 'custom';

export interface RouteWaypoint {
  location: [number, number]; // [lat, lng]
  name: string;
  type: PoiCategory;
  address?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  description?: string;
  source?: PoiSource;
}

export interface RouteResult {
  points: [number, number][]; // [lat, lng] для сумісності з існуючим кодом
  waypoints: RouteWaypoint[];
  distanceKm: number;
  estimatedTimeMinutes: number;
  locations: string[];
  options?: RouteOptions;
}

interface ParsedPrompt {
  poiKeywords: string[];
  isExploration: boolean;
}

/**
 * LLM PARSER MOCK: Заглушка для парсингу через AI (наприклад Gemini).
 * Очікує короткий промпт від користувача і повертає структуровані вимоги.
 */
async function parsePromptWithLLM(text: string): Promise<ParsedPrompt> {
  // TODO: Замінити на реальний виклик Gemini/OpenAI API у майбутньому
  const lowerText = text.toLowerCase();
  const isExploration = lowerText.includes('прогул') || lowerText.includes('walk') || lowerText.includes('around');
  
  const poiKeywords: string[] = [];
  if (lowerText.includes('кафе') || lowerText.includes('cafe') || lowerText.includes('coffee')) poiKeywords.push('cafe');
  if (lowerText.includes('парк') || lowerText.includes('park')) poiKeywords.push('park');
  if (lowerText.includes('музей') || lowerText.includes('museum')) poiKeywords.push('museum');
  if (lowerText.includes('магазин') || lowerText.includes('shop')) poiKeywords.push('store');

  if (poiKeywords.length === 0) poiKeywords.push('point of interest'); // fallback

  return {
    poiKeywords,
    isExploration
  };
}

export function parseRouteRequest(text: string) {
  // Stub to prevent UI crashes if this is still imported somewhere
  return {
    destinationType: null,
    destinationName: null,
    waypointTypes: [],
    waypointNames: [],
    isExplorationMode: true,
  };
}

/**
 * Пошук конкретної будівлі/місця за назвою через Google Places
 */
export async function findPlaceByName(
  placeName: string,
  userLocation: [number, number] // [lng, lat]
): Promise<Place | null> {
  const maps = await loadGoogleMaps(["places", "geometry"]);
  const dummyDiv = document.createElement('div');
  const placesService = new maps.places.PlacesService(dummyDiv);
  const loc = new maps.LatLng(userLocation[1], userLocation[0]);

  return new Promise((resolve) => {
    placesService.findPlaceFromQuery({
      query: placeName,
      fields: ['name', 'geometry', 'place_id', 'formatted_address'],
      locationBias: { radius: 50000, center: loc }
    }, (results: any, status: any) => {
      if (status === maps.places.PlacesServiceStatus.OK && results && results[0]) {
        const place = results[0];
        resolve({
          name: place.name || placeName,
          coordinates: [place.geometry.location.lng(), place.geometry.location.lat()],
          type: 'custom',
          address: place.formatted_address,
          source: 'google'
        });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Пошук найближчого місця за типом через Google Places API
 */
export async function findNearestPlace(
  userLocation: [number, number], // [lng, lat]
  placeType: string,
  radius: number = 5000 // радіус пошуку в метрах
): Promise<Place | null> {
  const maps = await loadGoogleMaps(["places", "geometry"]);
  const dummyDiv = document.createElement('div');
  const placesService = new maps.places.PlacesService(dummyDiv);
  const loc = new maps.LatLng(userLocation[1], userLocation[0]);

  return new Promise((resolve) => {
    placesService.nearbySearch({
      location: loc,
      radius: radius,
      keyword: placeType
    }, (results: any, status: any) => {
      if (status === maps.places.PlacesServiceStatus.OK && results && results[0]) {
        const place = results[0];
        resolve({
          name: place.name || placeType,
          coordinates: [place.geometry.location.lng(), place.geometry.location.lat()],
          type: placeType,
          address: place.vicinity,
          source: 'google'
        });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Пошук проміжної точки на маршруті
 */
export async function findWaypointOnRoute(
  start: [number, number], // [lng, lat]
  end: [number, number], // [lng, lat]
  waypointType: string
): Promise<Place | null> {
  const midLng = (start[0] + end[0]) / 2;
  const midLat = (start[1] + end[1]) / 2;
  return await findNearestPlace([midLng, midLat], waypointType, 2000);
}

/**
 * Фільтрує POI за різноманітністю типів
 */
function filterPoisByDiversity(pois: RouteWaypoint[]): RouteWaypoint[] {
  if (pois.length <= 6) return pois;

  const typeGroups: Record<string, RouteWaypoint[]> = {};

  for (const poi of pois) {
    const type = poi.type || 'custom';
    if (!typeGroups[type]) {
      typeGroups[type] = [];
    }
    typeGroups[type].push(poi);
  }

  Object.values(typeGroups).forEach(group => {
    group.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  });

  const result: RouteWaypoint[] = [];
  const maxPerType = 2;

  const types = Object.keys(typeGroups).sort(
    (a, b) => (typeGroups[b][0].rating || 0) - (typeGroups[a][0].rating || 0)
  );

  for (const type of types) {
    result.push(...typeGroups[type].slice(0, maxPerType));
    if (result.length >= 8) break;
  }

  return result.slice(0, 8);
}

/**
 * Сортує POI за якістю (рейтинг, кількість відгуків)
 */
function rankPoisByQuality(pois: RouteWaypoint[]): RouteWaypoint[] {
  return [...pois].sort((a, b) => {
    const scoreA =
      (a.rating || 3) * 0.7 + Math.min((a.userRatingsTotal || 0) / 100, 1) * 0.3;
    const scoreB =
      (b.rating || 3) * 0.7 + Math.min((b.userRatingsTotal || 0) / 100, 1) * 0.3;
    return scoreB - scoreA;
  });
}

interface PoiSearchSpec {
  type?: string;
  keyword?: string;
  category: PoiCategory;
}

const KEYWORD_TO_SEARCH: Record<string, PoiSearchSpec> = {
  cafe: { type: 'cafe', category: 'cafe' },
  coffee: { type: 'cafe', keyword: 'coffee', category: 'cafe' },
  park: { type: 'park', category: 'park' },
  museum: { type: 'museum', category: 'museum' },
  shop: { type: 'store', category: 'shop' },
  store: { type: 'store', category: 'shop' },
  restaurant: { type: 'restaurant', category: 'restaurant' },
  library: { type: 'library', category: 'library' },
  church: { type: 'church', category: 'place_of_worship' },
  beach: { keyword: 'beach', category: 'beach' },
  lake: { keyword: 'lake', category: 'lake' },
  river: { keyword: 'river', category: 'river' },
  landmark: { keyword: 'landmark', category: 'custom' },
  attraction: { keyword: 'tourist attraction', category: 'custom' },
  viewpoint: { keyword: 'viewpoint', category: 'custom' },
  'point of interest': { keyword: 'point of interest', category: 'custom' },
  'natural_feature': { keyword: 'natural feature', category: 'custom' },
};

const FALLBACK_SEARCHES: PoiSearchSpec[] = [
  { type: 'park', category: 'park' },
  { type: 'cafe', category: 'cafe' },
  { keyword: 'landmark', category: 'custom' },
  { keyword: 'tourist attraction', category: 'custom' },
];

const GOOGLE_TYPE_TO_CATEGORY: Record<string, PoiCategory> = {
  cafe: 'cafe',
  park: 'park',
  museum: 'museum',
  store: 'shop',
  shopping_mall: 'shop',
  restaurant: 'restaurant',
  library: 'library',
  church: 'place_of_worship',
  place_of_worship: 'place_of_worship',
  natural_feature: 'custom',
  tourist_attraction: 'custom',
  point_of_interest: 'custom',
};

function resolvePoiCategory(
  googleTypes: string[] | undefined,
  fallback: PoiCategory
): PoiCategory {
  if (!googleTypes) return fallback;
  for (const t of googleTypes) {
    if (GOOGLE_TYPE_TO_CATEGORY[t]) {
      return GOOGLE_TYPE_TO_CATEGORY[t];
    }
  }
  return fallback;
}

function passesRatingFilter(rating: number | undefined): boolean {
  if (rating === undefined) return true;
  return rating >= 3.5;
}

function buildSearchSpecs(keywords: string[]): PoiSearchSpec[] {
  const specs: PoiSearchSpec[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    const normalized = keyword.toLowerCase().trim();
    const spec = KEYWORD_TO_SEARCH[normalized];
    const key = spec?.type || spec?.keyword || normalized;
    if (!seen.has(key)) {
      seen.add(key);
      specs.push(spec || { keyword: normalized, category: 'custom' });
    }
  }

  for (const fallback of FALLBACK_SEARCHES) {
    const key = fallback.type || fallback.keyword || '';
    if (!seen.has(key)) {
      seen.add(key);
      specs.push(fallback);
    }
  }

  return specs;
}

/**
 * Пошук кількох POI навколо заданого центру через Google Places з мультитиповим пошуком
 */
export async function searchComprehensivePois(
  center: [number, number],
  keywords: string[],
  radiusMeters: number = 3000
): Promise<RouteWaypoint[]> {
  const maps = await loadGoogleMaps(["places", "geometry"]);
  const dummyDiv = document.createElement('div');
  const placesService = new maps.places.PlacesService(dummyDiv);
  const centerLatLng = new maps.LatLng(center[1], center[0]);

  const searchSpecs = buildSearchSpecs(keywords);

  const searchOne = (spec: PoiSearchSpec): Promise<any[]> =>
    new Promise((resolve) => {
      const request: Record<string, unknown> = {
        location: centerLatLng,
        radius: radiusMeters,
      };
      if (spec.type) request.type = spec.type;
      if (spec.keyword) request.keyword = spec.keyword;

      placesService.nearbySearch(request as any, (results: any, status: any) => {
        if (status === maps.places.PlacesServiceStatus.OK && results) {
          resolve(results);
        } else {
          resolve([]);
        }
      });
    });

  const resultSets = await Promise.all(searchSpecs.map(searchOne));

  const allPois: RouteWaypoint[] = [];
  const seenPlaceIds = new Set<string>();

  resultSets.forEach((places, specIndex) => {
    const spec = searchSpecs[specIndex];
    for (const place of places) {
      const placeId = place.place_id;
      if (!placeId || seenPlaceIds.has(placeId)) continue;
      if (!passesRatingFilter(place.rating)) continue;

      seenPlaceIds.add(placeId);
      allPois.push({
        location: [place.geometry.location.lat(), place.geometry.location.lng()],
        name: place.name,
        type: resolvePoiCategory(place.types, spec.category),
        address: place.vicinity,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        source: 'google',
      });
    }
  });

  const ranked = rankPoisByQuality(allPois);
  return filterPoisByDiversity(ranked);
}

/**
 * Збагачує POI додатковими даними (рейтинг, фото тощо).
 */
export async function enrichPoiDetails(poi: Place): Promise<Place> {
  return poi;
}

/**
 * Побудова маршруту через Google Maps Directions API
 */
export async function buildRoute(
  userLocation: [number, number], // [lng, lat]
  destination: [number, number], // [lng, lat]
  waypoints: [number, number][] = [],
  options?: { optimizeWaypoints?: boolean }
): Promise<RouteResult> {
  const maps = await loadGoogleMaps(["places"]);
  const directionsService = new maps.DirectionsService();

  const originLatLng = new maps.LatLng(userLocation[1], userLocation[0]);
  const destLatLng = new maps.LatLng(destination[1], destination[0]);
  
  const mappedWaypoints = waypoints.map(wp => ({
    location: new maps.LatLng(wp[1], wp[0]),
    stopover: true
  }));

  const response = await directionsService.route({
    origin: originLatLng,
    destination: destLatLng,
    waypoints: mappedWaypoints,
    travelMode: maps.TravelMode.WALKING,
    optimizeWaypoints: options?.optimizeWaypoints ?? false,
  });

  if (!response.routes || response.routes.length === 0) {
    throw new Error("Не вдалося побудувати маршрут.");
  }

  const route = response.routes[0];
  let distanceMeters = 0;
  let timeSeconds = 0;
  
  route.legs.forEach((leg: any) => {
    distanceMeters += leg.distance?.value || 0;
    timeSeconds += leg.duration?.value || 0;
  });

  const points = route.overview_path.map((p: any) => [p.lat(), p.lng()] as [number, number]);

  const waypointsWithNames = waypoints.map((wp, index) => ({
    location: [wp[1], wp[0]] as [number, number],
    name: `Проміжна точка ${index + 1}`,
    type: 'custom' as PoiCategory,
  }));

  return {
    points,
    waypoints: waypointsWithNames,
    distanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
    estimatedTimeMinutes: Math.round(timeSeconds / 60),
    locations: []
  };
}

/**
 * Генерує прогулянковий маршрут з кількома POI навколо користувача.
 */
export async function generateExplorationRoute(
  userLocation: [number, number], // [lng, lat]
  options: {
    types: string[];
    desiredPoiCount?: number;
    targetDistanceKm?: number;
  }
): Promise<RouteResult> {
  const { types, desiredPoiCount = 6, targetDistanceKm } = options;

  const effectiveTypes = types.length > 0 ? types : ['park', 'cafe', 'museum'];
  const allPois = await searchComprehensivePois(userLocation, effectiveTypes, 3000);

  if (allPois.length === 0) throw new Error('Поруч не вдалося знайти цікаві місця.');

  const { selectBestWaypoints, sequenceWaypoints, validateRoute } = await import('./waypointOptimizer');

  const selectedPois = await selectBestWaypoints(
    allPois,
    Math.min(desiredPoiCount, allPois.length),
    userLocation,
    userLocation
  );

  const sequencedPois = await sequenceWaypoints(selectedPois, userLocation, userLocation);

  const validation = validateRoute(sequencedPois, userLocation, userLocation);
  if (!validation.valid) {
    console.warn('Route validation issues:', validation.issues);
  }

  const route = await buildRoute(
    userLocation,
    userLocation,
    sequencedPois.map(wp => [wp.location[1], wp.location[0]]),
    { optimizeWaypoints: false }
  );
  route.waypoints = sequencedPois;
  route.locations = sequencedPois.map(wp => wp.name);

  const { enrichRouteWithAdvancedOptions } = await import('./routeOptions');
  route.options = await enrichRouteWithAdvancedOptions(route);
  return route;
}

/**
 * Основна функція для створення маршруту на основі короткого текстового запиту користувача
 */
export async function generateRouteFromText(
  userLocation: [number, number], // [lng, lat]
  text: string,
  options?: { routeMode?: "point_to_point" | "exploration" }
): Promise<RouteResult> {
  const parsed = await parsePromptWithLLM(text);

  if (parsed.isExploration || options?.routeMode === "exploration") {
    return generateExplorationRoute(userLocation, {
       types: parsed.poiKeywords,
    });
  }

  // Будуємо Point to Point маршрут
  const allPois = await searchComprehensivePois(userLocation, parsed.poiKeywords, 3000);
  if (allPois.length === 0) throw new Error("Не вдалося знайти відповідні місця для вашого запиту.");

  const { selectBestWaypoints, sequenceWaypoints, validateRoute } = await import('./waypointOptimizer');

  const selectedPois = await selectBestWaypoints(
    allPois,
    Math.min(allPois.length, 5),
    userLocation,
    allPois[0]?.location ? [allPois[0].location[1], allPois[0].location[0]] : userLocation
  );

  if (selectedPois.length === 0) throw new Error("Не вдалося знайти відповідні місця для вашого запиту.");

  const destinationCoords = [selectedPois[selectedPois.length - 1].location[1], selectedPois[selectedPois.length - 1].location[0]] as [number, number];
  const intermediateWaypoints = selectedPois.slice(0, -1);

  const sequencedWaypoints = await sequenceWaypoints(intermediateWaypoints, userLocation, destinationCoords);

  const validation = validateRoute(sequencedWaypoints, userLocation, destinationCoords);
  if (!validation.valid) {
    console.warn('Route validation issues:', validation.issues);
  }

  const route = await buildRoute(
    userLocation,
    destinationCoords,
    sequencedWaypoints.map(wp => [wp.location[1], wp.location[0]]),
    { optimizeWaypoints: false }
  );
  route.waypoints = [...sequencedWaypoints, selectedPois[selectedPois.length - 1]];
  route.locations = route.waypoints.map(w => w.name);

  const { enrichRouteWithAdvancedOptions } = await import('./routeOptions');
  route.options = await enrichRouteWithAdvancedOptions(route);
  return route;
}
