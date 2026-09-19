import type { ReactNode } from "react";
import { redirect } from "next/navigation";

export default function LegacyAdminLayout({ children: _children }: { children: ReactNode }) {
  redirect("/admin");
}
