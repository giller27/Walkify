/// <reference types="google.maps" />
import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  generateRouteFromText,
  RouteResult,
  RouteWaypoint,
} from "../services/routeService";
import type { SavedRoute } from "../services/supabaseService";
import type { RouteDifficulty } from "../types/routeEnhancements";

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
    difficulty?: RouteDifficulty;
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
  store:            "#3f51b5",
  supermarket:      "#3f51b5",
  museum:           "#9c27b0",
  library:          "#03a9f4",
  place_of_worship: "#795548",
  church:           "#795548",
  beach:            "#ffc107",
  lake:             "#2196f3",
  river:            "#00bcd4",
  natural_feature:  "#4caf50",
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
  point_of_interest:"#ef5350",
  sport:            "#42a5f5",
  hotel:            "#5c6bc0",
  custom:           "#6c757d",
};

// ─── Іконки типів POI ────────────────────────────────────────────────────────
const TYPE_EMOJI: Record<string, string> = {
  cafe:             "☕",
  coffee:           "☕",
  restaurant:       "🍽️",
  park:             "🌿",
  shop:             "🛍️",
  store:            "🛍️",
  supermarket:      "🛒",
  museum:           "🏛️",
  library:          "📚",
  place_of_worship: "⛪",
  church:           "⛪",
  beach:            "🏖️",
  lake:             "🌊",
  river:            "🌊",
  natural_feature:  "🌲",
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
  point_of_interest:"⭐",
  sport:            "⚽",
  hotel:            "🏨",
  custom:           "📍",
};

// ─── Допоміжна функція для SVG Маркерів Google Maps ────────────────────────
function createSvgIcon(emoji: string, color: string): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="15" fill="${color}" stroke="#fff" stroke-width="2.5"/>
    <text x="18" y="23" font-size="14" text-anchor="middle" font-family="sans-serif">${emoji}</text>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(36, 36),
    anchor: new google.maps.Point(18, 18),
  };
}

// ─── Компонент ────────────────────────────────────────────────────────────────

