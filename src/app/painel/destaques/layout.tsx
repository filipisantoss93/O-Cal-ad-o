import type { ReactNode } from "react";
import { ContextHelp } from "@/components/merchant/context-help";

export default function HighlightsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContextHelp title="Publicidade aumenta a exposição, mas não é necessária para publicar">
        <p>
          Destaques e banners são campanhas opcionais compradas separadamente do
          Free e do Calçadão Pro. Destaque de categoria prioriza sua loja dentro da
          categoria; destaque da cidade amplia a presença na página da cidade; o
          combinado usa os dois espaços; e o banner regional ocupa uma área
          publicitária de alta visibilidade para usuários da região escolhida.
          Sua loja continua publicada normalmente sem contratar publicidade.
        </p>
      </ContextHelp>
      {children}
    </>
  );
}
