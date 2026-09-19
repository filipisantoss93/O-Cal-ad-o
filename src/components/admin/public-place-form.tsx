"use client";

import { useActionState, useRef, useState } from "react";
import { savePublicPlaceAction } from "@/app/admin/actions";
import { FloatingNotice } from "@/components/floating-notice";
import { LocateIcon } from "@/components/icons";
import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";
import type { CityOption, StateOption } from "@/lib/location";
import type { PublicPlaceKind } from "@/types/catalog";

export type PublicPlaceFormValue = {
  id: number;
  cityId: number;
  kind: PublicPlaceKind;
  name: string;
  slug: string;
  description: string;
  tags: string[];
  whatsapp: string;
  phone: string;
  publicEmail: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  officialSourceUrl: string;
  street: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  isPublished: boolean;
} | null;

type PublicPlaceFormProps = {
  publicPlace: PublicPlaceFormValue;
  states: StateOption[];
  initialCity: CityOption;
};

const kinds: Array<{ value: PublicPlaceKind; label: string }> = [
  { value: "government", label: "Atendimento governamental" },
  { value: "health", label: "Saúde" },
  { value: "education", label: "Educação" },
  { value: "transport", label: "Transporte" },
  { value: "safety", label: "Segurança e emergência" },
  { value: "culture", label: "Cultura" },
  { value: "leisure", label: "Lazer e áreas públicas" },
  { value: "social_service", label: "Assistência e serviço social" },
  { value: "other", label: "Outro serviço público" },
];

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-canvas";
const labelClass = "block text-sm font-extrabold text-ink";

