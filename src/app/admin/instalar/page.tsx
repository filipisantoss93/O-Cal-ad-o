import type { Metadata } from "next";
import { AdminPwaInstall } from "@/components/admin-pwa-install";

export const metadata: Metadata = {
  title: "Instalar aplicativo administrativo",
  robots: { index: false, follow: false },
};

export default function AdminInstallPage() {
  return <div className="mx-auto max-w-2xl">
    <header className="mb-6">
      <p className="text-xs font-black uppercase tracking-widest text-brand-dark">O Calçadão Admin</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">Aplicativo do administrador</h1>
    </header>
    <AdminPwaInstall />
  </div>;
}
