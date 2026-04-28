/**
 * routeService.ts
 *
 * Логіка генерації прогулянок з точками інтересу (POI).
 *
 * Стек (всі сервіси безкоштовні):
 *  1. Claude API  – розбирає природномовний запит → JSON з типами POI та параметрами
 *  2. Overpass API (OpenStreetMap) – знаходить реальні POI поруч від користувача
 *  3. OSRM (public demo)  – будує пішохідний маршрут між точками
 */

// ─── Типи ────────────────────────────────────────────────────────────────────

export interface RouteWaypoint {
  name: string;
  type: string;
  location: [number, number]; // [lat, lng]
  address?: string;
  description?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  source?: string;
}

export interface RouteResult {
  points: [number, number][]; // [lat, lng][]
  waypoints: RouteWaypoint[];
  distanceKm: number;
  estimatedTimeMinutes: number;
  locations: string[];
}

// Параметри, що повертає Claude після аналізу тексту
interface ParsedIntent {
  poiTypes: string[];          // наприклад: ["cafe", "park"]
  maxRadiusMeters: number;     // 500..3000
  maxPois: number;             // 1..5
  routeMode: "loop" | "point_to_point";
  language: string;
}

// ─── Константи ───────────────────────────────────────────────────────────────

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const OSRM_API_URL = "https://router.project-osrm.org/route/v1/foot";

/**
 * Відповідність між «типом POI» та тегами OpenStreetMap.
 * Ключі мають збігатися з тим, що повертає Claude.
 */
const POI_TYPE_TO_OSM: Record<string, { key: string; value: string }[]> = {
  cafe:             [{ key: "amenity", value: "cafe" }],
  coffee:           [{ key: "amenity", value: "cafe" }],
  restaurant:       [{ key: "amenity", value: "restaurant" }],
  park:             [{ key: "leisure", value: "park" }, { key: "leisure", value: "garden" }],
  museum:           [{ key: "tourism", value: "museum" }],
  library:          [{ key: "amenity", value: "library" }],
  shop:             [{ key: "shop", value: "supermarket" }, { key: "shop", value: "mall" }],
  lake:             [{ key: "natural", value: "water" }],
  river:            [{ key: "waterway", value: "river" }],
  beach:            [{ key: "natural", value: "beach" }],
  fountain:         [{ key: "amenity", value: "fountain" }],
  bench:            [{ key: "amenity", value: "bench" }],
  playground:       [{ key: "leisure", value: "playground" }],
  viewpoint:        [{ key: "tourism", value: "viewpoint" }],
  monument:         [{ key: "historic", value: "monument" }, { key: "historic", value: "memorial" }],
  church:           [{ key: "amenity", value: "place_of_worship" }],
  place_of_worship: [{ key: "amenity", value: "place_of_worship" }],
  cinema:           [{ key: "amenity", value: "cinema" }],
  theatre:          [{ key: "amenity", value: "theatre" }],
  pharmacy:         [{ key: "amenity", value: "pharmacy" }],
  bakery:           [{ key: "shop", value: "bakery" }],
  supermarket:      [{ key: "shop", value: "supermarket" }],
  atm:              [{ key: "amenity", value: "atm" }],
  hotel:            [{ key: "tourism", value: "hotel" }],
  sport:            [{ key: "leisure", value: "sports_centre" }, { key: "leisure", value: "pitch" }],
  zoo:              [{ key: "tourism", value: "zoo" }],
  attraction:       [{ key: "tourism", value: "attraction" }],
};

// ─── Допоміжні функції ───────────────────────────────────────────────────────

/** Відстань між двома точками (формула Гаверсина), км */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Вибирає N найближчих POI серед знайдених */
function pickNearestPois(
  pois: RouteWaypoint[],
  origin: [number, number],
  n: number
): RouteWaypoint[] {
  return [...pois]
    .sort((a, b) => {
      const dA = haversineKm(origin[0], origin[1], a.location[0], a.location[1]);
      const dB = haversineKm(origin[0], origin[1], b.location[0], b.location[1]);
      return dA - dB;
    })
    .slice(0, n);
}

// ─── Крок 1: Claude розбирає запит ───────────────────────────────────────────

