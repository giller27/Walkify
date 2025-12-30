// src/Components/RouteMap.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, Popup, Source, Layer } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useAuth } from "../context/AuthContext";
import * as supabaseModules from "../services/supabaseService";
import type { MapRef } from "react-map-gl";

const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsbGV5cy1jb21ldCIsImEiOiJjbWpzcmc0dzQ0NHZ1M2dxeDRyOTFtNHFxIn0.gCWJwF521jdHqD38Nn8ZsA";

type LatLngTuple = [number, number];

// ================= Mapbox Geocoding API =================
/**
 * Пошук місць через Mapbox Geocoding API
 * @param query - назва місця або адреса
 * @param proximity - координати для пошуку поблизу (опціонально)
 * @returns координати місця [lat, lng] або null
 */
const geocodeWithMapbox = async (
  query: string,
  proximity?: LatLngTuple
): Promise<LatLngTuple | null> => {
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      limit: "1",
      types: "poi,address,place",
    });

    if (proximity) {
      // Mapbox очікує [lng, lat] для proximity
      params.append("proximity", `${proximity[1]},${proximity[0]}`);
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Mapbox Geocoding error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return [lat, lng];
    }

    return null;
  } catch (error) {
    console.error("Mapbox Geocoding error:", error);
    return null;
  }
};

/**
 * Пошук POI (Points of Interest) поблизу через Mapbox Geocoding API
 * @param center - центр пошуку [lat, lng]
 * @param category - категорія POI (cafe, park, shop, restaurant, museum, etc.)
 * @param radius - радіус пошуку в метрах
 * @returns масив координат знайдених місць
 */
const searchPOIWithMapbox = async (
  center: LatLngTuple,
  category: string,
  radius: number = 2000
): Promise<LatLngTuple[]> => {
  try {
    const [lat, lng] = center;
    
    // Mapbox категорії POI
    const categoryMap: Record<string, string> = {
      cafe: "cafe",
      кафе: "cafe",
      coffee: "cafe",
      park: "park",
      парк: "park",
      shop: "shop",
      магазин: "shop",
      supermarket: "shop",
      супермаркет: "shop",
      restaurant: "restaurant",
      ресторан: "restaurant",
      museum: "museum",
      музей: "museum",
      church: "place_of_worship",
      церква: "place_of_worship",
      храм: "place_of_worship",
    };

    const mapboxCategory = categoryMap[category.toLowerCase()] || category;

    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      limit: "10",
      proximity: `${lng},${lat}`,
      types: "poi",
      radius: radius.toString(),
    });

    // Пошук за категорією
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(mapboxCategory)}.json?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Mapbox POI search error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      return data.features.map((feature: any) => {
        const [lng, lat] = feature.center;
        return [lat, lng] as LatLngTuple;
      });
    }

    return [];
  } catch (error) {
    console.error("Mapbox POI search error:", error);
    return [];
  }
};

// ================= Mapbox Directions API =================
/**
 * Отримати маршрут через Mapbox Directions API
 * @param coordinates - масив координат [lng, lat] для Mapbox
 * @param options - опції маршруту
 */
