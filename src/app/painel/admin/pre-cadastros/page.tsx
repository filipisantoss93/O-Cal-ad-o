import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPreRegisteredBusinessAction } from "@/app/painel/admin/pre-cadastros/actions";
import { PreRegistrationLocationFields } from "@/components/admin/pre-registration-location-fields";
import { FloatingNotice } from "@/components/floating-notice";
import { ShieldCheckIcon, StoreIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/dal";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

export const metadata: Metadata = { title: "Pré-cadastro de lojas" };

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10";
const labelClass = "block text-sm font-extrabold text-ink";

type PageProps = {
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
};

export default async function PreCadastrosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase } = await requireAdmin("/painel/admin/pre-cadastros");
  const claimsClient = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;

  const [statesResult, categoriesResult, claimsResult] = await Promise.all([
    supabase
      .from("states")
      .select("code, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .neq("slug", "locais-publicos")
      .order("display_order")
      .order("name"),
    claimsClient
      .from("business_claims")
      .select("business_id, claim_email, created_at, claimed_at, claimed_by")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  if (statesResult.error || categoriesResult.error || claimsResult.error) {
    throw new Error("Não foi possível carregar o pré-cadastro de lojas.");
  }

  const claims = claimsResult.data ?? [];
  const businessIds = claims.map((claim) => claim.business_id);
  const businessResult = businessIds.length
    ? await supabase
        .from("businesses")
        .select("id, name, slug, publication_status, created_at, cities(name, state_code)")
        .in("id", businessIds)
    : { data: [], error: null };

  if (businessResult.error) {
    throw new Error("Não foi possível carregar as lojas pré-cadastradas.");
  }

  const businesses = new Map(
    (businessResult.data ?? []).map((business) => [business.id, business]),
  );

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-positive">
            Administração
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Pré-cadastro de lojas
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
            Monte a vitrine para o comerciante e informe o e-mail responsável. Quando ele criar e confirmar a conta com esse mesmo e-mail, a loja passa automaticamente para o painel dele.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-positive-soft px-4 py-2 text-sm font-black text-positive">
          <ShieldCheckIcon className="size-4" /> Vinculação protegida por e-mail confirmado
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/painel/admin"
          className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink hover:border-brand/40"
        >
          Voltar para moderação
        </Link>
        <Link
          href="/painel/admin/dashboard"
          className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink hover:border-brand/40"
        >
          Dashboard administrativo
        </Link>
      </div>

      {params.sucesso && (
        <FloatingNotice tone="success">{params.sucesso}</FloatingNotice>
      )}
      {params.erro && <FloatingNotice tone="error">{params.erro}</FloatingNotice>}

      <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
        <div className="mb-7">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Nova vitrine
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
            Cadastrar para um futuro usuário
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            O e-mail abaixo é usado somente para entregar a propriedade da loja. Ele não precisa ser o e-mail público exibido na vitrine.
          </p>
        </div>

        <form action={createPreRegisteredBusinessAction} className="space-y-8">
          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="col-span-full mb-1 text-lg font-black text-ink">
              Responsável e identificação
            </legend>

            <div className="sm:col-span-2 rounded-2xl border border-brand/20 bg-brand/8 p-4">
              <label className={labelClass} htmlFor="claim-email">
                E-mail do futuro proprietário
              </label>
              <input
                className={inputClass}
                id="claim-email"
                name="claim_email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                placeholder="responsavel@empresa.com.br"
              />
              <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                A vinculação só acontece depois que esse endereço estiver confirmado no cadastro do O Calçadão.
              </p>
            </div>

            <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-name">
              Nome da loja
              <input
                className={inputClass}
                id="pre-name"
                name="name"
                type="text"
                minLength={2}
                maxLength={120}
                required
                placeholder="Ex.: Mercado Avenida"
              />
            </label>

            <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-slug">
              Endereço público <span className="font-semibold text-muted">(opcional)</span>
              <input
                className={inputClass}
                id="pre-slug"
                name="slug"
                type="text"
                maxLength={100}
                placeholder="mercado-avenida — se vazio, será gerado pelo nome"
              />
            </label>

            <div className="sm:col-span-2">
              <PreRegistrationLocationFields
                states={(statesResult.data ?? []).map((state) => ({
                  code: state.code,
                  name: state.name,
                }))}
              />
            </div>

            <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-category">
              Categoria principal
              <select
                className={inputClass}
                id="pre-category"
                name="category_id"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Selecione a categoria
                </option>
                {(categoriesResult.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-tags">
              Tags para busca
              <input
                className={inputClass}
                id="pre-tags"
                name="tags"
                type="text"
                maxLength={500}
                required
                placeholder="Ex.: mecânica, troca de óleo, suspensão"
              />
              <span className="mt-1.5 block text-xs font-semibold text-muted">
                Informe de 3 a 12 termos separados por vírgula.
              </span>
            </label>

            <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-description">
              Descrição <span className="font-semibold text-muted">(opcional)</span>
              <textarea
                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-line bg-white px-4 py-3 text-base leading-7 text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                id="pre-description"
                name="description"
                maxLength={2000}
                placeholder="Apresente a empresa, produtos e serviços."
              />
            </label>
          </fieldset>

          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="col-span-full mb-1 text-lg font-black text-ink">
              Contatos
            </legend>

            <label className={labelClass} htmlFor="pre-whatsapp">
              WhatsApp
              <input
                className={inputClass}
                id="pre-whatsapp"
                name="whatsapp_e164"
                type="tel"
                required
                placeholder="(18) 99999-9999"
              />
            </label>

            <label className={labelClass} htmlFor="pre-phone">
              Telefone fixo <span className="font-semibold text-muted">(opcional)</span>
              <input
                className={inputClass}
                id="pre-phone"
                name="phone_e164"
                type="tel"
                placeholder="(18) 3322-1234"
              />
            </label>

            <label className={labelClass} htmlFor="pre-public-email">
              E-mail público <span className="font-semibold text-muted">(opcional)</span>
              <input
                className={inputClass}
                id="pre-public-email"
                name="public_email"
                type="email"
                maxLength={254}
                placeholder="contato@empresa.com.br"
              />
            </label>

            <label className={labelClass} htmlFor="pre-website">
              Site <span className="font-semibold text-muted">(opcional)</span>
              <input
                className={inputClass}
                id="pre-website"
                name="website_url"
                type="text"
                maxLength={500}
                placeholder="empresa.com.br"
              />
            </label>

            <label className={labelClass} htmlFor="pre-instagram">
              Instagram <span className="font-semibold text-muted">(opcional)</span>
              <input
                className={inputClass}
                id="pre-instagram"
                name="instagram_url"
                type="text"
                maxLength={500}
                placeholder="@empresa ou link do perfil"
              />
            </label>

            <label className={labelClass} htmlFor="pre-facebook">
              Facebook <span className="font-semibold text-muted">(opcional)</span>
              <input
                className={inputClass}
                id="pre-facebook"
                name="facebook_url"
                type="text"
                maxLength={500}
                placeholder="facebook.com/empresa"
              />
            </label>
          </fieldset>

          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="col-span-full mb-1 text-lg font-black text-ink">
              Endereço
            </legend>

            <label className={labelClass} htmlFor="pre-street">
              Rua ou avenida
              <input className={inputClass} id="pre-street" name="street" required maxLength={160} />
            </label>
            <label className={labelClass} htmlFor="pre-number">
              Número
              <input className={inputClass} id="pre-number" name="address_number" required maxLength={20} />
            </label>
            <label className={labelClass} htmlFor="pre-neighborhood">
              Bairro
              <input className={inputClass} id="pre-neighborhood" name="neighborhood" required maxLength={120} />
            </label>
            <label className={labelClass} htmlFor="pre-postal-code">
              CEP <span className="font-semibold text-muted">(opcional)</span>
              <input className={inputClass} id="pre-postal-code" name="postal_code" inputMode="numeric" placeholder="19800-000" />
            </label>
            <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-complement">
              Complemento <span className="font-semibold text-muted">(opcional)</span>
              <input className={inputClass} id="pre-complement" name="complement" maxLength={120} />
            </label>

            <label className={labelClass} htmlFor="pre-latitude">
              Latitude <span className="font-semibold text-muted">(opcional)</span>
              <input className={inputClass} id="pre-latitude" name="latitude" inputMode="decimal" placeholder="-22.6590" />
            </label>
            <label className={labelClass} htmlFor="pre-longitude">
              Longitude <span className="font-semibold text-muted">(opcional)</span>
              <input className={inputClass} id="pre-longitude" name="longitude" inputMode="decimal" placeholder="-50.4183" />
            </label>
          </fieldset>

          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="col-span-full mb-1 text-lg font-black text-ink">
              Imagens
            </legend>
            <label className={labelClass} htmlFor="pre-logo">
              Logo <span className="font-semibold text-muted">(opcional)</span>
              <input
                className={`${inputClass} py-2.5`}
                id="pre-logo"
                name="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
              />
            </label>
            <label className={labelClass} htmlFor="pre-cover">
              Foto de capa <span className="font-semibold text-muted">(opcional)</span>
              <input
                className={`${inputClass} py-2.5`}
                id="pre-cover"
                name="cover"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
              />
            </label>
            <p className="sm:col-span-2 text-xs font-semibold leading-5 text-muted">
              JPG, PNG, WebP ou AVIF, até 5 MB por imagem. O comerciante poderá substituir as fotos depois.
            </p>
          </fieldset>

          <label className="flex items-start gap-3 rounded-2xl border border-line bg-canvas p-4 text-sm font-bold text-ink">
            <input
              type="checkbox"
              name="publication_status"
              defaultChecked
              className="mt-0.5 size-5 accent-[var(--color-brand)]"
            />
            <span>
              Publicar a vitrine agora
              <span className="mt-1 block text-xs font-semibold leading-5 text-muted">
                Desmarque somente se quiser preparar a loja sem exibi-la no Centro Comercial.
              </span>
            </span>
          </label>

          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:w-auto"
          >
            <StoreIcon className="size-4" /> Criar pré-cadastro da loja
          </button>
        </form>
      </section>

      <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Acompanhamento
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">Pré-cadastros recentes</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            “Aguardando cadastro” significa que a vitrine está pronta, mas ainda não foi entregue a uma conta confirmada.
          </p>
        </div>

        {claims.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-canvas p-6 text-center text-sm font-semibold text-muted">
            Nenhum pré-cadastro criado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => {
              const business = businesses.get(claim.business_id);
              const city = business?.cities
                ? Array.isArray(business.cities)
                  ? business.cities[0]
                  : business.cities
                : null;
              const claimed = Boolean(claim.claimed_at);
              return (
                <article
                  key={claim.business_id}
                  className="flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-black text-ink">
                        {business?.name ?? `Loja #${claim.business_id}`}
                      </p>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-black ${
                          claimed
                            ? "border-positive/20 bg-positive-soft text-positive"
                            : "border-brand/20 bg-brand/8 text-brand-dark"
                        }`}
                      >
                        {claimed ? "Vinculada" : "Aguardando cadastro"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-muted">{claim.claim_email}</p>
                    {city && (
                      <p className="mt-1 text-xs font-semibold text-muted">
                        {city.name}/{city.state_code} · {business?.publication_status === "published" ? "vitrine publicada" : "vitrine fora do ar"}
                      </p>
                    )}
                  </div>
                  {business?.slug && (
                    <Link
                      href={`/loja/${business.slug}?preview=admin`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-black text-ink hover:border-brand/40"
                    >
                      Abrir vitrine
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