async function parseIntentWithClaude(
  userPrompt: string,
  routeMode: "point_to_point" | "exploration" = "exploration"
): Promise<ParsedIntent> {
  const systemPrompt = `You are a walking route planner assistant.
The user describes a walk they want to take (usually in Ukrainian or Russian).
Your job is to extract structured parameters for finding Points of Interest (POI).

Respond ONLY with a valid JSON object — no markdown, no explanation, no code fences.

JSON schema:
{
  "poiTypes": string[],       // OSM POI types from this list: cafe, coffee, restaurant, park, museum, library, shop, lake, river, beach, fountain, bench, playground, viewpoint, monument, church, cinema, theatre, pharmacy, bakery, supermarket, zoo, attraction, sport
  "maxRadiusMeters": number,  // search radius: 300-2000
  "maxPois": number,          // how many POIs to visit: 1-5
  "routeMode": "loop" | "point_to_point",
  "language": "uk" | "ru" | "en"
}

Rules:
- poiTypes: pick types that best match the user's request. If vague ("walk"), use ["park", "viewpoint"]. If multiple types mentioned, include all.
- maxRadiusMeters: set based on implied distance. "short walk" = 500, "walk to park" = 1000, default = 800.
- maxPois: 1 for "to the cafe", 2-3 for "walk with a cafe", up to 5 for "long walk".
- routeMode: "loop" if exploration/stroll (default), "point_to_point" if going somewhere specific.
- language: detect from user input.`;

  const userMessage = `User request: "${userPrompt}"\nRoute mode hint: ${routeMode}`;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      console.warn("Claude API недоступний, використовуємо fallback");
      return buildFallbackIntent(userPrompt, routeMode);
    }

    const data = await response.json();
    const raw = data.content?.find((b: any) => b.type === "text")?.text || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as ParsedIntent;
    return parsed;
  } catch (err) {
    console.warn("Помилка Claude API, fallback:", err);
    return buildFallbackIntent(userPrompt, routeMode);
  }
}

/** Fallback-парсинг по ключовим словам якщо Claude недоступний */
function buildFallbackIntent(
  prompt: string,
  routeMode: "point_to_point" | "exploration"
): ParsedIntent {
  const lower = prompt.toLowerCase();
  const poiTypes: string[] = [];

  const keywordMap: Record<string, string[]> = {
    cafe:       ["кав'ярн", "кафе", "cafe", "coffee", "кофе"],
    park:       ["парк", "park", "сад", "garden"],
    restaurant: ["ресторан", "їжа", "restaurant", "food"],
    museum:     ["музей", "museum"],
    library:    ["бібліотек", "library"],
    lake:       ["озер", "lake"],
    river:      ["річк", "river"],
    beach:      ["пляж", "beach"],
    monument:   ["памятник", "монумент", "monument"],
    viewpoint:  ["вид", "панорама", "viewpoint"],
    fountain:   ["фонтан", "fountain"],
    playground: ["дитяч", "майданчик", "playground"],
    church:     ["церкв", "храм", "church"],
  };

  for (const [type, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      poiTypes.push(type);
    }
  }

  if (poiTypes.length === 0) poiTypes.push("park", "viewpoint");

  return {
    poiTypes,
    maxRadiusMeters: 1000,
    maxPois: poiTypes.length <= 1 ? 2 : poiTypes.length,
    routeMode: routeMode === "point_to_point" ? "point_to_point" : "loop",
    language: "uk",
  };
}

// ─── Крок 2: Overpass API — знаходить POI ────────────────────────────────────

