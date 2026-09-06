import type { MetadataRoute } from "next";

const SITE_URL = "https://ocalcadao.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/painel/",
        "/entrar",
        "/cadastro",
        "/esqueci-senha",
        "/redefinir-senha",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
