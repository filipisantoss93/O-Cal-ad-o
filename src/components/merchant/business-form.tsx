"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { saveBusinessAction } from "@/app/painel/loja/actions";
import { ImageIcon, LocateIcon } from "@/components/icons";
import {
  type ActionState,
  initialActionState,
} from "@/lib/action-state";
import type { CityOption, StateOption } from "@/lib/location";
import { detectCurrentCity } from "@/lib/location-client";

export type BusinessFormValue = {
  id: number;
  cityId: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  whatsapp: string;
  publicEmail: string;
  websiteUrl: string;
  street: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  postalCode: string;
  isActive: boolean;
  logoUrl: string | null;
  coverUrl: string | null;
} | null;

type BusinessFormProps = {
  business: BusinessFormValue;
  states: StateOption[];
  initialCity: CityOption | null;
  categories: Array<{ id: number; label: string }>;
};

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-canvas";
const labelClass = "block text-sm font-extrabold text-ink";

function fieldError(state: ActionState, name: string) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? (
    <p className="mt-1.5 text-sm font-semibold text-brand-dark">{message}</p>
  ) : null;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function BusinessForm({
  business,
  states,
  initialCity,
  categories,
}: BusinessFormProps) {
  const [state, action, pending] = useActionState(
    saveBusinessAction,
    initialActionState,
  );
  const [name, setName] = useState(business?.name ?? "");
  const [slug, setSlug] = useState(business?.slug ?? "");
  const [slugWasEdited, setSlugWasEdited] = useState(Boolean(business?.slug));
  const [stateCode, setStateCode] = useState(initialCity?.stateCode ?? "");
  const [cityId, setCityId] = useState(initialCity ? String(initialCity.id) : "");
  const [cities, setCities] = useState<CityOption[]>(initialCity ? [initialCity] : []);
  const [loadingCities, setLoadingCities] = useState(false);
  const [detectingCity, setDetectingCity] = useState(false);
  const [cityError, setCityError] = useState("");

  async function loadCities(nextStateCode: string, preservedCityId = "") {
    if (!nextStateCode) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    setCityError("");
    try {
      const response = await fetch(`/api/localidades?uf=${nextStateCode}`);
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { cities: CityOption[] };
      setCities(payload.cities);
      setCityId(preservedCityId);
    } catch {
      setCityError("Não foi possível carregar as cidades.");
    } finally {
      setLoadingCities(false);
    }
  }

  async function useCurrentLocation() {
    setDetectingCity(true);
    setCityError("");
    try {
      const city = await detectCurrentCity();
      setStateCode(city.stateCode);
      await loadCities(city.stateCode, String(city.id));
    } catch (reason) {
      setCityError(reason instanceof Error ? reason.message : "Não foi possível identificar a cidade.");
    } finally {
      setDetectingCity(false);
    }
  }

  return (
    <form action={action} className="space-y-8">
      {business && (
        <input type="hidden" name="business_id" value={business.id} />
      )}

      {state.message && (
        <div
          role={state.status === "success" ? "status" : "alert"}
          className={
            state.status === "success"
              ? "rounded-xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold leading-6 text-positive"
              : "rounded-xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold leading-6 text-brand-dark"
          }
        >
          {state.message}
        </div>
      )}

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="col-span-full mb-1 text-lg font-black text-ink">
          Identificação da loja
        </legend>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="business-name">
            Nome da loja
          </label>
          <input
            className={inputClass}
            id="business-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (!slugWasEdited) setSlug(slugify(nextName));
            }}
            required
            minLength={2}
            maxLength={120}
            placeholder="Ex.: Mercado Avenida"
          />
          {fieldError(state, "name")}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="business-slug">
            Endereço público
          </label>
          <div className="mt-2 flex min-h-12 items-center rounded-xl border border-line bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
            <span className="hidden pl-4 text-sm font-bold text-muted sm:inline">
              ocalcadao.com.br/loja/
            </span>
            <input
              className="min-h-11 min-w-0 flex-1 bg-transparent px-4 text-base text-ink outline-none sm:pl-1"
              id="business-slug"
              name="slug"
              type="text"
              value={slug}
              onChange={(event) => {
                setSlug(slugify(event.target.value));
                setSlugWasEdited(true);
              }}
              required
              minLength={2}
              maxLength={100}
              placeholder="mercado-avenida"
            />
          </div>
          <p className="mt-1.5 text-xs font-semibold text-muted">
            Use letras, números e hífens. Evite alterar depois de divulgar.
          </p>
          {fieldError(state, "slug")}
        </div>

        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className={labelClass}>Localização da loja</p>
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={pending || detectingCity}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-black text-brand-dark transition hover:bg-brand/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              <LocateIcon className="size-4" />
              {detectingCity ? "Identificando..." : "Usar localização atual"}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-extrabold text-ink" htmlFor="business-state">
              Estado
              <select
                className={inputClass}
                id="business-state"
                value={stateCode}
                onChange={(event) => {
                  const nextStateCode = event.target.value;
                  setStateCode(nextStateCode);
                  setCityId("");
                  void loadCities(nextStateCode);
                }}
                required
              >
                <option value="" disabled>Selecione</option>
                {states.map((state) => (
                  <option key={state.code} value={state.code}>{state.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-extrabold text-ink" htmlFor="business-city">
              Cidade
              <select
                className={inputClass}
                id="business-city"
                name="city_id"
                value={cityId}
                onChange={(event) => setCityId(event.target.value)}
                onFocus={() => {
                  if (stateCode && cities.length <= 1) {
                    void loadCities(stateCode, cityId);
                  }
                }}
                disabled={!stateCode || loadingCities}
                required
              >
                <option value="" disabled>
                  {loadingCities ? "Carregando..." : "Selecione"}
                </option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </label>
          </div>
          {cityError && <p role="alert" className="mt-2 text-sm font-semibold text-brand-dark">{cityError}</p>}
          {fieldError(state, "city_id")}
        </div>

        <div>
          <label className={labelClass} htmlFor="business-category">
            Categoria principal
          </label>
          <select
            className={inputClass}
            id="business-category"
            name="category_id"
            defaultValue={business?.categoryId ?? ""}
            required
          >
            <option value="" disabled>
              Selecione
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
          {fieldError(state, "category_id")}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="business-description">
            Descrição
          </label>
          <textarea
            className="mt-2 min-h-32 w-full resize-y rounded-xl border border-line bg-white px-4 py-3 text-base leading-7 text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10"
            id="business-description"
            name="description"
            defaultValue={business?.description}
            maxLength={2000}
            placeholder="Conte o que sua empresa oferece e o que torna seu atendimento especial."
          />
          {fieldError(state, "description")}
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="col-span-full mb-1 text-lg font-black text-ink">
          Contato público
        </legend>
        <div>
          <label className={labelClass} htmlFor="business-whatsapp">
            WhatsApp
          </label>
          <input
            className={inputClass}
            id="business-whatsapp"
            name="whatsapp_e164"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={business?.whatsapp}
            required
            placeholder="(18) 99999-9999"
          />
          {fieldError(state, "whatsapp_e164")}
        </div>
        <div>
          <label className={labelClass} htmlFor="business-email">
            E-mail público <span className="font-semibold text-muted">(opcional)</span>
          </label>
          <input
            className={inputClass}
            id="business-email"
            name="public_email"
            type="email"
            inputMode="email"
            defaultValue={business?.publicEmail}
            placeholder="contato@sualoja.com.br"
          />
          {fieldError(state, "public_email")}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="business-website">
            Site ou rede social <span className="font-semibold text-muted">(opcional)</span>
          </label>
          <input
            className={inputClass}
            id="business-website"
            name="website_url"
            type="text"
            inputMode="url"
            defaultValue={business?.websiteUrl}
            placeholder="instagram.com/sualoja"
          />
          {fieldError(state, "website_url")}
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="col-span-full mb-1 text-lg font-black text-ink">
          Endereço
        </legend>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="business-street">
            Rua ou avenida
          </label>
          <input
            className={inputClass}
            id="business-street"
            name="street"
            type="text"
            autoComplete="street-address"
            defaultValue={business?.street}
            required
            maxLength={160}
          />
          {fieldError(state, "street")}
        </div>
        <div>
          <label className={labelClass} htmlFor="business-number">
            Número
          </label>
          <input
            className={inputClass}
            id="business-number"
            name="address_number"
            type="text"
            defaultValue={business?.addressNumber}
            required
            maxLength={20}
            placeholder="123 ou S/N"
          />
          {fieldError(state, "address_number")}
        </div>
        <div>
          <label className={labelClass} htmlFor="business-complement">
            Complemento <span className="font-semibold text-muted">(opcional)</span>
          </label>
          <input
            className={inputClass}
            id="business-complement"
            name="complement"
            type="text"
            defaultValue={business?.complement}
            maxLength={120}
          />
          {fieldError(state, "complement")}
        </div>
        <div>
          <label className={labelClass} htmlFor="business-neighborhood">
            Bairro
          </label>
          <input
            className={inputClass}
            id="business-neighborhood"
            name="neighborhood"
            type="text"
            defaultValue={business?.neighborhood}
            required
            maxLength={120}
          />
          {fieldError(state, "neighborhood")}
        </div>
        <div>
          <label className={labelClass} htmlFor="business-postal-code">
            CEP <span className="font-semibold text-muted">(opcional)</span>
          </label>
          <input
            className={inputClass}
            id="business-postal-code"
            name="postal_code"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            defaultValue={business?.postalCode}
            maxLength={9}
            placeholder="12345-678"
          />
          {fieldError(state, "postal_code")}
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="col-span-full mb-1 text-lg font-black text-ink">
          Imagens da vitrine
        </legend>
        <MediaField
          id="business-logo"
          name="logo"
          label="Logo"
          hint="Imagem quadrada, até 5 MB."
          currentUrl={business?.logoUrl ?? null}
          sizes="128px"
        />
        <MediaField
          id="business-cover"
          name="cover"
          label="Capa"
          hint="Imagem horizontal, até 5 MB."
          currentUrl={business?.coverUrl ?? null}
          sizes="(max-width: 640px) 100vw, 50vw"
          wide
        />
      </fieldset>

      <div className="rounded-2xl border border-line bg-canvas p-4">
        <label className="flex items-start gap-3">
          <input
            className="mt-1 size-4 accent-brand"
            name="is_active"
            type="checkbox"
            defaultChecked={business?.isActive ?? true}
            disabled={pending}
          />
          <span>
            <span className="block text-sm font-black text-ink">
              Manter loja ativa
            </span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-muted">
              Desmarque para ocultar temporariamente a loja depois que ela estiver publicada.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs font-semibold leading-5 text-muted">
          Alterações em informações públicas podem passar por uma nova análise antes de aparecer na avenida.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-brand px-6 text-base font-black text-white shadow-[0_10px_24px_rgba(185,61,37,0.2)] transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
        >
          {pending ? "Salvando..." : business ? "Salvar alterações" : "Cadastrar loja"}
        </button>
      </div>
    </form>
  );
}

function MediaField({
  id,
  name,
  label,
  hint,
  currentUrl,
  sizes,
  wide = false,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  currentUrl: string | null;
  sizes: string;
  wide?: boolean;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <div
        className={`relative mt-2 overflow-hidden rounded-2xl border border-dashed border-line bg-canvas ${
          wide ? "aspect-[16/7]" : "aspect-[2/1] sm:aspect-[3/2]"
        }`}
      >
        {currentUrl ? (
          <Image
            src={currentUrl}
            alt={`${label} atual da loja`}
            fill
            sizes={sizes}
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted">
            <ImageIcon className="size-8" />
          </span>
        )}
      </div>
      <input
        className="mt-3 block w-full rounded-xl border border-line bg-white p-2 text-sm font-semibold text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-black file:text-white"
        id={id}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
      />
      <p className="mt-1.5 text-xs font-semibold text-muted">{hint}</p>
    </div>
  );
}
