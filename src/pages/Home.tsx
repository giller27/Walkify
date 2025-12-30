import { useRef, useState, useEffect } from "react";
import RouteMap, { RouteMapRef, WalkPreferences } from "../Components/RouteMap";
import WalkPreferencesBar from "../Components/WalkPreferences";
import { addWalkStatistic } from "../services/supabaseService";
import { useAuth } from "../context/AuthContext";

interface GoogleUser {
  name: string;
  picture: string;
  email: string;
}

function Home() {
  const { user } = useAuth();
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

    // Альтернативно, перевірити routeToView для уже збережених маршрутів
    const routeToView = localStorage.getItem("routeToView");
    if (routeToView) {
      try {
        const savedRoute = JSON.parse(routeToView);
        // Передати маршрут з точками до RouteMap для візуалізації
        localStorage.setItem("viewSavedRoute", JSON.stringify(savedRoute));
        localStorage.removeItem("routeToView");
      } catch (e) {
        console.error("Помилка завантаження маршруту для перегляду:", e);
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

  const handleRouteGenerated = async (data: {
    distanceKm: number;
    locations: string[];
    prompt?: string;
    estimatedTimeMinutes: number;
  }) => {
    // Зберегти статистику в Supabase, якщо користувач авторизований
    if (user) {
      try {
        const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        await addWalkStatistic({
          user_id: user.id,
          date: todayDate,
          distance_km: data.distanceKm,
          duration_minutes: Math.round(data.estimatedTimeMinutes), // Округлити до INTEGER
          pace:
            data.estimatedTimeMinutes > 0
              ? data.distanceKm / (data.estimatedTimeMinutes / 60)
              : 0,
          notes: data.prompt || undefined,
        } as any);
        console.log("Статистика успішно додана");
      } catch (err) {
        console.error("Помилка збереження статистики:", err);
      }
    }
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

  // Завантажити збережений маршрут для перегляду
  useEffect(() => {
    const viewSavedRoute = localStorage.getItem("viewSavedRoute");
    if (viewSavedRoute && routeMapRef.current) {
      try {
        const routeData = JSON.parse(viewSavedRoute);
        const timer = setTimeout(async () => {
          if (routeMapRef.current) {
            setIsGenerating(true);
            await routeMapRef.current.loadSavedRoute(routeData);
            setIsGenerating(false);
            localStorage.removeItem("viewSavedRoute");
          }
        }, 500);
        return () => clearTimeout(timer);
      } catch (e) {
        console.error("Помилка завантаження збереженого маршруту:", e);
        localStorage.removeItem("viewSavedRoute");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
