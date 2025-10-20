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
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";

// 🧭 Виправлення іконок у Leaflet (для Vite/React)
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

    // Використовуємо OSRM demo сервер для побудови реального маршруту
    const routingControl = (L.Routing.control as any)({
      waypoints: points.map((p) => L.latLng(p[0], p[1])),
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
        profile: "driving",
      }),
      lineOptions: {
        styles: [{ color: "#007bff", weight: 5, opacity: 0.9 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      addWaypoints: false,
      draggableWaypoints: false, // <-- тепер не свариться
      fitSelectedRoutes: true,
      routeWhileDragging: false,
      show: false,
    }).addTo(map);

    return () => {
      map.removeControl(routingControl);
    };
  }, [map, points]);

  return null;
};

const RoutingMap = () => {
  const [points, setPoints] = useState<LatLngTuple[]>([]);

  // 📍 Обробка кліку по карті
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPoints((prev) => [...prev, [lat, lng]]);
      },
    });
    return null;
  };

  // 🔄 Очистка маршруту
  const clearRoute = () => setPoints([]);

  return (
    <div style={{ position: "relative" }}>
      {/* Кнопка очищення */}
      <button
        onClick={clearRoute}
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 1000,
          background: "#fff",
          border: "1px solid #ccc",
          borderRadius: "6px",
          padding: "6px 12px",
          cursor: "pointer",
        }}
      >
        Очистити маршрут
      </button>

      <MapContainer
        center={[50.45, 30.52]} // Київ
        zoom={13}
        style={{ height: "100vh", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        />

        <MapClickHandler />

        {/* Відображення маркерів */}
        {points.map((pos, index) => (
          <Marker key={index} position={pos}>
            <Popup>
              <strong>Точка {index + 1}</strong> <br />
              {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
            </Popup>
          </Marker>
        ))}

        {/* Компонент для побудови маршруту */}
        <RoutingMachine points={points} />
      </MapContainer>
    </div>
  );
};

export default RoutingMap;
