export type Coordinate = { latitude: number; longitude: number };

export type ChargingStation = {
  id: number;
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
  latitude: number;
  longitude: number;
  powerKw: number | null;
  connectors: string[];
  openingHours: string | null;
  access: string;
  sourceUrl: string | null;
  checkedAt: string | null;
};

export type PlannedStation = ChargingStation & {
  routeKm: number;
  lateralKm: number;
  remainingKm: number;
  withinRange: boolean | null;
};

export function validCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== "object") return false;
  const coords = value as Record<string, unknown>;
  return typeof coords.latitude === "number" && Number.isFinite(coords.latitude) &&
    coords.latitude >= -90 && coords.latitude <= 90 &&
    typeof coords.longitude === "number" && Number.isFinite(coords.longitude) &&
    coords.longitude >= -180 && coords.longitude <= 180;
}

export function distanceKm(a: Coordinate, b: Coordinate) {
  const radians = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * radians;
  const lon = (b.longitude - a.longitude) * radians;
  const h = Math.sin(lat / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(lon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function googleDirectionsUrl(origin: Coordinate, destination: Coordinate, waypoints: Coordinate[] = []) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
  url.searchParams.set("travelmode", "driving");
  if (waypoints.length) url.searchParams.set("waypoints", waypoints.map(point => `${point.latitude},${point.longitude}`).join("|"));
  return url.toString();
}

/**
 * Projeção em segmentos da geometria real do provedor de rotas.
 * lateralKm é aproximação em linha reta até a geometria; NÃO é desvio rodoviário.
 * routeKm é a posição aproximada ao longo do percurso, não distância até a tomada.
 */
export function locateAlongRoute(point: Coordinate, path: Coordinate[], routeLengthKm: number) {
  const rad = Math.PI / 180;
  const cumulative: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    cumulative[i] = cumulative[i - 1] + distanceKm(path[i - 1], path[i]);
  }
  const length = cumulative[path.length - 1] ?? 0;
  let nearest = { lateralKm: Infinity, routeKm: 0 };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const latitudeFactor = Math.cos((a.latitude + b.latitude + point.latitude) / 3 * rad);
    const dx = (b.longitude - a.longitude) * 111.195 * latitudeFactor;
    const dy = (b.latitude - a.latitude) * 111.195;
    const px = (point.longitude - a.longitude) * 111.195 * latitudeFactor;
    const py = (point.latitude - a.latitude) * 111.195;
    const denom = dx * dx + dy * dy;
    const t = denom === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / denom));
    const lateralKm = Math.hypot(px - t * dx, py - t * dy);
    if (lateralKm < nearest.lateralKm) {
      const segmentProgress = cumulative[i - 1] + t * (cumulative[i] - cumulative[i - 1]);
      nearest = { lateralKm, routeKm: length > 0 ? segmentProgress / length * routeLengthKm : 0 };
    }
  }
  return nearest;
}
