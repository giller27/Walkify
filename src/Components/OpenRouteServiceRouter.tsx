import L from "leaflet";
import "leaflet-routing-machine";

// ✅ Клас для OpenRouteService (піші маршрути)
class OpenRouteServiceRouter extends (L.Routing.OSRMv1 as any) {
  constructor(apiKey: string) {
    super({
      serviceUrl: "https://api.openrouteservice.org/v2/directions/foot-walking",
      profile: "foot-walking",
    });
    this.apiKey = apiKey;
  }

  apiKey: string;

  // @ts-ignore — перевизначення приватного методу
  route(waypoints: any[], callback: any, context: any, options?: any) {
    const coordinates = waypoints.map((wp) => [wp.latLng.lng, wp.latLng.lat]);

    fetch(this.options.serviceUrl, {
      method: "POST",
      headers: {
        Accept: "application/json, application/geo+json",
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      body: JSON.stringify({ coordinates }),
    })
      .then((res) => res.json())
      .then((data) => {
        const route = {
          name: "Піший маршрут",
          coordinates: data.features[0].geometry.coordinates.map(
            (c: [number, number]) => L.latLng(c[1], c[0])
          ),
        };
        callback.call(context, null, [route]);
      })
      .catch((err) => callback.call(context, err));
  }
}

export default OpenRouteServiceRouter;
