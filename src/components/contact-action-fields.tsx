"use client";

import { useId, useState } from "react";
import type { ContactAction } from "@/types/catalog";

type ContactActionFieldsProps = {
  defaultAction?: ContactAction;
  defaultUrl?: string | null;
  whatsappAvailable?: boolean;
  phoneAvailable?: boolean;
  compact?: boolean;
};

export function ContactActionFields({
  defaultAction = "whatsapp",
  defaultUrl = null,
  whatsappAvailable,
  phoneAvailable,
  compact = false,
}: ContactActionFieldsProps) {
  const id = useId();
  const [action, setAction] = useState<ContactAction>(defaultAction);
  const inputClass = compact
    ? "mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold"
    : "mt-1 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-semibold";
  const availabilitySuffix = (available: boolean | undefined) =>
    available === false ? " (não cadastrado)" : "";

  return (
    <div className={compact ? "grid gap-3" : "grid gap-4 sm:col-span-2 sm:grid-cols-2"}>
      <label className="text-sm font-black text-ink">
        Ao clicar, abrir
        <select
          name="contact_action"
          value={action}
          onChange={(event) => setAction(event.target.value as ContactAction)}
          className={inputClass}
        >
          <option value="whatsapp">
            WhatsApp da loja{availabilitySuffix(whatsappAvailable)}
          </option>
          <option value="phone">
            Telefone fixo da loja{availabilitySuffix(phoneAvailable)}
          </option>
          <option value="link">Link específico</option>
        </select>
      </label>

      {action === "link" ? (
        <label className="text-sm font-black text-ink" htmlFor={`${id}-contact-url`}>
          Link do item
          <input
            id={`${id}-contact-url`}
            name="contact_url"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            defaultValue={defaultUrl ?? ""}
            maxLength={500}
            required
            className={inputClass}
            placeholder="https://seusite.com/produto"
          />
        </label>
      ) : (
        <div className="rounded-xl border border-line bg-canvas p-3 text-xs font-semibold leading-5 text-muted">
          {action === "whatsapp"
            ? "O cliente abrirá uma conversa no WhatsApp da loja já com o item identificado."
            : "O cliente abrirá a ligação para o telefone fixo cadastrado na loja."}
        </div>
      )}
    </div>
  );
}