async function fetchPoisFromOverpass(
  lat: number,
  lng: number,
  poiTypes: string[],
  radiusMeters: number
): Promise<RouteWaypoint[]> {
  // Будуємо Overpass QL запит
  const filters: string[] = [];

  for (const type of poiTypes) {
    const osmTags = POI_TYPE_TO_OSM[type] || [];
    for (const tag of osmTags) {
      filters.push(
        `node["${tag.key}"="${tag.value}"](around:${radiusMeters},${lat},${lng});`
      );
    }
  }

  if (filters.length === 0) {
    // Fallback: будь-що цікаве
    filters.push(`node["tourism"](around:${radiusMeters},${lat},${lng});`);
    filters.push(`node["leisure"="park"](around:${radiusMeters},${lat},${lng});`);
  }

  const query = `[out:json][timeout:15];(${filters.join("")});out body 50;`;

  const response = await fetch(OVERPASS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API помилка: ${response.status}`);
  }

  const data = await response.json();
  const elements: any[] = data.elements || [];

  // Фільтруємо тільки ті що мають назву
  const pois: RouteWaypoint[] = elements
    .filter((el) => el.lat && el.lon && el.tags?.name)
    .map((el) => {
      const tags = el.tags || {};

      // Визначаємо тип
      let detectedType = "attraction";
      for (const [type, osmTags] of Object.entries(POI_TYPE_TO_OSM)) {
        if (osmTags.some((t) => tags[t.key] === t.value)) {
          detectedType = type;
          break;
        }
      }

      const poi: RouteWaypoint = {
        name: tags.name || tags["name:uk"] || tags["name:en"] || "Місце",
        type: detectedType,
        location: [el.lat, el.lon],
        source: "OpenStreetMap",
      };

      if (tags["addr:street"]) {
        poi.address = [tags["addr:street"], tags["addr:housenumber"]]
          .filter(Boolean)
          .join(" ");
      }
      if (tags.description) poi.description = tags.description;
      if (tags.website) poi.description = (poi.description || "") + ` 🌐 ${tags.website}`;
      if (tags.opening_hours) {
        poi.description = (poi.description || "") + ` ⏰ ${tags.opening_hours}`;
      }

      return poi;
    });

  return pois;
}

// ─── Крок 3: OSRM — будує реальний маршрут ───────────────────────────────────

async function buildRouteWithOSRM(
  waypoints: [number, number][] // [[lat, lng], ...]
): Promise<[number, number][]> {
  // OSRM очікує lng,lat
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `${OSRM_API_URL}/${coords}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`OSRM помилка: ${response.status}`);

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error("OSRM не знайшов маршрут між точками");
  }

  const coordinates: [number, number][] = data.routes[0].geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng] // повертаємо в [lat, lng]
  );

  return coordinates;
}

// ─── Основна функція ──────────────────────────────────────────────────────────

export async function generateRouteFromText(
  userLocation: [number, number], // [lng, lat] — формат Mapbox
  prompt: string,
  options?: {
    routeMode?: "point_to_point" | "exploration";
  }
): Promise<RouteResult> {
  const [userLng, userLat] = userLocation; // Mapbox передає [lng, lat]
  const routeMode = options?.routeMode || "exploration";

  // 1. Парсимо намір
  const intent = await parseIntentWithClaude(prompt, routeMode);

  // 2. Шукаємо POI
  const allPois = await fetchPoisFromOverpass(
    userLat,
    userLng,
    intent.poiTypes,
    intent.maxRadiusMeters
  );

  if (allPois.length === 0) {
    // Розширюємо радіус і пробуємо ще раз
    const widePois = await fetchPoisFromOverpass(
      userLat,
      userLng,
      intent.poiTypes,
      intent.maxRadiusMeters * 2
    );

    if (widePois.length === 0) {
      throw new Error(
        "Не вдалося знайти цікаві місця поруч. Спробуйте інший запит або розширте пошук."
      );
    }

    allPois.push(...widePois);
  }

  // 3. Вибираємо найближчі N POI
  const selectedPois = pickNearestPois(
    allPois,
    [userLat, userLng],
    intent.maxPois
  );

  // 4. Будуємо ланцюжок точок: старт → POI → (для loop: назад до старту)
  const origin: [number, number] = [userLat, userLng];
  const waypointCoords: [number, number][] = [
    origin,
    ...selectedPois.map((p) => p.location),
  ];

  if (intent.routeMode === "loop") {
    waypointCoords.push(origin); // повертаємось
  }

  // 5. Будуємо реальний маршрут через OSRM
  const routePoints = await buildRouteWithOSRM(waypointCoords);

  // 6. Розраховуємо відстань
  let distanceKm = 0;
  for (let i = 0; i < routePoints.length - 1; i++) {
    distanceKm += haversineKm(
      routePoints[i][0],
      routePoints[i][1],
      routePoints[i + 1][0],
      routePoints[i + 1][1]
    );
  }
  distanceKm = Math.max(Math.round(distanceKm * 10) / 10, 0.1);
  const estimatedTimeMinutes = Math.max(Math.round((distanceKm / 5) * 60), 5);

  return {
    points: routePoints,
    waypoints: selectedPois,
    distanceKm,
    estimatedTimeMinutes,
    locations: selectedPois.map((p) => p.name),
  };
}
