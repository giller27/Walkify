import { useRef, useState, useEffect } from "react";
import RouteMap, { RouteMapRef, WalkPreferences } from "../Components/RouteMap";
import WalkPreferencesBar from "../Components/WalkPreferences";

function Home() {
  const routeMapRef = useRef<RouteMapRef>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
      <RouteMap ref={routeMapRef} />
      <WalkPreferencesBar
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />
    </>
  );
}

export default Home;
