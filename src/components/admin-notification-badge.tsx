"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AdminNotificationBadge({ userId }: { userId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    const refresh = async () => {
      const { count: total } = await supabase.from("admin_notifications")
        .select("id", { count: "exact", head: true }).eq("recipient_id", userId).is("read_at", null);
      if (mounted) setCount(total ?? 0);
    };
    void refresh();
    const channel = supabase.channel(`admin-inbox-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications", filter: `recipient_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => { mounted = false; void supabase.removeChannel(channel); };
  }, [userId]);

  return <Link href="/admin/notificacoes" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-canvas px-3 text-sm font-black text-ink" aria-label={`Notificações administrativas: ${count} não lidas`}>
    <span aria-hidden="true">🔔</span><span className="hidden sm:inline">Alertas</span>
    {count > 0 && <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] leading-none text-white">{count > 99 ? "99+" : count}</span>}
  </Link>;
}
