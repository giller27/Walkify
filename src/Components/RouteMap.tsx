import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { generateRouteFromText, RouteResult } from "../services/routeService";
import { saveRoute } from "../services/supabaseService";
import type { SavedRoute } from "../services/supabaseService";

const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsbGV5cy1jb21ldCIsImEiOiJjbWpzcmc0dzQ0NHZ1M2dxeDRyOTFtNHFxIn0.gCWJwF521jdHqD38Nn8ZsA";

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
}

const RouteMap = forwardRef<RouteMapRef, RouteMapProps>(
  ({ onRouteSummary, onRouteGenerated }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
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
      if (!mapRef.current) return;

      clearRoute();
      clearMarkers();

      // Конвертуємо координати в формат [lng, lat] для Mapbox
      const coordinates = route.points.map((point) => [point[1], point[0]] as [number, number]);

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
      if (coordinates.length > 0) {
        const startMarker = new mapboxgl.Marker({ color: "#28a745" })
          .setLngLat(coordinates[0])
          .setPopup(new mapboxgl.Popup().setHTML("<b>Початок маршруту</b>"))
          .addTo(mapRef.current);
        markersRef.current.push(startMarker);
      }

      // Додаємо маркери для проміжних точок
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

      // Додаємо маркер на кінці маршруту
      if (coordinates.length > 0) {
        const endMarker = new mapboxgl.Marker({ color: "#dc3545" })
          .setLngLat(coordinates[coordinates.length - 1])
          .setPopup(new mapboxgl.Popup().setHTML("<b>Кінець маршруту</b>"))
          .addTo(mapRef.current);
        markersRef.current.push(endMarker);
      }

      // Вписуємо карту в межі маршруту
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach((coord) => {
        bounds.extend(coord);
      });
      mapRef.current.fitBounds(bounds, { padding: 50 });
    };

    // Генерація маршруту
    const generateRoute = async (preferences: WalkPreferences) => {
      if (!userLocation) {
        alert("Будь ласка, дозвольте доступ до геолокації або вкажіть вашу позицію");
        return;
      }

      setIsGenerating(true);
      try {
        const route = await generateRouteFromText(userLocation, preferences.prompt);
        currentRouteRef.current = route;

        displayRoute(route);

        // Формуємо підсумок маршруту
        const summary = `${route.distanceKm} км, ~${route.estimatedTimeMinutes} хв. ${route.locations.length > 0 ? `Через: ${route.locations.join(", ")}` : ""}`;
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
        alert(error.message || "Не вдалося згенерувати маршрут. Спробуйте інший запит.");
        if (onRouteSummary) {
          onRouteSummary("");
        }
      } finally {
        setIsGenerating(false);
      }
    };

    // Завантаження збереженого маршруту
    const loadSavedRoute = async (route: SavedRoute) => {
      if (!mapRef.current) return;

      setIsGenerating(true);
      try {
        const routeResult: RouteResult = {
          points: route.points,
          waypoints: route.waypoints || [],
          distanceKm: route.statistics.distanceKm,
          estimatedTimeMinutes: route.statistics.estimatedTimeMinutes,
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
        alert("Не вдалося завантажити маршрут");
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
          alert("Не вдалося отримати вашу позицію. Перевірте налаштування браузера.");
        }
      );
    };

    // Експортуємо методи через ref
    useImperativeHandle(ref, () => ({
      generateRoute,
      loadSavedRoute,
      requestGeolocation,
      isGenerating,
    }));

    return (
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "calc(100vh - 60px)",
          position: "relative",
        }}
      />
    );
  }
);

RouteMap.displayName = "RouteMap";

export default RouteMap;
