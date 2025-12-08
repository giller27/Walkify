import { useRef, useState, useEffect } from "react";
import RouteMap, { RouteMapRef, WalkPreferences } from "../Components/RouteMap";
import WalkPreferencesBar from "../Components/WalkPreferences";
import { RouteStatistic } from "./Statistic";

interface GoogleUser {
  name: string;
  picture: string;
  email: string;
}

function Home() {
  const routeMapRef = useRef<RouteMapRef>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [routeSummary, setRouteSummary] = useState("");
  const [loadedRoute, setLoadedRoute] = useState<WalkPreferences | null>(null);
  const [userInfo, setUserInfo] = useState<GoogleUser | null>(null);

  // Завантажити інформацію користувача
  useEffect(() => {
    const storedUser = localStorage.getItem("userInfo");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserInfo(user);
      } catch (e) {
        console.error("Помилка завантаження інформації користувача:", e);
      }
    }
  }, []);

  // Завантажити маршрут з localStorage, якщо він є
  useEffect(() => {
    const routeToLoad = localStorage.getItem("routeToLoad");
    if (routeToLoad) {
      try {
        const preferences = JSON.parse(routeToLoad);
        setLoadedRoute(preferences);
        localStorage.removeItem("routeToLoad"); // Видалити після завантаження
      } catch (e) {
        console.error("Помилка завантаження маршруту:", e);
      }
    }
  }, []);

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

  const handleRequestGeolocation = () => {
    if (routeMapRef.current) {
      routeMapRef.current.requestGeolocation();
    }
  };

  const handleRouteGenerated = (data: {
    distanceKm: number;
    locations: string[];
    prompt?: string;
    estimatedTimeMinutes: number;
  }) => {
    if (!userInfo?.email) {
      return; // Не зберігаємо статистику, якщо користувач не авторизований
    }

    // Створити запис статистики
    const statistic: RouteStatistic = {
      id: Date.now().toString(),
      userEmail: userInfo.email,
      distanceKm: data.distanceKm,
      locations: data.locations,
      prompt: data.prompt,
      completedAt: new Date().toISOString(),
      estimatedTimeMinutes: data.estimatedTimeMinutes,
    };

    // Завантажити існуючу статистику
    const allStatsStr = localStorage.getItem("routeStatistics");
    let allStats: RouteStatistic[] = [];
    if (allStatsStr) {
      try {
        allStats = JSON.parse(allStatsStr);
      } catch (e) {
        console.error("Помилка парсингу статистики:", e);
      }
    }

    // Додати новий запис
    allStats.push(statistic);

    // Зберегти статистику
    localStorage.setItem("routeStatistics", JSON.stringify(allStats));
  };

  // Автоматично згенерувати маршрут, якщо він завантажений
  useEffect(() => {
    if (loadedRoute && routeMapRef.current) {
      // Невелика затримка, щоб карта встигла ініціалізуватися
      const timer = setTimeout(async () => {
        if (routeMapRef.current) {
          setIsGenerating(true);
          await routeMapRef.current.generateRoute(loadedRoute);
          setIsGenerating(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedRoute]);

  return (
    <>
      <RouteMap
        ref={routeMapRef}
        onRouteSummary={setRouteSummary}
        onRouteGenerated={handleRouteGenerated}
      />
      <WalkPreferencesBar
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        routeSummary={routeSummary}
        onRequestGeolocation={handleRequestGeolocation}
        initialPreferences={loadedRoute || undefined}
      />
    </>
  );
}

export default Home;
