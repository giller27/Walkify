import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { WalkPreferences } from "./WalkPreferences";

const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsbGV5cy1jb21ldCIsImEiOiJjbWpzcmc0dzQ0NHZ1M2dxeDRyOTFtNHFxIn0.gCWJwF521jdHqD38Nn8ZsA";

// Експортуємо тип WalkPreferences для використання в інших компонентах
export type { WalkPreferences };

export interface RouteMapRef {
  generateRoute: (preferences: WalkPreferences) => Promise<void>;
  requestGeolocation: () => void;
  loadSavedRoute: (routeData: any) => Promise<void>;
  isGenerating: boolean;
}

interface RouteMapProps {
  onRouteSummary?: (summary: string) => void;
  onRouteGenerated?: (data: {
    distanceKm: number;
    locations: string[];
    prompt?: string;
    estimatedTimeMinutes: number;
  }) => void;
}

const RouteMap = forwardRef<RouteMapRef, RouteMapProps>(
  ({ onRouteSummary, onRouteGenerated }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [userHeading, setUserHeading] = useState<number | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const routeLayerRef = useRef<string | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const watchIdRef = useRef<number | null>(null);

    // Функція для оновлення маркера користувача
    const updateUserMarker = (longitude: number, latitude: number, heading: number | null) => {
      if (!mapRef.current) return;

      // Видалити попередній маркер, якщо він є
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
      }

      // Створити кастомний маркер з напрямком
      const el = document.createElement("div");
      el.className = "user-location-marker";
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#007bff";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      el.style.position = "relative";
      el.style.cursor = "pointer";

      // Додати стрілку напрямку, якщо heading доступний
      if (heading !== null && !isNaN(heading)) {
        const arrow = document.createElement("div");
        arrow.style.position = "absolute";
        arrow.style.top = "-8px";
        arrow.style.left = "50%";
        arrow.style.transform = `translateX(-50%) rotate(${heading}deg)`;
        arrow.style.width = "0";
        arrow.style.height = "0";
        arrow.style.borderLeft = "4px solid transparent";
        arrow.style.borderRight = "4px solid transparent";
        arrow.style.borderBottom = "8px solid #007bff";
        el.appendChild(arrow);
      }

      // Додати маркер на поточну позицію
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current);

      userLocationMarkerRef.current = marker;
    };

    // Ініціалізація карти
    useEffect(() => {
      if (!mapContainerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [30.5234, 50.4501], // Київ за замовчуванням
        zoom: 13,
      });

      mapRef.current = map;

      // Додати навігаційні контроли
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Запит геолокації при завантаженні (тихо, без індикатора)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            const heading = position.coords.heading ?? null;
            setUserLocation([latitude, longitude]);
            setUserHeading(heading);
            
            // Додати кастомний маркер на позицію користувача
            updateUserMarker(longitude, latitude, heading);

            map.flyTo({
              center: [longitude, latitude],
              zoom: 14,
            });
          },
          (error) => {
            console.log("Геолокація недоступна:", error);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000, // Використати кешовану позицію до 1 хвилини
          }
        );
      }

      return () => {
        // Зупинити відстеження при розмонтуванні
        if (watchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      };

      return () => {
        map.remove();
      };
    }, []);

    // Очищення маркерів
    const clearMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };

    // Очищення маршруту
    const clearRoute = () => {
      if (!mapRef.current) return;

      // Видалити шар маршруту
      if (routeLayerRef.current && mapRef.current.getLayer(routeLayerRef.current)) {
        mapRef.current.removeLayer(routeLayerRef.current);
      }

      // Видалити джерело маршруту
      if (mapRef.current.getSource("route")) {
        mapRef.current.removeSource("route");
      }

      routeLayerRef.current = null;
    };

    // Геокодування локації
    const geocodeLocation = async (location: string): Promise<[number, number] | null> => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            location
          )}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=UA`
        );

        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          return [lat, lng];
        }
        return null;
      } catch (error) {
        console.error("Помилка геокодування:", error);
        return null;
      }
    };

    // Пошук POI (Points of Interest) навколо точки
    const findPOI = async (
      center: [number, number],
      category: string,
      radius: number = 1000
    ): Promise<[number, number] | null> => {
      try {
        const [lat, lng] = center;
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            category
          )}.json?access_token=${MAPBOX_TOKEN}&proximity=${lng},${lat}&limit=1&country=UA`
        );

        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          return [lat, lng];
        }
        return null;
      } catch (error) {
        console.error("Помилка пошуку POI:", error);
        return null;
      }
    };

    // Обчислення відстані між двома точками (Haversine формула)
    const calculateDistance = (
      point1: [number, number],
      point2: [number, number]
    ): number => {
      const R = 6371; // Радіус Землі в км
      const dLat = ((point2[0] - point1[0]) * Math.PI) / 180;
      const dLon = ((point2[1] - point1[1]) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((point1[0] * Math.PI) / 180) *
          Math.cos((point2[0] * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Побудова маршруту через Mapbox Directions API
    const buildRoute = async (waypoints: [number, number][]): Promise<[number, number][]> => {
      if (waypoints.length < 2) return waypoints;

      try {
        // Конвертувати [lat, lng] в [lng, lat] для API
        const coordinates = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");

        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?access_token=${MAPBOX_TOKEN}&geometries=geojson&steps=true&overview=full`
        );

        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          // Конвертувати [lng, lat] назад в [lat, lng]
          const points = route.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          );
          return points;
        }
      } catch (error) {
        console.error("Помилка побудови маршруту:", error);
      }

      // Якщо API не спрацював, повертаємо прямі лінії між точками
      return waypoints;
    };

    // Генерація маршруту на основі параметрів
    const generateRoute = async (preferences: WalkPreferences) => {
      if (!mapRef.current) return;

      setIsGenerating(true);
      clearRoute();
      clearMarkers();

      try {
        let startPoint: [number, number] | null = null;
        const waypoints: [number, number][] = [];

        // Визначити початкову точку
        if (userLocation) {
          startPoint = userLocation;
        } else {
          // Використати центр карти як початкову точку
          const center = mapRef.current.getCenter();
          startPoint = [center.lat, center.lng];
        }

        waypoints.push(startPoint);

        // Якщо немає локацій та промпту, створити простий маршрут навколо початкової точки
        const hasLocations = preferences.locations && preferences.locations.length > 0;
        const hasPrompt = preferences.prompt && preferences.prompt.trim().length > 0;

        if (!hasLocations && !hasPrompt) {
          // Створити простий круговий маршрут навколо початкової точки
          const targetDistance = preferences.distanceKm || 2; // За замовчуванням 2 км
          const radiusKm = targetDistance / (2 * Math.PI); // Радіус для кругового маршруту
          
          // Створити 4 точки навколо початкової точки
          const [lat, lng] = startPoint;
          const pointsCount = 4;
          for (let i = 0; i < pointsCount; i++) {
            const angle = (i * 2 * Math.PI) / pointsCount;
            // Приблизна формула для додавання відстані в градусах
            const deltaLat = (radiusKm / 111) * Math.cos(angle);
            const deltaLng = (radiusKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
            waypoints.push([lat + deltaLat, lng + deltaLng]);
          }
          // Повернутися до початкової точки
          waypoints.push(startPoint);
        } else {
          // Обробити локації з preferences
          if (hasLocations) {
            for (const location of preferences.locations) {
              const coords = await geocodeLocation(location);
              if (coords) {
                waypoints.push(coords);
              } else {
                // Якщо геокодування не вдалося, спробувати знайти POI
                const poiCoords = await findPOI(startPoint, location);
                if (poiCoords) {
                  waypoints.push(poiCoords);
                }
              }
            }
          }

          // Якщо є промпт, спробувати витягти з нього інформацію
          if (hasPrompt) {
            // Простий парсинг промпту для пошуку ключових слів
            const promptLower = preferences.prompt.toLowerCase();
            const keywords = ["кафе", "cafe", "парк", "park", "магазин", "shop", "ресторан", "restaurant", "музей", "museum"];

            for (const keyword of keywords) {
              if (promptLower.includes(keyword)) {
                const poiCoords = await findPOI(
                  waypoints[waypoints.length - 1],
                  keyword,
                  2000
                );
                if (poiCoords) {
                  // Перевірити, чи точка не дуже далеко
                  const lastPoint = waypoints[waypoints.length - 1];
                  const distance = calculateDistance(lastPoint, poiCoords);
                  if (distance < 5) {
                    // Максимум 5 км від попередньої точки
                    waypoints.push(poiCoords);
                  }
                }
              }
            }
          }

          // Якщо вказана відстань, намагатися відрегулювати маршрут
          if (preferences.distanceKm && preferences.distanceKm > 0) {
            // Якщо маршрут занадто короткий, додати додаткові точки
            let currentDistance = 0;
            for (let i = 0; i < waypoints.length - 1; i++) {
              currentDistance += calculateDistance(waypoints[i], waypoints[i + 1]);
            }

            if (currentDistance < preferences.distanceKm * 0.8) {
              // Якщо маршрут на 20% коротший за цільову відстань, додати точки
              const targetDistance = preferences.distanceKm;
              const additionalPoints = Math.ceil((targetDistance - currentDistance) / 2);

              for (let i = 0; i < additionalPoints; i++) {
                const lastPoint = waypoints[waypoints.length - 1];
                // Знайти POI навколо останньої точки
                const poiCoords = await findPOI(lastPoint, "park", 1500);
                if (poiCoords) {
                  waypoints.push(poiCoords);
                }
              }
            }
          }
        }

        // Побудувати маршрут через всі точки
        const routePoints = await buildRoute(waypoints);

        if (routePoints.length < 2) {
          throw new Error("Не вдалося побудувати маршрут");
        }

        // Відобразити маршрут на карті
        if (mapRef.current.getSource("route")) {
          (mapRef.current.getSource("route") as mapboxgl.GeoJSONSource).setData({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: routePoints.map(([lat, lng]) => [lng, lat]),
            },
            properties: {},
          });
        } else {
          mapRef.current.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: routePoints.map(([lat, lng]) => [lng, lat]),
              },
              properties: {},
            },
          });

          mapRef.current.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#28a745",
              "line-width": 4,
              "line-opacity": 0.8,
            },
          });

          routeLayerRef.current = "route-line";
        }

        // Додати маркери на точки
        waypoints.forEach((point, index) => {
          const [lat, lng] = point;
          const marker = new mapboxgl.Marker({
            color: index === 0 ? "#28a745" : index === waypoints.length - 1 ? "#dc3545" : "#ffc107",
            scale: 0.8,
          })
            .setLngLat([lng, lat])
            .addTo(mapRef.current!);

          markersRef.current.push(marker);
        });

        // Обчислити загальну відстань
        let totalDistance = 0;
        for (let i = 0; i < routePoints.length - 1; i++) {
          totalDistance += calculateDistance(routePoints[i], routePoints[i + 1]);
        }

        // Обчислити приблизний час (середня швидкість пішохода 5 км/год)
        const estimatedTimeMinutes = Math.round((totalDistance / 5) * 60);

        // Оновити підсумок маршруту
        const summary = `Маршрут: ${totalDistance.toFixed(2)} км, приблизно ${estimatedTimeMinutes} хв`;
        if (onRouteSummary) {
          onRouteSummary(summary);
        }

        // Викликати колбек згенерованого маршруту
        if (onRouteGenerated) {
          onRouteGenerated({
            distanceKm: totalDistance,
            locations: preferences.locations || [],
            prompt: preferences.prompt,
            estimatedTimeMinutes,
          });
        }

        // Вписати карту в межі маршруту
        const bounds = new mapboxgl.LngLatBounds();
        routePoints.forEach(([lat, lng]) => {
          bounds.extend([lng, lat]);
        });
        mapRef.current.fitBounds(bounds, { padding: 50 });
      } catch (error) {
        console.error("Помилка генерації маршруту:", error);
        if (onRouteSummary) {
          onRouteSummary("Помилка генерації маршруту. Спробуйте інші параметри.");
        }
      } finally {
        setIsGenerating(false);
      }
    };

    // Запит геолокації
    const requestGeolocation = () => {
      if (!navigator.geolocation) {
        alert("Геолокація не підтримується вашим браузером.");
        return;
      }

      setIsLocating(true);

      // Зупинити попереднє відстеження, якщо воно є
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      // Спочатку отримати поточну позицію
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          const heading = position.coords.heading ?? null;
          setUserLocation([latitude, longitude]);
          setUserHeading(heading);
          
          if (mapRef.current) {
            updateUserMarker(longitude, latitude, heading);

            // Центрувати карту на позиції користувача
            mapRef.current.flyTo({
              center: [longitude, latitude],
              zoom: 15,
              duration: 1000,
            });
          }
          setIsLocating(false);

          // Почати відстеження позиції для оновлення маркера
          watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              const { longitude, latitude } = position.coords;
              const heading = position.coords.heading ?? null;
              setUserLocation([latitude, longitude]);
              setUserHeading(heading);
              
              if (mapRef.current && userLocationMarkerRef.current) {
                // Оновити позицію маркера
                userLocationMarkerRef.current.setLngLat([longitude, latitude]);
                
                // Оновити напрямок, якщо він змінився
                if (heading !== null && !isNaN(heading)) {
                  const markerEl = userLocationMarkerRef.current.getElement();
                  if (markerEl) {
                    const arrow = markerEl.querySelector("div") as HTMLElement;
                    if (arrow) {
                      arrow.style.transform = `translateX(-50%) rotate(${heading}deg)`;
                    } else {
                      // Якщо стрілки немає, оновити весь маркер
                      updateUserMarker(longitude, latitude, heading);
                    }
                  }
                }
              }
            },
            (error) => {
              console.error("Помилка відстеження геолокації:", error);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 1000,
            }
          );
        },
        (error) => {
          console.error("Помилка отримання геолокації:", error);
          let errorMessage = "Не вдалося отримати геолокацію.";
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Дозвіл на геолокацію відхилено. Будь ласка, увімкніть геолокацію в налаштуваннях браузера.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Інформація про геолокацію недоступна.";
              break;
            case error.TIMEOUT:
              errorMessage = "Час очікування геолокації вичерпано.";
              break;
          }
          
          alert(errorMessage);
          setIsLocating(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    };

    // Завантаження збереженого маршруту
    const loadSavedRoute = async (routeData: any) => {
      if (!mapRef.current) return;

      setIsGenerating(true);
      clearRoute();
      clearMarkers();

      try {
        const points: [number, number][] = routeData.points || [];

        if (points.length < 2) {
          throw new Error("Недостатньо точок для маршруту");
        }

        // Відобразити маршрут
        if (mapRef.current.getSource("route")) {
          (mapRef.current.getSource("route") as mapboxgl.GeoJSONSource).setData({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: points.map(([lat, lng]) => [lng, lat]),
            },
            properties: {},
          });
        } else {
          mapRef.current.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: points.map(([lat, lng]) => [lng, lat]),
              },
              properties: {},
            },
          });

          mapRef.current.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#28a745",
              "line-width": 4,
              "line-opacity": 0.8,
            },
          });

          routeLayerRef.current = "route-line";
        }

        // Додати маркери
        points.forEach((point, index) => {
          const [lat, lng] = point;
          const marker = new mapboxgl.Marker({
            color: index === 0 ? "#28a745" : index === points.length - 1 ? "#dc3545" : "#ffc107",
            scale: 0.8,
          })
            .setLngLat([lng, lat])
            .addTo(mapRef.current!);

          markersRef.current.push(marker);
        });

        // Вписати карту в межі маршруту
        const bounds = new mapboxgl.LngLatBounds();
        points.forEach(([lat, lng]) => {
          bounds.extend([lng, lat]);
        });
        mapRef.current.fitBounds(bounds, { padding: 50 });

        // Оновити підсумок
        if (routeData.statistics) {
          const stats = routeData.statistics;
          const summary = `Маршрут: ${stats.distanceKm?.toFixed(2) || "N/A"} км, приблизно ${stats.estimatedTimeMinutes || "N/A"} хв`;
          if (onRouteSummary) {
            onRouteSummary(summary);
          }
        }
      } catch (error) {
        console.error("Помилка завантаження маршруту:", error);
        if (onRouteSummary) {
          onRouteSummary("Помилка завантаження маршруту.");
        }
      } finally {
        setIsGenerating(false);
      }
    };

    // Експортувати методи через ref
    useImperativeHandle(ref, () => ({
      generateRoute,
      requestGeolocation,
      loadSavedRoute,
      isGenerating,
    }));

    return (
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100vh",
          position: "relative",
        }}
      >
        {isGenerating && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              backgroundColor: "white",
              padding: "10px 20px",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div className="spinner-border spinner-border-sm text-success" role="status">
              <span className="visually-hidden">Завантаження...</span>
            </div>
            <span>Генерація маршруту...</span>
          </div>
        )}

        {/* Кнопка геолокації */}
        <button
          onClick={requestGeolocation}
          disabled={isLocating}
          className="btn btn-success"
          style={{
            position: "absolute",
            bottom: "100px",
            right: "20px",
            zIndex: 2000,
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: isLocating ? "#6c757d" : "#670d29ff",
            border: "2px solid white",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isLocating ? "not-allowed" : "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            transition: "all 0.2s ease",
            padding: 0,
          }}
          onMouseEnter={(e) => {
            if (!isLocating) {
              e.currentTarget.style.backgroundColor = "#277b43ff";
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.5)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLocating) {
              e.currentTarget.style.backgroundColor = "#0d9e4bff";
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
            }
          }}
          title={isLocating ? "Отримання геолокації..." : "Знайти моє місцезнаходження"}
          aria-label="Знайти моє місцезнаходження"
        >
          {isLocating ? (
            <div className="spinner-border spinner-border-sm" role="status" style={{ width: "20px", height: "20px" }}>
              <span className="visually-hidden">Завантаження...</span>
            </div>
          ) : (
            <i className="bi bi-geo-alt-fill" style={{ fontSize: "24px" }}></i>
          )}
        </button>
      </div>
    );
  }
);

RouteMap.displayName = "RouteMap";

export default RouteMap;
