// src/Components/RouteMap.tsx
import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../context/AuthContext";
import * as supabaseModules from "../services/supabaseService";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom icon for user location with direction indicator (play button style)
const createUserLocationIcon = (heading: number) => {
  return L.divIcon({
    className: "user-location-icon",
    html: `
      <div style="position: relative; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 60px; height: 60px; border-radius: 50%; background: rgba(25, 135, 84, 0.15); animation: pulse 2.5s infinite; box-shadow: 0 0 10px rgba(25, 135, 84, 0.3);"></div>
        <div style="position: absolute; width: 45px; height: 45px; border-radius: 50%; border: 2px solid rgba(25, 135, 84, 0.4); animation: pulse 2.5s infinite; animation-delay: 0.3s;"></div>
        <div style="position: relative; width: 35px; height: 35px; border-radius: 50%; background: linear-gradient(135deg, #198754, #20c997); border: 3px solid white; box-shadow: 0 3px 12px rgba(0, 0, 0, 0.5), inset 0 1px 3px rgba(255,255,255,0.3); z-index: 2; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 10px solid white; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.4)); transform: rotate(${
            heading + 180
          }deg) translateY(-5px); transition: transform 0.3s ease;"></div>
        </div>
        <style>
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.5; }
            100% { transform: scale(1.4); opacity: 0; }
          }
        </style>
      </div>
    `,
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    popupAnchor: [0, -30],
  });
};

type LatLngTuple = [number, number];

const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImE3YzUxNmU2ZmMzYzQyMTQ4OTJhMWM4YWM1YTI2OWQ1IiwiaCI6Im11cm11cjY0In0="; // <-- встав свій ключ

// Geocoding function to convert location name to coordinates
const geocodeLocation = async (
  locationName: string
): Promise<LatLngTuple | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        locationName
      )}&limit=1`,
      {
        headers: {
          "User-Agent": "Walkify App",
        },
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

// Map query types to OSM tags
const getOSMTags = (query: string): { key: string; value: string }[] => {
  const queryLower = query.toLowerCase();
  const tags: { key: string; value: string }[] = [];

  if (queryLower.includes("park") || queryLower.includes("парк")) {
    tags.push({ key: "leisure", value: "park" });
    tags.push({ key: "landuse", value: "recreation_ground" });
  }
  if (
    queryLower.includes("cafe") ||
    queryLower.includes("кафе") ||
    queryLower.includes("кав")
  ) {
    tags.push({ key: "amenity", value: "cafe" });
  }
  if (
    queryLower.includes("shop") ||
    queryLower.includes("магазин") ||
    queryLower.includes("supermarket") ||
    queryLower.includes("супермаркет")
  ) {
    tags.push({ key: "shop", value: "supermarket" });
    tags.push({ key: "amenity", value: "marketplace" });
  }
  if (queryLower.includes("restaurant") || queryLower.includes("ресторан")) {
    tags.push({ key: "amenity", value: "restaurant" });
  }
  if (queryLower.includes("museum") || queryLower.includes("музей")) {
    tags.push({ key: "tourism", value: "museum" });
  }
  if (
    queryLower.includes("church") ||
    queryLower.includes("церква") ||
    queryLower.includes("храм")
  ) {
    tags.push({ key: "amenity", value: "place_of_worship" });
  }

  return tags;
};

// Search for POI using Overpass API (more accurate than Nominatim)
const searchNearbyPOIOverpass = async (
  center: LatLngTuple,
  tags: { key: string; value: string }[],
  radius: number = 2000
): Promise<LatLngTuple[]> => {
  if (tags.length === 0) return [];

  try {
    const [lat, lng] = center;
    // Convert radius from meters to degrees (approximate)
    const radiusDeg = radius / 111000;

    // Build Overpass QL query
    const tagFilters = tags
      .map((tag) => `["${tag.key}"="${tag.value}"]`)
      .join("");
    const query = `
      [out:json][timeout:10];
      (
        node${tagFilters}(around:${radius},${lat},${lng});
        way${tagFilters}(around:${radius},${lat},${lng});
        relation${tagFilters}(around:${radius},${lat},${lng});
      );
      out center;
    `;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    const results: LatLngTuple[] = [];

    if (data.elements) {
      for (const element of data.elements) {
        if (element.type === "node") {
          results.push([element.lat, element.lon]);
        } else if (element.center) {
          results.push([element.center.lat, element.center.lon]);
        } else if (element.lat && element.lon) {
          results.push([element.lat, element.lon]);
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Overpass API error:", error);
    return [];
  }
};

// Search for POI (Points of Interest) near user location
const searchNearbyPOI = async (
  center: LatLngTuple,
  query: string,
  radius: number = 2000
): Promise<LatLngTuple[]> => {
  try {
    const [lat, lng] = center;

    // First try Overpass API (more accurate for POI)
    const osmTags = getOSMTags(query);
    if (osmTags.length > 0) {
      const overpassResults = await searchNearbyPOIOverpass(
        center,
        osmTags,
        radius
      );
      if (overpassResults.length > 0) {
        return overpassResults.slice(0, 10); // Limit to 10 results
      }
    }

    // Fallback to Nominatim if Overpass doesn't return results
    const searchQueries = [`${query}`, `${query} near ${lat},${lng}`];

    for (const searchQuery of searchQueries) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery
          )}&lat=${lat}&lon=${lng}&radius=${radius}&limit=10&addressdetails=1`,
          {
            headers: {
              "User-Agent": "Walkify App",
            },
          }
        );
        const data = await response.json();
        if (data && data.length > 0) {
          const results = data.map((item: any) => [
            parseFloat(item.lat),
            parseFloat(item.lon),
          ]);
          if (results.length > 0) {
            return results;
          }
        }
      } catch (err) {
        console.warn("Nominatim search attempt failed:", err);
      }
    }
    return [];
  } catch (error) {
    console.error("POI search error:", error);
    return [];
  }
};

