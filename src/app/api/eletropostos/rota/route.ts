import { validCoordinate, type Coordinate } from "@/lib/charging-planner";

export const runtime = "nodejs";
export const maxDuration = 30;

type Place = Coordinate & { label: string };
type RequestBody = {
  origin?: unknown;
  originText?: unknown;
  destinationText?: unknown;
};

let geocodingQueue: Promise<void> = Promise.resolve();
let previousGeocodingAt = 0;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 3 || normalized.length > 120 || /[<>\r\n]/.test(normalized)) return null;
  return normalized;
}

async function geocode(place: string): Promise<Place | null> {
  const job = geocodingQueue.then(async () => {
    const delay = Math.max(0, 1200 - (Date.now() - previousGeocodingAt));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    previousGeocodingAt = Date.now();
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${place}, Brasil`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: {
        Accept: "application/geo+json",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": "O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)",
        Referer: "https://ocalcadao.com.br/",
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("geocode-unavailable");
    const results: unknown = await response.json();
    if (!Array.isArray(results) || !results.length) return null;
    const item = results[0] as { lat?: string; lon?: string; display_name?: string };
    const coordinate = { latitude: Number(item.lat), longitude: Number(item.lon) };
    if (!validCoordinate(coordinate)) return null;
    return { ...coordinate, label: item.display_name?.slice(0, 180) || place };
  });
  geocodingQueue = job.then(() => undefined, () => undefined);
  return job;
}

type OrsResponse = {
  features?: Array<{
    geometry?: { coordinates?: number[][] };
    properties?: { summary?: { distance?: number; duration?: number } };
  }>;
};

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 2048) {
    return Response.json({ error: "Pesquisa muito extensa." }, { status: 413 });
  }
  const apiKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({
      error: "Planejamento por estrada indisponível: o serviço de rotas ainda não foi configurado.",
      code: "ROUTE_PROVIDER_NOT_CONFIGURED",
    }, { status: 503 });
  }
  let body: RequestBody;
  try { body = await request.json() as RequestBody; }
  catch { return Response.json({ error: "Informe a origem e o destino." }, { status: 400 }); }

  const startText = text(body.originText);
  const endText = text(body.destinationText);
  if (!endText || (!startText && !validCoordinate(body.origin))) {
    return Response.json({ error: "Informe cidades de origem e destino válidas, ou use sua localização como origem." }, { status: 400 });
  }

  let start: Place | null = validCoordinate(body.origin)
    ? { ...body.origin, label: "Sua localização aproximada" }
    : null;
  let end: Place | null = null;
  try {
    if (!start && startText) start = await geocode(startText);
    end = await geocode(endText);
  } catch {
    return Response.json({ error: "Não foi possível localizar a origem ou o destino. Tente novamente." }, { status: 503 });
  }
  if (!start || !end) {
    return Response.json({ error: "Origem ou destino não localizado. Informe cidade e UF, por exemplo: Assis, SP." }, { status: 422 });
  }
  const url = "https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [start.longitude, start.latitude],
          [end.longitude, end.latitude],
        ],
        instructions: false,
        elevation: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(18000),
    });
    if (!response.ok) {
      // A API externa pode enviar uma descrição útil do erro. Nunca registre credenciais.
      const responseText = (await response.text()).slice(0, 600);
      const sanitized = responseText.replaceAll(apiKey, "[redacted]")
        .replace(/[A-Za-z0-9_=-]{24,}/g, "[redacted]");
      console.error("[eletropostos/rota] upstream", {
        status: response.status,
        contentType: response.headers.get("content-type"),
        reason: sanitized.slice(0, 240),
      });
      return Response.json({ error: "Não foi possível traçar a rota rodoviária. Confira a origem e o destino." }, { status: 503 });
    }
    const payload = await response.json() as OrsResponse;
    const feature = payload.features?.[0];
    const km = Number(feature?.properties?.summary?.distance) / 1000;
    const points = feature?.geometry?.coordinates?.map(pair => ({
      latitude: pair[1], longitude: pair[0],
    })) ?? [];
    if (!Number.isFinite(km) || km <= 0 || points.length < 2 || points.length > 100000 ||
        !points.every(validCoordinate)) {
      throw new Error("unexpected-route");
    }
    return Response.json({
      origin: start, destination: end,
      routeKm: km, points,
      attribution: "Trajeto: openrouteservice, dados © contribuidores OpenStreetMap (ODbL).",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "O serviço de rotas está indisponível. Tente novamente." }, { status: 503 });
  }
}