const getRouteFromMapbox = async (
  coordinates: number[][],
  options?: {
    alternatives?: boolean;
    steps?: boolean;
    overview?: "full" | "simplified" | "false";
    maxDistance?: number;
  }
): Promise<GeoJSON.FeatureCollection | null> => {
  try {
    if (!coordinates || coordinates.length < 2) {
      console.warn("Need at least 2 coordinates for routing");
      return null;
    }

    const coordsString = coordinates.map((c) => `${c[0]},${c[1]}`).join(";");
    
    const params = new URLSearchParams({
      geometries: "geojson",
      access_token: MAPBOX_TOKEN,
      steps: options?.steps ? "true" : "false",
      overview: options?.overview || "full",
      alternatives: options?.alternatives !== false ? "true" : "false",
    });

    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordsString}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const txt = await response.text();
      let errorMessage = `Mapbox Directions API error: ${response.status}`;
      
      if (response.status === 422) {
        errorMessage = "Неможливо побудувати маршрут між вказаними точками. Спробуйте інші місця.";
      } else if (response.status === 429) {
        errorMessage = "Перевищено ліміт запитів до Mapbox API. Спробуйте пізніше.";
      } else if (response.status >= 500) {
        errorMessage = "Помилка сервера Mapbox. Спробуйте пізніше.";
      }
      
      console.error(errorMessage, txt);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data || !data.routes || data.routes.length === 0) {
      console.warn("Mapbox returned no routes", data);
      return null;
    }

    // Фільтрація за максимальною відстанню
    let validRoutes = data.routes;
    if (options?.maxDistance) {
      validRoutes = data.routes.filter(
        (route: any) => route.distance <= options.maxDistance!
      );
      
      if (validRoutes.length === 0 && data.routes.length > 0) {
        console.warn(`No routes within ${options.maxDistance}m, using closest route`);
        validRoutes = [
          data.routes.reduce((closest: any, current: any) => {
            const closestDiff = Math.abs(closest.distance - options.maxDistance!);
            const currentDiff = Math.abs(current.distance - options.maxDistance!);
            return currentDiff < closestDiff ? current : closest;
          }, data.routes[0])
        ];
      }
    }

    if (validRoutes.length === 0) {
      console.warn("No valid routes found");
      return null;
    }

    // Вибір найкращого маршруту (найкоротший)
    const bestRoute = validRoutes.reduce((best: any, current: any) => {
      return current.distance < best.distance ? current : best;
    }, validRoutes[0]);

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: bestRoute.geometry,
          properties: {
            distance: bestRoute.distance,
            duration: bestRoute.duration,
            distanceKm: (bestRoute.distance / 1000).toFixed(2),
            durationMinutes: Math.round(bestRoute.duration / 60),
          },
        },
      ],
    };
  } catch (error) {
    console.error("Mapbox Directions error:", error);
    return null;
  }
};

/**
 * Оптимізація порядку відвідування точок (найближчий сусід)
 * @param start - стартова точка [lat, lng]
 * @param points - масив точок для відвідування [lat, lng][]
 * @returns оптимізований порядок точок
 */
const optimizeRouteOrder = (
  start: LatLngTuple,
  points: LatLngTuple[]
): LatLngTuple[] => {
  if (points.length === 0) return [];
  if (points.length === 1) return points;

  const visited = new Set<number>();
  const optimized: LatLngTuple[] = [];
  let current = start;

  while (visited.size < points.length) {
    let closestIdx = -1;
    let closestDist = Infinity;

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;
      
      const dist = calculateDistance(current, points[i]);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    if (closestIdx === -1) break;

    optimized.push(points[closestIdx]);
    visited.add(closestIdx);
    current = points[closestIdx];
  }

  return optimized;
};

/**
 * Розрахунок відстані між двома точками (Haversine формула)
 */
