/// <reference types="google.maps" />
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { generateRouteFromText, RouteResult, RouteWaypoint } from "../services/routeService";
import { reverseGeocode } from "../services/placesService";
import type { SavedRoute } from "../services/supabaseService";
import type { RouteDifficulty } from "../types/routeEnhancements";
import PlaceInfoCard from "./PlaceInfoCard";

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
  pickDestinationMode?: boolean;
  onDestinationPicked?: (coords: [number, number], address: string) => void;
}

const TYPE_COLOR_MAP: Record<string, string> = {
  cafe: "#ff8c00", park: "#4caf50", restaurant: "#ff5722", shop: "#3f51b5", store: "#3f51b5",
  museum: "#9c27b0", library: "#03a9f4", church: "#795548", beach: "#ffc107",
  lake: "#2196f3", river: "#00bcd4", tourist_attraction: "#ef5350", custom: "#6c757d",
  bakery: "#d4a574", art_gallery: "#ab47bc", book_store: "#5c6bc0", shopping_mall: "#3949ab",
  gym: "#e53935", spa: "#8d6e63", zoo: "#ff9800", stadium: "#607d8b",
  movie_theater: "#7e57c2", night_club: "#c2185b", playground: "#66bb6a",
};

const TYPE_EMOJI: Record<string, string> = {
  cafe: "☕", park: "🌿", restaurant: "🍽️", shop: "🛍️", store: "🛍️",
  museum: "🏛️", library: "📚", church: "⛪", beach: "🏖️",
  lake: "🌊", river: "🌊", tourist_attraction: "⭐", custom: "📍",
  bakery: "🥐", art_gallery: "🎨", book_store: "📖", shopping_mall: "🏬",
  gym: "💪", spa: "🧖", zoo: "🦁", stadium: "🏟️",
  movie_theater: "🎬", night_club: "🎵", playground: "🛝",
};

function createSvgIcon(emoji: string, color: string, label?: string): google.maps.Icon {
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

function createNumberedIcon(number: number, color: string): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14" fill="${color}" stroke="#fff" stroke-width="2"/>
    <text x="16" y="21" font-size="13" font-weight="bold" text-anchor="middle" fill="#fff" font-family="sans-serif">${number}</text>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16),
  };
}

const RouteMap = forwardRef<RouteMapRef, RouteMapProps>(
  ({ onRouteSummary, onRouteGenerated, panelExpanded = true, pickDestinationMode, onDestinationPicked }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const routeLineRef = useRef<google.maps.Polyline | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
    const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const currentRouteRef = useRef<RouteResult | null>(null);
    const [selectedPoi, setSelectedPoi] = useState<{ waypoint: RouteWaypoint; stopNumber?: number } | null>(null);

    useEffect(() => {
      if (!mapContainerRef.current || !window.google) return;
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 50.4501, lng: 30.5234 },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
      mapRef.current = map;

      navigator.geolocation.getCurrentPosition((pos) => {
        const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(loc);
        map.setCenter({ lat: loc[1], lng: loc[0] });
      });
    }, []);

    const clearRouteAndMarkers = useCallback(() => {
      if (routeLineRef.current) routeLineRef.current.setMap(null);
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      setSelectedPoi(null);
    }, []);

    const displayRoute = useCallback((route: RouteResult) => {
      const map = mapRef.current;
      if (!map) return;
      clearRouteAndMarkers();

      const path = route.points.map(p => ({ lat: p[0], lng: p[1] }));

      routeLineRef.current = new google.maps.Polyline({
        path,
        strokeColor: '#28a745',
        strokeOpacity: 0.85,
        strokeWeight: 5,
        map,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            strokeColor: '#1b5e20',
            fillColor: '#1b5e20',
            fillOpacity: 1,
          },
          offset: '0',
          repeat: '70px',
        }],
      });

      const bounds = new google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      map.fitBounds(bounds);

      route.waypoints.forEach((wp, index) => {
        const color = TYPE_COLOR_MAP[wp.type] || TYPE_COLOR_MAP["custom"];
        const emoji = TYPE_EMOJI[wp.type] || "📍";
        const isDestination = wp.type === 'custom' && index === route.waypoints.length - 1;

        const marker = new google.maps.Marker({
          position: { lat: wp.location[0], lng: wp.location[1] },
          map,
          title: wp.name,
          icon: isDestination
            ? createSvgIcon('🏁', '#dc3545')
            : createNumberedIcon(index + 1, color),
          zIndex: isDestination ? 200 : 100 + index,
        });

        marker.addListener("click", () => {
          setSelectedPoi({ waypoint: wp, stopNumber: isDestination ? undefined : index + 1 });
        });
        markersRef.current.push(marker);
      });

      const summary = `${route.distanceKm} км · ~${route.estimatedTimeMinutes} хв${route.difficulty ? ` · ${route.difficulty}` : ''}`;
      onRouteSummary?.(summary);
    }, [clearRouteAndMarkers, onRouteSummary]);

    const setDestinationMarker = useCallback((coords: [number, number]) => {
      const map = mapRef.current;
      if (!map) return;

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setMap(null);
      }

      destinationMarkerRef.current = new google.maps.Marker({
        position: { lat: coords[1], lng: coords[0] },
        map,
        icon: createSvgIcon('🏁', '#dc3545'),
        title: 'Пункт призначення',
        zIndex: 300,
      });
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      if (mapClickListenerRef.current) {
        google.maps.event.removeListener(mapClickListenerRef.current);
        mapClickListenerRef.current = null;
      }

      if (pickDestinationMode) {
        map.setOptions({ draggableCursor: 'crosshair' });
        mapClickListenerRef.current = map.addListener('click', async (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const coords: [number, number] = [e.latLng.lng(), e.latLng.lat()];
          const address = await reverseGeocode(coords) || `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;
          setDestinationMarker(coords);
          onDestinationPicked?.(coords, address);
        });
      } else {
        map.setOptions({ draggableCursor: undefined });
      }

      return () => {
        if (mapClickListenerRef.current) {
          google.maps.event.removeListener(mapClickListenerRef.current);
        }
      };
    }, [pickDestinationMode, onDestinationPicked, setDestinationMarker]);

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
        userRatingsTotal: wp.userRatingsTotal,
        externalId: wp.externalId,
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
      requestGeolocation: () => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(loc);
          mapRef.current?.setCenter({ lat: loc[1], lng: loc[0] });
        });
      },
      getCurrentRoute: () => currentRouteRef.current,
      clearCurrentRoute: clearRouteAndMarkers,
      isGenerating
    }));

    return (
      <>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%", position: "absolute" }} />

        {pickDestinationMode && (
          <div
            className="position-absolute top-0 start-50 translate-middle-x mt-3 px-3 py-2 bg-warning text-dark rounded-pill shadow small fw-semibold"
            style={{ zIndex: 1100 }}
          >
            <i className="bi bi-crosshair me-1"></i> Клікніть на карті, щоб вказати кінець маршруту
          </div>
        )}

        {selectedPoi && (
          <PlaceInfoCard
            waypoint={selectedPoi.waypoint}
            stopNumber={selectedPoi.stopNumber}
            onClose={() => setSelectedPoi(null)}
          />
        )}
      </>
    );
  }
);

RouteMap.displayName = "RouteMap";
export default RouteMap;