// ================= RoutingMachine (малює маршрут та слухає сигнал очистки) =================
const RoutingMachine = ({
  points,
  clearSignal,
  onRouteDrawn,
}: {
  points: LatLngTuple[];
  clearSignal: number;
  onRouteDrawn?: (layer: L.Layer | null) => void;
}) => {
  const map = useMap();
  const routeLayerRef = useRef<L.Layer | null>(null);
  const lastClearSignalRef = useRef<number>(clearSignal);

  // Функція, що видаляє шар маршруту якщо він є
  const removeRouteLayer = () => {
    if (routeLayerRef.current) {
      try {
        map.removeLayer(routeLayerRef.current);
      } catch (e) {
        // ignore
      }
      routeLayerRef.current = null;
      if (onRouteDrawn) onRouteDrawn(null);
    }
  };

  // Якщо сигнал про очистку змінився — видаляємо шар
  useEffect(() => {
    if (clearSignal !== lastClearSignalRef.current) {
      lastClearSignalRef.current = clearSignal;
      removeRouteLayer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSignal]);

  useEffect(() => {
    if (!map) return;
    // завжди видаляємо попередній шар перед побудовою нового
    removeRouteLayer();

    if (!points || points.length < 2) return;

    let isCanceled = false;

    const fetchAndDraw = async () => {
      try {
        const coords = points.map((p) => [p[1], p[0]]); // [lng, lat]
        const res = await fetch(
          "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: ORS_API_KEY,
            },
            body: JSON.stringify({ coordinates: coords }),
          }
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`ORS ${res.status} ${res.statusText} - ${txt}`);
        }

        const data = await res.json();

        if (isCanceled) return;

        if (!data || !data.features || data.features.length === 0) {
          console.warn("ORS returned no features", data);
          return;
        }

        // створюємо шар і позначаємо його як маршрут (корисно при діагностиці)
        const routeLayer = L.geoJSON(data, {
          style: () => ({
            color: "#28a745", // зелений
            weight: 5,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }),
        });

        // позначимо шар кастомним прапорцем (щоб можна було знайти)
        (routeLayer as any)._isRouteLayer = true;

        routeLayer.addTo(map);
        routeLayerRef.current = routeLayer;

        // масштабування карти
        try {
          const bounds = (routeLayer as any).getBounds();
          if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40] });
          }
        } catch (e) {
          // ignore
        }

        if (onRouteDrawn) onRouteDrawn(routeLayer);
      } catch (err) {
        console.error("Routing error:", err);
      }
    };

    fetchAndDraw();

    // cleanup при розмонтуванні або зміні точок
    return () => {
      isCanceled = true;
      removeRouteLayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(points)]); // stringify щоб спрацьовував при зміні coords

  return null;
};

