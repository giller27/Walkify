// Сервіс для пошуку місць та побудови маршрутів

import { loadGoogleMaps } from "./googleMapsLoader";

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
 * Пошук кількох POI навколо заданого центру через Google Places
 */
export async function searchNearbyPois(
  center: [number, number], // [lng, lat]
  keywords: string[],
  radiusMeters: number = 3000
): Promise<RouteWaypoint[]> {
  const maps = await loadGoogleMaps(["places", "geometry"]);
  const dummyDiv = document.createElement('div');
  const placesService = new maps.places.PlacesService(dummyDiv);
  const centerLatLng = new maps.LatLng(center[1], center[0]);

  const foundPois: RouteWaypoint[] = [];

  for (const keyword of keywords) {
    const request = {
      location: centerLatLng,
      radius: radiusMeters,
      keyword: keyword
    };

    const places = await new Promise<any[]>((resolve) => {
      placesService.nearbySearch(request, (results: any, status: any) => {
        if (status === maps.places.PlacesServiceStatus.OK && results) {
          resolve(results);
        } else {
          resolve([]);
        }
      });
    });

    if (places.length > 0) {
      const place = places[0];
      foundPois.push({
        location: [place.geometry.location.lat(), place.geometry.location.lng()],
        name: place.name,
        type: 'custom',
        address: place.vicinity,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        source: 'google'
      });
    }
  }

  return foundPois;
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
  waypoints: [number, number][] = [] 
): Promise<RouteResult> {
  const maps = await loadGoogleMaps(["directions", "geometry"]);
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
    optimizeWaypoints: true
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
  const waypoints = await searchNearbyPois(userLocation, effectiveTypes, 3000);
  const selected = waypoints.slice(0, Math.max(2, Math.min(desiredPoiCount, waypoints.length)));

  if (selected.length === 0) throw new Error('Поруч не вдалося знайти цікаві місця.');

  const route = await buildRoute(userLocation, userLocation, selected.map(wp => [wp.location[1], wp.location[0]]));
  route.waypoints = selected;
  route.locations = selected.map(wp => wp.name);
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
  const waypoints = await searchNearbyPois(userLocation, parsed.poiKeywords, 3000);
  if (waypoints.length === 0) throw new Error("Не вдалося знайти відповідні місця для вашого запиту.");

  const destinationCoords = [waypoints[waypoints.length - 1].location[1], waypoints[waypoints.length - 1].location[0]] as [number, number];
  const intermediateWaypoints = waypoints.slice(0, -1);

  const route = await buildRoute(userLocation, destinationCoords, intermediateWaypoints.map(wp => [wp.location[1], wp.location[0]]));
  route.waypoints = waypoints;
  route.locations = waypoints.map(w => w.name);
  return route;
}
