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
        profile: "foot-walking",
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
    <div>
      <button
        className="z-1 btn btn-success position-fixed pb-2 rounded-circle"
        style={{ bottom: "80px", left: "20px" }}
        onClick={clearRoute}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          className="bi bi-trash"
          viewBox="0 0 16 16"
        >
          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
          <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
        </svg>
      </button>
      <MapContainer
        className="z-0 bg-success-subtle border-5"
        center={[49.234, 28.469]} // Київ
        zoom={13}
        style={{ height: "calc(100vh - 116px)", width: "100%", marginTop: "56px", borderRadius: "1%" }}
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
