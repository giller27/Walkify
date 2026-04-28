import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  generateRouteFromText,
  RouteResult,
  RouteWaypoint,
} from "../services/routeService";
import { saveRoute } from "../services/supabaseService";
import type { SavedRoute } from "../services/supabaseService";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export interface WalkPreferences {
  prompt: string;
  locations: string[];
  distance?: number;
  duration?: number;
  routeMode?: "point_to_point" | "exploration";
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

// ─── Кольори маркерів за типом POI ───────────────────────────────────────────
const TYPE_COLOR_MAP: Record<string, string> = {
  cafe:             "#ff8c00",
  coffee:           "#d4813a",
  restaurant:       "#ff5722",
  park:             "#4caf50",
  shop:             "#3f51b5",
  supermarket:      "#3f51b5",
  museum:           "#9c27b0",
  library:          "#03a9f4",
  place_of_worship: "#795548",
  church:           "#795548",
  beach:            "#ffc107",
  lake:             "#2196f3",
  river:            "#00bcd4",
  fountain:         "#29b6f6",
  viewpoint:        "#ff7043",
  monument:         "#8d6e63",
  playground:       "#ec407a",
  cinema:           "#ab47bc",
  theatre:          "#7e57c2",
  pharmacy:         "#26a69a",
  bakery:           "#ffca28",
  zoo:              "#66bb6a",
  attraction:       "#ef5350",
  sport:            "#42a5f5",
  hotel:            "#5c6bc0",
  custom:           "#6c757d",
};

// ─── Іконки типів POI (emoji, відображаються на маркері) ─────────────────────
const TYPE_EMOJI: Record<string, string> = {
  cafe:             "☕",
  coffee:           "☕",
  restaurant:       "🍽️",
  park:             "🌿",
  shop:             "🛍️",
  supermarket:      "🛒",
  museum:           "🏛️",
  library:          "📚",
  place_of_worship: "⛪",
  church:           "⛪",
  beach:            "🏖️",
  lake:             "🌊",
  river:            "🌊",
  fountain:         "⛲",
  viewpoint:        "🔭",
  monument:         "🗿",
  playground:       "🎠",
  cinema:           "🎬",
  theatre:          "🎭",
  pharmacy:         "💊",
  bakery:           "🥐",
  zoo:              "🦁",
  attraction:       "⭐",
  sport:            "⚽",
  hotel:            "🏨",
  custom:           "📍",
};

// ─── Компонент ────────────────────────────────────────────────────────────────

const RouteMap = forwardRef<RouteMapRef, RouteMapProps>(
  ({ onRouteSummary, onRouteGenerated, panelExpanded = true }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const currentRouteRef = useRef<RouteResult | null>(null);
    const [selectedPoi, setSelectedPoi] = useState<RouteWaypoint | null>(null);
    const [routeReadyToStart, setRouteReadyToStart] = useState(false);
    const [navigationMode, setNavigationMode] = useState(false);
    const [navMessage, setNavMessage] = useState<string | null>(null);
    const [mapStyle, setMapStyle] = useState<string>("mapbox://styles/mapbox/navigation-day-v1");
    const [timeOfDay, setTimeOfDay] = useState<"morning" | "afternoon" | "evening" | "night">("afternoon");
    const [navDistance, setNavDistance] = useState<number | null>(null);
    const [navInstruction, setNavInstruction] = useState<string | null>(null);
    const navWatchIdRef = useRef<number | null>(null);
    const currentHeadingRef = useRef<number>(0);
    const deviceOrientationHandlerRef = useRef<EventListener | null>(null);

    // ── Функція для визначення часу доби ────────────────────────────────────
    const getTimeOfDayStyle = () => {
      const hour = new Date().getHours();
      let style: string;
      let period: "morning" | "afternoon" | "evening" | "night";

      if (hour >= 5 && hour < 12) {
        // Ранок (5-11)
        style = "mapbox://styles/mapbox/light-v11";
        period = "morning";
      } else if (hour >= 12 && hour < 17) {
        // День (12-16)
        style = "mapbox://styles/mapbox/streets-v12";
        period = "afternoon";
      } else if (hour >= 17 && hour < 21) {
        // Вечір (17-20)
        style = "mapbox://styles/mapbox/navigation-day-v1";
        period = "evening";
      } else {
        // Ніч (21-4)
        style = "mapbox://styles/mapbox/navigation-night-v1";
        period = "night";
      }

      return { style, period };
    };

    // ── Ініціалізація карти ─────────────────────────────────────────────────
    useEffect(() => {
      if (!mapContainerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const { style, period } = getTimeOfDayStyle();
      setMapStyle(style);
      setTimeOfDay(period);

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: style,
        center: [30.5234, 50.4501],
        zoom: 13,
        pitch: 0,
        bearing: 0,
        antialias: true,
      });

      map.on("load", () => {
        const layers = map.getStyle().layers || [];
        let labelLayerId: string | undefined;
        for (const layer of layers) {
          if (layer.type === "symbol" && layer.layout && (layer.layout as any)["text-field"]) {
            labelLayerId = layer.id;
            break;
          }
        }

        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 15,
            paint: {
              "fill-extrusion-color": "#c6c6c6",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.65,
            },
          },
          labelLayerId
        );
      });

      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            setUserLocation([longitude, latitude]);
            map.flyTo({ center: [longitude, latitude], zoom: 15 });
            addUserMarker(map, longitude, latitude);
          },
          (error) => console.error("Помилка геолокації:", error)
        );
      }

      return () => { map.remove(); };
    }, []);

    // ── Перевірка часу доби кожну хвилину ───────────────────────────────────
    useEffect(() => {
      const interval = setInterval(() => {
        const { style, period } = getTimeOfDayStyle();
        if (style !== mapStyle && mapRef.current) {
          setMapStyle(style);
          setTimeOfDay(period);
          mapRef.current.setStyle(style);
        }
      }, 60000); // Перевіряємо кожну хвилину

      return () => clearInterval(interval);
    }, [mapStyle]);

    // ── Маркер користувача ──────────────────────────────────────────────────
    const addUserMarker = (map: mapboxgl.Map, lng: number, lat: number) => {
      userMarkerRef.current?.remove();
      const el = document.createElement("div");
      el.style.cssText = `
        width:16px;height:16px;border-radius:50%;
        background:#28a745;border:3px solid #fff;
        box-shadow:0 0 0 3px rgba(40,167,69,0.35);
      `;
      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setHTML("<b>📍 Ваша позиція</b>"))
        .addTo(map);
    };

    // ── Очищення маркерів ───────────────────────────────────────────────────
    const clearMarkers = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };

    // ── Очищення лінії маршруту ─────────────────────────────────────────────
    const clearRoute = () => {
      const map = mapRef.current;
      if (!map) return;
      ["route-line-border", "route-line"].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource("route")) map.removeSource("route");
    };

    // ── Відображення маршруту ───────────────────────────────────────────────
    const displayRoute = (route: RouteResult) => {
      const map = mapRef.current;
      if (!map) return;

      try {
        clearRoute();
        clearMarkers();
        setSelectedPoi(null);
        setRouteReadyToStart(true);
        setNavigationMode(false);
        setNavMessage(
          route.waypoints?.[0]?.name
            ? `Готово! Натисніть «Почати», щоб рухатися до ${route.waypoints[0].name}`
            : "Готово! Натисніть «Почати», щоб розпочати навігацію"
        );

        // Координати у форматі Mapbox [lng, lat]
        const coordinates = route.points.map(
          ([lat, lng]) => [lng, lat] as [number, number]
        );

        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates },
            properties: {},
          },
        });

        // Тінь маршруту
        map.addLayer({
          id: "route-line-border",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#1a7a30",
            "line-width": 7,
            "line-opacity": 0.35,
          },
        });

        // Основна лінія
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#28a745",
            "line-width": 4,
            "line-opacity": 0.9,
            "line-dasharray": [0, 0],
          },
        });

        // Стартовий маркер
        if (coordinates.length > 0) {
          const startEl = createNumberedMarker("🚶", "#28a745");
          const startMarker = new mapboxgl.Marker({ element: startEl })
            .setLngLat(coordinates[0])
            .setPopup(new mapboxgl.Popup().setHTML("<b>Початок маршруту</b>"))
            .addTo(map);
          markersRef.current.push(startMarker);
        }

        // Маркери POI
        route.waypoints.forEach((wp, idx) => {
          const [lat, lng] = wp.location;
          const color = TYPE_COLOR_MAP[wp.type] || TYPE_COLOR_MAP["custom"];
          const emoji = TYPE_EMOJI[wp.type] || "📍";

          const el = createPoiMarker(emoji, color, idx + 1);
          el.addEventListener("click", () => setSelectedPoi(wp));
          el.title = wp.name;

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);
          markersRef.current.push(marker);
        });

        // Кінцевий маркер (тільки для point_to_point)
        if (coordinates.length > 1) {
          const lastCoord = coordinates[coordinates.length - 1];
          const firstCoord = coordinates[0];
          const isLoop =
            Math.abs(lastCoord[0] - firstCoord[0]) < 0.0001 &&
            Math.abs(lastCoord[1] - firstCoord[1]) < 0.0001;

          if (!isLoop) {
            const endEl = createNumberedMarker("🏁", "#dc3545");
            const endMarker = new mapboxgl.Marker({ element: endEl })
              .setLngLat(lastCoord)
              .setPopup(new mapboxgl.Popup().setHTML("<b>Кінець маршруту</b>"))
              .addTo(map);
            markersRef.current.push(endMarker);
          }
        }

        // Вписуємо в bounds
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, { padding: 60 });
      } catch (err) {
        console.error("Помилка відображення маршруту:", err);
      }
    };

    // ── Генерація маршруту ──────────────────────────────────────────────────
    const generateRoute = async (preferences: WalkPreferences) => {
      if (!userLocation) {
        alert("Будь ласка, дозвольте доступ до геолокації");
        return;
      }

      setIsGenerating(true);
      try {
        const route = await generateRouteFromText(
          userLocation,
          preferences.prompt,
          { routeMode: preferences.routeMode }
        );

        currentRouteRef.current = route;
        displayRoute(route);

        const poiNames = route.waypoints.map((w) => w.name).join(", ");
        const summary = `${route.distanceKm} км · ~${route.estimatedTimeMinutes} хв${
          poiNames ? ` · ${poiNames}` : ""
        }`;

        onRouteSummary?.(summary);
        onRouteGenerated?.({
          distanceKm: route.distanceKm,
          locations: route.locations,
          prompt: preferences.prompt,
          estimatedTimeMinutes: route.estimatedTimeMinutes,
        });
      } catch (error: any) {
        console.error("Помилка генерації маршруту:", error);
        alert(error.message || "Не вдалося згенерувати маршрут. Спробуйте інший запит.");
        onRouteSummary?.("");
      } finally {
        setIsGenerating(false);
      }
    };

    const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;

    const computeBearing = (
      start: [number, number],
      end: [number, number]
    ) => {
      const [lat1, lon1] = start;
      const [lat2, lon2] = end;
      const φ1 = degreesToRadians(lat1);
      const φ2 = degreesToRadians(lat2);
      const Δλ = degreesToRadians(lon2 - lon1);
      const y = Math.sin(Δλ) * Math.cos(φ2);
      const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
      const brng = Math.atan2(y, x);
      return (radiansToDegrees(brng) + 360) % 360;
    };

    const computeDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const getTurnDirection = (bearing1: number, bearing2: number): string => {
      let diff = (bearing2 - bearing1 + 360) % 360;
      if (diff > 180) diff = 360 - diff;

      if (diff < 30) return "прямо";
      if (diff <= 90) return "вправо";
      if (diff > 90 && diff < 180) return "різко вправо";
      if (diff < -30 && diff >= -90) return "вліво";
      if (diff <= -90) return "різко вліво";
      return "поворот";
    };

    const startNavigation = () => {
      const route = currentRouteRef.current;
      const map = mapRef.current;
      if (!route || !map || route.points.length < 2) return;

      setNavigationMode(true);
      setRouteReadyToStart(false);
      currentHeadingRef.current = 0;

      // Запускаємо слухач орієнтації пристрою
      const handleDeviceOrientation: EventListener = (event) => {
        const orientationEvent = event as DeviceOrientationEvent;
        if (orientationEvent.alpha !== null) {
          currentHeadingRef.current = orientationEvent.alpha || 0;
        }
      };
      deviceOrientationHandlerRef.current = handleDeviceOrientation;

      // Спочатку запитуємо дозвіл на iOS 13+
      if (
        window.DeviceOrientationEvent &&
        typeof (window.DeviceOrientationEvent as any).requestPermission === "function"
      ) {
        (window.DeviceOrientationEvent as any)
          .requestPermission()
          .then((permission: string) => {
            if (permission === "granted") {
              window.addEventListener("deviceorientationabsolute", handleDeviceOrientation);
              console.log("✓ DeviceOrientation permission granted");
            } else {
              console.log("✗ DeviceOrientation permission denied");
            }
          })
          .catch((err: Error) => console.error("DeviceOrientation error:", err));
      } else if (window.DeviceOrientationEvent) {
        // Для браузерів без явного запиту дозволу (Android)
        window.addEventListener("deviceorientation", handleDeviceOrientation);
        console.log("✓ DeviceOrientation listener added");
      }

      // Запускаємо відслідкування геолокації в режимі навігації
      if (navigator.geolocation) {
        navWatchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { longitude, latitude } = position.coords;

            // Знаходимо найближчу точку маршруту
            let closestIdx = 0;
            let minDist = Infinity;
            for (let i = 0; i < route.points.length; i++) {
              const dist = computeDistanceKm(
                latitude,
                longitude,
                route.points[i][0],
                route.points[i][1]
              );
              if (dist < minDist) {
                minDist = dist;
                closestIdx = i;
              }
            }

            // Показуємо наступну точку
            const nextIdx = Math.min(closestIdx + 2, route.points.length - 1);
            const [nextLat, nextLng] = route.points[nextIdx];
            const nextWaypoint = route.waypoints.find((wp) => {
              const wpDist = computeDistanceKm(
                wp.location[0],
                wp.location[1],
                nextLat,
                nextLng
              );
              return wpDist < 0.05;
            });

            // Обчислюємо відстань
            const distToNextKm = computeDistanceKm(latitude, longitude, nextLat, nextLng);
            const distMeters = Math.round(distToNextKm * 1000);

            setNavDistance(distMeters);

            // Обчислюємо напрям повороту
            const bearingNow = computeBearing([latitude, longitude], [nextLat, nextLng]);
            if (closestIdx < route.points.length - 1) {
              const [curr2Lat, curr2Lng] = route.points[closestIdx + 1] || route.points[closestIdx];
              const bearingNext = computeBearing([nextLat, nextLng], [curr2Lat, curr2Lng]);
              const turnDir = getTurnDirection(bearingNow, bearingNext);

              const waypointName = nextWaypoint?.name || "наступну точку";
              setNavInstruction(`${turnDir} • ${waypointName}`);
            }

            // Оновлюємо позицію на карті і центруємо з урахуванням компаса
            if (map) {
              addUserMarker(map, longitude, latitude);
              map.setCenter([longitude, latitude]);
              // Використовуємо bearingNow як основу та добавляємо поворот пристрою
              const finalBearing = (bearingNow + currentHeadingRef.current) % 360;
              map.setBearing(finalBearing);
              map.setPitch(60);
            }
          },
          (error) => console.error("Помилка GPS:", error),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }

      setNavMessage(`Навігація розпочата: рухайтесь по маршруту`);
    };

    const stopNavigation = () => {
      const map = mapRef.current;
      if (!map) return;

      // Зупиняємо слухачі геолокації
      if (navWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(navWatchIdRef.current);
        navWatchIdRef.current = null;
      }

      // Зупиняємо слухачі орієнтації
      if (deviceOrientationHandlerRef.current) {
        window.removeEventListener("deviceorientation", deviceOrientationHandlerRef.current);
        window.removeEventListener("deviceorientationabsolute", deviceOrientationHandlerRef.current);
        deviceOrientationHandlerRef.current = null;
      }

      currentHeadingRef.current = 0;

      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1200,
      });
      setNavigationMode(false);
      setRouteReadyToStart(false);
      setNavMessage(null);
      setNavDistance(null);
      setNavInstruction(null);
    };

    // ── Завантаження збереженого маршруту ───────────────────────────────────
    const loadSavedRoute = async (route: SavedRoute) => {
      if (!mapRef.current) return;

      setIsGenerating(true);
      try {
        if (!route.points || !Array.isArray(route.points)) {
          throw new Error("Маршрут не містить точок");
        }

        let distanceKm = route.statistics?.distanceKm
          || (route as any).distance_km
          || 0;
        let estimatedTimeMinutes = route.statistics?.estimatedTimeMinutes
          || (route as any).duration_minutes
          || 0;

        if (distanceKm === 0 && route.points.length > 0) {
          for (let i = 0; i < route.points.length - 1; i++) {
            const [lat1, lon1] = route.points[i];
            const [lat2, lon2] = route.points[i + 1];
            distanceKm += haversineKm(lat1, lon1, lat2, lon2);
          }
          distanceKm = Math.max(Math.round(distanceKm * 10) / 10, 0.5);
        }
        if (estimatedTimeMinutes === 0) {
          estimatedTimeMinutes = Math.round((distanceKm / 5) * 60);
        }

        const routeResult: RouteResult = {
          points: route.points,
          waypoints: (route as any).waypoints || [],
          distanceKm,
          estimatedTimeMinutes,
          locations: (route as any).locations || [],
        };

        currentRouteRef.current = routeResult;
        displayRoute(routeResult);
        onRouteSummary?.(`${distanceKm} км · ~${estimatedTimeMinutes} хв`);
      } catch (error) {
        console.error("Помилка завантаження маршруту:", error);
        alert("Не вдалося завантажити маршрут: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setIsGenerating(false);
      }
    };

    // ── Геолокація ──────────────────────────────────────────────────────────
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
            mapRef.current.flyTo({ center: [longitude, latitude], zoom: 15 });
            addUserMarker(mapRef.current, longitude, latitude);
          }
        },
        () => alert("Не вдалося отримати позицію. Перевірте налаштування браузера.")
      );
    };

    // ── Resize при зміні панелі ─────────────────────────────────────────────
    useEffect(() => {
      if (mapRef.current) {
        setTimeout(() => mapRef.current?.resize(), 300);
      }
    }, [panelExpanded]);

    // ── Cleanup при unmount ─────────────────────────────────────────────────
    useEffect(() => {
      return () => {
        if (navWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(navWatchIdRef.current);
        }
        if (deviceOrientationHandlerRef.current) {
          window.removeEventListener("deviceorientation", deviceOrientationHandlerRef.current);
          window.removeEventListener("deviceorientationabsolute", deviceOrientationHandlerRef.current);
        }
      };
    }, []);

    // ── Ref API ─────────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      generateRoute,
      loadSavedRoute,
      requestGeolocation,
      getCurrentRoute: () => currentRouteRef.current,
      clearCurrentRoute: () => {
        if (navigationMode) {
          stopNavigation();
        }
        clearRoute();
        clearMarkers();
        currentRouteRef.current = null;
        setSelectedPoi(null);
        setRouteReadyToStart(false);
        setNavMessage(null);
      },
      isGenerating,
    }));

    // ── Рендер ──────────────────────────────────────────────────────────────
    return (
      <>
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

        {(routeReadyToStart || navigationMode) && (
          <div
            style={{
              position: "fixed",
              left: 16,
              top: 76,
              right: "auto",
              bottom: "auto",
              zIndex: 1200,
              display: "flex",
              justifyContent: "flex-start",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                backgroundColor: navigationMode ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.72)",
                color: "#fff",
                borderRadius: 16,
                padding: navigationMode ? "16px 20px" : "14px 18px",
                minWidth: navigationMode ? 360 : 280,
                maxWidth: 480,
                boxShadow: "0 16px 40px rgba(0,0,0,0.3)",
                pointerEvents: "auto",
              }}
            >
              {routeReadyToStart && !navigationMode ? (
                <>
                  <div style={{ marginBottom: 10, fontWeight: 700, fontSize: "1rem" }}>
                    Маршрут готовий
                  </div>
                  <div style={{ marginBottom: 14, color: "#d1d5db" }}>
                    {navMessage || "Натисніть «Почати», щоб перейти в режим навігації"}
                  </div>
                  <button
                    type="button"
                    onClick={startNavigation}
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: 12,
                      padding: "10px 0",
                      backgroundColor: "#28a745",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      cursor: "pointer",
                    }}
                  >
                    Почати маршрут
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 700, fontSize: "1.2rem", lineHeight: 1.2 }}>
                    {navDistance !== null && (
                      <>
                        <span style={{ color: "#4ade80", fontSize: "1.4rem", fontWeight: 800 }}>
                          {navDistance < 1000 ? `${navDistance}м` : `${(navDistance / 1000).toFixed(1)}км`}
                        </span>
                        {navInstruction && (
                          <div style={{ marginTop: 4, fontSize: "0.95rem", color: "#e5e7eb" }}>
                            {navInstruction}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={stopNavigation}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      border: "1px solid rgba(255,255,255,0.18)",
                      borderRadius: 12,
                      padding: "8px 0",
                      backgroundColor: "transparent",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                    }}
                  >
                    Завершити навігацію
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Картка вибраного POI */}
        {selectedPoi && (
          <div
            style={{
              position: "fixed",
              right: 16,
              bottom: panelExpanded ? 200 : 80,
              zIndex: 1200,
              backgroundColor: "#ffffff",
              borderRadius: 14,
              boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
              padding: "14px 16px",
              maxWidth: 290,
              minWidth: 220,
              borderLeft: `4px solid ${TYPE_COLOR_MAP[selectedPoi.type] || "#6c757d"}`,
            }}
          >
            <div className="d-flex justify-content-between align-items-start mb-1">
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.3 }}>
                  {TYPE_EMOJI[selectedPoi.type] || "📍"} {selectedPoi.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "capitalize", marginTop: 2 }}>
                  {selectedPoi.type}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPoi(null)}
                style={{
                  border: "none", background: "transparent",
                  cursor: "pointer", padding: "2px 4px", marginLeft: 8,
                  color: "#999", fontSize: "1rem",
                }}
                aria-label="Закрити"
              >
                ✕
              </button>
            </div>

            {selectedPoi.photoUrl && (
              <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden", maxHeight: 140 }}>
                <img src={selectedPoi.photoUrl} alt={selectedPoi.name} style={{ width: "100%", objectFit: "cover" }} />
              </div>
            )}

            {selectedPoi.address && (
              <div style={{ fontSize: "0.78rem", color: "#555", marginBottom: 4 }}>
                📌 {selectedPoi.address}
              </div>
            )}

            {typeof selectedPoi.rating === "number" && (
              <div style={{ fontSize: "0.78rem", color: "#333", marginBottom: 4 }}>
                ⭐ {selectedPoi.rating.toFixed(1)}
                {typeof selectedPoi.userRatingsTotal === "number" && selectedPoi.userRatingsTotal > 0 && (
                  <span style={{ color: "#999", marginLeft: 4 }}>({selectedPoi.userRatingsTotal})</span>
                )}
              </div>
            )}

            {selectedPoi.description && (
              <div style={{ fontSize: "0.78rem", color: "#555", marginTop: 6 }}>
                {selectedPoi.description}
              </div>
            )}

            {selectedPoi.source && (
              <div style={{ fontSize: "0.68rem", color: "#bbb", marginTop: 8 }}>
                Джерело: {selectedPoi.source}
              </div>
            )}
          </div>
        )}
      </>
    );
  }
);

RouteMap.displayName = "RouteMap";
export default RouteMap;

// ─── Допоміжні функції для маркерів ──────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createPoiMarker(emoji: string, color: string, num: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width:32px;height:32px;border-radius:50%;
    background:${color};border:2.5px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);
    cursor:pointer;display:flex;align-items:center;
    justify-content:center;font-size:14px;
  `;
  el.textContent = emoji;
  el.title = `Точка ${num}`;
  return el;
}

function createNumberedMarker(emoji: string, color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width:36px;height:36px;border-radius:50%;
    background:${color};border:3px solid #fff;
    box-shadow:0 2px 10px rgba(0,0,0,0.25);
    display:flex;align-items:center;justify-content:center;
    font-size:16px;
  `;
  el.textContent = emoji;
  return el;
}