// ================= Geolocation Control Component =================
const GeolocationControl = ({
  onLocationUpdate,
  onHeadingUpdate,
  onRequestGeolocationRef,
}: {
  onLocationUpdate: (lat: number, lng: number) => void;
  onHeadingUpdate: (heading: number) => void;
  onRequestGeolocationRef?: React.MutableRefObject<(() => void) | null>;
}) => {
  const map = useMap();
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

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;

        // Лог для дебагу
        console.log("Geolocation updated:", {
          lat: latitude,
          lng: longitude,
          heading: heading,
        });

        // Передати координати через callback
        onLocationUpdate(latitude, longitude);

        // Use heading from geolocation if available
        if (heading !== null && heading !== undefined && !isNaN(heading)) {
          onHeadingUpdate(heading);
        }

        // Center map on user location
        map.setView([latitude, longitude], map.getZoom());
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

    // Watch device orientation for heading (if available)
    if (window.DeviceOrientationEvent) {
      const handleOrientation = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null && event.alpha !== undefined) {
          // alpha is the compass direction (0-360)
          onHeadingUpdate(event.alpha);
        }
      };

      orientationHandlerRef.current = handleOrientation;

      // Request permission for iOS 13+
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

  // Expose startGeolocation to parent via ref
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
          e.stopPropagation(); // Prevent map click event
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
  locations: string[];
  distanceKm?: number;
  prompt?: string;
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
    const routeLayerRefParent = useRef<L.Layer | null>(null);
    const requestGeolocationRef = useRef<(() => void) | null>(null);
    const geolocationPermissionRef = useRef<boolean>(false);

    // Спробувати отримати геолокацію при завантаженні, якщо дозвіл вже надано
    useEffect(() => {
      if (navigator.geolocation && !userLocation) {
        // Спробувати отримати кешовану позицію (не запитувати дозвіл)
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
            geolocationPermissionRef.current = true;
          },
          () => {
            // Дозвіл не надано або помилка - це нормально, запитуватимемо пізніше
            geolocationPermissionRef.current = false;
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000, // Використовувати кешовану позицію до 5 хвилин
          }
        );
      }
    }, [userLocation]);

    // --- Helpers to parse prompt into hints ---
    const extractLocationsFromPrompt = (prompt?: string): string[] => {
      if (!prompt) return [];
      const lower = prompt.toLowerCase();
      const keywords = [
        "park",
        "парк",
        "cafe",
        "кафе",
        "coffee",
        "кав'ярня",
        "shop",
        "магазин",
        "mall",
        "трц",
        "atb",
        "атб",
        "silpo",
        "сільпо",
        "silpo",
        "сільпо",
        "supermarket",
        "супермаркет",
      ];
      const found = keywords.filter((k) => lower.includes(k));
      return Array.from(new Set(found));
    };

    const inferDistanceFromPrompt = (
      prompt?: string,
      fallbackKm = 3
    ): number => {
      if (!prompt) return fallbackKm;
      const normalized = prompt.toLowerCase().replace(",", ".");
      const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(год|hour|h)/);
      const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(хв|min)/);
      if (hourMatch) {
        const hrs = parseFloat(hourMatch[1]);
        if (!Number.isNaN(hrs) && hrs > 0)
          return Math.max(1, Math.min(hrs * 4.5, 50));
      }
      if (minMatch) {
        const mins = parseFloat(minMatch[1]);
        if (!Number.isNaN(mins) && mins > 0)
          return Math.max(1, Math.min((mins / 60) * 4.5, 50));
      }
      return fallbackKm;
    };

    const clearAll = () => {
      setPoints([]);
      // послати сигнал компоненту RoutingMachine, щоб він видалив шар всередині
      setClearSignal((s) => s + 1);

      // додаткова безпека: якщо батьківський реф має шар — теж видаляємо
      if (routeLayerRefParent.current) {
        try {
          (routeLayerRefParent.current as any).remove();
        } catch (e) {
          // ignore
        }
        routeLayerRefParent.current = null;
      }
    };

    const handleLocationUpdate = (lat: number, lng: number) => {
      setUserLocation([lat, lng]);
    };

    const handleHeadingUpdate = (heading: number) => {
      setUserHeading(heading);
    };

    const generateRouteFromPreferences = React.useCallback(
      async (preferences: WalkPreferences) => {
        // Якщо геолокація не ввімкнена, спробувати автоматично отримати
        let currentLocation = userLocation;

        if (!currentLocation) {
          // Спробувати отримати поточну позицію
          if (navigator.geolocation) {
            try {
              const position = await new Promise<GeolocationPosition>(
                (resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000, // Використовувати кешовану позицію до 5 хвилин
                  });
                }
              );
              const { latitude, longitude } = position.coords;
              currentLocation = [latitude, longitude];
              setUserLocation(currentLocation);
              geolocationPermissionRef.current = true;
            } catch (error) {
              alert(
                "Будь ласка, надайте дозвіл на геолокацію для генерації маршруту"
              );
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
          // Merge prompt-derived hints with manual locations
          const promptLocations = extractLocationsFromPrompt(
            preferences.prompt
          );
          const combinedLocations = Array.from(
            new Set([...preferences.locations, ...promptLocations])
          );
          // Allow generation even without specific locations if prompt is provided
          // The route can be generated based on prompt alone

          // Determine distance - використовуємо distanceKm якщо вказано, інакше визначаємо з промпту або використовуємо 3 км за замовчуванням
          const targetDistanceKm = preferences.distanceKm
            ? preferences.distanceKm
            : inferDistanceFromPrompt(preferences.prompt, 3);

          // Geocode all locations
          const locationCoords: LatLngTuple[] = [];
          for (const location of combinedLocations) {
            const coords = await geocodeLocation(location);
            if (coords) {
              locationCoords.push(coords);
            } else {
              console.warn(`Could not geocode location: ${location}`);
            }
          }

          // Calculate average walking speed (km/h) - typical is 4-5 km/h
          const walkingSpeedKmh = 4.5;
          const maxDistanceMeters = targetDistanceKm * 1000;

          // Start with user location
          const routePoints: LatLngTuple[] = [currentLocation];

          // If no locations found but prompt exists, try to find POI based on prompt
          let finalDistanceKm = targetDistanceKm;
          if (locationCoords.length === 0) {
            if (preferences.prompt && preferences.prompt.trim()) {
              // Try to extract keywords from prompt and search for nearby POI
              const promptLower = preferences.prompt.toLowerCase();
              const searchQueries: string[] = [];

              // Extract common location types from prompt
              if (
                promptLower.includes("парк") ||
                promptLower.includes("park") ||
                promptLower.includes("до парку") ||
                promptLower.includes("до парка")
              ) {
                searchQueries.push("park");
              }
              if (
                promptLower.includes("кафе") ||
                promptLower.includes("cafe") ||
                promptLower.includes("кав")
              ) {
                searchQueries.push("cafe");
              }
              if (
                promptLower.includes("магазин") ||
                promptLower.includes("shop") ||
                promptLower.includes("атб") ||
                promptLower.includes("atb") ||
                promptLower.includes("сільпо") ||
                promptLower.includes("silpo")
              ) {
                searchQueries.push("supermarket");
              }
              if (
                promptLower.includes("ресторан") ||
                promptLower.includes("restaurant")
              ) {
                searchQueries.push("restaurant");
              }
              if (
                promptLower.includes("музей") ||
                promptLower.includes("museum")
              ) {
                searchQueries.push("museum");
              }
              if (
                promptLower.includes("церква") ||
                promptLower.includes("church") ||
                promptLower.includes("храм")
              ) {
                searchQueries.push("church");
              }

              // If no specific keywords found, try to extract any location name from prompt
              if (searchQueries.length === 0) {
                // Try to find location names (words after "до", "в", "на")
                const locationPatterns = [
                  /до\s+([а-яa-z]+)/i,
                  /в\s+([а-яa-z]+)/i,
                  /на\s+([а-яa-z]+)/i,
                ];

                for (const pattern of locationPatterns) {
                  const match = promptLower.match(pattern);
                  if (match && match[1]) {
                    searchQueries.push(match[1]);
                    break;
                  }
                }
              }

              // Search for POI based on extracted keywords
              const searchRadius = Math.min(targetDistanceKm * 500, 5000); // Increased search radius
              const foundPOIs: LatLngTuple[] = [];

              // Search for all queries in parallel (currentLocation is guaranteed to be non-null here)
              if (currentLocation) {
                const location: LatLngTuple = currentLocation; // Type assertion for TypeScript
                const poiPromises = searchQueries.map((query) =>
                  searchNearbyPOI(location, query, searchRadius)
                );
                const poiResults = await Promise.all(poiPromises);

                for (const pois of poiResults) {
                  foundPOIs.push(...pois);
                }
              }

              // Remove duplicates (points that are very close to each other)
              const uniquePOIs: LatLngTuple[] = [];
              for (const poi of foundPOIs) {
                const isDuplicate = uniquePOIs.some(
                  (existing) => calculateDistance(existing, poi) < 0.1 // Less than 100m apart
                );
                if (!isDuplicate) {
                  uniquePOIs.push(poi);
                }
              }

              if (uniquePOIs.length > 0) {
                // Use found POIs to create route
                locationCoords.push(...uniquePOIs.slice(0, 5)); // Limit to 5 POIs
                // Continue to route generation with POIs below
              } else {
                // If no POIs found, try to search for generic "park" or create circular route
                // Try one more generic search
                if (currentLocation) {
                  const location: LatLngTuple = currentLocation; // Type assertion for TypeScript
                  const genericPOIs = await searchNearbyPOI(
                    location,
                    "park",
                    Math.min(targetDistanceKm * 500, 3000)
                  );
                  if (genericPOIs.length > 0) {
                    locationCoords.push(...genericPOIs.slice(0, 3));
                  } else {
                    // Create circular route
                    const radiusKm = targetDistanceKm / (2 * Math.PI);
                    const radiusMeters = radiusKm * 1000;
                    const [lat, lng] = currentLocation;
                    const latOffset = radiusMeters / 111000;
                    const lngOffset =
                      radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

                    const numPoints = 6;
                    for (let i = 0; i < numPoints; i++) {
                      const angle = (i * 2 * Math.PI) / numPoints;
                      const pointLat = lat + latOffset * Math.cos(angle);
                      const pointLng = lng + lngOffset * Math.sin(angle);
                      routePoints.push([pointLat, pointLng]);
                    }
                    routePoints.push(currentLocation);

                    if (routePoints.length > 1) {
                      let totalDistance = 0;
                      for (let i = 0; i < routePoints.length - 1; i++) {
                        totalDistance += calculateDistance(
                          routePoints[i],
                          routePoints[i + 1]
                        );
                      }
                      finalDistanceKm = totalDistance;
                    }
                  }
                }
              }
            } else {
              alert("Додайте місця або промпт із цілями маршруту");
              setIsGenerating(false);
              if (props.onRouteSummary) {
                props.onRouteSummary(
                  "Маршрут не згенеровано: необхідно вказати місця або промпт."
                );
              }
              return;
            }
          }

          // If we have location coordinates (either from manual input or POI search), create route
          if (locationCoords.length > 0) {
            // Try to include locations within constraints
            // Simple approach: include locations that fit within distance/time constraints
            let currentDistance = 0;
            const visited = new Set<number>();

            // Find closest locations first
            while (
              routePoints.length < locationCoords.length + 1 &&
              visited.size < locationCoords.length
            ) {
              let closestIdx = -1;
              let closestDist = Infinity;
              const lastPoint = routePoints[routePoints.length - 1];

              for (let i = 0; i < locationCoords.length; i++) {
                if (visited.has(i)) continue;

                const dist = calculateDistance(lastPoint, locationCoords[i]);
                if (dist < closestDist) {
                  closestDist = dist;
                  closestIdx = i;
                }
              }

              if (closestIdx === -1) break;

              const distanceToAdd = closestDist * 1000; // convert to meters
              // Check if adding this location would exceed constraints
              if (currentDistance + distanceToAdd <= maxDistanceMeters) {
                routePoints.push(locationCoords[closestIdx]);
                currentDistance += distanceToAdd;
                visited.add(closestIdx);
              } else {
                break;
              }
            }

            // Return to start if possible
            if (routePoints.length > 1) {
              const returnDist =
                calculateDistance(
                  routePoints[routePoints.length - 1],
                  currentLocation
                ) * 1000;
              if (currentDistance + returnDist <= maxDistanceMeters) {
                routePoints.push(currentLocation);
              }
            }

            // Calculate final distance from actual points
            if (routePoints.length > 1) {
              let totalDistance = 0;
              for (let i = 0; i < routePoints.length - 1; i++) {
                totalDistance += calculateDistance(
                  routePoints[i],
                  routePoints[i + 1]
                );
              }
              finalDistanceKm = totalDistance;
            }
          }

          // Ensure we have at least 2 points for route generation
          if (routePoints.length < 2) {
            // If no route points, create a simple circular route
            const radiusKm = targetDistanceKm / (2 * Math.PI);
            const radiusMeters = radiusKm * 1000;
            const [lat, lng] = currentLocation;
            const latOffset = radiusMeters / 111000;
            const lngOffset =
              radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

            const numPoints = 6;
            for (let i = 0; i < numPoints; i++) {
              const angle = (i * 2 * Math.PI) / numPoints;
              const pointLat = lat + latOffset * Math.cos(angle);
              const pointLng = lng + lngOffset * Math.sin(angle);
              routePoints.push([pointLat, pointLng]);
            }
            routePoints.push(currentLocation);

            // Calculate distance
            let totalDistance = 0;
            for (let i = 0; i < routePoints.length - 1; i++) {
              totalDistance += calculateDistance(
                routePoints[i],
                routePoints[i + 1]
              );
            }
            finalDistanceKm = totalDistance;
          }

          // Calculate estimated time (assuming 4.5 km/h walking speed)
          const estimatedTimeMinutes = (finalDistanceKm / 4.5) * 60;

          // Set the generated points
          setGeneratedPoints(routePoints);
          setPoints(routePoints);
          setClearSignal((s) => s + 1); // Clear previous route

          if (props.onRouteSummary) {
            let summaryText = "";
            if (locationCoords.length === 0 && preferences.prompt) {
              summaryText = `Маршрут згенеровано на основі промпту. Орієнтовна довжина: ${finalDistanceKm.toFixed(
                1
              )} км.`;
            } else {
              const includedLocations = combinedLocations.slice(
                0,
                Math.min(routePoints.length - 1, combinedLocations.length)
              );
              summaryText =
                routePoints.length > 1
                  ? `Маршрут стартує з вашої локації${
                      includedLocations.length > 0
                        ? ` та включає: ${includedLocations.join(", ")}`
                        : ""
                    }. Орієнтовна довжина: ${finalDistanceKm.toFixed(1)} км.`
                  : "Не вдалося побудувати маршрут з обраними параметрами.";
            }
            props.onRouteSummary(summaryText);
          }

          // Callback for statistics
          if (props.onRouteGenerated && routePoints.length > 1) {
            const routeData = {
              distanceKm: finalDistanceKm,
              locations: combinedLocations,
              prompt: preferences.prompt,
              estimatedTimeMinutes: estimatedTimeMinutes,
            };
            setLastRouteData(routeData);
            props.onRouteGenerated(routeData);
          }
        } catch (error) {
          console.error("Route generation error:", error);
          alert("Помилка при генерації маршруту");
        } finally {
          setIsGenerating(false);
        }
      },
      [userLocation, props.onRouteSummary, props.onRouteGenerated]
    );

    // Calculate distance between two points in kilometers (Haversine formula)
    const calculateDistance = (
      point1: LatLngTuple,
      point2: LatLngTuple
    ): number => {
      const R = 6371; // Earth's radius in km
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

    // Expose generateRouteFromPreferences and requestGeolocation to parent via ref
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

        // Конвертуємо точки в правильний формат [lat, lng]
        const points: [number, number][] = generatedPoints.map((point) => [
          point[0],
          point[1],
        ]);

        // Зберегти маршрут через функцію saveRoute
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

        // Автоматично додати маршрут в улюблені
        if (savedRouteData && savedRouteData.id) {
          try {
            await supabaseModules.addToFavorites(savedRouteData.id);
          } catch (favErr) {
            console.warn("Помилка додавання в улюблені:", favErr);
            // Маршрут збережено, але не додано в улюблені - це не критично
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

    // Load saved route from points
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

          // Set route points
          setPoints(routeData.points as LatLngTuple[]);

          // Calculate and display distance
          let totalDistance = 0;
          for (let i = 0; i < routeData.points.length - 1; i++) {
            totalDistance += calculateDistance(
              routeData.points[i] as LatLngTuple,
              routeData.points[i + 1] as LatLngTuple
            );
          }

          // Create summary
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
      [calculateDistance, props]
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
      [generateRouteFromPreferences, loadSavedRoute, isGenerating, userLocation]
    );

    return (
      <div>
        <button
          className="z-1 btn btn-success position-fixed pb-2 rounded-circle"
          style={{ bottom: "80px", left: "20px" }}
          onClick={clearAll}
          title="Очистити маршрут"
        >
          <i className="bi bi-trash"></i>
        </button>

        {generatedPoints.length > 1 && user && (
          <button
            className="z-1 btn btn-primary position-fixed pb-2 rounded-circle"
            style={{ bottom: "80px", left: "80px" }}
            onClick={handleSaveRoute}
            disabled={isSaving}
            title={isSaving ? "Збереження..." : "Зберегти маршрут"}
          >
            <i
              className={`bi bi-${isSaving ? "hourglass-split" : "bookmark"}`}
            ></i>
          </button>
        )}

        <MapContainer
          center={[49.234, 28.469]}
          zoom={13}
          style={{ height: "calc(100dvh - 120px)", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          />
          <GeolocationControl
            onLocationUpdate={handleLocationUpdate}
            onHeadingUpdate={handleHeadingUpdate}
            onRequestGeolocationRef={requestGeolocationRef}
          />

          {userLocation && (
            <Marker
              position={userLocation}
              icon={createUserLocationIcon(userHeading)}
            >
              <Popup>
                <strong>Ваше місцезнаходження</strong>
                <br />
                {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
                <br />
                Напрямок: {Math.round(userHeading)}°
              </Popup>
            </Marker>
          )}

          {points.map((pos, idx) => (
            <Marker key={idx} position={pos}>
              <Popup>
                <strong>Точка {idx + 1}</strong>
                <br />
                {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
              </Popup>
            </Marker>
          ))}

          <RoutingMachine
            points={points}
            clearSignal={clearSignal}
            onRouteDrawn={(layer) => (routeLayerRefParent.current = layer)}
          />
        </MapContainer>
      </div>
    );
  }
);

RoutingMap.displayName = "RoutingMap";

export default RoutingMap;
