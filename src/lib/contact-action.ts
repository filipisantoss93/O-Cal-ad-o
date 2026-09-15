import type { ContactAction } from "@/types/catalog";

export type BusinessContactChannels = {
  whatsapp?: string | null;
  phone?: string | null;
};

export function parseContactAction(value: string): ContactAction {
  if (value === "whatsapp" || value === "phone" || value === "link") {
    return value;
  }
  throw new Error("Escolha como o cliente deve entrar em contato.");
}

export function normalizeContactUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length > 500) {
    throw new Error("O link deve ter no máximo 500 caracteres.");
  }

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Informe um link válido.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("O link precisa começar com http:// ou https://.");
  }
  return url.toString();
}

export function validateContactSelection(
  actionValue: string,
  urlValue: string | null | undefined,
  channels: BusinessContactChannels,
) {
  const contactAction = parseContactAction(actionValue);
  const contactUrl = contactAction === "link" ? normalizeContactUrl(urlValue) : null;

  if (contactAction === "whatsapp" && !channels.whatsapp?.replace(/\D/g, "")) {
    throw new Error("Cadastre o WhatsApp da loja antes de usar esta opção.");
  }
  if (contactAction === "phone" && !channels.phone?.replace(/\D/g, "")) {
    throw new Error("Cadastre o telefone fixo da loja antes de usar esta opção.");
  }
  if (contactAction === "link" && !contactUrl) {
    throw new Error("Informe o link que deve ser aberto para este item.");
  }

  return { contactAction, contactUrl };
}

export function resolveContactHref({
  action,
  contactUrl,
  whatsapp,
  phone,
  whatsappMessage,
}: {
  action: ContactAction;
  contactUrl?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  whatsappMessage?: string;
}) {
  if (action === "link") return normalizePublicHttpUrl(contactUrl);
  if (action === "phone") {
    const digits = phone?.replace(/\D/g, "") ?? "";
    return digits ? `tel:+${digits}` : null;
  }

  const digits = whatsapp?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  const message = whatsappMessage?.trim();
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function contactActionLabel(action: ContactAction, whatsappLabel: string) {
  if (action === "phone") return "Ligar agora";
  if (action === "link") return "Abrir link";
  return whatsappLabel;
}

export function normalizePublicContactAction(value: string | null | undefined): ContactAction {
  return value === "phone" || value === "link" ? value : "whatsapp";
}

function normalizePublicHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
