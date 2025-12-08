// src/Components/RouteMap.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom icon for user location with direction indicator
const createUserLocationIcon = (heading: number) => {
  return L.divIcon({
    className: "user-location-icon",
    html: `
      <div style="
        position: relative;
        width: 50px;
        height: 50px;
      ">
        <!-- Outer pulse ring -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(25, 135, 84, 0.2);
          animation: pulse 2s infinite;
        "></div>
        <!-- Middle ring -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(25, 135, 84, 0.4);
          border: 2px solid white;
        "></div>
        <!-- Inner dot with large arrow -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #198754;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Large arrow pointing in direction -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(${heading}deg);
            font-size: 18px;
            font-weight: bold;
            color: white;
            text-shadow: 0 1px 3px rgba(0,0,0,0.5);
            line-height: 1;
            margin-top: -2px;
          ">&gt;</div>
        </div>
        <style>
          @keyframes pulse {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.7;
            }
            50% {
              transform: translate(-50%, -50%) scale(1.5);
              opacity: 0.3;
            }
            100% {
              transform: translate(-50%, -50%) scale(2);
              opacity: 0;
            }
          }
        </style>
      </div>
    `,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
  });
};

type LatLngTuple = [number, number];

const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImE3YzUxNmU2ZmMzYzQyMTQ4OTJhMWM4YWM1YTI2OWQ1IiwiaCI6Im11cm11cjY0In0="; // <-- встав свій ключ

