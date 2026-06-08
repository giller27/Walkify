/// <reference types="google.maps" />
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { generateRouteFromText, RouteResult, RouteWaypoint } from "../services/routeService";
import { getTerrainInfo } from "../services/routeOptions";
import type { SavedRoute } from "../services/supabaseService";
import type { RouteDifficulty } from "../types/routeEnhancements";

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
    difficulty?: RouteDifficulty;
  }) => void;
  panelExpanded?: boolean;
}

const TYPE_COLOR_MAP: Record<string, string> = {
  cafe: "#ff8c00", park: "#4caf50", restaurant: "#ff5722", shop: "#3f51b5",
  museum: "#9c27b0", library: "#03a9f4", church: "#795548", beach: "#ffc107",
  lake: "#2196f3", river: "#00bcd4", tourist_attraction: "#ef5350", custom: "#6c757d"
};

const TYPE_EMOJI: Record<string, string> = {
  cafe: "☕", park: "🌿", restaurant: "🍽️", shop: "🛍️",
  museum: "🏛️", library: "📚", church: "⛪", beach: "🏖️",
  lake: "🌊", river: "🌊", tourist_attraction: "⭐", custom: "📍"
};

function createSvgIcon(emoji: string, color: string): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="15" fill="${color}" stroke="#fff" stroke-width="2.5"/>
    <text x="18" y="23" font-size="14" text-anchor="middle" font-family="sans-serif">${emoji}</text>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(36, 36),
    anchor: new google.maps.Point(18, 18),
  };
}

const RouteMap = forwardRef<RouteMapRef, RouteMapProps>(
  ({ onRouteSummary, onRouteGenerated, panelExpanded = true }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const routeLineRef = useRef<google.maps.Polyline | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const currentRouteRef = useRef<RouteResult | null>(null);
    const [selectedPoi, setSelectedPoi] = useState<RouteWaypoint | null>(null);

    useEffect(() => {
      if (!mapContainerRef.current || !window.google) return;
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 50.4501, lng: 30.5234 },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
      });
      mapRef.current = map;
    }, []);

    const clearRouteAndMarkers = () => {
      if (routeLineRef.current) routeLineRef.current.setMap(null);
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };

    const displayRoute = (route: RouteResult) => {
      const map = mapRef.current;
      if (!map) return;
      clearRouteAndMarkers();
      
      const path = route.points.map(p => ({ lat: p[0], lng: p[1] }));
      routeLineRef.current = new google.maps.Polyline({ path, strokeColor: '#28a745', strokeOpacity: 0.9, strokeWeight: 5, map });

      const bounds = new google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      map.fitBounds(bounds);

      route.waypoints.forEach((wp) => {
        const color = TYPE_COLOR_MAP[wp.type] || TYPE_COLOR_MAP["custom"];
        const emoji = TYPE_EMOJI[wp.type] || "📍";
        const marker = new google.maps.Marker({
          position: { lat: wp.location[0], lng: wp.location[1] },
          map,
          title: wp.name,
          icon: createSvgIcon(emoji, color)
        });
        marker.addListener("click", () => setSelectedPoi(wp));
        markersRef.current.push(marker);
      });
    };

    const generateRoute = async (preferences: WalkPreferences) => {
      if (!userLocation) return;
      setIsGenerating(true);
      try {
        const route = await generateRouteFromText(userLocation, preferences.prompt, { routeMode: preferences.routeMode });
        currentRouteRef.current = route;
        displayRoute(route);
        onRouteGenerated?.({ ...route, prompt: preferences.prompt });
      } finally {
        setIsGenerating(false);
      }
    };

    const loadSavedRoute = async (route: SavedRoute) => {
      const safeWaypoints: RouteWaypoint[] = ((route as any).waypoints || []).map((wp: any) => ({
        location: wp.location,
        name: wp.name,
        type: wp.type,
        address: wp.address,
        rating: wp.rating,
        source: (wp.source === 'google' || wp.source === 'custom') ? wp.source : 'custom'
      }));

      const routeResult: RouteResult = {
        points: route.points,
        waypoints: safeWaypoints,
        distanceKm: (route as any).statistics?.distanceKm || 0,
        estimatedTimeMinutes: (route as any).statistics?.estimatedTimeMinutes || 0,
        locations: (route as any).locations || [],
        difficulty: (route as any).difficulty
      };
      
      currentRouteRef.current = routeResult;
      displayRoute(routeResult);
    };

    useImperativeHandle(ref, () => ({
      generateRoute,
      loadSavedRoute,
      requestGeolocation: () => {},
      getCurrentRoute: () => currentRouteRef.current,
      clearCurrentRoute: clearRouteAndMarkers,
      isGenerating
    }));

    return (
      <>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%", position: "absolute" }} />
        {selectedPoi && (
          <div className="card position-fixed" style={{ bottom: 100, right: 20, zIndex: 1200, width: 250 }}>
            <div className="card-body">
              <h6>{selectedPoi.name}</h6>
              <p className="small">{selectedPoi.description}</p>
            </div>
          </div>
        )}
      </>
    );
  }
);

RouteMap.displayName = "RouteMap";
export default RouteMap;