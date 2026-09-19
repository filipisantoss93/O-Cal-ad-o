/* Admin-only push display. No page caching: authenticated pages must stay fresh. */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  const title = typeof payload.title === "string" ? payload.title : "O Calçadão";
  const body = typeof payload.body === "string" ? payload.body : "Há uma nova notificação.";
  const url = typeof payload.url === "string" && payload.url.startsWith("/admin")
    ? payload.url : "/admin/notificacoes";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/pwa-192.png",
    badge: "/notification-badge-96.png",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/admin/notificacoes", self.location.origin);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/admin")) return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    const open = windows.find((client) => client.url.startsWith(self.location.origin) && "focus" in client);
    if (open) {
      await open.focus();
      if ("navigate" in open) await open.navigate(url.href);
      else await self.clients.openWindow(url.href);
    }
    else await self.clients.openWindow(url.href);
  }));
});
