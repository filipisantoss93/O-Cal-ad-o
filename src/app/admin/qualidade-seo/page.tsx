import type { Metadata } from "next";
import Link from "next/link";
import { reviewSeoIssueAction } from "@/app/admin/qualidade-seo/actions";
import { requireAdmin } from "@/lib/admin/dal";
import { FloatingNotice } from "@/components/floating-notice";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Qualidade SEO — fila de revisão", robots: { index: false, follow: false } };

const LIMIT = 20;
const issueLabels: Record<string, string> = {
  missing_street: "Endereço ausente",
  possible_duplicate: "Possível duplicidade",
  generic_category: "Categoria genérica",
  missing_neighborhood: "Bairro não informado",
  missing_business_description: "Empresa sem descrição própria",
  missing_public_place_description: "Local público sem descrição própria",
};
const statusLabels: Record<string, string> = {
  pending: "Pendente", reviewing: "Em análise", resolved: "Resolvida", dismissed: "Descartada",
};
type Filters = { status?: string; issue?: string; prioridade?: string; pagina?: string; sucesso?: string; erro?: string };
function safeExternalUrl(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch { return null; }
}
function destination(q: URLSearchParams, page: number) {
  const next = new URLSearchParams(q);
  if (page > 1) next.set("pagina", String(page));
  else next.delete("pagina");
  return "/admin/qualidade-seo?" + next.toString();
}

