import type { Metadata } from "next";
import Link from "next/link";
import { markAdminNotificationRead, resolveAdminMessage } from "@/app/painel/admin/notificacoes/actions";
import { AdminPushManager } from "@/components/admin-push-manager";
import { requireAdmin } from "@/lib/admin/dal";

export const metadata: Metadata = { title: "Notificações administrativas" };
export const dynamic = "force-dynamic";

const labels: Record<string, string> = { new_user: "Cadastros", support: "Suporte", report: "Denúncias" };
const reasons: Record<string, string> = { inaccurate: "Informações incorretas", fraud: "Suspeita de fraude", inappropriate: "Conteúdo inadequado", other: "Outro motivo" };

export default async function AdminNotifications({ searchParams }: { searchParams: Promise<{ tipo?: string; id?: string; erro?: string }> }) {
  const params = await searchParams;
  const kind = labels[params.tipo ?? ""] ? params.tipo! : null;
  const sourceId = Number(params.id);
  const { supabase, user } = await requireAdmin("/painel/admin/notificacoes");

  let query = supabase.from("admin_notifications")
    .select("id, event_type, source_id, title, body, destination, read_at, created_at")
    .eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (kind) query = query.eq("event_type", kind);
  const [noticesResult, publicKeyResult] = await Promise.all([
    query,
    supabase.rpc("admin_vapid_public_key"),
  ]);
  if (noticesResult.error) throw new Error("Não foi possível carregar as notificações.");
  const notices = noticesResult.data ?? [];
  const selected = Number.isSafeInteger(sourceId) && sourceId > 0 && kind
    ? notices.find((notice) => notice.event_type === kind && notice.source_id === String(sourceId))
    : null;

  const support = selected?.event_type === "support"
    ? await supabase.from("support_messages").select("id, name, email, subject, message, status, created_at").eq("id", sourceId).maybeSingle()
    : null;
  const report = selected?.event_type === "report"
    ? await supabase.from("business_reports").select("id, business_id, name, email, reason, details, status, created_at").eq("id", sourceId).maybeSingle()
    : null;
  const business = report?.data
    ? await supabase.from("businesses").select("id, name, slug, status").eq("id", report.data.business_id).maybeSingle()
    : null;
  if (support?.error || report?.error || business?.error) throw new Error("Não foi possível carregar os detalhes da notificação.");

  return <div className="space-y-6">
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-positive">Administração</p>
      <h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Notificações</h1>
      <p className="mt-2 text-sm text-muted">Acompanhe novos usuários, mensagens de suporte e denúncias de lojas.</p>
    </div>
    {params.erro && <p role="alert" className="rounded-xl bg-brand/8 p-4 text-sm font-bold text-brand-dark">Não foi possível salvar a alteração. Tente novamente.</p>}
    <AdminPushManager publicKey={publicKeyResult.data ?? null} />

    <nav aria-label="Filtrar notificações" className="flex gap-2 overflow-x-auto pb-1">
      {[[null, "Todas"], ...Object.entries(labels)] .map(([value, label]) =>
        <Link key={value ?? "all"} href={value ? `/painel/admin/notificacoes?tipo=${value}` : "/painel/admin/notificacoes"}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black ${value === kind ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted"}`}>{label}</Link>)}
    </nav>

    {selected && (support?.data || report?.data) && <section className="rounded-3xl border border-brand/25 bg-surface p-5 shadow-sm sm:p-7" aria-label="Detalhes da notificação">
      <h2 className="text-xl font-black text-ink">{selected.title}</h2>
      {support?.data && <div className="mt-4 space-y-3 text-sm text-ink">
        <p><strong>De:</strong> {support.data.name} · <a className="text-brand-dark underline" href={`mailto:${support.data.email}`}>{support.data.email}</a></p>
        <p><strong>Assunto:</strong> {support.data.subject}</p>
        <p className="whitespace-pre-wrap break-words rounded-xl bg-canvas p-4 leading-6">{support.data.message}</p>
        <p className="text-muted">Status: {support.data.status === "open" ? "Aberta" : "Resolvida"}</p>
      </div>}
      {report?.data && <div className="mt-4 space-y-3 text-sm text-ink">
        {business?.data && <p><strong>Loja:</strong> {business.data.name} · <Link className="text-brand-dark underline" href={`/loja/${business.data.slug}?preview=admin`}>Visualizar vitrine</Link></p>}
        <p><strong>Enviada por:</strong> {report.data.name} · <a className="text-brand-dark underline" href={`mailto:${report.data.email}`}>{report.data.email}</a></p>
        <p><strong>Motivo:</strong> {reasons[report.data.reason] ?? report.data.reason}</p>
        <p className="whitespace-pre-wrap break-words rounded-xl bg-canvas p-4 leading-6">{report.data.details}</p>
        <p className="text-muted">Status: {report.data.status === "open" ? "Aberta" : "Resolvida"}</p>
        {business?.data && <Link className="inline-block font-bold text-brand-dark underline" href="/painel/admin">Abrir moderação de lojas</Link>}
      </div>}
      <div className="mt-5 flex flex-wrap gap-2">
        {!selected.read_at && <form action={markAdminNotificationRead}><input type="hidden" name="id" value={selected.id} /><button className="min-h-10 rounded-xl border border-line px-4 text-sm font-bold">Marcar como lida</button></form>}
        {((support?.data && support.data.status === "open") || (report?.data && report.data.status === "open")) && <form action={resolveAdminMessage}>
          <input type="hidden" name="id" value={sourceId} /><input type="hidden" name="kind" value={kind!} />
          <button className="min-h-10 rounded-xl bg-positive px-4 text-sm font-black text-white">Concluir atendimento</button>
        </form>}
      </div>
    </section>}

    {notices.length === 0 ? <p className="rounded-3xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">Nenhuma notificação nesta lista.</p> : <div className="space-y-3">
      {notices.map((notice) => <article key={notice.id} className={`rounded-2xl border p-4 sm:p-5 ${notice.read_at ? "border-line bg-surface" : "border-brand/30 bg-brand/5"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><span className="text-[11px] font-black uppercase tracking-wide text-brand-dark">{labels[notice.event_type]}</span>
            <h2 className="mt-1 text-base font-black text-ink">{notice.title}</h2>
            <p className="mt-1 text-sm text-muted">{notice.body}</p>
            <time dateTime={notice.created_at} className="mt-2 block text-xs text-muted">{new Date(notice.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>
          </div>
          <div className="flex items-center gap-2">
            <Link href={notice.destination} className="min-h-10 rounded-xl border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:border-brand/40">Ver detalhes</Link>
            {!notice.read_at && <form action={markAdminNotificationRead}><input type="hidden" name="id" value={notice.id} /><button className="min-h-10 rounded-xl bg-ink px-3 text-xs font-black text-white">Lida</button></form>}
          </div>
        </div>
      </article>)}
    </div>}
  </div>;
}
