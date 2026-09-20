export const eventCategories = {
  musica: "Música e shows",
  gastronomia: "Gastronomia",
  feira: "Feiras e exposições",
  esporte: "Esportes",
  cultura: "Cultura",
  inauguracao: "Inaugurações",
  infantil: "Infantil e família",
  outros: "Outros eventos",
} as const;

export type EventCategory = keyof typeof eventCategories;
export type EventRecord = {
  id: number;
  business_id: number;
  city_id: number;
  title: string;
  description: string;
  category: string;
  banner_path: string;
  venue_name: string;
  venue_address: string;
  starts_at: string;
  ends_at: string | null;
  utc_offset: string;
  free_entry: boolean;
  ticket_price_cents: number | null;
  ticket_url: string | null;
  is_active: boolean;
};

export function eventCategoryName(category: string) {
  return eventCategories[category as EventCategory] ?? eventCategories.outros;
}

export function eventDate(value: string, utcOffset = "-03:00", options?: Intl.DateTimeFormatOptions) {
  const match = /^-(0[2-5]):00$/.exec(utcOffset);
  const hours = match ? Number(match[1]) : 3;
  const local = new Date(new Date(value).getTime() - hours * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(local);
}

export function eventInputDate(value: string, utcOffset = "-03:00") {
  const match = /^-(0[2-5]):00$/.exec(utcOffset);
  const hours = match ? Number(match[1]) : 3;
  return new Date(new Date(value).getTime() - hours * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function eventPrice(freeEntry: boolean, cents: number | null) {
  if (freeEntry) return "Entrada franca";
  if (cents === null) return "Consulte o organizador";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function eventDirectionsUrl(address: string) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address);
}
