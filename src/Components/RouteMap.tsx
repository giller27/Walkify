import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { generateRouteFromText, RouteResult } from "../services/routeService";
import { saveRoute } from "../services/supabaseService";
import type { SavedRoute } from "../services/supabaseService";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiaGFsbGV5cy1jb21ldCIsImEiOiJjbWpzcmc0dzQ0NHZ1M2dxeDRyOTFtNHFxIn0.gCWJwF521jdHqD38Nn8ZsA";

export interface WalkPreferences {
  prompt: string;
  locations: string[];
  distance?: number;
  duration?: number;
}

export interface RouteMapRef {
  generateRoute: (preferences: WalkPreferences) => Promise<void>;
  loadSavedRoute: (route: SavedRoute) => Promise<void>;
  requestGeolocation: () => void;
  getCurrentRoute: () => RouteResult | null;
  clearCurrentRoute: () => void;
  isGenerating: boolean;
}

interface RouteMapProps {
  onRouteSummary?: (summary: string) => void;
  onRouteGenerated?: (data: {
    distanceKm: number;
    locations: string[];
    prompt?: string;
    estimatedTimeMinutes: number;
  }) => void;
  panelExpanded?: boolean;
}

const RouteMap = forwardRef<RouteMapRef, RouteMapProps>(
  ({ onRouteSummary, onRouteGenerated, panelExpanded = true }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(
      null
    );
    const [isGenerating, setIsGenerating] = useState(false);
    const currentRouteRef = useRef<RouteResult | null>(null);

    // Ініціалізація карти
    useEffect(() => {
      if (!mapContainerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [30.5234, 50.4501], // Київ за замовчуванням
        zoom: 13,
      });

      mapRef.current = map;

      // Додаємо навігаційні контроли
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Запитуємо геолокацію при завантаженні
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            setUserLocation([longitude, latitude]);
            map.flyTo({
              center: [longitude, latitude],
              zoom: 15,
            });

            // Додаємо маркер поточної позиції
            new mapboxgl.Marker({ color: "#28a745" })
              .setLngLat([longitude, latitude])
              .setPopup(new mapboxgl.Popup().setHTML("<b>Ваша позиція</b>"))
              .addTo(map);
          },
          (error) => {
            console.error("Помилка отримання геолокації:", error);
          }
        );
      }

      return () => {
        map.remove();
      };
    }, []);

    // Очищення маркерів
    const clearMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };

    // Очищення маршруту
    const clearRoute = () => {
      if (!mapRef.current) return;

      // Видаляємо джерело та шар маршруту, якщо вони існують
      if (mapRef.current.getSource("route")) {
        if (mapRef.current.getLayer("route-line")) {
          mapRef.current.removeLayer("route-line");
        }
        mapRef.current.removeSource("route");
      }
    };

    // Відображення маршруту на карті
    const displayRoute = (route: RouteResult) => {
      if (!mapRef.current) {
        console.warn("Map not ready yet");
        return;
      }

      try {
        clearRoute();
        clearMarkers();

        // Конвертуємо координати в формат [lng, lat] для Mapbox
        const coordinates = route.points.map(
          (point) => [point[1], point[0]] as [number, number]
        );

        // Додаємо джерело даних для маршруту
        mapRef.current.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: coordinates,
            },
            properties: {},
          },
        });

        // Додаємо шар для лінії маршруту
        mapRef.current.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#28a745",
            "line-width": 4,
            "line-opacity": 0.8,
          },
        });

        // Додаємо маркер на початку маршруту
        if (coordinates.length > 0 && mapRef.current) {
          const startMarker = new mapboxgl.Marker({ color: "#28a745" })
            .setLngLat(coordinates[0])
            .setPopup(new mapboxgl.Popup().setHTML("<b>Початок маршруту</b>"))
            .addTo(mapRef.current);
          markersRef.current.push(startMarker);
        }

        // Додаємо маркери для проміжних точок
        if (
          route.waypoints &&
          Array.isArray(route.waypoints) &&
          mapRef.current
        ) {
          route.waypoints.forEach((waypoint) => {
            const [lat, lng] = waypoint.location;
            const marker = new mapboxgl.Marker({ color: "#ffc107" })
              .setLngLat([lng, lat])
              .setPopup(
                new mapboxgl.Popup().setHTML(
                  `<b>${waypoint.name}</b><br><small>${waypoint.type}</small>`
                )
              )
              .addTo(mapRef.current!);
            markersRef.current.push(marker);
          });
        }

        // Додаємо маркер на кінці маршруту
        if (coordinates.length > 0 && mapRef.current) {
          const endMarker = new mapboxgl.Marker({ color: "#dc3545" })
            .setLngLat(coordinates[coordinates.length - 1])
            .setPopup(new mapboxgl.Popup().setHTML("<b>Кінець маршруту</b>"))
            .addTo(mapRef.current);
          markersRef.current.push(endMarker);
        }

        // Вписуємо карту в межи маршруту
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach((coord) => {
          bounds.extend(coord);
        });
        mapRef.current.fitBounds(bounds, { padding: 50 });
      } catch (error) {
        console.error("Error displaying route:", error);
      }
    };

    // Генерація маршруту
    const generateRoute = async (preferences: WalkPreferences) => {
      if (!userLocation) {
        alert(
          "Будь ласка, дозвольте доступ до геолокації або вкажіть вашу позицію"
        );
        return;
      }

      setIsGenerating(true);
      try {
        const route = await generateRouteFromText(
          userLocation,
          preferences.prompt
        );
        currentRouteRef.current = route;

        displayRoute(route);

        // Формуємо підсумок маршруту
        const summary = `${route.distanceKm} км, ~${
          route.estimatedTimeMinutes
        } хв. ${
          route.locations.length > 0
            ? `Через: ${route.locations.join(", ")}`
            : ""
        }`;
        if (onRouteSummary) {
          onRouteSummary(summary);
        }

        // Викликаємо callback
        if (onRouteGenerated) {
          onRouteGenerated({
            distanceKm: route.distanceKm,
            locations: route.locations,
            prompt: preferences.prompt,
            estimatedTimeMinutes: route.estimatedTimeMinutes,
          });
        }
      } catch (error: any) {
        console.error("Помилка генерації маршруту:", error);
        alert(
          error.message ||
            "Не вдалося згенерувати маршрут. Спробуйте інший запит."
        );
        if (onRouteSummary) {
          onRouteSummary("");
        }
      } finally {
        setIsGenerating(false);
      }
    };

    // Завантаження збереженого маршруту
    const loadSavedRoute = async (route: SavedRoute) => {
      if (!mapRef.current) {
        console.warn("Map not ready, waiting...");
        return;
      }

      setIsGenerating(true);
      try {
        // Перевіряємо наявність обов'язкових полів
        if (!route.points || !Array.isArray(route.points)) {
          throw new Error("Invalid route: missing points");
        }

        // Обробляємо різні формати даних маршруту
        let distanceKm = 0;
        let estimatedTimeMinutes = 0;

        // Формат 1: є statistics об'єкт
        if (route.statistics && typeof route.statistics === "object") {
          distanceKm = route.statistics.distanceKm || 0;
          estimatedTimeMinutes = route.statistics.estimatedTimeMinutes || 0;
        }

        // Формат 2: є distance_km поле (дані з localStorage)
        if (
          (distanceKm === 0 || estimatedTimeMinutes === 0) &&
          (route as any).distance_km
        ) {
          distanceKm = (route as any).distance_km;
          // Якщо duration_minutes відсутня, розраховуємо за середньою швидкістю 5 км/год
          estimatedTimeMinutes =
            (route as any).duration_minutes ||
            Math.round((distanceKm / 5) * 60);
        }

        // Формат 3: розраховуємо距離 з координат, якщо вона відсутня
        if (distanceKm === 0 && route.points.length > 0) {
          // Розраховуємо приблизну відстань через координати
          // На коротких відстанях можемо використовувати просту формулу
          const calculateDistance = (
            lat1: number,
            lon1: number,
            lat2: number,
            lon2: number
          ) => {
            // Haversine formula для розрахунку відстані між двома точками
            const R = 6371; // Радіус Землі в км
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLon = ((lon2 - lon1) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
          };

          // Сумуємо відстані між послідовними точками
          for (let i = 0; i < route.points.length - 1; i++) {
            const [lat1, lon1] = route.points[i];
            const [lat2, lon2] = route.points[i + 1];
            distanceKm += calculateDistance(lat1, lon1, lat2, lon2);
          }

          // Якщо розрахована відстань невелика, встановимо мінімум 0.5 км
          if (distanceKm < 0.5) {
            distanceKm = 0.5;
          }

          // Розраховуємо час за середньою швидкістю 5 км/год
          estimatedTimeMinutes = Math.round((distanceKm / 5) * 60);
        }

        if (distanceKm === 0) {
          throw new Error("Invalid route: could not determine distance");
        }

        const routeResult: RouteResult = {
          points: route.points,
          waypoints: route.waypoints || [],
          distanceKm: Math.round(distanceKm * 10) / 10, // Округлюємо до 1 десяткового знаку
          estimatedTimeMinutes: estimatedTimeMinutes,
          locations: route.preferences?.locations || [],
        };

        currentRouteRef.current = routeResult;
        displayRoute(routeResult);

        const summary = `${routeResult.distanceKm} км, ~${routeResult.estimatedTimeMinutes} хв.`;
        if (onRouteSummary) {
          onRouteSummary(summary);
        }
      } catch (error) {
        console.error("Помилка завантаження маршруту:", error);
        alert(
          "Не вдалося завантажити маршрут: " +
            (error instanceof Error ? error.message : String(error))
        );
      } finally {
        setIsGenerating(false);
      }
    };

    // Запит геолокації
    const requestGeolocation = () => {
      if (!navigator.geolocation) {
        alert("Ваш браузер не підтримує геолокацію");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);

          if (mapRef.current) {
            mapRef.current.flyTo({
              center: [longitude, latitude],
              zoom: 15,
            });

            // Очищаємо старі маркери
            clearMarkers();

            // Додаємо маркер поточної позиції
            const marker = new mapboxgl.Marker({ color: "#28a745" })
              .setLngLat([longitude, latitude])
              .setPopup(new mapboxgl.Popup().setHTML("<b>Ваша позиція</b>"))
              .addTo(mapRef.current);
            markersRef.current.push(marker);
          }
        },
        (error) => {
          console.error("Помилка отримання геолокації:", error);
          alert(
            "Не вдалося отримати вашу позицію. Перевірте налаштування браузера."
          );
        }
      );
    };

    // Перерендер карти при зміні panelExpanded
    useEffect(() => {
      if (mapRef.current) {
        setTimeout(() => {
          mapRef.current?.resize();
        }, 300); // Затримка для синхронізації з анімацією
      }
    }, [panelExpanded]);

    // Експортуємо методи через ref
    useImperativeHandle(ref, () => ({
      generateRoute,
      loadSavedRoute,
      requestGeolocation,
      getCurrentRoute: () => currentRouteRef.current,
      clearCurrentRoute: () => {
        clearRoute();
        clearMarkers();
        currentRouteRef.current = null;
      },
      isGenerating,
    }));

    return (
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: panelExpanded
            ? "calc(100vh - 60px - 150px)"
            : "calc(100vh - 60px - 65px)",
          position: "absolute",
          transition: "height 0.3s ease-in-out",
        }}
      />
    );
  }
);

RouteMap.displayName = "RouteMap";

export default RouteMap;