const calculateDistance = (
  point1: LatLngTuple,
  point2: LatLngTuple
): number => {
  const R = 6371; // Радіус Землі в км
  const dLat = ((point2[0] - point1[0]) * Math.PI) / 180;
  const dLon = ((point2[1] - point1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1[0] * Math.PI) / 180) *
      Math.cos((point2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ================= Geolocation Control Component =================
const GeolocationControl = ({
  onLocationUpdate,
  onHeadingUpdate,
  onRequestGeolocationRef,
  mapRef,
}: {
  onLocationUpdate: (lat: number, lng: number) => void;
  onHeadingUpdate: (heading: number) => void;
  onRequestGeolocationRef?: React.MutableRefObject<(() => void) | null>;
  mapRef: React.RefObject<MapRef>;
}) => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const orientationHandlerRef = useRef<
    ((event: DeviceOrientationEvent) => void) | null
  >(null);

  const startGeolocation = () => {
    if (!navigator.geolocation) {
      setError("Геолокація не підтримується вашим браузером");
      setTimeout(() => setError(null), 5000);
      return;
    }

    setIsActive(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        onLocationUpdate(latitude, longitude);

        if (heading !== null && heading !== undefined && !isNaN(heading)) {
          onHeadingUpdate(heading);
        }

        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [longitude, latitude],
            zoom: mapRef.current.getZoom(),
          });
        }
        setError(null);
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMessage = "Помилка отримання геолокації";

        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Геолокація заборонена в налаштуваннях браузера";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Позиція недоступна";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Час очікування геолокації закінчився";
        }

        setError(errorMessage);
        setIsActive(false);
        setTimeout(() => setError(null), 5000);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    if (window.DeviceOrientationEvent) {
      const handleOrientation = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null && event.alpha !== undefined) {
          onHeadingUpdate(event.alpha);
        }
      };

      orientationHandlerRef.current = handleOrientation;

      if (
        typeof (DeviceOrientationEvent as any).requestPermission === "function"
      ) {
        (DeviceOrientationEvent as any)
          .requestPermission()
          .then((response: string) => {
            if (response === "granted" && orientationHandlerRef.current) {
              window.addEventListener(
                "deviceorientation",
                orientationHandlerRef.current
              );
            }
          })
          .catch((error: Error) => {
            console.error("Device orientation permission denied:", error);
          });
      } else {
        window.addEventListener("deviceorientation", handleOrientation);
      }
    }
  };

  const stopGeolocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (orientationHandlerRef.current) {
      window.removeEventListener(
        "deviceorientation",
        orientationHandlerRef.current
      );
      orientationHandlerRef.current = null;
    }
    setIsActive(false);
  };

  useEffect(() => {
    if (onRequestGeolocationRef) {
      onRequestGeolocationRef.current = startGeolocation;
    }
    return () => {
      if (onRequestGeolocationRef) {
        onRequestGeolocationRef.current = null;
      }
      stopGeolocation();
    };
  }, [onRequestGeolocationRef]);

  return (
    <>
      {error && (
        <div
          className="position-absolute text-danger"
          style={{
            top: "70px",
            right: "10px",
            zIndex: 1000,
            fontSize: "12px",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            padding: "8px 12px",
            borderRadius: "4px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
          }}
        >
          {error}
        </div>
      )}
      <button
        className={`btn ${
          isActive ? "btn-success" : "btn-success"
        } position-absolute rounded-circle`}
        style={{
          top: "10px",
          right: "10px",
          zIndex: 1000,
          width: "45px",
          height: "45px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isActive) {
            stopGeolocation();
          } else {
            startGeolocation();
          }
        }}
        title={
          isActive ? "Зупинити геолокацію" : "Показати моє місцезнаходження"
        }
      >
        <i
          className={`bi bi-${isActive ? "crosshair2" : "crosshair"}`}
          style={{ fontSize: "18px" }}
        ></i>
      </button>
    </>
  );
};

// ================= Головний компонент карти =================
export interface WalkPreferences {
  locations: string[]; // Обов'язкові місця для відвідування
  distanceKm?: number; // Бажана відстань (опціонально)
  prompt?: string; // Загальні побажання (опціонально)
}

export interface RouteMapRef {
  generateRoute: (preferences: WalkPreferences) => Promise<void>;
  loadSavedRoute: (routeData: {
    points: [number, number][];
    name?: string;
    description?: string;
  }) => Promise<void>;
  isGenerating: boolean;
  requestGeolocation: () => void;
}

type RoutingMapProps = {
  onRouteSummary?: (summary: string) => void;
  onRouteGenerated?: (data: {
    distanceKm: number;
    locations: string[];
    prompt?: string;
    estimatedTimeMinutes: number;
  }) => void;
};

