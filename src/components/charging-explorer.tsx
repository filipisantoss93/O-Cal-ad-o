"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  distanceKm, googleDirectionsUrl, locateAlongRoute, type ChargingStation,
  type Coordinate, type PlannedStation,
} from "@/lib/charging-planner";

type RouteResult = {
  origin: Coordinate & { label: string };
  destination: Coordinate & { label: string };
  routeKm: number;
  points: Coordinate[];
  attribution: string;
};

const formatKm = (km: number) => km < 1
  ? `${Math.max(1, Math.round(km * 1000))} m`
  : `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

function accessLabel(value: string) {
  if (value === "public") return "Acesso público informado";
  if (value === "customers") return "Apenas clientes";
  if (value === "restricted") return "Acesso restrito";
  return "Acesso não informado";
}

function StationCard({ station, position, planned }: {
  station: ChargingStation;
  position: Coordinate | null;
  planned?: PlannedStation;
}) {
  const distance = position ? distanceKm(position, station) : null;
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black leading-tight text-ink">{station.name}</h3>
          <p className="mt-1 text-xs font-semibold text-muted">{station.city} · {station.state}</p>
        </div>
        {station.powerKw !== null && (
          <span className="shrink-0 rounded-lg bg-[#e4f6e9] px-2.5 py-1 text-sm font-black text-[#17633b]">
            {station.powerKw.toLocaleString("pt-BR")} kW
          </span>
        )}
      </div>
      {planned ? (
        <div className="mt-3 rounded-xl bg-canvas px-3 py-2 text-xs font-bold text-ink">
          ~{formatKm(planned.routeKm)} após a origem na rota · ~{formatKm(planned.lateralKm)} em linha reta fora do traçado
          {planned.withinRange === false ? (
            <p className="mt-1 font-semibold text-[#a83b26]">Além da autonomia informada, mesmo sem contar o desvio.</p>
          ) : null}
          {planned.withinRange === true ? (
            <p className="mt-1 font-semibold text-[#17633b]">Posição aproximada dentro da autonomia; desvio e consumo não calculados.</p>
          ) : null}
        </div>
      ) : distance !== null ? (
        <p className="mt-2 text-xs font-bold text-ink">{formatKm(distance)} em linha reta de sua localização</p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-muted">{station.address}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-ink">
          {accessLabel(station.access)}
        </span>
        <span className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-ink">
          {station.openingHours || "Horário não confirmado"}
        </span>
        {station.connectors.slice(0, 3).map((connector, index) =>
          <span key={`${connector}:${index}`} className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-ink">{connector}</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/loja/${station.slug}`} className="inline-flex min-h-10 items-center rounded-xl border border-line px-3 text-xs font-black text-ink">
          Ver dados e fonte
        </Link>
        <a href={googleDirectionsUrl(position, station)}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center rounded-xl bg-brand-dark px-3 text-xs font-black text-white">
          Navegar até o ponto ↗
        </a>
      </div>
    </article>
  );
}

function RouteSketch({ route, stations }: { route: RouteResult; stations: PlannedStation[] }) {
  const sampled = route.points.filter((_, index) => index % Math.max(1, Math.ceil(route.points.length / 180)) === 0 ||
    index === route.points.length - 1);
  const all = [...sampled, route.origin, route.destination, ...stations.slice(0, 8)];
  const mid = all.reduce((sum, c) => sum + c.latitude, 0) / all.length;
  const factor = Math.cos(mid * Math.PI / 180);
  const xs = all.map(c => c.longitude * factor), ys = all.map(c => c.latitude);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (value: number) => 14 + (value * factor - minX) / Math.max(maxX - minX, 0.0001) * 372;
  const scaleY = (value: number) => 186 - (value - minY) / Math.max(maxY - minY, 0.0001) * 172;
  const line = sampled.map((point, index) =>
    `${index === 0 ? "M" : "L"}${scaleX(point.longitude).toFixed(2)},${scaleY(point.latitude).toFixed(2)}`).join(" ");
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <svg viewBox="0 0 400 200" role="img" aria-label="Esquema do percurso com eletropostos próximos ao traçado" className="h-auto w-full rounded-xl bg-[#f1f8f5]">
        <path d={line} fill="none" stroke="#25835f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {stations.slice(0, 8).map(s => (
          <circle key={s.id} cx={scaleX(s.longitude)} cy={scaleY(s.latitude)} r="4.5" fill="#d95f37" stroke="white" strokeWidth="1.5" />
        ))}
        <circle cx={scaleX(route.origin.longitude)} cy={scaleY(route.origin.latitude)} r="5" fill="#174f39" />
        <circle cx={scaleX(route.destination.longitude)} cy={scaleY(route.destination.latitude)} r="5" fill="#263c62" />
      </svg>
      <p className="mt-2 text-[11px] leading-4 text-muted">
        Esquema aproximado do traçado, sem ruas, escala ou sentido de tráfego. Use o aplicativo de mapas para navegar.
      </p>
    </div>
  );
}

