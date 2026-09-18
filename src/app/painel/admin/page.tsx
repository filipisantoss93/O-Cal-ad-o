import type { Metadata } from "next";
import Link from "next/link";
import { moderateBusinessAction } from "@/app/painel/admin/actions";
import { FloatingNotice } from "@/components/floating-notice";
import { MapPinIcon, StoreIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/dal";

export const metadata: Metadata = { title: "Moderação de lojas" };

const allowedStatuses = ["pending", "approved", "rejected", "suspended"] as const;
const statusLabels: Record<string, string> = {
  pending: "Aguardando",
  approved: "Aprovadas",
  rejected: "Ajustes",
  suspended: "Suspensas",
};

type AdminPageProps = {
  searchParams: Promise<{ status?: string; sucesso?: string; erro?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const selectedStatus = allowedStatuses.includes(params.status as (typeof allowedStatuses)[number])
    ? params.status!
    : "pending";
  const { supabase } = await requireAdmin();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, description, street, address_number, neighborhood, postal_code, latitude, longitude, status, publication_status, moderation_note, created_at, categories(name), cities(name, state_code)",
    )
    .eq("listing_type", "business")
    .eq("status", selectedStatus)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw new Error("Não foi possível carregar a fila de moderação.");

  return (
    <div>
      <header>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-positive">Administração</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">Moderação de lojas</h1>
      </header>

      {params.sucesso && (
        <FloatingNotice tone="success">
          Moderação salva com sucesso.
        </FloatingNotice>
      )}
      {params.erro && (
        <FloatingNotice tone="error">
          {params.erro === "informe-o-motivo" ? "Informe um motivo com pelo menos 5 caracteres." : "Não foi possível concluir a moderação."}
        </FloatingNotice>
      )}

      <nav aria-label="Filtrar moderação" className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {allowedStatuses.map((status) => (
          <Link
            key={status}
            href={`/painel/admin?status=${status}`}
            className={`rounded-xl border px-3 py-2.5 text-center text-sm font-extrabold sm:rounded-full sm:px-4 sm:py-2 ${selectedStatus === status ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted"}`}
          >
            {statusLabels[status]}
          </Link>
        ))}
      </nav>

      {businesses.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
          <StoreIcon className="mx-auto size-7 text-muted" />
          <h2 className="mt-3 text-lg font-black text-ink">Nenhuma loja nesta fila</h2>
        </section>
      ) : (
        <div className="mt-6 space-y-5">
          {businesses.map((business) => {
            const category = Array.isArray(business.categories) ? business.categories[0] : business.categories;
            const city = Array.isArray(business.cities) ? business.cities[0] : business.cities;
            const published = business.publication_status === "published";
            return (
              <article key={business.id} className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-wider text-brand-dark">{category?.name ?? "Sem categoria"}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-black ${published ? "border-positive/20 bg-positive-soft text-positive" : "border-brand/20 bg-brand/8 text-brand-dark"}`}>
                        {published ? "Vitrine publicada" : "Fora do ar"}
                      </span>
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-ink">{business.name}</h2>
                    {business.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{business.description}</p>}
                    <p className="mt-4 flex items-start gap-2 text-sm font-bold text-ink">
                      <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand" />
                      {business.street}, {business.address_number} · {business.neighborhood} · {city?.name}/{city?.state_code}
                    </p>
                  </div>

                  <div className="w-full lg:max-w-sm">
                    <Link
                      href={`/loja/${business.slug}?preview=admin`}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-ink/15 bg-white px-4 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Visualizar vitrine
                    </Link>
                    <form action={moderateBusinessAction} className="rounded-2xl bg-canvas p-4">
                      <input type="hidden" name="business_id" value={business.id} />
                      <label className="text-sm font-extrabold text-ink" htmlFor={`note-${business.id}`}>Motivo ou orientação</label>
                      <textarea
                        id={`note-${business.id}`}
                        name="moderation_note"
                        defaultValue={business.moderation_note ?? ""}
                        maxLength={1000}
                        className="mt-2 min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                        placeholder="Obrigatório para solicitar ajustes ou suspender"
                      />
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {business.status !== "approved" && (
                          <button name="intent" value="approve" className="min-h-10 rounded-xl bg-positive px-3 text-sm font-black text-white">Aprovar</button>
                        )}
                        {(business.status !== "rejected" || !published) && (
                          <button name="intent" value="request_changes" className="min-h-10 rounded-xl border border-accent-dark/25 bg-accent/20 px-3 text-sm font-black text-ink">Solicitar ajustes</button>
                        )}
                        {(business.status !== "rejected" || published) && (
                          <button name="intent" value="request_changes_unpublish" className="min-h-10 rounded-xl border border-brand/25 bg-brand/8 px-3 text-sm font-black text-brand-dark">Ajustes + retirar do ar</button>
                        )}
                        {business.status !== "suspended" && (
                          <button name="intent" value="suspend" className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-black text-ink">Suspender</button>
                        )}
                        {business.status !== "pending" && (
                          <button name="intent" value="reopen" className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-black text-ink sm:col-span-2">Reabrir análise e publicar</button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
