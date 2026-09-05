import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin(returnTo = "/painel/admin") {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/entrar?next=${encodeURIComponent(returnTo)}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    redirect("/painel");
  }

  return { supabase, user };
}
