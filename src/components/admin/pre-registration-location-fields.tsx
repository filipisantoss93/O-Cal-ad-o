"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LocateIcon } from "@/components/icons";
import { detectCurrentCity } from "@/lib/location-client";

type StateOption = { code: string; name: string };
type CityOption = { id: number; name: string; stateCode: string };

type Props = {
  states: StateOption[];
};

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-canvas";
const labelClass = "block text-sm font-extrabold text-ink";

function inputValue(id: string) {
  const input = document.getElementById(id);
  return input instanceof HTMLInputElement ? input.value.trim() : "";
}

function setInputValue(id: string, value: string) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function hasStoredCoordinates() {
  const latitudeValue = inputValue("pre-latitude");
  const longitudeValue = inputValue("pre-longitude");
  if (!latitudeValue || !longitudeValue) return false;

  const latitude = Number(latitudeValue.replace(",", "."));
  const longitude = Number(longitudeValue.replace(",", "."));
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

export function PreRegistrationLocationFields({ states }: Props) {
  const [stateCode, setStateCode] = useState("");
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [locatingByAddress, setLocatingByAddress] = useState(false);
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const resolvingOnSubmitRef = useRef(false);
  const allowNextSubmitRef = useRef(false);

  function clearCoordinates() {
    setInputValue("pre-latitude", "");
    setInputValue("pre-longitude", "");
    setLocationMessage("");
  }

  async function loadCities(nextState: string, preservedCityId = "") {
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
      setCityId(preservedCityId);
    } catch {
      setError("Não foi possível carregar as cidades desse estado.");
    } finally {
      setLoading(false);
    }
  }

  const locateRegisteredAddress = useCallback(async (gpsError = "") => {
    const street = inputValue("pre-street");
    const addressNumber = inputValue("pre-number");
    const neighborhood = inputValue("pre-neighborhood");
    const postalCode = inputValue("pre-postal-code");

    if (!cityId || !street || !addressNumber || !neighborhood) {
      setError(
        [
          gpsError,
          "Preencha cidade, rua, número e bairro para buscar as coordenadas pelo endereço.",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return false;
    }

    setLocatingByAddress(true);
    setError("");
    setLocationMessage("");
    try {
      const response = await fetch("/api/geocodificar-endereco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId: Number(cityId),
          street,
          addressNumber,
          neighborhood,
          postalCode,
        }),
      });
      const payload = (await response.json()) as {
        latitude?: number;
        longitude?: number;
        error?: string;
      };

      if (
        !response.ok ||
        !Number.isFinite(payload.latitude) ||
        !Number.isFinite(payload.longitude)
      ) {
        throw new Error(
          payload.error ?? "Não foi possível localizar esse endereço.",
        );
      }

      setInputValue("pre-latitude", String(payload.latitude));
      setInputValue("pre-longitude", String(payload.longitude));
      setLocationMessage(
        gpsError
          ? "O GPS não ficou disponível. As coordenadas foram encontradas pelo endereço e serão gravadas no cadastro."
          : "Coordenadas encontradas pelo endereço e prontas para serem gravadas.",
      );
      return true;
    } catch (reason) {
      const addressError =
        reason instanceof Error
          ? reason.message
          : "Não foi possível localizar esse endereço.";
      setError([gpsError, addressError].filter(Boolean).join(" "));
      return false;
    } finally {
      setLocatingByAddress(false);
    }
  }, [cityId]);

  async function captureCurrentLocation() {
    setDetecting(true);
    setError("");
    setLocationMessage("");
    try {
      const city = await detectCurrentCity();
      await loadCities(city.stateCode, String(city.id));
      setInputValue("pre-latitude", String(city.latitude));
      setInputValue("pre-longitude", String(city.longitude));
      setLocationMessage(
        "Localização atual capturada. Estas coordenadas serão gravadas na loja quando o pré-cadastro for enviado.",
      );
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Não foi possível obter a localização atual.";
      const hasAddress =
        Boolean(cityId) &&
        Boolean(inputValue("pre-street")) &&
        Boolean(inputValue("pre-number")) &&
        Boolean(inputValue("pre-neighborhood"));
      if (hasAddress) {
        await locateRegisteredAddress(message);
      } else {
        setError(message);
      }
    } finally {
      setDetecting(false);
    }
  }

  useEffect(() => {
    const addressIds = [
      "pre-street",
      "pre-number",
      "pre-neighborhood",
      "pre-postal-code",
    ];
    const addressInputs = addressIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLInputElement => element instanceof HTMLInputElement);

    const onAddressChange = () => {
      if (hasStoredCoordinates()) clearCoordinates();
    };
    addressInputs.forEach((input) => input.addEventListener("input", onAddressChange));

    const citySelect = document.getElementById("pre-city");
    const form = citySelect?.closest("form");
    const onSubmit = (event: Event) => {
      if (!(form instanceof HTMLFormElement)) return;
      if (allowNextSubmitRef.current) {
        allowNextSubmitRef.current = false;
        return;
      }
      if (resolvingOnSubmitRef.current || hasStoredCoordinates()) return;

      const hasAddress =
        Boolean(cityId) &&
        Boolean(inputValue("pre-street")) &&
        Boolean(inputValue("pre-number")) &&
        Boolean(inputValue("pre-neighborhood"));
      if (!hasAddress) return;

      event.preventDefault();
      resolvingOnSubmitRef.current = true;
      void locateRegisteredAddress().finally(() => {
        resolvingOnSubmitRef.current = false;
        allowNextSubmitRef.current = true;
        form.requestSubmit();
      });
    };

    form?.addEventListener("submit", onSubmit);
    return () => {
      addressInputs.forEach((input) => input.removeEventListener("input", onAddressChange));
      form?.removeEventListener("submit", onSubmit);
    };
  }, [cityId, locateRegisteredAddress]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand/8 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-ink">Coordenadas da loja</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">
            Se estiver na empresa, capture o GPS. Se estiver cadastrando à distância, o endereço informado será usado para encontrar as coordenadas.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void captureCurrentLocation()}
            disabled={detecting || locatingByAddress}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
          >
            <LocateIcon className="size-4" />
            {detecting ? "Capturando..." : "Usar localização atual"}
          </button>
          <button
            type="button"
            onClick={() => void locateRegisteredAddress()}
            disabled={detecting || locatingByAddress}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-brand/25 bg-white px-4 text-sm font-black text-brand-dark transition hover:border-brand/45 hover:bg-brand/5 disabled:cursor-wait disabled:opacity-60"
          >
            <LocateIcon className="size-4" />
            {locatingByAddress ? "Buscando..." : "Buscar pelo endereço"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass} htmlFor="pre-state">
          Estado
          <select
            id="pre-state"
            className={inputClass}
            value={stateCode}
            onChange={(event) => {
              clearCoordinates();
              void loadCities(event.target.value);
            }}
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
            onChange={(event) => {
              setCityId(event.target.value);
              clearCoordinates();
              setError("");
            }}
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

        {locationMessage && !error && (
          <p className="sm:col-span-2 text-sm font-bold text-positive" role="status">
            {locationMessage}
          </p>
        )}
        {error && (
          <p className="sm:col-span-2 text-sm font-bold text-brand-dark" role="alert">
            {error}
          </p>
        )}
        <p className="sm:col-span-2 text-xs font-semibold leading-5 text-muted">
          Se nenhuma coordenada tiver sido informada, o sistema tentará localizar automaticamente o endereço antes de enviar o pré-cadastro. O cadastro não é bloqueado se o provedor de mapas não encontrar o local.
        </p>
      </div>
    </div>
  );
}
