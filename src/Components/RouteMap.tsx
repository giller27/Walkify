import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 🧭 Іконки Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LatLngTuple = [number, number];

const RoutingMachine = ({ points }: { points: LatLngTuple[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length < 2) return;

    const fetchRoute = async () => {
      const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImE3YzUxNmU2ZmMzYzQyMTQ4OTJhMWM4YWM1YTI2OWQ1IiwiaCI6Im11cm11cjY0In0="; // 🔑 встав свій ключ OpenRouteService
      const coords = points.map((p) => [p[1], p[0]]); // [lng, lat] порядок!

      try {
        const res = await fetch(
          "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: apiKey,
            },
            body: JSON.stringify({
              coordinates: coords,
            }),
          }
        );

        const data = await res.json();

        // Якщо маршрут не знайдено
        if (!data || !data.features || data.features.length === 0) {
          console.error("Маршрут не знайдено:", data);
          return;
        }

        // Додаємо geoJSON лінію на карту
        const routeLayer = L.geoJSON(data, {
          style: {
            color: "green", // 💚 зелена лінія
            weight: 5,
            opacity: 0.9,
          },
        }).addTo(map);

        // Масштаб до маршруту
        map.fitBounds(routeLayer.getBounds());

        // Очистка при зміні точок
        return () => {
          map.removeLayer(routeLayer);
        };
      } catch (error) {
        console.error("Помилка побудови маршруту:", error);
      }
    };

    fetchRoute();
  }, [map, points]);

  return null;
};

const RoutingMap = () => {
  const [points, setPoints] = useState<LatLngTuple[]>([]);

  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPoints((prev) => [...prev, [lat, lng]]);
      },
    });
    return null;
  };

  const clearRoute = () => setPoints([]);

  return (
    <div>
      <button
        className="z-1 btn btn-success position-fixed pb-2 rounded-circle"
        style={{ bottom: "80px", left: "20px" }}
        onClick={clearRoute}
      >
        <i className="bi bi-trash"></i>
      </button>
      <MapContainer
        center={[49.234, 28.469]}
        zoom={13}
        style={{ height: "calc(100dvh - 120px)", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        />
        <MapClickHandler />
        {points.map((pos, index) => (
          <Marker key={index} position={pos}>
            <Popup>
              <strong>Точка {index + 1}</strong> <br />
              {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
            </Popup>
          </Marker>
        ))}
        <RoutingMachine points={points} />
      </MapContainer>
    </div>
  );
};

export default RoutingMap;
