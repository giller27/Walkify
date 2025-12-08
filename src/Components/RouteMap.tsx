// src/Components/RouteMap.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
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
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        background: #198754;
        border: 3px solid white;
        transform: rotate(${heading}deg);
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        position: relative;
      ">
        <div style="
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 12px solid #198754;
        "></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
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
}: {
  onLocationUpdate: (lat: number, lng: number) => void;
  onHeadingUpdate: (heading: number) => void;
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

  useEffect(() => {
    return () => {
      stopGeolocation();
    };
  }, []);

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
      onClick={isActive ? stopGeolocation : startGeolocation}
      title={isActive ? "Зупинити геолокацію" : "Показати моє місцезнаходження"}
    >
      <i className={`bi bi-${isActive ? "geo-alt-fill" : "geo-alt"}`} style={{ fontSize: "20px" }}></i>
    </button>
  );
};

// ================= Головний компонент карти =================
export interface WalkPreferences {
  locations: string[];
  timeMinutes: number;
  distanceKm: number;
}

export interface RouteMapRef {
  generateRoute: (preferences: WalkPreferences) => Promise<void>;
  isGenerating: boolean;
}

const RoutingMap = React.forwardRef<RouteMapRef>((props, ref) => {
  const [points, setPoints] = useState<LatLngTuple[]>([]);
  const [clearSignal, setClearSignal] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [userHeading, setUserHeading] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPoints, setGeneratedPoints] = useState<LatLngTuple[]>([]);
  const routeLayerRefParent = useRef<L.Layer | null>(null);

  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPoints((prev) => {
          // зберігаємо максимум 10 точок або інша логіка
          return [...prev, [lat, lng]];
        });
      },
    });
    return null;
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
    if (!userLocation) {
      alert("Будь ласка, увімкніть геолокацію спочатку");
      return;
    }

    setIsGenerating(true);
    try {
      // Geocode all locations
      const locationCoords: LatLngTuple[] = [];
      for (const location of preferences.locations) {
        const coords = await geocodeLocation(location);
        if (coords) {
          locationCoords.push(coords);
        } else {
          console.warn(`Could not geocode location: ${location}`);
        }
      }

      if (locationCoords.length === 0) {
        alert("Не вдалося знайти жодного з вказаних місць");
        setIsGenerating(false);
        return;
      }

      // Calculate average walking speed (km/h) - typical is 4-5 km/h
      const walkingSpeedKmh = 4.5;
      const maxDistanceMeters = preferences.distanceKm * 1000;
      const maxTimeSeconds = preferences.timeMinutes * 60;

      // Start with user location
      const routePoints: LatLngTuple[] = [userLocation];

      // Try to include locations within constraints
      // Simple approach: include locations that fit within distance/time constraints
      let currentDistance = 0;
      let currentTime = 0;
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
        const timeToAdd = (distanceToAdd / walkingSpeedKmh) * 3.6; // convert to seconds

        // Check if adding this location would exceed constraints
        if (currentDistance + distanceToAdd <= maxDistanceMeters &&
            currentTime + timeToAdd <= maxTimeSeconds) {
          routePoints.push(locationCoords[closestIdx]);
          currentDistance += distanceToAdd;
          currentTime += timeToAdd;
          visited.add(closestIdx);
        } else {
          break;
        }
      }

      // Return to start if possible
      if (routePoints.length > 1) {
        const returnDist = calculateDistance(routePoints[routePoints.length - 1], userLocation) * 1000;
        const returnTime = (returnDist / walkingSpeedKmh) * 3.6;
        if (currentDistance + returnDist <= maxDistanceMeters &&
            currentTime + returnTime <= maxTimeSeconds) {
          routePoints.push(userLocation);
        }
      }

      // Set the generated points
      setGeneratedPoints(routePoints);
      setPoints(routePoints);
      setClearSignal((s) => s + 1); // Clear previous route
    } catch (error) {
      console.error("Route generation error:", error);
      alert("Помилка при генерації маршруту");
    } finally {
      setIsGenerating(false);
    }
  }, [userLocation]);

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

  // Expose generateRouteFromPreferences to parent via ref
  React.useImperativeHandle(
    ref,
    () => ({
      generateRoute: generateRouteFromPreferences,
      isGenerating,
    }),
    [generateRouteFromPreferences, isGenerating]
  );

  return (
    <div>
      <button
        className="z-1 btn btn-success position-fixed pb-2 rounded-circle"
        style={{ bottom: "160px", left: "20px" }}
        onClick={clearAll}
        title="Очистити маршрут"
      >
        <i className="bi bi-trash"></i>
      </button>

      <MapContainer
        center={[49.234, 28.469]}
        zoom={13}
        style={{ height: "calc(100dvh - 260px)", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        />
        <MapClickHandler />
        <GeolocationControl
          onLocationUpdate={handleLocationUpdate}
          onHeadingUpdate={handleHeadingUpdate}
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
