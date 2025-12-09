import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPreviewProps {
  points?: [number, number][];
  isPublic?: boolean;
  height?: number;
}

const MapPreview: React.FC<MapPreviewProps> = ({
  points = [],
  isPublic = false,
  height = 200,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || !points || points.length < 2) {
      return;
    }

    // Очистити попередню карту
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Створити нову карту
    const map = L.map(containerRef.current, {
      zoom: 13,
      center: [points[0][0], points[0][1]],
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    mapRef.current = map;

    // Додати tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    // Конвертувати points в LatLngTuple для leaflet
    const latLngs = points.map((p) => [p[0], p[1]] as L.LatLngTuple);

    // Додати маршрут як поліліню
    const polyline = L.polyline(latLngs, {
      color: isPublic ? "#28a745" : "#6c757d",
      weight: 3,
      opacity: 0.8,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Додати маркери на початку та кінці
    L.circleMarker(latLngs[0], {
      radius: 5,
      fillColor: "#28a745",
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    }).addTo(map);

    L.circleMarker(latLngs[latLngs.length - 1], {
      radius: 5,
      fillColor: "#dc3545",
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    }).addTo(map);

    // Вписати карту в межі маршруту
    const bounds = polyline.getBounds();
    map.fitBounds(bounds, { padding: [10, 10] });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points, isPublic]);

  if (!points || points.length < 2) {
    return (
      <div
        ref={containerRef}
        style={{
          height: `${height}px`,
          width: "100%",
          background: "#f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: "14px",
          borderRadius: "4px 4px 0 0",
        }}
      >
        <i className="bi bi-exclamation-triangle me-2"></i>
        Немає даних маршруту
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: `${height}px`,
        width: "100%",
        borderRadius: "4px 4px 0 0",
        overflow: "hidden",
      }}
    />
  );
};

export default MapPreview;