const RoutingMap = React.forwardRef<RouteMapRef, RoutingMapProps>(
  (props, ref) => {
    const { user } = useAuth();
    const [points, setPoints] = useState<LatLngTuple[]>([]);
    const [clearSignal, setClearSignal] = useState<number>(0);
    const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
    const [userHeading, setUserHeading] = useState<number>(0);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [generatedPoints, setGeneratedPoints] = useState<LatLngTuple[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [lastRouteData, setLastRouteData] = useState<{
      distanceKm: number;
      locations: string[];
      prompt?: string;
      estimatedTimeMinutes: number;
    } | null>(null);
    const [routeGeoJson, setRouteGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
    const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
    const [maxDistanceMeters, setMaxDistanceMeters] = useState<number | undefined>(undefined);
    const mapRef = useRef<MapRef>(null);
    const requestGeolocationRef = useRef<(() => void) | null>(null);
    const geolocationPermissionRef = useRef<boolean>(false);

    // Спробувати отримати геолокацію при завантаженні
    useEffect(() => {
      if (navigator.geolocation && !userLocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
            geolocationPermissionRef.current = true;
          },
          () => {
            geolocationPermissionRef.current = false;
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000,
          }
        );
      }
    }, [userLocation]);

    const clearAll = () => {
      setPoints([]);
      setRouteGeoJson(null);
      setMaxDistanceMeters(undefined);
      setClearSignal((s) => s + 1);
    };

    const handleLocationUpdate = (lat: number, lng: number) => {
      setUserLocation([lat, lng]);
    };

    const handleHeadingUpdate = (heading: number) => {
      setUserHeading(heading);
    };

    // Витягнути відстань з промпту
    const extractDistanceFromPrompt = (prompt?: string): number | undefined => {
      if (!prompt) return undefined;
      const normalized = prompt.toLowerCase().replace(",", ".");
      const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(год|hour|h)/);
      const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(хв|min)/);
      if (hourMatch) {
        const hrs = parseFloat(hourMatch[1]);
        if (!Number.isNaN(hrs) && hrs > 0) {
          // Середня швидкість пішохода 4.5 км/год
          return Math.max(1, Math.min(hrs * 4.5, 50));
        }
      }
      if (minMatch) {
        const mins = parseFloat(minMatch[1]);
        if (!Number.isNaN(mins) && mins > 0) {
          return Math.max(1, Math.min((mins / 60) * 4.5, 50));
        }
      }
      return undefined;
    };

    // Генерація маршруту з нуля
    const generateRouteFromPreferences = React.useCallback(
      async (preferences: WalkPreferences) => {
        // 1. Отримати геолокацію користувача
        let currentLocation = userLocation;

        if (!currentLocation) {
          if (navigator.geolocation) {
            try {
              const position = await new Promise<GeolocationPosition>(
                (resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000,
                  });
                }
              );
              const { latitude, longitude } = position.coords;
              currentLocation = [latitude, longitude];
              setUserLocation(currentLocation);
              geolocationPermissionRef.current = true;
            } catch (error) {
              alert("Будь ласка, надайте дозвіл на геолокацію для генерації маршруту");
              setIsGenerating(false);
              return;
            }
          } else {
            alert("Геолокація не підтримується вашим браузером");
            setIsGenerating(false);
            return;
          }
        }

        if (!currentLocation) {
          setIsGenerating(false);
          return;
        }

        setIsGenerating(true);

        try {
          // 2. Визначити цільову відстань
          const targetDistanceKm = preferences.distanceKm || 
            extractDistanceFromPrompt(preferences.prompt) || 
            3; // За замовчуванням 3 км

          setMaxDistanceMeters(Math.round(targetDistanceKm * 1000 * 1.2)); // +20% буфер

          // 3. Знайти обов'язкові місця для відвідування
          const requiredLocations: LatLngTuple[] = [];
          
          if (preferences.locations && preferences.locations.length > 0) {
            console.log("Шукаю обов'язкові місця:", preferences.locations);
            
            for (const locationQuery of preferences.locations) {
              // Спочатку спробувати знайти точну адресу/місце
              let coords = await geocodeWithMapbox(locationQuery, currentLocation);
              
              // Якщо не знайдено, спробувати як POI категорію
              if (!coords) {
                const poiResults = await searchPOIWithMapbox(
                  currentLocation,
                  locationQuery,
                  targetDistanceKm * 1000
                );
                if (poiResults.length > 0) {
                  coords = poiResults[0]; // Беремо найближчий
                }
              }

              if (coords) {
                requiredLocations.push(coords);
                console.log(`Знайдено місце "${locationQuery}":`, coords);
              } else {
                console.warn(`Не вдалося знайти місце: ${locationQuery}`);
              }
            }
          }

          // 4. Якщо є промпт, але немає обов'язкових місць, спробувати знайти місця з промпту
          if (requiredLocations.length === 0 && preferences.prompt) {
            const promptLower = preferences.prompt.toLowerCase();
            const categories: string[] = [];

            // Витягнути категорії з промпту
            if (promptLower.includes("парк") || promptLower.includes("park")) {
              categories.push("park");
            }
            if (promptLower.includes("кафе") || promptLower.includes("cafe") || promptLower.includes("кав")) {
              categories.push("cafe");
            }
            if (promptLower.includes("магазин") || promptLower.includes("shop") || promptLower.includes("супермаркет")) {
              categories.push("shop");
            }
            if (promptLower.includes("ресторан") || promptLower.includes("restaurant")) {
              categories.push("restaurant");
            }
            if (promptLower.includes("музей") || promptLower.includes("museum")) {
              categories.push("museum");
            }

            // Знайти POI для кожної категорії
            for (const category of categories) {
              const poiResults = await searchPOIWithMapbox(
                currentLocation,
                category,
                targetDistanceKm * 1000
              );
              if (poiResults.length > 0) {
                requiredLocations.push(poiResults[0]);
              }
            }
          }

          // 5. Побудувати маршрут
          let routePoints: LatLngTuple[] = [currentLocation];
          let finalDistanceKm = 0;

          if (requiredLocations.length > 0) {
            // Оптимізувати порядок відвідування
            const optimizedOrder = optimizeRouteOrder(currentLocation, requiredLocations);
            routePoints = [currentLocation, ...optimizedOrder];

            // Можливо повернутися до старту, якщо відстань дозволяє
            const returnDistance = calculateDistance(
              routePoints[routePoints.length - 1],
              currentLocation
            );
            const totalDistance = routePoints.slice(0, -1).reduce((sum, point, idx, arr) => {
              if (idx === 0) return 0;
              return sum + calculateDistance(arr[idx - 1], point);
            }, 0) + returnDistance;

            if (totalDistance <= targetDistanceKm * 1.2) {
              routePoints.push(currentLocation);
            }
          } else {
            // Якщо немає обов'язкових місць, створити круговий маршрут
            const radiusKm = targetDistanceKm / (2 * Math.PI);
            const radiusMeters = radiusKm * 1000;
            const [lat, lng] = currentLocation;
            const latOffset = radiusMeters / 111000;
            const lngOffset = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

            const numPoints = 8;
            for (let i = 0; i < numPoints; i++) {
              const angle = (i * 2 * Math.PI) / numPoints;
              const pointLat = lat + latOffset * Math.cos(angle);
              const pointLng = lng + lngOffset * Math.sin(angle);
              routePoints.push([pointLat, pointLng]);
            }
            routePoints.push(currentLocation);
          }

          // Розрахувати фінальну відстань
          if (routePoints.length > 1) {
            let totalDistance = 0;
            for (let i = 0; i < routePoints.length - 1; i++) {
              totalDistance += calculateDistance(routePoints[i], routePoints[i + 1]);
            }
            finalDistanceKm = totalDistance;
          }

          // 6. Встановити точки та згенерувати маршрут через Mapbox
          setGeneratedPoints(routePoints);
          setPoints(routePoints);
          setClearSignal((s) => s + 1);

          // 7. Оновити підсумок
          const estimatedTimeMinutes = (finalDistanceKm / 4.5) * 60;
          
          if (props.onRouteSummary) {
            let summaryText = "";
            if (requiredLocations.length > 0) {
              summaryText = `Маршрут включає ${requiredLocations.length} обов'язкових місць. `;
            }
            summaryText += `Довжина: ${finalDistanceKm.toFixed(1)} км. Орієнтовний час: ${Math.round(estimatedTimeMinutes)} хв.`;
            props.onRouteSummary(summaryText);
          }

          // 8. Callback для статистики
          if (props.onRouteGenerated) {
            const routeData = {
              distanceKm: finalDistanceKm,
              locations: preferences.locations,
              prompt: preferences.prompt,
              estimatedTimeMinutes: estimatedTimeMinutes,
            };
            setLastRouteData(routeData);
            props.onRouteGenerated(routeData);
          }
        } catch (error) {
          console.error("Route generation error:", error);
          alert("Помилка при генерації маршруту: " + (error instanceof Error ? error.message : "Невідома помилка"));
          if (props.onRouteSummary) {
            props.onRouteSummary("Помилка при генерації маршруту");
          }
        } finally {
          setIsGenerating(false);
        }
      },
      [userLocation, props.onRouteSummary, props.onRouteGenerated]
    );

    // Отримати та відобразити маршрут при зміні точок
    useEffect(() => {
      if (!points || points.length < 2) {
        setRouteGeoJson(null);
        return;
      }

      let isCanceled = false;

      const fetchAndDraw = async () => {
        try {
          const coordinates = points.map((p) => [p[1], p[0]]); // [lng, lat] для Mapbox
          const route = await getRouteFromMapbox(coordinates, {
            alternatives: true,
            steps: false,
            overview: "full",
            maxDistance: maxDistanceMeters,
          });

          if (isCanceled) return;

          if (route) {
            setRouteGeoJson(route);

            if (mapRef.current && route.features[0]?.geometry) {
              const geometry = route.features[0].geometry as GeoJSON.LineString;
              if (geometry.coordinates && geometry.coordinates.length > 0) {
                const bounds = geometry.coordinates.reduce(
                  (bounds, coord) => {
                    return [
                      [Math.min(bounds[0][0], coord[0]), Math.min(bounds[0][1], coord[1])],
                      [Math.max(bounds[1][0], coord[0]), Math.max(bounds[1][1], coord[1])],
                    ];
                  },
                  [
                    [geometry.coordinates[0][0], geometry.coordinates[0][1]],
                    [geometry.coordinates[0][0], geometry.coordinates[0][1]],
                  ]
                );

                mapRef.current.fitBounds(
                  bounds as [[number, number], [number, number]],
                  { padding: 40 }
                );
              }
            }
          } else {
            console.warn("Failed to generate route from Mapbox");
          }
        } catch (err) {
          console.error("Routing error:", err);
        }
      };

      fetchAndDraw();

      return () => {
        isCanceled = true;
      };
    }, [points, clearSignal, maxDistanceMeters]);

    const handleSaveRoute = async () => {
      if (!user || !lastRouteData || generatedPoints.length < 2) {
        alert("Неможливо зберегти маршрут. Спробуйте ще раз.");
        return;
      }

      setIsSaving(true);
      try {
        const routeName =
          lastRouteData.prompt ||
          `Маршрут ${new Date().toLocaleDateString("uk-UA")}`;
        const estimatedTimeMinutes = lastRouteData.estimatedTimeMinutes;

        const points: [number, number][] = generatedPoints.map((point) => [
          point[0],
          point[1],
        ]);

        const savedRouteData = await supabaseModules.saveRoute({
          name: routeName,
          description: lastRouteData.prompt,
          points: points,
          statistics: {
            distanceKm: lastRouteData.distanceKm,
            estimatedTimeMinutes: estimatedTimeMinutes,
          },
          preferences: {
            locations: lastRouteData.locations,
            prompt: lastRouteData.prompt,
          },
          is_public: false,
        });

        if (savedRouteData && savedRouteData.id) {
          try {
            await supabaseModules.addToFavorites(savedRouteData.id);
          } catch (favErr) {
            console.warn("Помилка додавання в улюблені:", favErr);
          }
        }

        alert("✅ Маршрут успішно збережено та додано в улюблені!");
      } catch (err) {
        console.error("Помилка збереження маршруту:", err);
        alert("❌ Помилка при збереженні маршруту");
      } finally {
        setIsSaving(false);
      }
    };

    const loadSavedRoute = React.useCallback(
      async (routeData: {
        points: [number, number][];
        name?: string;
        description?: string;
      }) => {
        if (!routeData.points || routeData.points.length === 0) {
          console.warn("Invalid route data");
          return;
        }

        try {
          setIsGenerating(true);
          setPoints(routeData.points as LatLngTuple[]);

          let totalDistance = 0;
          for (let i = 0; i < routeData.points.length - 1; i++) {
            totalDistance += calculateDistance(
              routeData.points[i] as LatLngTuple,
              routeData.points[i + 1] as LatLngTuple
            );
          }

          const summaryText = `Завантажений маршрут "${
            routeData.name || "Без назви"
          }". Довжина: ${totalDistance.toFixed(1)} км.`;
          if (props.onRouteSummary) {
            props.onRouteSummary(summaryText);
          }
        } catch (error) {
          console.error("Error loading saved route:", error);
        } finally {
          setIsGenerating(false);
        }
      },
      [props]
    );

    React.useImperativeHandle(
      ref,
      () => ({
        generateRoute: generateRouteFromPreferences,
        loadSavedRoute,
        isGenerating,
        requestGeolocation: () => {
          if (requestGeolocationRef.current) {
            requestGeolocationRef.current();
          }
        },
      }),
      [generateRouteFromPreferences, loadSavedRoute, isGenerating]
    );

    return (
      <div>
        <button
          className="z-1 btn btn-success position-fixed pb-2 rounded-circle"
          style={{ bottom: "80px", left: "20px", zIndex: 1000 }}
          onClick={clearAll}
          title="Очистити маршрут"
        >
          <i className="bi bi-trash"></i>
        </button>

        {generatedPoints.length > 1 && user && (
          <button
            className="z-1 btn btn-primary position-fixed pb-2 rounded-circle"
            style={{ bottom: "80px", left: "80px", zIndex: 1000 }}
            onClick={handleSaveRoute}
            disabled={isSaving}
            title={isSaving ? "Збереження..." : "Зберегти маршрут"}
          >
            <i
              className={`bi bi-${isSaving ? "hourglass-split" : "bookmark"}`}
            ></i>
          </button>
        )}

        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{
            longitude: 28.469,
            latitude: 49.234,
            zoom: 13,
          }}
          style={{ height: "calc(100dvh - 120px)", width: "100%" }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <GeolocationControl
            onLocationUpdate={handleLocationUpdate}
            onHeadingUpdate={handleHeadingUpdate}
            onRequestGeolocationRef={requestGeolocationRef}
            mapRef={mapRef}
          />

          {userLocation && (
            <Marker
              longitude={userLocation[1]}
              latitude={userLocation[0]}
              anchor="center"
            >
              <div
                style={{
                  position: "relative",
                  width: "60px",
                  height: "60px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "rgba(25, 135, 84, 0.15)",
                    animation: "pulse 2.5s infinite",
                    boxShadow: "0 0 10px rgba(25, 135, 84, 0.3)",
                  }}
                ></div>
                <div
                  style={{
                    position: "absolute",
                    width: "45px",
                    height: "45px",
                    borderRadius: "50%",
                    border: "2px solid rgba(25, 135, 84, 0.4)",
                    animation: "pulse 2.5s infinite",
                    animationDelay: "0.3s",
                  }}
                ></div>
                <div
                  style={{
                    position: "relative",
                    width: "35px",
                    height: "35px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #198754, #20c997)",
                    border: "3px solid white",
                    boxShadow:
                      "0 3px 12px rgba(0, 0, 0, 0.5), inset 0 1px 3px rgba(255,255,255,0.3)",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      width: 0,
                      height: 0,
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderBottom: "10px solid white",
                      filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))",
                      transform: `rotate(${-userHeading}deg) translateY(-5px)`,
                      transition: "transform 0.3s ease",
                    }}
                  ></div>
                </div>
                <style>
                  {`
                    @keyframes pulse {
                      0% { transform: scale(1); opacity: 1; }
                      50% { transform: scale(1.2); opacity: 0.5; }
                      100% { transform: scale(1.4); opacity: 0; }
                    }
                  `}
                </style>
              </div>
              {selectedMarker === -1 && userLocation && (
                <Popup
                  longitude={userLocation[1]}
                  latitude={userLocation[0]}
                  closeOnClick={false}
                  onClose={() => setSelectedMarker(null)}
                  anchor="bottom"
                >
                  <strong>Ваше місцезнаходження</strong>
                  <br />
                  {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
                  <br />
                  Напрямок: {Math.round(userHeading)}°
                </Popup>
              )}
            </Marker>
          )}

          {points.map((pos, idx) => (
            <Marker
              key={idx}
              longitude={pos[1]}
              latitude={pos[0]}
              anchor="center"
              onClick={() => setSelectedMarker(idx)}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: idx === 0 ? "#198754" : "#dc3545",
                  border: "2px solid white",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                }}
              ></div>
              {selectedMarker === idx && (
                <Popup
                  longitude={pos[1]}
                  latitude={pos[0]}
                  closeOnClick={false}
                  onClose={() => setSelectedMarker(null)}
                  anchor="bottom"
                >
                  <strong>{idx === 0 ? "Старт" : `Точка ${idx}`}</strong>
                  <br />
                  {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
                </Popup>
              )}
            </Marker>
          ))}

          {routeGeoJson && (
            <Source id="route" type="geojson" data={routeGeoJson}>
              <Layer
                id="route-line"
                type="line"
                layout={{
                  "line-join": "round",
                  "line-cap": "round",
                }}
                paint={{
                  "line-color": "#28a745",
                  "line-width": 5,
                  "line-opacity": 0.95,
                }}
              />
            </Source>
          )}
        </Map>
      </div>
    );
  }
);

RoutingMap.displayName = "RoutingMap";

export default RoutingMap;
