import type { Metadata, Viewport } from "next";
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
  themeColor: "#f7f5ef",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
