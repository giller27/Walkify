import React, { useState, useRef, useCallback } from "react";
import RouteMap, { RouteMapRef } from "../Components/RouteMap";
import WalkPreferences from "../Components/WalkPreferences";
import WalkFiltersMenu from "../Components/WalkFiltersMenu";
import { generateRouteByFilters, RouteFilterOptions, RouteDestination } from "../services/routeService";

const Home: React.FC = () => {
  const mapRef = useRef<RouteMapRef>(null);
  const [activeTab, setActiveTab] = useState<"filters" | "text">("filters");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [routeSummary, setRouteSummary] = useState<string>("");
  const [destination, setDestination] = useState<RouteDestination | null>(null);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);

  const handleDestinationPicked = useCallback((coords: [number, number], address: string) => {
    setDestination({ coords, address, name: address });
    setIsPickingOnMap(false);
  }, []);

  const handleFilterGeneration = async (filterOptions: RouteFilterOptions) => {
    if (!mapRef.current) return;

    setIsGenerating(true);
    setRouteSummary("Шукаємо місця та будуємо маршрут...");

    navigator.geolocation.getCurrentPosition(async (position) => {
      const userLoc: [number, number] = [position.coords.longitude, position.coords.latitude];

      try {
        const options: RouteFilterOptions = {
          ...filterOptions,
          destination: filterOptions.routeMode === 'point_to_point'
            ? (destination?.coords
                ? destination
                : filterOptions.destination)
            : undefined,
        };

        const generatedRoute = await generateRouteByFilters(userLoc, options);

        if (mapRef.current) {
          (mapRef.current as any).loadSavedRoute({
            points: generatedRoute.points,
            statistics: {
              distanceKm: generatedRoute.distanceKm,
              estimatedTimeMinutes: generatedRoute.estimatedTimeMinutes,
            },
            waypoints: generatedRoute.waypoints,
            locations: generatedRoute.locations,
            difficulty: generatedRoute.difficulty,
          });

          const diffStr = generatedRoute.difficulty ? ` · ${generatedRoute.difficulty}` : '';
          setRouteSummary(
            `${generatedRoute.distanceKm} км · ~${generatedRoute.estimatedTimeMinutes} хв (ціль: ${filterOptions.targetTimeMinutes} хв)${diffStr}`
          );
        }
      } catch (err: any) {
        alert(err.message || "Помилка побудови маршруту.");
        setRouteSummary("");
      } finally {
        setIsGenerating(false);
      }
    }, () => {
      alert("Будь ласка, увімкніть геолокацію в браузері.");
      setIsGenerating(false);
      setRouteSummary("");
    });
  };

  return (
    <div className="container-fluid p-0 position-relative" style={{ height: "calc(100vh - 120px)" }}>
      <div className="row g-0 h-100">

        <div className="col-12 col-md-4 p-3 bg-light border-end overflow-y-auto" style={{ zIndex: 10, maxHeight: "100%" }}>

          <ul className="nav nav-pills nav-fill mb-3 bg-white p-1 rounded-3 border">
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
                <i className="bi bi-chat-left-text me-1"></i> Текстовий запит
              </button>
            </li>
          </ul>

          {activeTab === "filters" ? (
            <WalkFiltersMenu
              onGenerate={handleFilterGeneration}
              isGenerating={isGenerating}
              destination={destination}
              onDestinationChange={setDestination}
              onPickOnMap={() => setIsPickingOnMap(prev => !prev)}
              isPickingOnMap={isPickingOnMap}
            />
          ) : (
            <WalkPreferences
              onGenerate={(prefs: any) => {
                if (mapRef.current) {
                  mapRef.current.generateRoute(prefs);
                }
              }}
              isGenerating={isGenerating}
              onRequestGeolocation={() => {
                if (mapRef.current) {
                  mapRef.current.requestGeolocation();
                }
              }}
              routeSummary={routeSummary}
              hasRoute={!!mapRef.current?.getCurrentRoute()}
              onSaveRoute={() => console.log("Save clicked")}
              onClearRoute={() => mapRef.current?.clearCurrentRoute()}
            />
          )}

          {routeSummary && (
            <div className="alert alert-info mt-3 border-0 rounded-3 small shadow-sm">
              <i className="bi bi-info-circle me-2"></i> {routeSummary}
            </div>
          )}
        </div>

        <div className="col-12 col-md-8 position-relative h-100">
          <RouteMap
            ref={mapRef}
            panelExpanded={true}
            onRouteSummary={(sum) => setRouteSummary(sum)}
            pickDestinationMode={isPickingOnMap}
            onDestinationPicked={handleDestinationPicked}
          />
        </div>

      </div>
    </div>
  );
};

export default Home;
