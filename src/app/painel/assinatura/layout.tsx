import type { ReactNode } from "react";
import { ContextHelp } from "@/components/merchant/context-help";

export default function BillingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContextHelp title="Plano, adicionais e publicidade são coisas diferentes">
        <p>
          <strong className="text-ink">Plano</strong> define a capacidade da sua conta.
          O Free inclui 1 loja e 2 promoções por loja; o Calçadão Pro aumenta para
          3 lojas e 10 promoções por loja. Lojas adicionais e pacotes extras de
          promoções são contratados separadamente. Destaques e banners são
          publicidade opcional e não fazem parte da assinatura Pro.
        </p>
      </ContextHelp>
      {children}
    </>
  );
}
