import type { ReactNode } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { getMerchantWorkspace } from "@/lib/merchant/dal";

export default async function MerchantLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, profile } = await getMerchantWorkspace("/painel");
  const displayName =
    profile?.full_name ||
    (typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name
      : "") ||
    user.email ||
    "Comerciante";

  return (
    <MerchantShell name={displayName} email={user.email ?? ""}>
      {children}
    </MerchantShell>
  );
}
