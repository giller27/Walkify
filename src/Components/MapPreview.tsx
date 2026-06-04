import React, { useEffect, useRef } from "react";
import { loadGoogleMaps } from "../services/googleMapsLoader";

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
  const mapRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    let disposed = false;

    const clearMapOverlays = () => {
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };

    const renderPreview = async () => {
      if (!containerRef.current || !points || points.length < 2) {
        return;
      }

      try {
        const maps = await loadGoogleMaps();
        if (disposed || !containerRef.current) return;

        const path = points.map(([lat, lng]) => ({ lat, lng }));
        const map =
          mapRef.current ||
          new maps.Map(containerRef.current, {
            center: path[0],
            zoom: 13,
            disableDefaultUI: true,
            draggable: false,
            keyboardShortcuts: false,
            scrollwheel: false,
            clickableIcons: false,
          });

        mapRef.current = map;
        clearMapOverlays();

        routeLineRef.current = new maps.Polyline({
          map,
          path,
          strokeColor: isPublic ? "#28a745" : "#6c757d",
          strokeOpacity: 0.85,
          strokeWeight: 4,
        });

        markersRef.current.push(
          new maps.Marker({
            map,
            position: path[0],
            title: "Початок маршруту",
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#28a745",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          }),
          new maps.Marker({
            map,
            position: path[path.length - 1],
            title: "Кінець маршруту",
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#dc3545",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          })
        );

        const bounds = new maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, 10);
      } catch (error) {
        console.error("Помилка превʼю Google Maps:", error);
      }
    };

    renderPreview();

    return () => {
      disposed = true;
      clearMapOverlays();
      mapRef.current = null;
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
