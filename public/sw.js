/* Somente push administrativo. Sem fetch/cache: páginas autenticadas nunca ficam armazenadas offline. */
function adminDestination(value) {
  const url = new URL(typeof value === "string" ? value : "/admin/notificacoes", self.location.origin);
  if (url.origin !== self.location.origin || !/^\/admin(?:\/|$)/.test(url.pathname)) {
    return new URL("/admin/notificacoes", self.location.origin);
  }
  return url;
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  const title = typeof payload.title === "string" ? payload.title : "O Calçadão Admin";
  const body = typeof payload.body === "string" ? payload.body : "Há uma nova notificação.";
  const url = adminDestination(payload.url);
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/admin/app-icon?size=192",
    badge: "/notification-badge-96.png",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: { url: url.pathname + url.search + url.hash },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = adminDestination(event.notification.data?.url);
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    // Não redireciona a janela do catálogo público ao abrir uma notificação do admin.
    const adminWindow = windows.find((client) => {
      try {
        const current = new URL(client.url);
        return current.origin === self.location.origin &&
          /^\/admin(?:\/|$)/.test(current.pathname) && "focus" in client;
      } catch { return false; }
    });
    if (adminWindow) {
      if ("navigate" in adminWindow) await adminWindow.navigate(url.href);
      await adminWindow.focus();
      return;
    }
    await self.clients.openWindow(url.href);
  }));
});