export function ChargingExplorer() {
  const [mode, setMode] = useState<"near" | "trip">("near");
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<Coordinate | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [connector, setConnector] = useState("");
  const [minPower, setMinPower] = useState("");
  const [publicOnly, setPublicOnly] = useState(false);
  const [originText, setOriginText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [useGpsOrigin, setUseGpsOrigin] = useState(false);
  const [autonomy, setAutonomy] = useState("");
  const [reserve, setReserve] = useState("30");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeError, setRouteError] = useState("");
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/eletropostos", { signal: controller.signal })
      .then(async response => {
        const result = await response.json() as { stations?: ChargingStation[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Não foi possível consultar os eletropostos.");
        setStations(result.stations ?? []);
      })
      .catch(error => {
        if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : "Não foi possível carregar os pontos.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  function locate() {
    if (!navigator.geolocation) {
      setLocationError("Seu navegador não oferece localização. Pesquise pela cidade ou informe a origem.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      found => {
        setPosition({ latitude: found.coords.latitude, longitude: found.coords.longitude });
        setUseGpsOrigin(true);
        setLocating(false);
      },
      () => {
        setLocationError("Não foi possível obter a localização. Pesquise pela cidade ou informe a origem.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }

  const connectors = useMemo(() => [...new Set(stations.flatMap(s => s.connectors))].sort((a, b) => a.localeCompare(b, "pt-BR")), [stations]);
  const filtered = useMemo(() => {
    const power = minPower ? Number(minPower) : null;
    return stations.filter(station => {
      if (connector && !station.connectors.includes(connector)) return false;
      if (power !== null && (station.powerKw === null || station.powerKw < power)) return false;
      if (publicOnly && station.access !== "public") return false;
      if (mode === "near" && cityFilter.trim() && !`${station.city} ${station.state}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .includes(cityFilter.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) return false;
      return true;
    });
  }, [stations, connector, minPower, publicOnly, cityFilter, mode]);

  const nearby = useMemo(() => [...filtered].sort((a, b) => position
    ? distanceKm(position, a) - distanceKm(position, b)
    : a.city.localeCompare(b.city, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 60), [filtered, position]);

  const planned = useMemo((): PlannedStation[] => {
    if (!route) return [];
    const available = autonomy.trim() !== "" && Number.isFinite(Number(autonomy)) && Number(autonomy) > 0
      ? Math.max(0, Number(autonomy) - (Number(reserve) || 0)) : null;
    return filtered.flatMap(station => {
      const { routeKm, lateralKm } = locateAlongRoute(station, route.points, route.routeKm);
      // Exclui grandes desvios em linha reta e pontos já ultrapassados na rota.
      if (lateralKm > 8 || routeKm < 0.5 || routeKm > route.routeKm - 0.5) return [];
      return [{ ...station, routeKm, lateralKm,
        remainingKm: Math.max(0, route.routeKm - routeKm),
        withinRange: available === null ? null : routeKm <= available && lateralKm <= 3,
      }];
    }).sort((a, b) => a.routeKm - b.routeKm);
  }, [filtered, route, autonomy, reserve]);

  async function plan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPlanning(true); setRoute(null); setRouteError("");
    try {
      const response = await fetch("/api/eletropostos/rota", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: useGpsOrigin && position ? position : undefined,
          originText: useGpsOrigin && position ? undefined : originText.trim(),
          destinationText: destinationText.trim(),
        }),
      });
      const payload = await response.json() as RouteResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível traçar a rota.");
      setRoute(payload);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "Não foi possível traçar a rota.");
    } finally { setPlanning(false); }
  }

  const externalRouteUrl = (() => {
    const origin = useGpsOrigin && position
      ? `${position.latitude},${position.longitude}` : originText.trim();
    if (!origin || !destinationText.trim()) return null;
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destinationText.trim());
    url.searchParams.set("travelmode", "driving");
    return url.toString();
  })();

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Modo de busca" className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-1.5">
        <button type="button" role="tab" aria-selected={mode === "near"} onClick={() => setMode("near")}
          className={`min-h-12 rounded-xl px-3 text-sm font-black ${mode === "near" ? "bg-brand-dark text-white" : "text-ink"}`}>📍 Perto de mim</button>
        <button type="button" role="tab" aria-selected={mode === "trip"} onClick={() => setMode("trip")}
          className={`min-h-12 rounded-xl px-3 text-sm font-black ${mode === "trip" ? "bg-brand-dark text-white" : "text-ink"}`}>🚗 Planejar viagem</button>
      </div>

      {mode === "near" ? (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-muted">Encontre pontos próximos ou pesquise em qualquer cidade, sem alterar a cidade principal do Calçadão.</p>
          <button type="button" onClick={locate} disabled={locating}
            className="mt-3 min-h-11 rounded-xl bg-brand-dark px-4 text-sm font-black text-white disabled:opacity-60">
            {locating ? "Localizando..." : position ? "Atualizar localização" : "📍 Usar minha localização"}
          </button>
          <label className="mt-3 block text-xs font-bold text-ink">Pesquisar cidade ou UF
            <input value={cityFilter} onChange={event => setCityFilter(event.target.value)}
              placeholder="Ex.: Ourinhos ou SP" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink" />
          </label>
          {locationError && <p role="status" className="mt-2 text-xs font-semibold text-muted">{locationError}</p>}
          <p className="mt-2 text-xs text-muted">{position ? "Ordenação por distância em linha reta, não por percurso rodoviário." : "Sem localização, os resultados são organizados por cidade."}</p>
        </div>
      ) : (
        <form onSubmit={plan} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-muted">Informe origem e destino para encontrar pontos na direção da viagem, mesmo em outras cidades.</p>
          <label className="block text-xs font-bold text-ink">Origem
            <input value={originText} onChange={event => { setOriginText(event.target.value); setUseGpsOrigin(false); }}
              disabled={useGpsOrigin && !!position} required={!useGpsOrigin || !position}
              placeholder="Assis, SP" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink disabled:opacity-55" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={locate} disabled={locating}
              className="min-h-10 rounded-xl border border-line px-3 text-xs font-bold text-ink disabled:opacity-60">
              {locating ? "Localizando..." : "Usar GPS como origem"}
            </button>
            {useGpsOrigin && position &&
              <button type="button" onClick={() => setUseGpsOrigin(false)} className="text-xs font-bold text-brand-dark underline">GPS selecionado · Alterar</button>}
          </div>
          <label className="block text-xs font-bold text-ink">Destino
            <input value={destinationText} onChange={event => { setDestinationText(event.target.value); setRoute(null); }}
              required placeholder="São Paulo, SP" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-bold text-ink">Autonomia restante (km)
              <input type="number" min="1" max="2000" step="1" value={autonomy} onChange={event => setAutonomy(event.target.value)}
                placeholder="Opcional" className="mt-1 min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink" />
            </label>
            <label className="block text-xs font-bold text-ink">Reserva desejada (km)
              <input type="number" min="0" max="500" step="1" value={reserve} onChange={event => setReserve(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink" />
            </label>
          </div>
          <p className="text-xs leading-5 text-muted">O limite de autonomia é apenas informativo: consumo real, desvio até a tomada e disponibilidade do carregador não são calculados.</p>
          <button type="submit" disabled={planning || (!useGpsOrigin && !originText.trim()) || !destinationText.trim()}
            className="min-h-12 w-full rounded-xl bg-brand-dark px-4 text-sm font-black text-white disabled:opacity-55">
            {planning ? "Calculando trajeto..." : "Encontrar pontos no caminho"}
          </button>
          {externalRouteUrl && <a href={externalRouteUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center text-xs font-black text-brand-dark underline">
            Ver trajeto no Google Maps ↗
          </a>}
          {routeError && <p role="alert" className="rounded-xl border border-[#e8baaa] bg-[#fff2ec] p-3 text-xs font-bold text-[#8d3525]">{routeError}</p>}
          {locationError && <p role="status" className="text-xs text-muted">{locationError}</p>}
        </form>
      )}

      <fieldset className="rounded-2xl border border-line bg-surface p-4">
        <legend className="px-2 text-sm font-black text-ink">Filtros de recarga</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-ink">Conector
            <select value={connector} onChange={event => setConnector(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink">
              <option value="">Todos os conectores</option>
              {connectors.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-ink">Potência mínima
            <select value={minPower} onChange={event => setMinPower(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink">
              <option value="">Qualquer potência</option>
              {[7, 22, 50, 100, 150, 300].map(value => <option value={value} key={value}>{value} kW ou mais</option>)}
            </select>
          </label>
        </div>
        <label className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs font-bold text-ink">
          <input type="checkbox" checked={publicOnly} onChange={event => setPublicOnly(event.target.checked)} />
          Apenas pontos com acesso público informado
        </label>
      </fieldset>

      {loading ? <p className="text-sm text-muted">Consultando eletropostos...</p> : null}
      {catalogError ? <p role="alert" className="text-sm font-semibold text-muted">{catalogError}</p> : null}
      {!loading && !catalogError && mode === "near" ? (
        <section>
          <h2 className="mb-3 text-lg font-black text-ink">{nearby.length} {nearby.length === 1 ? "ponto encontrado" : "pontos encontrados"}</h2>
          {nearby.length === 0 ? <p className="text-sm text-muted">Nenhum ponto no filtro. Tente outra cidade ou potência.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">{nearby.map(station =>
              <StationCard key={station.id} station={station} position={position} />)}</div>
          )}
          {filtered.length > nearby.length && <p className="mt-3 text-xs text-muted">Exibindo os 60 primeiros de {filtered.length} pontos. Refine a cidade para ver outros.</p>}
        </section>
      ) : null}
      {mode === "trip" && route ? (
        <section className="space-y-3">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-lg font-black text-ink">Rota: {formatKm(route.routeKm)}</h2>
            <p className="mt-1 text-xs font-semibold text-muted">De {route.origin.label} até {route.destination.label}</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Encontramos {planned.length} pontos cadastrados a até 8 km em linha reta do traçado. A posição na rota é aproximada e não equivale a desvio por estrada, alcance garantido ou disponibilidade em tempo real.
            </p>
            <p className="mt-1 text-[11px] text-muted">{route.attribution}</p>
          </div>
          <RouteSketch route={route} stations={planned} />
          <h2 className="text-lg font-black text-ink">Próximas opções na ordem do percurso</h2>
          {planned.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">Nenhum eletroposto cadastrado próximo ao traçado desta rota. Isso não significa que não existam carregadores: a cobertura do catálogo ainda é parcial.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">{planned.map((station, index) =>
              <div key={station.id}>
                {index === 0 && <p className="mb-1 text-xs font-black text-brand-dark">PRÓXIMA OPÇÃO CADASTRADA</p>}
                <StationCard station={station} position={route.origin} planned={station} />
              </div>)}</div>
          )}
        </section>
      ) : null}
      <p className="text-xs leading-5 text-muted">
        Informações de potência, acesso e horário são declarações de fontes externas, sujeitas a mudanças. Confirme conector, funcionamento e cobrança com o operador antes de iniciar a viagem.
      </p>
    </div>
  );
}