function fieldError(state: ActionState, field: string) {
  const message = state.fieldErrors?.[field]?.[0];
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

export function PublicPlaceForm({
  publicPlace,
  states,
  initialCity,
}: PublicPlaceFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    savePublicPlaceAction,
    initialActionState,
  );
  const [name, setName] = useState(publicPlace?.name ?? "");
  const [slug, setSlug] = useState(publicPlace?.slug ?? "");
  const [slugWasEdited, setSlugWasEdited] = useState(Boolean(publicPlace));
  const [stateCode, setStateCode] = useState(initialCity.stateCode);
  const [cityId, setCityId] = useState(String(initialCity.id));
  const [cities, setCities] = useState<CityOption[]>([initialCity]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [locatingByAddress, setLocatingByAddress] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [latitude, setLatitude] = useState(
    publicPlace?.latitude === null || publicPlace?.latitude === undefined
      ? ""
      : String(publicPlace.latitude),
  );
  const [longitude, setLongitude] = useState(
    publicPlace?.longitude === null || publicPlace?.longitude === undefined
      ? ""
      : String(publicPlace.longitude),
  );

  function clearCoordinates() {
    setLatitude("");
    setLongitude("");
    setLocationMessage("");
    setLocationError("");
  }

  async function loadCities(nextStateCode: string) {
    if (!nextStateCode) {
      setCities([]);
      setCityId("");
      return;
    }
    setLoadingCities(true);
    setLocationError("");
    try {
      const response = await fetch(`/api/localidades?uf=${nextStateCode}`);
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { cities: CityOption[] };
      setCities(payload.cities);
      setCityId("");
    } catch {
      setLocationError("Não foi possível carregar as cidades.");
    } finally {
      setLoadingCities(false);
    }
  }

  async function locateRegisteredAddress() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const street = String(data.get("street") ?? "").trim();
    const addressNumber = String(data.get("address_number") ?? "").trim();
    const neighborhood = String(data.get("neighborhood") ?? "").trim();
    const postalCode = String(data.get("postal_code") ?? "").trim();

    if (!cityId || !street || !addressNumber || !neighborhood) {
      setLocationError("Preencha cidade, rua, número e bairro antes de buscar as coordenadas.");
      return;
    }

    setLocatingByAddress(true);
    setLocationError("");
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
        throw new Error(payload.error ?? "Não foi possível localizar esse endereço.");
      }
      setLatitude(String(payload.latitude));
      setLongitude(String(payload.longitude));
      setLocationMessage("Coordenadas encontradas. Salve o cadastro para gravá-las.");
    } catch (reason) {
      setLocationError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível localizar esse endereço.",
      );
    } finally {
      setLocatingByAddress(false);
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-8">
      {publicPlace && (
        <input type="hidden" name="business_id" value={publicPlace.id} />
      )}
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />

      {state.message && (
        <FloatingNotice tone={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FloatingNotice>
      )}

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="col-span-full mb-1 text-lg font-black text-ink">
          Identificação
        </legend>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="public-place-name">Nome do local</label>
          <input
            id="public-place-name"
            name="name"
            className={inputClass}
            value={name}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (!slugWasEdited) setSlug(slugify(nextName));
            }}
            minLength={2}
            maxLength={120}
            required
            placeholder="Ex.: Biblioteca Municipal"
          />
          {fieldError(state, "name")}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="public-place-slug">Endereço público</label>
          <div className="mt-2 flex min-h-12 items-center rounded-xl border border-line bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
            <span className="hidden pl-4 text-sm font-bold text-muted sm:inline">ocalcadao.com.br/loja/</span>
            <input
              id="public-place-slug"
              name="slug"
              className="min-h-11 min-w-0 flex-1 bg-transparent px-4 text-base text-ink outline-none sm:pl-1"
              value={slug}
              onChange={(event) => {
                setSlug(slugify(event.target.value));
                setSlugWasEdited(true);
              }}
              minLength={2}
              maxLength={100}
              required
            />
          </div>
          {fieldError(state, "slug")}
        </div>
        <label className={labelClass} htmlFor="public-place-state">
          Estado
          <select
            id="public-place-state"
            className={inputClass}
            value={stateCode}
            onChange={(event) => {
              const nextState = event.target.value;
              setStateCode(nextState);
              clearCoordinates();
              void loadCities(nextState);
            }}
            required
          >
            <option value="" disabled>Selecione</option>
            {states.map((stateOption) => (
              <option key={stateOption.code} value={stateOption.code}>{stateOption.name}</option>
            ))}
          </select>
        </label>
        <label className={labelClass} htmlFor="public-place-city">
          Cidade
          <select
            id="public-place-city"
            name="city_id"
            className={inputClass}
            value={cityId}
            onChange={(event) => {
              setCityId(event.target.value);
              clearCoordinates();
            }}
            disabled={!stateCode || loadingCities}
            required
          >
            <option value="" disabled>{loadingCities ? "Carregando..." : "Selecione"}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
          {fieldError(state, "city_id")}
        </label>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="public-place-kind">Tipo de local</label>
          <select
            id="public-place-kind"
            name="public_place_kind"
            className={inputClass}
            defaultValue={publicPlace?.kind ?? ""}
            required
          >
            <option value="" disabled>Selecione o tipo</option>
            {kinds.map((kind) => (
              <option key={kind.value} value={kind.value}>{kind.label}</option>
            ))}
          </select>
          {fieldError(state, "public_place_kind")}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="public-place-tags">Termos para busca</label>
          <input
            id="public-place-tags"
            name="tags"
            className={inputClass}
            defaultValue={publicPlace?.tags.join(", ") ?? ""}
            maxLength={500}
            required
            placeholder="Ex.: documentos, atendimento ao cidadão, prefeitura"
          />
          <p className="mt-1.5 text-xs font-semibold text-muted">De 2 a 12 termos, separados por vírgula.</p>
          {fieldError(state, "tags")}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="public-place-description">Descrição</label>
          <textarea
            id="public-place-description"
            name="description"
            className="mt-2 min-h-28 w-full resize-y rounded-xl border border-line bg-white px-4 py-3 text-base leading-7 text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            defaultValue={publicPlace?.description}
            maxLength={2000}
            placeholder="Explique quais serviços o cidadão encontra neste local."
          />
          {fieldError(state, "description")}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="public-place-source">Fonte oficial</label>
          <input
            id="public-place-source"
            name="official_source_url"
            className={inputClass}
            type="url"
            defaultValue={publicPlace?.officialSourceUrl}
            maxLength={500}
            placeholder="https://www.assis.sp.gov.br/..."
          />
          <p className="mt-1.5 text-xs font-semibold text-muted">Página usada para confirmar endereço, telefone ou horário.</p>
          {fieldError(state, "official_source_url")}
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="col-span-full mb-1 text-lg font-black text-ink">Contato público</legend>
        <Field id="public-place-phone" name="phone_e164" label="Telefone" defaultValue={publicPlace?.phone} placeholder="(18) 3322-1234" type="tel" />
        <Field id="public-place-whatsapp" name="whatsapp_e164" label="WhatsApp" defaultValue={publicPlace?.whatsapp} placeholder="(18) 99999-9999" type="tel" />
        <Field id="public-place-email" name="public_email" label="E-mail" defaultValue={publicPlace?.publicEmail} placeholder="atendimento@assis.sp.gov.br" type="email" />
        <Field id="public-place-website" name="website_url" label="Site" defaultValue={publicPlace?.websiteUrl} placeholder="https://www.assis.sp.gov.br/" type="url" />
        <Field id="public-place-instagram" name="instagram_url" label="Instagram" defaultValue={publicPlace?.instagramUrl} placeholder="@perfiloficial" />
        <Field id="public-place-facebook" name="facebook_url" label="Facebook" defaultValue={publicPlace?.facebookUrl} placeholder="facebook.com/perfiloficial" />
        {fieldError(state, "phone_e164")}
        {fieldError(state, "whatsapp_e164")}
        {fieldError(state, "public_email")}
        {fieldError(state, "website_url")}
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="col-span-full mb-1 text-lg font-black text-ink">Endereço</legend>
        <div className="sm:col-span-2">
          <Field id="public-place-street" name="street" label="Rua ou avenida" defaultValue={publicPlace?.street} required onChange={clearCoordinates} />
          {fieldError(state, "street")}
        </div>
        <div>
          <Field id="public-place-number" name="address_number" label="Número" defaultValue={publicPlace?.addressNumber} required placeholder="123 ou S/N" onChange={clearCoordinates} />
          {fieldError(state, "address_number")}
        </div>
        <Field id="public-place-complement" name="complement" label="Complemento" defaultValue={publicPlace?.complement} />
        <div>
          <Field id="public-place-neighborhood" name="neighborhood" label="Bairro" defaultValue={publicPlace?.neighborhood} required onChange={clearCoordinates} />
          {fieldError(state, "neighborhood")}
        </div>
        <Field id="public-place-postal-code" name="postal_code" label="CEP" defaultValue={publicPlace?.postalCode} placeholder="19800-000" onChange={clearCoordinates} />
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => void locateRegisteredAddress()}
            disabled={pending || locatingByAddress}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand/8 px-4 text-sm font-black text-brand-dark transition hover:border-brand/45 hover:bg-brand/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
          >
            <LocateIcon className="size-5" />
            {locatingByAddress ? "Buscando coordenadas..." : "Buscar coordenadas deste endereço"}
          </button>
          {locationError && <p role="alert" className="mt-2 text-sm font-semibold text-brand-dark">{locationError}</p>}
          {locationMessage && <p role="status" className="mt-2 text-sm font-bold text-positive">{locationMessage}</p>}
          {!locationError && !locationMessage && latitude && longitude && (
            <p className="mt-2 text-sm font-bold text-positive">Coordenadas cadastradas.</p>
          )}
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl border border-line bg-canvas p-4 sm:grid-cols-2" disabled={pending}>
        <Toggle name="is_active" label="Cadastro ativo" description="Desmarque para desativar este local na plataforma." defaultChecked={publicPlace?.isActive ?? true} />
        <Toggle name="publication_status" label="Visível ao público" description="Desmarque para manter o cadastro salvo, mas fora da busca." defaultChecked={publicPlace?.isPublished ?? true} />
      </fieldset>

      <div className="flex justify-end border-t border-line pt-6">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-6 text-base font-black text-white shadow-[0_10px_24px_rgba(185,61,37,0.2)] transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65 sm:w-auto"
        >
          {pending ? "Salvando..." : publicPlace ? "Salvar alterações" : "Cadastrar local público"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  onChange?: () => void;
}) {
  return (
    <label className={labelClass} htmlFor={id}>
      {label} {!required && <span className="font-semibold text-muted">(opcional)</span>}
      <input
        id={id}
        name={name}
        className={inputClass}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        maxLength={name === "description" ? 2000 : 500}
        onChange={onChange}
      />
    </label>
  );
}

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3">
      <input className="mt-1 size-4 accent-brand" name={name} type="checkbox" defaultChecked={defaultChecked} />
      <span>
        <span className="block text-sm font-black text-ink">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-muted">{description}</span>
      </span>
    </label>
  );
}
