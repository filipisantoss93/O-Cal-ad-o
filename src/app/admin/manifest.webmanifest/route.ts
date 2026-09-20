/** Manifest próprio: identidade e escopo distintos do aplicativo público. */
export function GET() {
  return Response.json({
    id: "/admin/",
    name: "O Calçadão Admin",
    short_name: "Calçadão Admin",
    description: "Painel administrativo do O Calçadão.",
    lang: "pt-BR",
    start_url: "/admin/dashboard",
    scope: "/admin/",
    display: "standalone",
    background_color: "#071017",
    theme_color: "#071017",
    icons: [
      { src: "/admin/app-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/admin/app-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/admin/app-icon?size=512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/admin/dashboard" },
      { name: "Notificações", url: "/admin/notificacoes" },
      { name: "Usuários e empresas", url: "/admin/cadastros" },
    ],
  }, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
