import OpenRouteServiceRouter from "./OpenRouteServiceRouter"; // імпорт класу
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";

function RoutingMachine({ points }: { points: [number, number][] }) {
  const map = useMap();

  const router = new OpenRouteServiceRouter(
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImM4MTMzMzc2NzE0ZjRhMDdhMGMyODUyOTJiMzExYWUzIiwiaCI6Im11cm11cjY0In0="
  );
  useEffect(() => {
    if (!map) return;

    const routingControl = L.Routing.control({
      waypoints: points.map((p) => L.latLng(p[0], p[1])),
      router,
      lineOptions: { styles: [{ color: "#007bff", weight: 4 }] } as any,
      addWaypoints: false,
      show: false,
      fitSelectedRoutes: true,
    }).addTo(map);

    // ✅ Функція очищення — видаляє контроль при зміні точок або демонтажі
    return () => {
      map.removeControl(routingControl);
    };
  }, [map, points]);

  return null;
}

export default RoutingMachine;