export default async function SeoQualityAdmin({ searchParams }: { searchParams: Promise<Filters> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin("/admin/qualidade-seo");
  const status = params.status && statusLabels[params.status] ? params.status : "pending";
  const issue = params.issue && issueLabels[params.issue] ? params.issue : "";
  const priority = ["1","2","3","4"].includes(params.prioridade ?? "") ? Number(params.prioridade) : 0;
  const rawPage = Number(params.pagina ?? "1");
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage < 100000 ? rawPage : 1;
  const offset = (page - 1) * LIMIT;
  const filters = new URLSearchParams();
  if (status !== "pending") filters.set("status", status);
  if (issue) filters.set("issue", issue);
  if (priority) filters.set("prioridade", String(priority));
  if (page > 1) filters.set("pagina", String(page));
  const returnQuery = filters.toString();

  let request = supabase.from("business_seo_review_queue")
    .select("id,business_id,related_business_id,issue_code,priority,status,review_note,created_at,reviewed_at", { count: "exact" })
    .eq("status", status);
  if (issue) request = request.eq("issue_code", issue);
  if (priority) request = request.eq("priority", priority);
  const [issuesResult, ...priorityResults] = await Promise.all([
    request.order("priority").order("created_at").order("id").range(offset, offset + LIMIT - 1),
    ...([1,2,3,4] as const).map((number) =>
      supabase.from("business_seo_review_queue").select("id", { count: "exact", head: true })
        .eq("status","pending").eq("priority",number)),
  ]);
  if (issuesResult.error || priorityResults.some((item) => item.error)) {
    throw new Error("Não foi possível ler a fila de qualidade SEO. Verifique as políticas de acesso do Supabase.");
  }

  const issues = issuesResult.data ?? [];
  const allIds = [...new Set(issues.flatMap((row) =>
    row.related_business_id ? [row.business_id, row.related_business_id] : [row.business_id]))];
  const businessResult = allIds.length
    ? await supabase.from("businesses")
      .select("id,name,slug,listing_type,pre_registered,owner_id,street,address_number,complement,neighborhood,description,official_source_url,data_source_url,cities(name,state_code),categories(name)")
      .in("id", allIds)
    : { data: [], error: null };
  if (businessResult.error) throw new Error("Não foi possível carregar as informações das vitrines em análise.");
  const businesses = new Map((businessResult.data ?? []).map((row) => [row.id, row]));
  const total = issuesResult.count ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / LIMIT));
  const number = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

  return <div className="space-y-6">
    <header>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-positive">Administração · revisão manual</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Qualidade SEO do catálogo</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
        Pendências identificadas na auditoria. A fila não modifica automaticamente os dados de lojas e locais públicos;
        confirme as informações na fonte antes de concluir a revisão.
      </p>
    </header>

    {params.sucesso && <FloatingNotice tone="success">Revisão registrada.</FloatingNotice>}
    {params.erro && <FloatingNotice tone="error">{params.erro.slice(0, 180)}</FloatingNotice>}

    <section aria-label="Pendências por prioridade" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {priorityResults.map((result, index) => <Link key={index}
        href={destination(new URLSearchParams([["prioridade",String(index + 1)]]),1)}
        className="rounded-2xl border border-line bg-surface p-3 transition hover:border-brand/40 sm:p-4">
        <p className="text-xs font-bold text-muted">P{index + 1} · Pendentes</p>
        <p className="mt-1 text-xl font-black tabular-nums text-ink">{number(result.count ?? 0)}</p>
      </Link>)}
    </section>

    <form method="get" className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3">
      <label className="text-sm font-extrabold text-ink">Situação
        <select name="status" defaultValue={status} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">
          {Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="text-sm font-extrabold text-ink">Prioridade
        <select name="prioridade" defaultValue={String(priority || "")} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">Todas</option>
          {[1,2,3,4].map((n) => <option key={n} value={n}>P{n}</option>)}
        </select>
      </label>
      <label className="text-sm font-extrabold text-ink">Problema
        <select name="issue" defaultValue={issue} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">Todos</option>
          {Object.entries(issueLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button type="submit" className="min-h-11 rounded-xl bg-ink px-4 text-sm font-black text-white sm:col-span-3">Aplicar filtros</button>
    </form>

    <div className="flex items-center justify-between gap-3 text-sm text-muted">
      <p><strong className="text-ink">{number(total)}</strong> pendências nesta seleção</p>
      <span>Página {Math.min(page,maxPage)} de {maxPage}</span>
    </div>

    {issues.length === 0 ? <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-sm text-muted">
      Nenhuma pendência corresponde aos filtros. <Link className="font-bold text-brand-dark underline" href="/admin/qualidade-seo">Abrir fila pendente</Link>
    </div> : <section aria-label="Pendências selecionadas" className="grid gap-3 lg:grid-cols-2">
      {issues.map((entry) => {
        const business = businesses.get(entry.business_id);
        const related = entry.related_business_id ? businesses.get(entry.related_business_id) : null;
        const city = business?.cities ? (Array.isArray(business.cities) ? business.cities[0] : business.cities) : null;
        const category = business?.categories ? (Array.isArray(business.categories) ? business.categories[0] : business.categories) : null;
        const source = safeExternalUrl(business?.official_source_url ?? business?.data_source_url ?? null);
        const canEditUnclaimed = Boolean(business?.listing_type === "business" && business.pre_registered && !business.owner_id);
        const options = entry.status === "pending" ? [["reviewing","Iniciar análise"],["dismissed","Descartar após verificação"]]
          : entry.status === "reviewing" ? [["pending","Devolver à fila"],["resolved","Concluir após correção"],["dismissed","Descartar após verificação"]]
          : [["reviewing","Reabrir análise"]];
        return <article key={entry.id} className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
            <span className="rounded-full bg-ink px-2.5 py-1 text-white">P{entry.priority}</span>
            <span className="rounded-full bg-canvas px-2.5 py-1 text-muted">{statusLabels[entry.status] ?? entry.status}</span>
            <span className="text-muted">#{entry.id}</span>
          </div>
          <h2 className="mt-2 text-lg font-black text-ink">{business?.name ?? "Cadastro não encontrado"}</h2>
          <p className="mt-1 text-sm font-bold text-brand-dark">{issueLabels[entry.issue_code] ?? entry.issue_code}</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            {category?.name ? category.name + " · " : ""}{city?.name ? city.name + "/" + city.state_code : "Cidade indisponível"}<br />
            {business ? [business.street,business.address_number,business.complement,business.neighborhood].filter(Boolean).join(", ") : "Cadastro indisponível"}
          </p>
          {related && <p className="mt-2 rounded-xl bg-canvas p-3 text-xs leading-5 text-ink">
            Complementos diferentes podem indicar unidades distintas no mesmo prédio. Compare também as fontes e os dados comerciais.<br />
            Comparar com: <strong>{related.name}</strong> (#{related.id}) · {related.street}, {related.address_number}{related.complement ? " · " + related.complement : " (sem complemento informado)"}.
            <Link className="ml-1 font-black text-brand-dark underline" href={"/loja/" + encodeURIComponent(related.slug)} target="_blank" rel="noreferrer">Abrir outra vitrine</Link>
          </p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-brand-dark">
            {business && <Link href={"/loja/" + encodeURIComponent(business.slug)} target="_blank" rel="noreferrer" className="underline">Ver vitrine</Link>}
            {canEditUnclaimed && <Link href={"/admin/perfis-nao-reivindicados/" + business!.id + "/editar"} className="underline">Corrigir perfil</Link>}
            {business?.listing_type === "public_place" && <Link href={"/admin/locais-publicos?local=" + business.id} className="underline">Editar local público</Link>}
            {source && <a href={source} target="_blank" rel="noreferrer noopener" className="underline">Consultar fonte</a>}
          </div>
          <form action={reviewSeoIssueAction} className="mt-4 space-y-3 rounded-xl border border-line bg-canvas p-3">
            <input type="hidden" name="id" value={entry.id} />
            <input type="hidden" name="expected_status" value={entry.status} />
            <input type="hidden" name="return_query" value={returnQuery} />
            <label className="block text-xs font-extrabold text-ink">Resultado da revisão
              <select name="next_status" required defaultValue="" className="mt-1 min-h-10 w-full rounded-lg border border-line bg-white px-2 text-sm">
                <option value="" disabled>Selecione a próxima etapa</option>
                {options.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-extrabold text-ink">Nota / evidência da verificação
              <textarea name="review_note" maxLength={1000} defaultValue={entry.review_note ?? ""}
                className="mt-1 min-h-20 w-full rounded-lg border border-line bg-white p-2 text-sm"
                placeholder="Descreva a correção ou o motivo do descarte; indique a fonte quando disponível." />
            </label>
            <label className="flex gap-2 text-xs leading-5 text-muted">
              <input type="checkbox" name="confirmed" className="mt-1 size-4 shrink-0 accent-[var(--color-brand)]" />
              Confirme que revisou a fonte e, ao concluir, verificou que os dados da vitrine foram corrigidos.
            </label>
            <button type="submit" className="min-h-10 w-full rounded-xl bg-brand px-3 text-sm font-black text-white">Registrar revisão</button>
          </form>
        </article>;
      })}
    </section>}
    {total > LIMIT && <nav aria-label="Paginação da fila" className="flex items-center justify-between gap-3">
      {page > 1 ? <Link href={destination(filters,page-1)} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink">Anterior</Link> : <span />}
      {page < maxPage ? <Link href={destination(filters,page+1)} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink">Próxima</Link> : <span />}
    </nav>}
  </div>;
}
