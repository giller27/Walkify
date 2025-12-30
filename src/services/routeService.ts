// Сервіс для пошуку місць та побудови маршрутів

const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsbGV5cy1jb21ldCIsImEiOiJjbWpzcmc0dzQ0NHZ1M2dxeDRyOTFtNHFxIn0.gCWJwF521jdHqD38Nn8ZsA";

export interface Place {
  name: string;
  coordinates: [number, number]; // [lng, lat]
  type: string;
  address?: string;
}

export interface RoutePoint {
  coordinates: [number, number]; // [lng, lat]
  type: 'start' | 'waypoint' | 'end';
  name?: string;
}

export interface RouteResult {
  points: [number, number][]; // [lat, lng] для сумісності з існуючим кодом
  waypoints: {
    location: [number, number]; // [lat, lng]
    name: string;
    type: 'cafe' | 'park' | 'shop' | 'custom';
  }[];
  distanceKm: number;
  estimatedTimeMinutes: number;
  locations: string[];
}

// Мапінг типів місць для пошуку
const PLACE_TYPE_MAPPING: Record<string, string> = {
  'парк': 'park',
  'кав\'ярня': 'cafe',
  'кав\'ярні': 'cafe',
  'кафе': 'cafe',
  'ресторан': 'restaurant',
  'магазин': 'shop',
  'музей': 'museum',
  'бібліотека': 'library',
  'церква': 'place_of_worship',
  'храм': 'place_of_worship',
  'пляж': 'beach',
  'озеро': 'lake',
  'річка': 'river',
};

// Мапінг типів для Mapbox
const MAPBOX_CATEGORY_MAPPING: Record<string, string> = {
  'park': 'park',
  'cafe': 'cafe',
  'restaurant': 'restaurant',
  'shop': 'shop',
  'museum': 'museum',
  'library': 'library',
  'place_of_worship': 'place_of_worship',
  'beach': 'beach',
  'lake': 'lake',
  'river': 'river',
};

/**
 * Парсить текстовий запит і витягує типи місць
 */
export function parseRouteRequest(text: string): {
  destinationType: string | null;
  waypointTypes: string[];
} {
  const lowerText = text.toLowerCase();
  let destinationType: string | null = null;
  const waypointTypes: string[] = [];

  // Шукаємо ключові слова для пункту призначення (прогулянка до парку, до кав'ярні, тощо)
  const destinationPatterns = [
    /до\s+(\w+)/g,
    /прогулянка\s+до\s+(\w+)/g,
    /маршрут\s+до\s+(\w+)/g,
  ];

  for (const pattern of destinationPatterns) {
    const matches = lowerText.matchAll(pattern);
    for (const match of matches) {
      const word = match[1];
      for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
        if (word.includes(key) || key.includes(word)) {
          if (!destinationType) {
            destinationType = value;
            break;
          }
        }
      }
    }
  }

  // Якщо не знайдено через патерни, шукаємо просто за ключовими словами
  if (!destinationType) {
    for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
      if (lowerText.includes(key) && !lowerText.includes(`з ${key}`) && !lowerText.includes(`через ${key}`)) {
        destinationType = value;
        break;
      }
    }
  }

  // Шукаємо ключові слова для проміжних точок (з, через, з кав'ярнею)
  const waypointPatterns = [
    /з\s+(\w+)/g,
    /через\s+(\w+)/g,
    /з\s+кав['\u2019]?ярнею/g,
    /з\s+кафе/g,
    /з\s+парком/g,
    /з\s+магазином/g,
  ];

  for (const pattern of waypointPatterns) {
    const matches = lowerText.matchAll(pattern);
    for (const match of matches) {
      const word = match[1] || match[0];
      for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
        if (word.includes(key) || key.includes(word) || 
            (word.includes('кав') && value === 'cafe') ||
            (word.includes('парк') && value === 'park') ||
            (word.includes('магазин') && value === 'shop')) {
          if (value !== destinationType && !waypointTypes.includes(value)) {
            waypointTypes.push(value);
          }
        }
      }
    }
  }

  // Додаткова перевірка для явних згадок
  for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
    if (lowerText.includes(`з ${key}`) || lowerText.includes(`через ${key}`)) {
      if (value !== destinationType && !waypointTypes.includes(value)) {
        waypointTypes.push(value);
      }
    }
  }

  return { destinationType, waypointTypes };
}

