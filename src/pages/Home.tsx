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
  const [isPanelExpanded, setIsPanelExpanded] = useState(true); // Стан панелі
  const [hasRoute, setHasRoute] = useState(false); // Стан наявності маршруту

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

  const handleSaveRoute = async () => {
    if (!routeMapRef.current || !user) {
      alert("Будь ласка, авторизуйтеся");
      return;
    }

    try {
      const currentRoute = routeMapRef.current.getCurrentRoute();
      if (!currentRoute || currentRoute.points.length === 0) {
        alert("Немає маршруту для збереження");
        return;
      }

      const routeName = prompt("Введіть назву маршруту:", "Мій маршрут");
      if (!routeName) return;

      // Подготовуємо дані для збереження
      const saveData: any = {
        user_id: user.id,
        name: routeName,
        description:
          currentRoute.locations.join(", ") || "Згенерований маршрут",
        points: currentRoute.points,
        waypoints: currentRoute.waypoints,
        statistics: {
          distanceKm: currentRoute.distanceKm,
          estimatedTimeMinutes: currentRoute.estimatedTimeMinutes,
        },
        preferences: {
          locations: currentRoute.locations,
        },
      };

      // Викликаємо функцію збереження з supabaseService
      const { saveRoute } = await import("../services/supabaseService");
      await saveRoute(saveData);

      alert("Маршрут успішно збережено!");
    } catch (error) {
      console.error("Помилка при збереженні маршруту:", error);
      alert(
        "Помилка при збереженні: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const handleClearRoute = () => {
    if (routeMapRef.current) {
      routeMapRef.current.clearCurrentRoute();
      setHasRoute(false); // Позначити, що маршруту немає
      setRouteSummary(""); // Очистити зведення маршруту
    }
  };

  const handleRouteGenerated = async (data: {
    distanceKm: number;
    locations: string[];
    prompt?: string;
    estimatedTimeMinutes: number;
  }) => {
    setHasRoute(true); // Позначити, що маршрут є
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
        panelExpanded={isPanelExpanded}
      />
      <WalkPreferencesBar
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        routeSummary={routeSummary}
        onRequestGeolocation={handleRequestGeolocation}
        initialPreferences={loadedRoute || undefined}
        isExpanded={isPanelExpanded}
        onToggleExpand={() => setIsPanelExpanded(!isPanelExpanded)}
        onSaveRoute={handleSaveRoute}
        onClearRoute={handleClearRoute}
        hasRoute={hasRoute}
      />
    </>
  );
}

export default Home;
