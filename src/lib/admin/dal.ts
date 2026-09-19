import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const AUTHORIZED_ADMIN_EMAIL = "filipi.01@live.com";

export async function requireAdmin(returnTo = "/admin") {
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

  const authorizedEmail = user.email?.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL;

  if (profileError || profile?.role !== "admin" || !authorizedEmail) {
    redirect("/");
  }

  return { supabase, user };
}
