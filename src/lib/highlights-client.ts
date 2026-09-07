export type HighlightEventType =
  | "impression"
  | "store_view"
  | "whatsapp"
  | "directions";

export function recordHighlightEvent(
  campaignIds: Array<number | null | undefined>,
  eventType: HighlightEventType,
) {
  const ids = [...new Set(campaignIds)]
    .filter((id): id is number => Number.isSafeInteger(id) && Number(id) > 0)
    .slice(0, 8);
  if (ids.length === 0) return;

  void fetch("/api/destaques/eventos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignIds: ids, eventType }),
    cache: "no-store",
    keepalive: true,
  }).catch(() => {
    // Métricas nunca devem impedir a navegação ou o contato com a loja.
  });
}
