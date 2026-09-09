import type { ReactNode } from "react";
import { ContextHelp } from "@/components/merchant/context-help";

export default function PromotionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContextHelp title="O que é uma promoção?">
        <p>
          Promoção é uma oferta destacada da sua loja, diferente de um item comum
          do catálogo. No plano Free você pode manter até 2 promoções por loja; no
          Calçadão Pro, até 10 por loja. Assinantes Pro podem comprar pacotes
          adicionais quando precisarem de mais capacidade.
        </p>
      </ContextHelp>
      {children}
    </>
  );
}
