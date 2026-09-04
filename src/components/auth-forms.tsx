"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  loginAction,
  requestPasswordResetAction,
  signupAction,
  updateRecoveredPasswordAction,
} from "@/app/(auth)/actions";
import {
  type ActionState,
  initialActionState,
} from "@/lib/action-state";

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-canvas";
const labelClass = "block text-sm font-extrabold text-ink";
const buttonClass =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-base font-black text-white shadow-[0_10px_24px_rgba(185,61,37,0.2)] transition hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65";

function FieldError({
  state,
  name,
}: {
  state: ActionState;
  name: string;
}) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? (
    <p className="mt-1.5 text-sm font-semibold text-brand-dark">{message}</p>
  ) : null;
}

export function ActionMessage({ state }: { state: ActionState }) {
  if (!state.message || state.status === "idle") return null;
  const success = state.status === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      className={
        success
          ? "mb-5 rounded-xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold leading-6 text-positive"
          : "mb-5 rounded-xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold leading-6 text-brand-dark"
      }
    >
      {state.message}
    </div>
  );
}

export function LoginForm({ next = "/painel" }: { next?: string }) {
  const [state, action, pending] = useActionState(
    loginAction,
    initialActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <ActionMessage state={state} />
      <div>
        <label className={labelClass} htmlFor="login-email">
          E-mail
        </label>
        <input
          className={inputClass}
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={pending}
          placeholder="voce@empresa.com.br"
        />
        <FieldError state={state} name="email" />
      </div>
      <div>
        <div className="flex items-center justify-between gap-3">
          <label className={labelClass} htmlFor="login-password">
            Senha
          </label>
          <Link
            href="/esqueci-senha"
            className="text-sm font-extrabold text-brand-dark hover:underline"
          >
            Esqueci a senha
          </Link>
        </div>
        <input
          className={inputClass}
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          placeholder="Sua senha"
        />
        <FieldError state={state} name="password" />
      </div>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Entrando..." : "Entrar na minha conta"}
      </button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(
    signupAction,
    initialActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <ActionMessage state={state} />
      <div>
        <label className={labelClass} htmlFor="signup-name">
          Seu nome
        </label>
        <input
          className={inputClass}
          id="signup-name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          disabled={pending}
          placeholder="Nome do responsável"
        />
        <FieldError state={state} name="full_name" />
      </div>
      <div>
        <label className={labelClass} htmlFor="signup-email">
          E-mail
        </label>
        <input
          className={inputClass}
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={pending}
          placeholder="voce@empresa.com.br"
        />
        <FieldError state={state} name="email" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="signup-password">
            Senha
          </label>
          <input
            className={inputClass}
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
            placeholder="8+ caracteres"
          />
          <FieldError state={state} name="password" />
        </div>
        <div>
          <label className={labelClass} htmlFor="signup-confirmation">
            Confirmar senha
          </label>
          <input
            className={inputClass}
            id="signup-confirmation"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
            placeholder="Repita a senha"
          />
          <FieldError state={state} name="password_confirmation" />
        </div>
      </div>
      <p className="text-sm leading-6 text-muted">
        Use no mínimo 8 caracteres, com pelo menos uma letra e um número.
      </p>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Criando conta..." : "Criar minha conta grátis"}
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    initialActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <ActionMessage state={state} />
      <div>
        <label className={labelClass} htmlFor="recovery-email">
          E-mail da conta
        </label>
        <input
          className={inputClass}
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={pending}
          placeholder="voce@empresa.com.br"
        />
        <FieldError state={state} name="email" />
      </div>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar link de recuperação"}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(
    updateRecoveredPasswordAction,
    initialActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <ActionMessage state={state} />
      <div>
        <label className={labelClass} htmlFor="reset-password">
          Nova senha
        </label>
        <input
          className={inputClass}
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
        <FieldError state={state} name="password" />
      </div>
      <div>
        <label className={labelClass} htmlFor="reset-confirmation">
          Confirmar nova senha
        </label>
        <input
          className={inputClass}
          id="reset-confirmation"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
        <FieldError state={state} name="password_confirmation" />
      </div>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
