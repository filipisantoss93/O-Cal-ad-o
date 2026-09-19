import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Perfis não reivindicados" };

export default function LegacyPreRegistrationPage() {
  redirect("/admin/perfis-nao-reivindicados");
}