/**
 * Пошук найближчого місця за типом
 */
export async function findNearestPlace(
  userLocation: [number, number], // [lng, lat]
  placeType: string,
  radius: number = 5000 // радіус пошуку в метрах
): Promise<Place | null> {
  try {
    const category = MAPBOX_CATEGORY_MAPPING[placeType] || placeType;
    
    // Спочатку спробуємо через OpenStreetMap Nominatim (безкоштовний і краще для пошуку місць)
    const nominatimQuery = getNominatimQuery(category);
    if (nominatimQuery) {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(nominatimQuery)}&` +
        `format=json&` +
        `limit=10&` +
        `bounded=1&` +
        `viewbox=${userLocation[0] - 0.1},${userLocation[1] - 0.1},${userLocation[0] + 0.1},${userLocation[1] + 0.1}&` +
        `addressdetails=1`;
      
      try {
        const nominatimResponse = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'WalkifyApp/1.0'
          }
        });
        
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json();
          
          if (nominatimData && nominatimData.length > 0) {
            // Обчислюємо відстань до кожного місця і вибираємо найближче
            let nearestPlace: Place | null = null;
            let minDistance = Infinity;

            for (const item of nominatimData) {
              const lng = parseFloat(item.lon);
              const lat = parseFloat(item.lat);
              const distance = calculateDistance(
                userLocation[1], userLocation[0],
                lat, lng
              );

              if (distance < minDistance && distance <= radius / 1000) {
                minDistance = distance;
                nearestPlace = {
                  name: item.display_name.split(',')[0] || item.name || 'Місце',
                  coordinates: [lng, lat],
                  type: category,
                  address: item.display_name,
                };
              }
            }

            if (nearestPlace) {
              return nearestPlace;
            }
          }
        }
      } catch (nominatimError) {
        console.log('Nominatim search failed, trying Mapbox...', nominatimError);
      }
    }

    // Якщо Nominatim не спрацював, використовуємо Mapbox Geocoding API
    const query = category === 'park' ? 'park' : category;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `proximity=${userLocation[0]},${userLocation[1]}&` +
      `limit=10&` +
      `access_token=${MAPBOX_TOKEN}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to search places');
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return null;
    }

    // Фільтруємо за типом, якщо можливо
    let features = data.features;
    if (category !== 'park') {
      features = features.filter((feature: any) => {
        const categories = feature.properties?.category || [];
        const placeType = feature.properties?.place_type?.[0] || '';
        return categories.some((cat: string) => 
          cat.toLowerCase().includes(category.toLowerCase())
        ) || placeType.toLowerCase().includes(category.toLowerCase());
      });
    }

    if (features.length === 0) {
      return null;
    }

    // Обчислюємо відстань до кожного місця і вибираємо найближче
    let nearestPlace: Place | null = null;
    let minDistance = Infinity;

    for (const feature of features) {
      const [lng, lat] = feature.center as [number, number];
      const distance = calculateDistance(
        userLocation[1], userLocation[0],
        lat, lng
      );

      if (distance < minDistance && distance <= radius / 1000) {
        minDistance = distance;
        nearestPlace = {
          name: feature.text || feature.place_name || 'Місце',
          coordinates: [lng, lat],
          type: category,
          address: feature.place_name,
        };
      }
    }

    return nearestPlace;
  } catch (error) {
    console.error('Error finding nearest place:', error);
    return null;
  }
}

/**
 * Отримує запит для Nominatim на основі типу місця
 */
function getNominatimQuery(category: string): string | null {
  const queries: Record<string, string> = {
    'park': 'park',
    'cafe': 'cafe',
    'restaurant': 'restaurant',
    'shop': 'shop',
    'museum': 'museum',
    'library': 'library',
    'place_of_worship': 'church',
    'beach': 'beach',
    'lake': 'lake',
    'river': 'river',
  };
  
  return queries[category] || null;
}

/**
 * Пошук проміжної точки на маршруті
 */
