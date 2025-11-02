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

type LatLngTuple = [number, number];

const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImE3YzUxNmU2ZmMzYzQyMTQ4OTJhMWM4YWM1YTI2OWQ1IiwiaCI6Im11cm11cjY0In0="; // <-- встав свій ключ

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

// ================= Головний компонент карти =================
const RoutingMap: React.FC = () => {
  const [points, setPoints] = useState<LatLngTuple[]>([]);
  const [clearSignal, setClearSignal] = useState<number>(0);
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
        <MapClickHandler />

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
};

export default RoutingMap;
