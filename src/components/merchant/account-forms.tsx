"use client";

import { useActionState } from "react";
import {
  deleteAccountAction,
  updateEmailAction,
  updatePasswordAction,
  updateProfileAction,
} from "@/app/painel/perfil/actions";
import { AlertTriangleIcon, TrashIcon } from "@/components/icons";
import {
  type ActionState,
  initialActionState,
} from "@/lib/action-state";

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-canvas";
const labelClass = "block text-sm font-extrabold text-ink";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-black text-white transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65";

function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
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
  );
}

function FieldError({
  state,
  name,
}: {
  state: ActionState;
  name: string;
}) {
  const error = state.fieldErrors?.[name]?.[0];
  return error ? (
    <p className="mt-1.5 text-sm font-semibold text-brand-dark">{error}</p>
  ) : null;
}

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string;
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    initialActionState,
  );
  return (
    <form action={action} className="space-y-5">
      <Feedback state={state} />
      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <div>
          <label className={labelClass} htmlFor="profile-name">
            Nome do responsável
          </label>
          <input
            className={inputClass}
            id="profile-name"
            name="full_name"
            type="text"
            autoComplete="name"
            defaultValue={fullName}
            minLength={2}
            maxLength={120}
            required
          />
          <FieldError state={state} name="full_name" />
        </div>
        <div>
          <label className={labelClass} htmlFor="profile-phone">
            Telefone pessoal <span className="font-semibold text-muted">(opcional)</span>
          </label>
          <input
            className={inputClass}
            id="profile-phone"
            name="phone_e164"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={phone}
            placeholder="(18) 99999-9999"
          />
          <FieldError state={state} name="phone_e164" />
        </div>
      </fieldset>
      <button className={primaryButton} type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar dados pessoais"}
      </button>
    </form>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action, pending] = useActionState(
    updateEmailAction,
    initialActionState,
  );
  return (
    <form action={action} className="space-y-5">
      <Feedback state={state} />
      <div>
        <label className={labelClass} htmlFor="current-email">
          E-mail atual
        </label>
        <input
          className={inputClass}
          id="current-email"
          type="email"
          value={currentEmail}
          readOnly
          disabled
        />
      </div>
      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <div>
          <label className={labelClass} htmlFor="new-email">
            Novo e-mail
          </label>
          <input
            className={inputClass}
            id="new-email"
            name="new_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
          />
          <FieldError state={state} name="new_email" />
        </div>
        <div>
          <label className={labelClass} htmlFor="email-current-password">
            Senha atual
          </label>
          <input
            className={inputClass}
            id="email-current-password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
          <FieldError state={state} name="current_password" />
        </div>
      </fieldset>
      <p className="text-xs font-semibold leading-5 text-muted">
        Por segurança, a alteração pode precisar de confirmação no endereço atual e no novo.
      </p>
      <button className={primaryButton} type="submit" disabled={pending}>
        {pending ? "Solicitando..." : "Alterar e-mail"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(
    updatePasswordAction,
    initialActionState,
  );
  return (
    <form action={action} className="space-y-5">
      <Feedback state={state} />
      <fieldset className="grid gap-5 sm:grid-cols-3" disabled={pending}>
        <div>
          <label className={labelClass} htmlFor="password-current">
            Senha atual
          </label>
          <input
            className={inputClass}
            id="password-current"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
          <FieldError state={state} name="current_password" />
        </div>
        <div>
          <label className={labelClass} htmlFor="password-new">
            Nova senha
          </label>
          <input
            className={inputClass}
            id="password-new"
            name="new_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <FieldError state={state} name="new_password" />
        </div>
        <div>
          <label className={labelClass} htmlFor="password-confirm">
            Confirmar nova senha
          </label>
          <input
            className={inputClass}
            id="password-confirm"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <FieldError state={state} name="password_confirmation" />
        </div>
      </fieldset>
      <p className="text-xs font-semibold leading-5 text-muted">
        Use no mínimo 8 caracteres, com pelo menos uma letra e um número.
      </p>
      <button className={primaryButton} type="submit" disabled={pending}>
        {pending ? "Alterando..." : "Alterar senha"}
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(
    deleteAccountAction,
    initialActionState,
  );
  return (
    <form action={action} className="space-y-5">
      <div className="flex gap-3 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-brand-dark">
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
        <p className="text-sm font-bold leading-6">
          Esta ação apaga permanentemente seu acesso, perfil, loja, promoções,
          produtos e imagens. Não será possível recuperar os dados.
        </p>
      </div>
      <Feedback state={state} />
      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <div>
          <label className={labelClass} htmlFor="delete-confirmation">
            Digite EXCLUIR
          </label>
          <input
            className={inputClass}
            id="delete-confirmation"
            name="confirmation"
            type="text"
            autoComplete="off"
            required
            pattern="EXCLUIR"
          />
          <FieldError state={state} name="confirmation" />
        </div>
        <div>
          <label className={labelClass} htmlFor="delete-password">
            Senha atual
          </label>
          <input
            className={inputClass}
            id="delete-password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
          <FieldError state={state} name="current_password" />
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
      >
        <TrashIcon className="size-4" />
        {pending ? "Excluindo..." : "Excluir minha conta definitivamente"}
      </button>
    </form>
  );
}
