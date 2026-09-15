import type { Metadata, Viewport } from "next";
import { LocationAutoRefresh } from "@/components/location-auto-refresh";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { PwaExperience } from "@/components/pwa-experience";
import { ZoomGuard } from "@/components/zoom-guard";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ocalcadao.com.br"),
  title: {
    default: "O Calçadão | Seu Centro Comercial",
    template: "%s | O Calçadão",
  },
  description:
    "Descubra lojas, serviços, produtos e promoções da sua cidade e fale direto com o comércio local.",
  applicationName: "O Calçadão",
  appleWebApp: { capable: true, title: "O Calçadão", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/pwa-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icon.svg",
    apple: [{ url: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
  },
  keywords: [
    "comércio local",
    "lojas da cidade",
    "serviços locais",
    "promoções",
    "vitrine digital",
  ],
  authors: [{ name: "O Calçadão" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "O Calçadão",
    title: "O Calçadão | Seu Centro Comercial",
    description:
      "Encontre tudo o que sua cidade oferece e fale direto com o comércio local.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#172321",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <ZoomGuard />
        <LocationAutoRefresh />
        <PullToRefresh />
        <PwaExperience />
        {children}
      </body>
    </html>
  );
}
