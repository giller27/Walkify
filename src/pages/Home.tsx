import { useRef, useState, useEffect } from "react";
import RouteMap, { RouteMapRef, WalkPreferences } from "../Components/RouteMap";
import WalkPreferencesBar from "../Components/WalkPreferences";

function Home() {
  const routeMapRef = useRef<RouteMapRef>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [routeSummary, setRouteSummary] = useState("");

  // Update isGenerating state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (routeMapRef.current) {
        setIsGenerating(routeMapRef.current.isGenerating);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async (preferences: WalkPreferences) => {
    if (routeMapRef.current) {
      setIsGenerating(true);
      await routeMapRef.current.generateRoute(preferences);
      setIsGenerating(false);
    }
  };

  return (
    <>
      <RouteMap ref={routeMapRef} onRouteSummary={setRouteSummary} />
      <WalkPreferencesBar
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        routeSummary={routeSummary}
      />
    </>
  );
}

export default Home;