// Geocoding function to convert location name to coordinates
const geocodeLocation = async (locationName: string): Promise<LatLngTuple | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`,
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

// Search for POI (Points of Interest) near user location
const searchNearbyPOI = async (
  center: LatLngTuple,
  query: string,
  radius: number = 2000
): Promise<LatLngTuple[]> => {
  try {
    const [lat, lng] = center;
    // Use Nominatim to search for places near the user
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&lat=${lat}&lon=${lng}&radius=${radius}&limit=5`,
      {
        headers: {
          "User-Agent": "Walkify App",
        },
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return data.map((item: any) => [parseFloat(item.lat), parseFloat(item.lon)]);
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
  const watchIdRef = useRef<number | null>(null);
  const orientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);

  const startGeolocation = () => {
    if (!navigator.geolocation) {
      alert("Геолокація не підтримується вашим браузером");
      return;
    }

    setIsActive(true);

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        onLocationUpdate(latitude, longitude);
        
        // Use heading from geolocation if available
        if (heading !== null && heading !== undefined && !isNaN(heading)) {
          onHeadingUpdate(heading);
        }

        // Center map on user location
        map.setView([latitude, longitude], map.getZoom());
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Помилка отримання геолокації: " + error.message);
        setIsActive(false);
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
              window.addEventListener("deviceorientation", orientationHandlerRef.current);
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
      window.removeEventListener("deviceorientation", orientationHandlerRef.current);
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
    <button
      className={`btn ${isActive ? "btn-success" : "btn-success"} position-absolute rounded-circle`}
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
      title={isActive ? "Зупинити геолокацію" : "Показати моє місцезнаходження"}
    >
      <i className={`bi bi-${isActive ? "geo-alt-fill" : "geo-alt"}`} style={{ fontSize: "20px" }}></i>
    </button>
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

const RoutingMap = React.forwardRef<RouteMapRef, RoutingMapProps>((props, ref) => {
  const [points, setPoints] = useState<LatLngTuple[]>([]);
  const [clearSignal, setClearSignal] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [userHeading, setUserHeading] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPoints, setGeneratedPoints] = useState<LatLngTuple[]>([]);
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

  const inferDistanceFromPrompt = (prompt?: string, fallbackKm = 3): number => {
    if (!prompt) return fallbackKm;
    const normalized = prompt.toLowerCase().replace(",", ".");
    const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(год|hour|h)/);
    const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(хв|min)/);
    if (hourMatch) {
      const hrs = parseFloat(hourMatch[1]);
      if (!Number.isNaN(hrs) && hrs > 0) return Math.max(1, Math.min(hrs * 4.5, 50));
    }
    if (minMatch) {
      const mins = parseFloat(minMatch[1]);
      if (!Number.isNaN(mins) && mins > 0) return Math.max(1, Math.min((mins / 60) * 4.5, 50));
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

  const generateRouteFromPreferences = React.useCallback(async (preferences: WalkPreferences) => {
    // Якщо геолокація не ввімкнена, спробувати автоматично отримати
    let currentLocation = userLocation;
    
    if (!currentLocation) {
      // Спробувати отримати поточну позицію
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 300000, // Використовувати кешовану позицію до 5 хвилин
            });
          });
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
      // Merge prompt-derived hints with manual locations
      const promptLocations = extractLocationsFromPrompt(preferences.prompt);
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
          if (promptLower.includes("парк") || promptLower.includes("park")) {
            searchQueries.push("park");
          }
          if (promptLower.includes("кафе") || promptLower.includes("cafe") || promptLower.includes("кав")) {
            searchQueries.push("cafe");
          }
          if (promptLower.includes("магазин") || promptLower.includes("shop") || promptLower.includes("атб") || promptLower.includes("atb") || promptLower.includes("сільпо") || promptLower.includes("silpo")) {
            searchQueries.push("supermarket");
          }
          if (promptLower.includes("ресторан") || promptLower.includes("restaurant")) {
            searchQueries.push("restaurant");
          }
          if (promptLower.includes("музей") || promptLower.includes("museum")) {
            searchQueries.push("museum");
          }
          if (promptLower.includes("церква") || promptLower.includes("church") || promptLower.includes("храм")) {
            searchQueries.push("church");
          }
          
          // Search for POI based on extracted keywords
          const searchRadius = Math.min(targetDistanceKm * 500, 3000); // Search within reasonable radius
          const foundPOIs: LatLngTuple[] = [];
          
          for (const query of searchQueries) {
            const pois = await searchNearbyPOI(currentLocation, query, searchRadius);
            foundPOIs.push(...pois);
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
            // If no POIs found, create a more natural circular route
            const radiusKm = targetDistanceKm / (2 * Math.PI);
            const radiusMeters = radiusKm * 1000;
            const [lat, lng] = currentLocation;
            const latOffset = radiusMeters / 111000;
            const lngOffset = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));
            
            // Create a more natural route with 6 points in a circle
            const numPoints = 6;
            for (let i = 0; i < numPoints; i++) {
              const angle = (i * 2 * Math.PI) / numPoints;
              const pointLat = lat + latOffset * Math.cos(angle);
              const pointLng = lng + lngOffset * Math.sin(angle);
              routePoints.push([pointLat, pointLng]);
            }
            routePoints.push(currentLocation); // return to start
            
            // Calculate actual distance for circular route
            if (routePoints.length > 1) {
              let totalDistance = 0;
              for (let i = 0; i < routePoints.length - 1; i++) {
                totalDistance += calculateDistance(routePoints[i], routePoints[i + 1]);
              }
              finalDistanceKm = totalDistance;
            }
          }
        } else {
          alert("Додайте місця або промпт із цілями маршруту");
          setIsGenerating(false);
          if (props.onRouteSummary) {
            props.onRouteSummary("Маршрут не згенеровано: необхідно вказати місця або промпт.");
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
        while (routePoints.length < locationCoords.length + 1 && visited.size < locationCoords.length) {
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
          const returnDist = calculateDistance(routePoints[routePoints.length - 1], currentLocation) * 1000;
          if (currentDistance + returnDist <= maxDistanceMeters) {
            routePoints.push(currentLocation);
          }
        }

        // Calculate final distance from actual points
        if (routePoints.length > 1) {
          let totalDistance = 0;
          for (let i = 0; i < routePoints.length - 1; i++) {
            totalDistance += calculateDistance(routePoints[i], routePoints[i + 1]);
          }
          finalDistanceKm = totalDistance;
        }
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
          summaryText = `Маршрут згенеровано на основі промпту. Орієнтовна довжина: ${finalDistanceKm.toFixed(1)} км.`;
        } else {
          const includedLocations = combinedLocations.slice(0, Math.min(routePoints.length - 1, combinedLocations.length));
          summaryText =
            routePoints.length > 1
              ? `Маршрут стартує з вашої локації${includedLocations.length > 0 ? ` та включає: ${includedLocations.join(", ")}` : ""}. Орієнтовна довжина: ${finalDistanceKm.toFixed(1)} км.`
              : "Не вдалося побудувати маршрут з обраними параметрами.";
        }
        props.onRouteSummary(summaryText);
      }

      // Callback for statistics
      if (props.onRouteGenerated && routePoints.length > 1) {
        props.onRouteGenerated({
          distanceKm: finalDistanceKm,
          locations: combinedLocations,
          prompt: preferences.prompt,
          estimatedTimeMinutes: estimatedTimeMinutes,
        });
      }
    } catch (error) {
      console.error("Route generation error:", error);
      alert("Помилка при генерації маршруту");
    } finally {
      setIsGenerating(false);
    }
  }, [userLocation, props.onRouteSummary, props.onRouteGenerated]);

  // Calculate distance between two points in kilometers (Haversine formula)
  const calculateDistance = (point1: LatLngTuple, point2: LatLngTuple): number => {
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
  React.useImperativeHandle(
    ref,
    () => ({
      generateRoute: generateRouteFromPreferences,
      isGenerating,
      requestGeolocation: () => {
        if (requestGeolocationRef.current) {
          requestGeolocationRef.current();
        }
      },
    }),
    [generateRouteFromPreferences, isGenerating, userLocation]
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
});

RoutingMap.displayName = "RoutingMap";

export default RoutingMap;