const RouteMap = forwardRef<RouteMapRef, RouteMapProps>(
  ({ onRouteSummary, onRouteGenerated, panelExpanded = true }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    
    // Рефи для об'єктів Google Maps
    const routeLineRef = useRef<google.maps.Polyline | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const userMarkerRef = useRef<google.maps.Marker | null>(null);

    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const currentRouteRef = useRef<RouteResult | null>(null);
    const [selectedPoi, setSelectedPoi] = useState<RouteWaypoint | null>(null);
    
    const [routeReadyToStart, setRouteReadyToStart] = useState(false);
    const [navigationMode, setNavigationMode] = useState(false);
    const [navMessage, setNavMessage] = useState<string | null>(null);
    const [navDistance, setNavDistance] = useState<number | null>(null);
    const [navInstruction, setNavInstruction] = useState<string | null>(null);

    // ── Ініціалізація карти Google ──────────────────────────────────────────
    useEffect(() => {
      if (!mapContainerRef.current || !window.google) return;

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 50.4501, lng: 30.5234 },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        mapId: "DEMO_MAP_ID", // Дозволяє використовувати векторні функції, такі як Heading
      });

      mapRef.current = map;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            setUserLocation([longitude, latitude]);
            map.panTo({ lat: latitude, lng: longitude });
            map.setZoom(15);
            addUserMarker(map, longitude, latitude);
          },
          (error) => console.error("Помилка геолокації:", error)
        );
      }
    }, []);

    // ── Маркер користувача ──────────────────────────────────────────────────
    const addUserMarker = (map: google.maps.Map, lng: number, lat: number) => {
      if (userMarkerRef.current) userMarkerRef.current.setMap(null);
      
      userMarkerRef.current = new google.maps.Marker({
        position: { lat, lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#28a745',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: "Ваша позиція"
      });
    };

    const clearMarkers = () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };

    const clearRoute = () => {
      if (routeLineRef.current) {
        routeLineRef.current.setMap(null);
        routeLineRef.current = null;
      }
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

        const path = route.points.map(p => ({ lat: p[0], lng: p[1] }));

        // Малювання лінії маршруту
        routeLineRef.current = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#28a745',
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map
        });

        // Вписуємо карту в межі маршруту
        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        map.fitBounds(bounds);

        // Маркери POI
        route.waypoints.forEach((wp, idx) => {
          const color = TYPE_COLOR_MAP[wp.type] || TYPE_COLOR_MAP["custom"];
          const emoji = TYPE_EMOJI[wp.type] || "📍";

          const marker = new google.maps.Marker({
            position: { lat: wp.location[0], lng: wp.location[1] },
            map,
            title: wp.name,
            icon: createSvgIcon(emoji, color)
          });

          marker.addListener("click", () => {
            setSelectedPoi(wp);
            map.panTo(marker.getPosition() as google.maps.LatLng);
          });
          
          markersRef.current.push(marker);
        });

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
        const diffStr = route.difficulty ? ` · ${route.difficulty}` : '';
        const summary = `${route.distanceKm} км · ~${route.estimatedTimeMinutes} хв${diffStr}${
          poiNames ? ` · ${poiNames}` : ""
        }`;

        onRouteSummary?.(summary);
        onRouteGenerated?.({
          distanceKm: route.distanceKm,
          locations: route.locations,
          prompt: preferences.prompt,
          estimatedTimeMinutes: route.estimatedTimeMinutes,
          difficulty: route.difficulty
        });
      } catch (error: any) {
        console.error("Помилка генерації маршруту:", error);
        alert(error.message || "Не вдалося згенерувати маршрут. Спробуйте інший запит.");
        onRouteSummary?.("");
      } finally {
        setIsGenerating(false);
      }
    };

    // ── Завантаження збереженого маршруту ───────────────────────────────────
    const loadSavedRoute = async (route: SavedRoute) => {
      if (!mapRef.current) return;

      setIsGenerating(true);
      try {
        if (!route.points || !Array.isArray(route.points)) {
          throw new Error("Маршрут не містить точок");
        }

        let distanceKm = route.statistics?.distanceKm || (route as any).distance_km || 0;
        let estimatedTimeMinutes = route.statistics?.estimatedTimeMinutes || (route as any).duration_minutes || 0;

        const safeWaypoints: RouteWaypoint[] = ((route as any).waypoints || []).map((wp: any) => ({
          location: wp.location,
          name: wp.name,
          type: wp.type,
          address: wp.address,
          rating: wp.rating,
          userRatingsTotal: wp.userRatingsTotal,
          photoUrl: wp.photoUrl,
          description: wp.description,
          source: (wp.source === 'google' ? 'google' : 'custom') as 'google' | 'custom'
        }));

        const routeResult: RouteResult = {
          points: route.points,
          waypoints: safeWaypoints,
          distanceKm,
          estimatedTimeMinutes,
          locations: (route as any).locations || [],
          difficulty: (route as any).difficulty,
        };

        currentRouteRef.current = routeResult;
        displayRoute(routeResult);
        
        const diffStr = routeResult.difficulty ? ` · ${routeResult.difficulty}` : '';
        onRouteSummary?.(`${distanceKm} км · ~${estimatedTimeMinutes} хв${diffStr}`);
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
            mapRef.current.panTo({ lat: latitude, lng: longitude });
            mapRef.current.setZoom(15);
            addUserMarker(mapRef.current, longitude, latitude);
          }
        },
        () => alert("Не вдалося отримати позицію. Перевірте налаштування браузера.")
      );
    };

    // ── Навігаційні функції ─────────────────────────────────────────────────
    const startNavigation = () => {
      const route = currentRouteRef.current;
      const map = mapRef.current;
      if (!route || !map || route.points.length < 2) return;
      
      setNavigationMode(true);
      setRouteReadyToStart(false);
      setNavMessage(`GPS Навігація активована`);
      
      // Google Maps Нахил камери для навігації
      map.setTilt(45);
      map.setZoom(18);
    };

    const stopNavigation = () => {
      const map = mapRef.current;
      if (!map) return;
      
      map.setHeading(0);
      map.setTilt(0);
      map.setZoom(14);
      
      setNavigationMode(false);
      setRouteReadyToStart(false);
      setNavMessage(null);
      setNavDistance(null);
      setNavInstruction(null);
    };

    useImperativeHandle(ref, () => ({
      generateRoute,
      loadSavedRoute,
      requestGeolocation,
      getCurrentRoute: () => currentRouteRef.current,
      clearCurrentRoute: () => {
        if (navigationMode) stopNavigation();
        clearRoute();
        clearMarkers();
        currentRouteRef.current = null;
        setSelectedPoi(null);
        setRouteReadyToStart(false);
        setNavMessage(null);
      },
      isGenerating,
    }));

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
                  <div style={{ marginBottom: 10, fontWeight: 700, fontSize: "1rem", display: 'flex', justifyContent: 'space-between' }}>
                    <span>Маршрут готовий</span>
                    {currentRouteRef.current?.difficulty && (
                      <span style={{ fontSize: "0.8rem", padding: "2px 8px", background: "#4caf50", borderRadius: "10px" }}>
                        {currentRouteRef.current.difficulty}
                      </span>
                    )}
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
                    {navDistance !== null ? (
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
                    ) : (
                      <span>{navMessage}</span>
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
                  {selectedPoi.type.replace('_', ' ')}
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
              <div style={{ fontSize: "0.75rem", color: "#0066cc", marginTop: 6, fontWeight: 500 }}>
                {selectedPoi.description}
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