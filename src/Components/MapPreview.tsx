/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import { loadGoogleMaps } from "../services/googleMapsLoader";

interface MapPreviewProps {
  points?: [number, number][]; // [lat, lng]
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
  const overlaysRef = useRef<Array<google.maps.Marker | google.maps.Polyline>>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !points || points.length < 2) {
      setMapLoading(false);
      return;
    }

    let cancelled = false;

    const clearOverlays = () => {
      overlaysRef.current.forEach((overlay) => {
        if ("setMap" in overlay) overlay.setMap(null);
      });
      overlaysRef.current = [];
      mapRef.current = null;
    };

    setMapLoading(true);
    setMapError(null);

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        clearOverlays();

        const path = points.map((p) => ({ lat: p[0], lng: p[1] }));

        const map = new google.maps.Map(containerRef.current, {
          center: path[0],
          zoom: 13,
          disableDefaultUI: true,
          gestureHandling: "none",
          clickableIcons: false,
        });

        mapRef.current = map;

        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: isPublic ? "#28a745" : "#198754",
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map,
        });
        overlaysRef.current.push(polyline);

        const startMarker = new google.maps.Marker({
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

        const endMarker = new google.maps.Marker({
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

        overlaysRef.current.push(startMarker, endMarker);

        const bounds = new google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds);

        google.maps.event.trigger(map, "resize");
        setMapLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("MapPreview:", err);
        setMapError("Не вдалося завантажити карту");
        setMapLoading(false);
      });

    return () => {
      cancelled = true;
      clearOverlays();
    };
  }, [points, isPublic]);

  if (!points || points.length < 2) {
    return (
      <div
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
      style={{
        height: `${height}px`,
        width: "100%",
        borderRadius: "4px 4px 0 0",
        overflow: "hidden",
        position: "relative",
        background: "#e9ecef",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {mapLoading && (
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: "rgba(255,255,255,0.7)", zIndex: 1 }}
        >
          <Spinner animation="border" size="sm" variant="success" />
        </div>
      )}
      {mapError && (
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center small text-muted px-2 text-center"
          style={{ background: "#f0f0f0", zIndex: 1 }}
        >
          {mapError}
        </div>
      )}
    </div>
  );
};

export default MapPreview;
