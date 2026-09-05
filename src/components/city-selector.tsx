"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LocateIcon, MapPinIcon, XIcon } from "@/components/icons";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  type CityOption,
  type SelectedCity,
  type StateOption,
} from "@/lib/location";
import {
  detectCurrentCity,
  saveSelectedCity,
} from "@/lib/location-client";

export function CitySelector({ variant = "compact" }: { variant?: "compact" | "hero" }) {
  const [open, setOpen] = useState(false);
  const storedCity = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(cityChangeEventName, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(cityChangeEventName, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => window.localStorage.getItem(selectedCityStorageKey),
    () => null,
  );
  const selectedCity = useMemo(() => {
    if (!storedCity) return null;
    try {
      return JSON.parse(storedCity) as SelectedCity;
    } catch {
      return null;
    }
  }, [storedCity]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [stateCode, setStateCode] = useState("");
  const [cityId, setCityId] = useState("");
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState("");

  async function loadStates() {
    if (states.length > 0) return;
    setLoadingStates(true);
    try {
      const response = await fetch("/api/localidades");
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { states: StateOption[] };
      setStates(payload.states);
    } catch {
      setError("Não foi possível carregar os estados.");
    } finally {
      setLoadingStates(false);
    }
  }

  async function loadCities(nextStateCode: string, preservedCityId = "") {
    if (!nextStateCode) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    setError("");
    try {
      const response = await fetch(`/api/localidades?uf=${nextStateCode}`);
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { cities: CityOption[] };
      setCities(payload.cities);
      setCityId(preservedCityId);
    } catch {
      setError("Não foi possível carregar as cidades.");
    } finally {
      setLoadingCities(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function chooseManualCity() {
    const city = cities.find((option) => option.id === Number(cityId));
    if (!city) return;
    saveSelectedCity(city);
    setOpen(false);
  }

  async function useCurrentLocation() {
    setDetecting(true);
    setError("");
    try {
      const city = await detectCurrentCity();
      saveSelectedCity(city, {
        latitude: city.latitude,
        longitude: city.longitude,
      });
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível obter sua localização.");
    } finally {
      setDetecting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError("");
          void loadStates();
          if (selectedCity) {
            setStateCode(selectedCity.stateCode);
            void loadCities(selectedCity.stateCode, String(selectedCity.id));
          }
        }}
        className={
          variant === "hero"
            ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-extrabold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            : "inline-flex min-h-10 max-w-44 items-center gap-2 rounded-full px-3 text-sm font-extrabold text-ink transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        }
        aria-haspopup="dialog"
        aria-label={selectedCity ? `Cidade: ${selectedCity.name}, ${selectedCity.stateCode}` : "Escolher cidade"}
      >
        <MapPinIcon className="size-4 shrink-0 text-brand" />
        <span className={variant === "compact" ? "hidden truncate sm:block" : "truncate"}>
          {selectedCity ? `${selectedCity.name} - ${selectedCity.stateCode}` : "Escolher cidade"}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-end bg-ink/45 p-0 sm:place-items-center sm:p-4">
          <button
            type="button"
            aria-label="Fechar seleção de cidade"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="city-selector-title"
            className="relative z-10 w-full rounded-t-[2rem] border border-line bg-surface p-5 shadow-2xl sm:max-w-lg sm:rounded-[2rem] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                  Sua localização
                </p>
                <h2 id="city-selector-title" className="mt-1 text-2xl font-black tracking-tight text-ink">
                  Escolha sua cidade
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Usamos a cidade para mostrar ofertas e comércios mais relevantes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-label="Fechar"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={detecting}
              autoFocus
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
            >
              <LocateIcon className="size-5" />
              {detecting ? "Identificando sua cidade..." : "Usar localização atual"}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-widest text-muted">
              <span className="h-px flex-1 bg-line" /> ou escolha manualmente <span className="h-px flex-1 bg-line" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-extrabold text-ink">
                Estado
                <select
                  className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                  value={stateCode}
                  disabled={loadingStates}
                  onChange={(event) => {
                    const nextStateCode = event.target.value;
                    setStateCode(nextStateCode);
                    setCityId("");
                    void loadCities(nextStateCode);
                  }}
                >
                  <option value="">{loadingStates ? "Carregando..." : "Selecione"}</option>
                  {states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-extrabold text-ink">
                Cidade
                <select
                  className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-canvas"
                  value={cityId}
                  disabled={!stateCode || loadingCities}
                  onChange={(event) => setCityId(event.target.value)}
                >
                  <option value="">{loadingCities ? "Carregando..." : "Selecione"}</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                </select>
              </label>
            </div>

            {error && <p role="alert" className="mt-4 text-sm font-bold leading-6 text-brand-dark">{error}</p>}

            <button
              type="button"
              onClick={chooseManualCity}
              disabled={!cityId}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-ink/12 bg-ink px-4 text-sm font-black text-white transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirmar cidade
            </button>

            <p className="mt-4 text-center text-xs font-semibold leading-5 text-muted">
              A localização exata é usada apenas para identificar o município e não é armazenada.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
