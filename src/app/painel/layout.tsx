import type { ReactNode } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { getMerchantBillingSummary } from "@/lib/merchant/billing";
import { getMerchantWorkspace } from "@/lib/merchant/dal";

export default async function MerchantLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { supabase, user, profile, businesses } = await getMerchantWorkspace("/painel");
  const billing = await getMerchantBillingSummary(supabase, user.id, businesses);
  const monthlyPrice =
    billing.prices.find((price) => price.billing_cycle === "monthly")?.price_cents ??
    null;
  const displayName =
    profile?.full_name ||
    (typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name
      : "") ||
    user.email ||
    "Comerciante";

  return (
    <MerchantShell
      name={displayName}
      email={user.email ?? ""}
      isAdmin={profile?.role === "admin"}
      proActive={billing.proActive}
      monthlyPriceCents={monthlyPrice}
    >
      {children}
    </MerchantShell>
  );
}