export async function findWaypointOnRoute(
  start: [number, number], // [lng, lat]
  end: [number, number], // [lng, lat]
  waypointType: string
): Promise<Place | null> {
  try {
    // Обчислюємо середню точку маршруту
    const midLng = (start[0] + end[0]) / 2;
    const midLat = (start[1] + end[1]) / 2;

    // Шукаємо місце поблизу середньої точки
    return await findNearestPlace([midLng, midLat], waypointType, 2000);
  } catch (error) {
    console.error('Error finding waypoint:', error);
    return null;
  }
}

/**
 * Побудова маршруту через Mapbox Directions API
 */
export async function buildRoute(
  userLocation: [number, number], // [lng, lat]
  destination: [number, number], // [lng, lat]
  waypoints: [number, number][] = [] // [lng, lat]
): Promise<RouteResult> {
  try {
    // Формуємо URL для Directions API
    let coordinates: [number, number][] = [userLocation, ...waypoints, destination];
    
    // Mapbox Directions API приймає координати у форматі lng,lat
    const coordinatesStr = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesStr}?` +
      `geometries=geojson&` +
      `steps=true&` +
      `overview=full&` +
      `access_token=${MAPBOX_TOKEN}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to build route: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = data.routes[0];
    const geometry = route.geometry;
    
    // Конвертуємо координати з [lng, lat] в [lat, lng] для сумісності
    const points: [number, number][] = geometry.coordinates.map((coord: [number, number]) => 
      [coord[1], coord[0]] // [lat, lng]
    );

    // Обчислюємо відстань та час
    const distanceKm = route.distance / 1000; // конвертуємо метри в кілометри
    const estimatedTimeMinutes = Math.round(route.duration / 60); // конвертуємо секунди в хвилини

    // Формуємо waypoints з назвами
    const waypointsWithNames = waypoints.map((wp, index) => ({
      location: [wp[1], wp[0]] as [number, number], // [lat, lng]
      name: `Проміжна точка ${index + 1}`,
      type: 'custom' as const,
    }));

    return {
      points,
      waypoints: waypointsWithNames,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      estimatedTimeMinutes,
      locations: [],
    };
  } catch (error) {
    console.error('Error building route:', error);
    throw error;
  }
}

/**
 * Генерація маршруту на основі текстового запиту
 */
export async function generateRouteFromText(
  userLocation: [number, number], // [lng, lat]
  text: string
): Promise<RouteResult> {
  const { destinationType, waypointTypes } = parseRouteRequest(text);

  if (!destinationType) {
    throw new Error('Не вдалося визначити пункт призначення. Спробуйте "прогулянка до парку" або подібне.');
  }

  // Знаходимо пункт призначення
  const destination = await findNearestPlace(userLocation, destinationType);
  if (!destination) {
    throw new Error(`Не вдалося знайти ${destinationType} поблизу вас.`);
  }

  // Знаходимо проміжні точки
  const waypoints: [number, number][] = [];
  const waypointPlaces: Place[] = [];

  for (const waypointType of waypointTypes) {
    const waypoint = await findWaypointOnRoute(
      userLocation,
      destination.coordinates,
      waypointType
    );
    if (waypoint) {
      waypoints.push(waypoint.coordinates);
      waypointPlaces.push(waypoint);
    }
  }

  // Будуємо маршрут
  const route = await buildRoute(userLocation, destination.coordinates, waypoints);

  // Додаємо інформацію про локації
  route.locations = [
    destination.name,
    ...waypointPlaces.map(wp => wp.name),
  ];

  // Оновлюємо waypoints з правильними назвами та типами
  route.waypoints = waypointPlaces.map((wp, index) => ({
    location: [wp.coordinates[1], wp.coordinates[0]] as [number, number], // [lat, lng]
    name: wp.name,
    type: (wp.type === 'cafe' ? 'cafe' : 
           wp.type === 'park' ? 'park' : 
           wp.type === 'shop' ? 'shop' : 'custom') as 'cafe' | 'park' | 'shop' | 'custom',
  }));

  return route;
}

/**
 * Обчислення відстані між двома точками (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Радіус Землі в кілометрах
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

