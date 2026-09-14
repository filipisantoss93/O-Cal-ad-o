"use client";

import { useActionState } from "react";
import { sendSupportMessage } from "@/app/contato/actions";
import { sendBusinessReport } from "@/app/loja/[slug]/denunciar/actions";
import { initialActionState } from "@/lib/action-state";

const input = "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10";
const label = "block text-sm font-extrabold text-ink";

function Message({ status, message }: { status: string; message?: string }) {
  if (!message) return null;
  return <p role={status === "error" ? "alert" : "status"} className={`rounded-xl p-4 text-sm font-bold ${status === "error" ? "bg-brand/8 text-brand-dark" : "bg-positive-soft text-positive"}`}>{message}</p>;
}

function IdentityFields({ pending }: { pending: boolean }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <label className={label}>Seu nome<input className={input} name="name" required minLength={2} maxLength={120} autoComplete="name" disabled={pending} /></label>
    <label className={label}>E-mail para resposta<input className={input} type="email" name="email" required maxLength={254} autoComplete="email" disabled={pending} /></label>
    <div className="absolute -left-[9999px]" aria-hidden="true"><label>Site da empresa<input name="company_website" tabIndex={-1} autoComplete="off" /></label></div>
  </div>;
}

export function SupportForm() {
  const [state, action, pending] = useActionState(sendSupportMessage, initialActionState);
  return <form action={action} className="space-y-5 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-8">
    <Message status={state.status} message={state.message} />
    <IdentityFields pending={pending} />
    <label className={label}>Assunto<input className={input} name="subject" required minLength={3} maxLength={160} disabled={pending} /></label>
    <label className={label}>Como podemos ajudar?<textarea className={`${input} min-h-40 py-3`} name="message" required minLength={10} maxLength={4000} disabled={pending} /></label>
    <button type="submit" disabled={pending || state.status === "success"} className="min-h-12 rounded-xl bg-brand px-6 text-sm font-black text-white disabled:opacity-60">{pending ? "Enviando..." : "Enviar mensagem"}</button>
  </form>;
}

export function ReportForm({ businessId }: { businessId: number }) {
  const [state, action, pending] = useActionState(sendBusinessReport, initialActionState);
  return <form action={action} className="space-y-5 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-8">
    <input type="hidden" name="business_id" value={businessId} />
    <Message status={state.status} message={state.message} />
    <IdentityFields pending={pending} />
    <label className={label}>Motivo<select className={input} name="reason" defaultValue="" required disabled={pending}>
      <option value="" disabled>Selecione um motivo</option>
      <option value="inaccurate">Informações incorretas</option>
      <option value="fraud">Suspeita de fraude</option>
      <option value="inappropriate">Conteúdo inadequado</option>
      <option value="other">Outro motivo</option>
    </select></label>
    <label className={label}>O que aconteceu?<textarea className={`${input} min-h-40 py-3`} name="details" required minLength={10} maxLength={4000} disabled={pending} /></label>
    <p className="text-xs leading-5 text-muted">Sua denúncia é vista somente pela administração; a loja não recebe seus dados.</p>
    <button type="submit" disabled={pending || state.status === "success"} className="min-h-12 rounded-xl bg-brand px-6 text-sm font-black text-white disabled:opacity-60">{pending ? "Enviando..." : "Enviar denúncia"}</button>
  </form>;
}
