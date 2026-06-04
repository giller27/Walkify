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
import { loadGoogleMaps } from "../services/googleMapsLoader";

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

const typeColorMap: Record<string, string> = {
  cafe: "#ff8c00",
  restaurant: "#ff5722",
  park: "#4caf50",
  shop: "#3f51b5",
  museum: "#9c27b0",
  library: "#03a9f4",
  place_of_worship: "#795548",
  beach: "#ffc107",
  lake: "#2196f3",
  river: "#00bcd4",
  custom: "#6c757d",
};

const RouteMap = forwardRef<RouteMapRef, RouteMapProps>(
  ({ onRouteSummary, onRouteGenerated, panelExpanded = true }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const routeLineRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(
      null
    );
    const [isGenerating, setIsGenerating] = useState(false);
    const currentRouteRef = useRef<RouteResult | null>(null);
    const [selectedPoi, setSelectedPoi] = useState<RouteWaypoint | null>(null);

    useEffect(() => {
      let disposed = false;

      const initMap = async () => {
        if (!mapContainerRef.current) return;

        try {
          const maps = await loadGoogleMaps(["places"]);
          if (disposed || !mapContainerRef.current) return;

          const map = new maps.Map(mapContainerRef.current, {
            center: { lat: 50.4501, lng: 30.5234 },
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });

          mapRef.current = map;

          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { longitude, latitude } = position.coords;
                setUserLocation([longitude, latitude]);
                const latLng = { lat: latitude, lng: longitude };
                map.panTo(latLng);
                map.setZoom(15);

                const marker = new maps.Marker({
                  map,
                  position: latLng,
                  title: "Ваша позиція",
                  icon: {
                    path: maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: "#28a745",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                  },
                });
                markersRef.current.push(marker);
              },
              (error) => {
                console.error("Помилка отримання геолокації:", error);
              }
            );
          }
        } catch (error) {
          console.error("Помилка ініціалізації Google Maps:", error);
          alert(
            error instanceof Error
              ? error.message
              : "Не вдалося завантажити Google Maps."
          );
        }
      };

      initMap();

      return () => {
        disposed = true;
        clearMarkers();
        if (routeLineRef.current) {
          routeLineRef.current.setMap(null);
          routeLineRef.current = null;
        }
        mapRef.current = null;
      };
    }, []);

    const clearMarkers = () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };

    const clearRoute = () => {
      if (routeLineRef.current) {
        routeLineRef.current.setMap(null);
        routeLineRef.current = null;
      }
    };

    const displayRoute = async (route: RouteResult) => {
      if (!mapRef.current) {
        console.warn("Map not ready yet");
        return;
      }

      try {
        const maps = await loadGoogleMaps(["places"]);
        clearRoute();
        clearMarkers();
        setSelectedPoi(null);

        const path = route.points.map(([lat, lng]) => ({ lat, lng }));

        routeLineRef.current = new maps.Polyline({
          map: mapRef.current,
          path,
          strokeColor: "#28a745",
          strokeOpacity: 0.85,
          strokeWeight: 5,
        });

        if (path.length > 0) {
          markersRef.current.push(
            new maps.Marker({
              map: mapRef.current,
              position: path[0],
              title: "Початок маршруту",
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#28a745",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            })
          );
        }

        route.waypoints?.forEach((waypoint) => {
          const [lat, lng] = waypoint.location;
          const marker = new maps.Marker({
            map: mapRef.current,
            position: { lat, lng },
            title: waypoint.name,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: typeColorMap[waypoint.type] || typeColorMap.custom,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
          marker.addListener("click", () => setSelectedPoi(waypoint));
          markersRef.current.push(marker);
        });

        if (path.length > 0) {
          markersRef.current.push(
            new maps.Marker({
              map: mapRef.current,
              position: path[path.length - 1],
              title: "Кінець маршруту",
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#dc3545",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            })
          );

          const bounds = new maps.LatLngBounds();
          path.forEach((point) => bounds.extend(point));
          mapRef.current.fitBounds(bounds, 50);
        }
      } catch (error) {
        console.error("Error displaying route:", error);
      }
    };

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
          preferences.prompt,
          {
            routeMode: preferences.routeMode,
          }
        );
        currentRouteRef.current = route;

        await displayRoute(route);

        const summary = `${route.distanceKm} км, ~${
          route.estimatedTimeMinutes
        } хв. ${
          route.locations.length > 0
            ? `Через: ${route.locations.join(", ")}`
            : ""
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
        alert(
          error.message ||
            "Не вдалося згенерувати маршрут. Спробуйте інший запит."
        );
        onRouteSummary?.("");
      } finally {
        setIsGenerating(false);
      }
    };

    const loadSavedRoute = async (route: SavedRoute) => {
      if (!mapRef.current) {
        console.warn("Map not ready, waiting...");
        return;
      }

      setIsGenerating(true);
      try {
        if (!route.points || !Array.isArray(route.points)) {
          throw new Error("Invalid route: missing points");
        }

        let distanceKm = 0;
        let estimatedTimeMinutes = 0;

        if (route.statistics && typeof route.statistics === "object") {
          distanceKm = route.statistics.distanceKm || 0;
          estimatedTimeMinutes = route.statistics.estimatedTimeMinutes || 0;
        }

        if (
          (distanceKm === 0 || estimatedTimeMinutes === 0) &&
          (route as any).distance_km
        ) {
          distanceKm = (route as any).distance_km;
          estimatedTimeMinutes =
            (route as any).duration_minutes ||
            Math.round((distanceKm / 5) * 60);
        }

        if (distanceKm === 0 && route.points.length > 0) {
          const calculateDistance = (
            lat1: number,
            lon1: number,
            lat2: number,
            lon2: number
          ) => {
            const R = 6371;
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

          for (let i = 0; i < route.points.length - 1; i++) {
            const [lat1, lon1] = route.points[i];
            const [lat2, lon2] = route.points[i + 1];
            distanceKm += calculateDistance(lat1, lon1, lat2, lon2);
          }

          if (distanceKm < 0.5) {
            distanceKm = 0.5;
          }

          estimatedTimeMinutes = Math.round((distanceKm / 5) * 60);
        }

        if (distanceKm === 0) {
          throw new Error("Invalid route: could not determine distance");
        }

        const routeResult: RouteResult = {
          points: route.points,
          waypoints: route.waypoints || [],
          distanceKm: Math.round(distanceKm * 10) / 10,
          estimatedTimeMinutes,
          locations: route.preferences?.locations || [],
        };

        currentRouteRef.current = routeResult;
        await displayRoute(routeResult);

        onRouteSummary?.(
          `${routeResult.distanceKm} км, ~${routeResult.estimatedTimeMinutes} хв.`
        );
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

    const requestGeolocation = () => {
      if (!navigator.geolocation) {
        alert("Ваш браузер не підтримує геолокацію");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);

          if (mapRef.current) {
            const maps = await loadGoogleMaps(["places"]);
            const latLng = { lat: latitude, lng: longitude };
            mapRef.current.panTo(latLng);
            mapRef.current.setZoom(15);

            clearMarkers();

            const marker = new maps.Marker({
              map: mapRef.current,
              position: latLng,
              title: "Ваша позиція",
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#28a745",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            });
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

    useEffect(() => {
      if (mapRef.current) {
        setTimeout(() => {
          const center = mapRef.current.getCenter();
          window.google?.maps.event.trigger(mapRef.current, "resize");
          if (center) mapRef.current.setCenter(center);
        }, 300);
      }
    }, [panelExpanded]);

    useImperativeHandle(ref, () => ({
      generateRoute,
      loadSavedRoute,
      requestGeolocation,
      getCurrentRoute: () => currentRouteRef.current,
      clearCurrentRoute: () => {
        clearRoute();
        clearMarkers();
        currentRouteRef.current = null;
        setSelectedPoi(null);
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
        {selectedPoi && (
          <div
            style={{
              position: "fixed",
              right: 16,
              bottom: panelExpanded ? 200 : 80,
              zIndex: 1200,
              backgroundColor: "#ffffff",
              borderRadius: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              padding: 12,
              maxWidth: 280,
            }}
          >
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                  {selectedPoi.name}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#6c757d",
                    textTransform: "capitalize",
                  }}
                >
                  {selectedPoi.type}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPoi(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  marginLeft: 8,
                }}
                aria-label="Закрити"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            {selectedPoi.photoUrl && (
              <div
                style={{
                  marginBottom: 8,
                  borderRadius: 8,
                  overflow: "hidden",
                  maxHeight: 140,
                }}
              >
                <img
                  src={selectedPoi.photoUrl}
                  alt={selectedPoi.name}
                  style={{ width: "100%", objectFit: "cover" }}
                />
              </div>
            )}
            {selectedPoi.address && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#495057",
                  marginBottom: 4,
                }}
              >
                <i className="bi bi-geo-alt me-1" />
                {selectedPoi.address}
              </div>
            )}
            {typeof selectedPoi.rating === "number" && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#343a40",
                  marginBottom: 4,
                }}
              >
                <i className="bi bi-star-fill text-warning me-1" />
                {selectedPoi.rating.toFixed(1)}
                {typeof selectedPoi.userRatingsTotal === "number" &&
                  selectedPoi.userRatingsTotal > 0 && (
                    <span className="text-muted ms-1">
                      ({selectedPoi.userRatingsTotal})
                    </span>
                  )}
              </div>
            )}
            {selectedPoi.description && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#495057",
                  marginTop: 4,
                }}
              >
                {selectedPoi.description}
              </div>
            )}
            {selectedPoi.source && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#adb5bd",
                  marginTop: 6,
                }}
              >
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
