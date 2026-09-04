import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const redirectType = (
        data as typeof data & { redirectType?: string | null }
      ).redirectType;
      const destination =
        next === "/redefinir-senha" && redirectType !== "recovery"
          ? "/painel"
          : next;
      return NextResponse.redirect(new URL(destination, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/entrar?erro=link-invalido", url.origin),
  );
}
