import { NextResponse } from "next/server";
import { distanceKm, validCoordinate } from "@/lib/charging-planner";
import { findChargingCityIds, loadChargingStations } from "@/lib/charging-stations-server";

export const revalidate = 0;

const pageSize = 24;

function positiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitudeValue = params.get("lat");
  const longitudeValue = params.get("lon");
  const hasCoordinates = latitudeValue !== null || longitudeValue !== null;
  const position = { latitude: Number(latitudeValue), longitude: Number(longitudeValue) };

  if (hasCoordinates && (latitudeValue === null || longitudeValue === null || !validCoordinate(position))) {
    return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  const selectedCityId = positiveInteger(params.get("cityId"));
  const citySearch = params.get("city")?.trim().slice(0, 80) ?? "";
  const page = positiveInteger(params.get("page")) ?? 1;
  const connector = params.get("connector")?.trim().slice(0, 80) ?? "";
  const minimumPower = Math.max(0, Number(params.get("minPower") ?? 0)) || 0;
  const publicOnly = params.get("publicOnly") === "1";

  if (!hasCoordinates && !selectedCityId && !citySearch) {
    return NextResponse.json({
      stations: [],
      total: 0,
      page: 1,
      pageSize,
      connectors: [],
      selectionRequired: true,
    });
  }

  try {
    const cityIds = hasCoordinates
      ? undefined
      : selectedCityId
        ? [selectedCityId]
        : await findChargingCityIds(citySearch);
    const candidates = await loadChargingStations({ cityIds });
    const availableConnectors = [...new Set(candidates.flatMap((station) => station.connectors))]
      .sort((first, second) => first.localeCompare(second, "pt-BR"));
    const filtered = candidates.filter((station) => {
      if (connector && !station.connectors.includes(connector)) return false;
      if (minimumPower > 0 && (station.powerKw === null || station.powerKw < minimumPower)) return false;
      if (publicOnly && station.access !== "public") return false;
      return true;
    });

    filtered.sort((first, second) => {
      if (hasCoordinates) return distanceKm(position, first) - distanceKm(position, second);
      const accessDifference = Number(second.access === "public") - Number(first.access === "public");
      if (accessDifference !== 0) return accessDifference;
      const powerDifference = Number(second.powerKw ?? 0) - Number(first.powerKw ?? 0);
      if (powerDifference !== 0) return powerDifference;
      return first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" });
    });

    const offset = (page - 1) * pageSize;
    return NextResponse.json({
      stations: filtered.slice(offset, offset + pageSize),
      total: filtered.length,
      page,
      pageSize,
      connectors: availableConnectors,
      selectionRequired: false,
    }, {
      headers: { "Cache-Control": "private, max-age=0, no-store" },
    });
  } catch (error) {
    console.error("[eletropostos] catálogo indisponível", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível carregar os eletropostos." }, { status: 503 });
  }
}
