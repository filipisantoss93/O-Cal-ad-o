import type { Metadata } from "next";
import Link from "next/link";
import { moderateBusinessAction } from "@/app/painel/admin/actions";
import { MapPinIcon, ShieldCheckIcon, StoreIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/dal";

export const metadata: Metadata = { title: "Moderação de lojas" };

const allowedStatuses = ["pending", "approved", "rejected", "suspended"] as const;
const statusLabels: Record<string, string> = {
  pending: "Em análise",
  approved: "Publicadas",
  rejected: "Ajustes solicitados",
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
      "id, slug, name, description, street, address_number, neighborhood, postal_code, latitude, longitude, status, moderation_note, created_at, categories(name), cities(name, state_code)",
    )
    .eq("status", selectedStatus)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw new Error("Não foi possível carregar a fila de moderação.");

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-positive">Administração</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">Moderação de lojas</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">Revise os dados antes de publicar cada comércio na avenida.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-positive-soft px-4 py-2 text-sm font-black text-positive">
          <ShieldCheckIcon className="size-4" /> Acesso administrativo
        </span>
      </div>

      {params.sucesso && (
        <p role="status" className="mt-6 rounded-2xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold text-positive">Moderação salva com sucesso.</p>
      )}
      {params.erro && (
        <p role="alert" className="mt-6 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold text-brand-dark">
          {params.erro === "informe-o-motivo" ? "Informe um motivo com pelo menos 5 caracteres." : "Não foi possível concluir a moderação."}
        </p>
      )}

      <nav aria-label="Filtrar moderação" className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {allowedStatuses.map((status) => (
          <Link
            key={status}
            href={`/painel/admin?status=${status}`}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-extrabold ${selectedStatus === status ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted"}`}
          >
            {statusLabels[status]}
          </Link>
        ))}
      </nav>

      {businesses.length === 0 ? (
        <section className="mt-6 grid min-h-64 place-items-center rounded-3xl border border-dashed border-line bg-surface p-6 text-center">
          <div>
            <StoreIcon className="mx-auto size-8 text-muted" />
            <h2 className="mt-4 text-xl font-black text-ink">Nenhuma loja nesta fila</h2>
            <p className="mt-2 text-sm text-muted">As novas solicitações aparecerão aqui automaticamente.</p>
          </div>
        </section>
      ) : (
        <div className="mt-6 space-y-5">
          {businesses.map((business) => {
            const category = Array.isArray(business.categories) ? business.categories[0] : business.categories;
            const city = Array.isArray(business.cities) ? business.cities[0] : business.cities;
            return (
              <article key={business.id} className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-wider text-brand-dark">{category?.name ?? "Sem categoria"}</p>
                    <h2 className="mt-2 text-2xl font-black text-ink">{business.name}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{business.description || "Sem descrição."}</p>
                    <p className="mt-4 flex items-start gap-2 text-sm font-bold text-ink">
                      <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand" />
                      {business.street}, {business.address_number} · {business.neighborhood} · {city?.name}/{city?.state_code}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {business.latitude !== null && business.longitude !== null ? "Coordenadas cadastradas para ordenação por distância." : "Sem coordenadas: aparecerá apenas pelo filtro de cidade."}
                    </p>
                  </div>

                  <form action={moderateBusinessAction} className="w-full rounded-2xl bg-canvas p-4 lg:max-w-sm">
                    <input type="hidden" name="business_id" value={business.id} />
                    <label className="text-sm font-extrabold text-ink" htmlFor={`note-${business.id}`}>Motivo ou orientação</label>
                    <textarea
                      id={`note-${business.id}`}
                      name="moderation_note"
                      defaultValue={business.moderation_note ?? ""}
                      maxLength={1000}
                      className="mt-2 min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                      placeholder="Obrigatório para rejeitar ou suspender"
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {business.status !== "approved" && (
                        <button name="intent" value="approve" className="min-h-10 rounded-xl bg-positive px-3 text-sm font-black text-white">Aprovar</button>
                      )}
                      {business.status !== "rejected" && (
                        <button name="intent" value="reject" className="min-h-10 rounded-xl border border-brand/25 bg-brand/8 px-3 text-sm font-black text-brand-dark">Solicitar ajustes</button>
                      )}
                      {business.status !== "suspended" && business.status !== "pending" && (
                        <button name="intent" value="suspend" className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-black text-ink">Suspender</button>
                      )}
                      {business.status !== "pending" && (
                        <button name="intent" value="reopen" className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-black text-ink">Reabrir análise</button>
                      )}
                    </div>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
