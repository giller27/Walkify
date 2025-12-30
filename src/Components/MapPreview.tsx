import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsbGV5cy1jb21ldCIsImEiOiJjbWpzcmc0dzQ0NHZ1M2dxeDRyOTFtNHFxIn0.gCWJwF521jdHqD38Nn8ZsA";

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
  const mapRef = useRef<mapboxgl.Map | null>(null);

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
    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: MAPBOX_TOKEN,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [points[0][1], points[0][0]], // [lng, lat]
      zoom: 13,
      interactive: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      // Конвертувати points в формат для Mapbox [lng, lat]
      const coordinates = points.map((p) => [p[1], p[0]] as [number, number]);

      // Додати джерело даних для маршруту
      map.addSource("route", {
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

      // Додати шар для лінії маршруту
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": isPublic ? "#28a745" : "#6c757d",
          "line-width": 3,
          "line-opacity": 0.8,
        },
      });

      // Додати маркери на початку та кінці
      new mapboxgl.Marker({
        color: "#28a745",
        scale: 0.8,
      })
        .setLngLat([points[0][1], points[0][0]])
        .addTo(map);

      new mapboxgl.Marker({
        color: "#dc3545",
        scale: 0.8,
      })
        .setLngLat([
          points[points.length - 1][1],
          points[points.length - 1][0],
        ])
        .addTo(map);

      // Вписати карту в межі маршруту
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach((coord) => {
        bounds.extend(coord as [number, number]);
      });
      map.fitBounds(bounds, { padding: 10 });
    });

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
