/// <reference types="google.maps" />
import React, { useEffect, useRef } from "react";

interface MapPreviewProps {
  points?: [number, number][]; // Очікується [lat, lng]
  isPublic?: boolean;
  height?: number;
}

const MapPreview: React.FC<MapPreviewProps> = ({
  points = [],
  isPublic = false,
  height = 200,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    // Якщо немає контейнера, мало точок, або Google API ще не завантажився
    if (!containerRef.current || !points || points.length < 2 || !window.google) {
      return;
    }

    const path = points.map((p) => ({ lat: p[0], lng: p[1] }));

    // Створюємо нову карту
    const map = new google.maps.Map(containerRef.current, {
      center: path[0],
      zoom: 13,
      disableDefaultUI: true, // Прибираємо зайві кнопки для прев'ю
      gestureHandling: "none", // Робимо карту неінтерактивною (як було раніше)
      mapId: "DEMO_MAP_ID",
    });

    mapRef.current = map;

    // Додаємо лінію маршруту
    new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: isPublic ? "#28a745" : "#6c757d",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      map,
    });

    // Маркер на старті (зелений)
    new google.maps.Marker({
      position: path[0],
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: "#28a745",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#ffffff",
      },
    });

    // Маркер на фініші (червоний)
    new google.maps.Marker({
      position: path[path.length - 1],
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: "#dc3545",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#ffffff",
      },
    });

    // Вписуємо карту в межі точок маршруту
    const bounds = new google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds);

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