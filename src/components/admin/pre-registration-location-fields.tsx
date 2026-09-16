"use client";

import { useState } from "react";

type StateOption = { code: string; name: string };
type CityOption = { id: number; name: string; stateCode: string };

type Props = {
  states: StateOption[];
};

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-canvas";
const labelClass = "block text-sm font-extrabold text-ink";

export function PreRegistrationLocationFields({ states }: Props) {
  const [stateCode, setStateCode] = useState("");
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadCities(nextState: string) {
    setStateCode(nextState);
    setCityId("");
    setCities([]);
    setError("");
    if (!nextState) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/localidades?uf=${encodeURIComponent(nextState)}`);
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { cities: CityOption[] };
      setCities(payload.cities);
    } catch {
      setError("Não foi possível carregar as cidades desse estado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass} htmlFor="pre-state">
        Estado
        <select
          id="pre-state"
          className={inputClass}
          value={stateCode}
          onChange={(event) => void loadCities(event.target.value)}
          required
        >
          <option value="" disabled>
            Selecione
          </option>
          {states.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass} htmlFor="pre-city">
        Cidade
        <select
          id="pre-city"
          name="city_id"
          className={inputClass}
          value={cityId}
          onChange={(event) => setCityId(event.target.value)}
          disabled={!stateCode || loading}
          required
        >
          <option value="" disabled>
            {loading ? "Carregando..." : "Selecione"}
          </option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="sm:col-span-2 text-sm font-bold text-brand-dark" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
