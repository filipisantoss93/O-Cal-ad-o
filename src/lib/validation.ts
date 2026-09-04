import "server-only";

export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function formString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export function requiredText(
  formData: FormData,
  field: string,
  label: string,
  minLength = 2,
  maxLength = 160,
) {
  const value = formString(formData, field);
  if (value.length < minLength) {
    throw new ValidationError(
      field,
      `${label} precisa ter pelo menos ${minLength} caracteres.`,
    );
  }
  if (value.length > maxLength) {
    throw new ValidationError(
      field,
      `${label} pode ter no máximo ${maxLength} caracteres.`,
    );
  }
  return value;
}

export function optionalText(
  formData: FormData,
  field: string,
  label: string,
  maxLength: number,
) {
  const value = formString(formData, field);
  if (!value) return null;
  if (value.length > maxLength) {
    throw new ValidationError(
      field,
      `${label} pode ter no máximo ${maxLength} caracteres.`,
    );
  }
  return value;
}

export function validateEmail(value: string, field = "email") {
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new ValidationError(field, "Informe um e-mail válido.");
  }
  return email;
}

export function validatePassword(value: string, field = "password") {
  if (value.length < 8) {
    throw new ValidationError(
      field,
      "A senha precisa ter pelo menos 8 caracteres.",
    );
  }
  if (!/[A-Za-zÀ-ÿ]/.test(value) || !/[0-9]/.test(value)) {
    throw new ValidationError(
      field,
      "Use pelo menos uma letra e um número na senha.",
    );
  }
  return value;
}

export function normalizePhone(
  rawValue: string,
  field: string,
  required?: true,
): string;
export function normalizePhone(
  rawValue: string,
  field: string,
  required: false,
): string | null;
export function normalizePhone(
  rawValue: string,
  field: string,
  required = true,
): string | null {
  let digits = rawValue.replace(/\D/g, "");
  if (!digits) {
    if (required) {
      throw new ValidationError(field, "Informe um telefone válido.");
    }
    return null;
  }

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) {
    throw new ValidationError(
      field,
      "Informe o DDD e o telefone. Ex.: (18) 99999-9999.",
    );
  }
  return `+${digits}`;
}

export function normalizePostalCode(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return null;
  if (!/^[0-9]{8}$/.test(digits)) {
    throw new ValidationError(
      "postal_code",
      "Informe um CEP com 8 números.",
    );
  }
  return digits;
}

export function normalizeSlug(rawValue: string) {
  const slug = rawValue
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  if (slug.length < 2) {
    throw new ValidationError(
      "slug",
      "Escolha um endereço público com pelo menos 2 caracteres.",
    );
  }
  return slug;
}

export function positiveInteger(
  formData: FormData,
  field: string,
  label: string,
) {
  const value = Number(formString(formData, field));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(
      field,
      `Selecione ${label.toLowerCase()}.`,
    );
  }
  return value;
}

export function parseMoney(
  rawValue: string,
  field: string,
  required?: true,
): number;
export function parseMoney(
  rawValue: string,
  field: string,
  required: false,
): number | null;
export function parseMoney(
  rawValue: string,
  field: string,
  required = true,
): number | null {
  const compact = rawValue.replace(/\s/g, "");
  if (!compact) {
    if (required) {
      throw new ValidationError(field, "Informe o valor da oferta.");
    }
    return null;
  }

  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 9999999999.99) {
    throw new ValidationError(field, "Informe um valor válido.");
  }
  return Math.round(value * 100) / 100;
}

export function brazilDateToIso(rawValue: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    throw new ValidationError(
      endOfDay ? "ends_on" : "starts_on",
      "Informe uma data válida.",
    );
  }
  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  const [year, month, day] = rawValue.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const date = new Date(`${rawValue}T${time}-03:00`);
  if (
    Number.isNaN(date.getTime()) ||
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new ValidationError(
      endOfDay ? "ends_on" : "starts_on",
      "Informe uma data válida.",
    );
  }
  return date.toISOString();
}

export function normalizeWebsite(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return null;
  const candidate = /^https?:\/\//i.test(value)
    ? value
    : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".")) throw new Error("invalid host");
    return url.toString().slice(0, 500);
  } catch {
    throw new ValidationError("website_url", "Informe um site válido.");
  }
}

export function safeNextPath(
  value: string | null | undefined,
  fallback = "/painel",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}
