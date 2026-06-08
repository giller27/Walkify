import React, { useState, useRef, useCallback } from "react";
import RouteMap, { RouteMapRef } from "../Components/RouteMap";
import WalkPreferences from "../Components/WalkPreferences";
import WalkFiltersMenu from "../Components/WalkFiltersMenu";
import { generateRouteByFilters, generateRouteFromText, RouteFilterOptions, RouteDestination } from "../services/routeService";
import "../styles/home.css";

const Home: React.FC = () => {
  const mapRef = useRef<RouteMapRef>(null);
  const [activeTab, setActiveTab] = useState<"filters" | "text">("filters");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [routeSummary, setRouteSummary] = useState<string>("");
  const [hasRoute, setHasRoute] = useState(false);
  const [destination, setDestination] = useState<RouteDestination | null>(null);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadRouteOnMap = useCallback((generatedRoute: Awaited<ReturnType<typeof generateRouteByFilters>>) => {
    if (!mapRef.current) return;
    (mapRef.current as any).loadSavedRoute({
      points: generatedRoute.points,
      statistics: {
        distanceKm: generatedRoute.distanceKm,
        estimatedTimeMinutes: generatedRoute.estimatedTimeMinutes,
      },
      waypoints: generatedRoute.waypoints,
      steps: generatedRoute.steps,
      locations: generatedRoute.locations,
      difficulty: generatedRoute.difficulty,
    });
    setHasRoute(true);
  }, []);

  const handlePickOnMap = useCallback(() => {
    setIsPickingOnMap(true);
    setSidebarOpen(false);
  }, []);

  const handlePickCancel = useCallback(() => {
    setIsPickingOnMap(false);
    setSidebarOpen(true);
  }, []);

  const handleDestinationPicked = useCallback((coords: [number, number], address: string) => {
    setDestination({ coords, address, name: address });
    setIsPickingOnMap(false);
    setSidebarOpen(true);
  }, []);

  const runWithGeolocation = (task: (userLoc: [number, number]) => Promise<void>) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLoc: [number, number] = [position.coords.longitude, position.coords.latitude];
        await task(userLoc);
      },
      () => {
        alert("Будь ласка, увімкніть геолокацію в браузері.");
        setIsGenerating(false);
        setRouteSummary("");
      }
    );
  };

  const handleFilterGeneration = async (filterOptions: RouteFilterOptions) => {
    if (!mapRef.current) return;

    setIsGenerating(true);
    setSidebarOpen(false);
    setRouteSummary("Шукаємо місця та будуємо маршрут...");

    runWithGeolocation(async (userLoc) => {
      try {
        const options: RouteFilterOptions = {
          ...filterOptions,
          destination: filterOptions.routeMode === 'point_to_point'
            ? (destination?.coords ? destination : filterOptions.destination)
            : undefined,
        };

        const generatedRoute = await generateRouteByFilters(userLoc, options);
        loadRouteOnMap(generatedRoute);
      } catch (err: any) {
        alert(err.message || "Помилка побудови маршруту.");
        setRouteSummary("");
      } finally {
        setIsGenerating(false);
      }
    });
  };

  const handleTextGeneration = async (prefs: { prompt: string; routeMode?: string; duration?: number }) => {
    if (!mapRef.current) return;

    setIsGenerating(true);
    setSidebarOpen(false);
    setRouteSummary("Аналізуємо запит...");

    runWithGeolocation(async (userLoc) => {
      try {
        const generatedRoute = await generateRouteFromText(userLoc, prefs.prompt, {
          routeMode: prefs.routeMode as "exploration" | "point_to_point" | undefined,
        });
        loadRouteOnMap(generatedRoute);
      } catch (err: any) {
        alert(err.message || "Помилка побудови маршруту.");
        setRouteSummary("");
      } finally {
        setIsGenerating(false);
      }
    });
  };

  const handleClearRoute = () => {
    mapRef.current?.clearCurrentRoute();
    setRouteSummary("");
    setHasRoute(false);
  };

  return (
    <div className="container-fluid p-0 position-relative home-layout">
      <div
        className={`home-sidebar-backdrop ${sidebarOpen && !isPickingOnMap ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <div className="row g-0 h-100">
        <div
          className={`col-12 col-md-4 p-2 p-md-3 bg-light border-end overflow-y-auto home-sidebar ${sidebarOpen ? 'open' : ''} ${isPickingOnMap ? 'd-none' : ''}`}
        >
          <ul className="nav nav-pills nav-fill mb-2 mb-md-3 bg-white p-1 rounded-3 border">
            <li className="nav-item">
              <button
                className={`nav-link rounded-2 fw-semibold py-2 ${activeTab === "filters" ? "active bg-success text-white" : "text-secondary"}`}
                onClick={() => setActiveTab("filters")}
              >
                <i className="bi bi-sliders me-1"></i> Фільтри
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link rounded-2 fw-semibold py-2 ${activeTab === "text" ? "active bg-success text-white" : "text-secondary"}`}
                onClick={() => setActiveTab("text")}
              >
                <i className="bi bi-chat-left-text me-1"></i> Текст
              </button>
            </li>
          </ul>

          {activeTab === "filters" ? (
            <WalkFiltersMenu
              onGenerate={handleFilterGeneration}
              isGenerating={isGenerating}
              destination={destination}
              onDestinationChange={setDestination}
              onPickOnMap={handlePickOnMap}
            />
          ) : (
            <WalkPreferences
              onGenerate={handleTextGeneration}
              isGenerating={isGenerating}
              onRequestGeolocation={() => mapRef.current?.requestGeolocation()}
              routeSummary={routeSummary}
              hasRoute={hasRoute}
              onClearRoute={handleClearRoute}
            />
          )}

          {routeSummary && sidebarOpen && (
            <div className="alert alert-info mt-2 mt-md-3 border-0 rounded-3 small shadow-sm mb-0">
              <i className="bi bi-info-circle me-2"></i> {routeSummary}
            </div>
          )}
        </div>

        <div className={`col-12 col-md-8 position-relative h-100 home-map-col ${isPickingOnMap ? 'fullscreen-pick' : ''}`}>
          {!isPickingOnMap && (
            <button
              type="button"
              className="home-menu-toggle"
              onClick={() => setSidebarOpen(prev => !prev)}
              aria-label="Меню параметрів"
            >
              <i className={`bi ${sidebarOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
            </button>
          )}

          {routeSummary && !sidebarOpen && !isPickingOnMap && (
            <div className="home-route-chip">
              <i className="bi bi-signpost-2 me-1 text-success"></i>
              {routeSummary}
            </div>
          )}

          <RouteMap
            ref={mapRef}
            onRouteSummary={(sum) => {
              setRouteSummary(sum);
              setHasRoute(true);
            }}
            pickDestinationMode={isPickingOnMap}
            onDestinationPicked={handleDestinationPicked}
            onPickCancel={handlePickCancel}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;
