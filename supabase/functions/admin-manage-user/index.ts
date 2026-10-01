import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const authorizedAdminEmail = "filipi.01@live.com";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Não autorizado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json({ error: "Serviço indisponível." }, 503);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
  if (callerError || !caller) return json({ error: "Não autorizado." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (
    profileError ||
    callerProfile?.role !== "admin" ||
    caller.email?.trim().toLowerCase() !== authorizedAdminEmail
  ) {
    return json({ error: "Acesso negado." }, 403);
  }

  let body: { action?: string; target_user_id?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id : "";
  if (!isUuid(targetUserId)) return json({ error: "Usuário inválido." }, 400);
  if (targetUserId === caller.id) return json({ error: "A conta administrativa não pode ser alterada por esta função." }, 400);

  const { data: targetProfile, error: targetProfileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle();
  if (targetProfileError || !targetProfile) return json({ error: "Usuário não encontrado." }, 404);
  if (targetProfile.role === "admin") return json({ error: "Outra conta administrativa não pode ser alterada por esta função." }, 400);

  const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
  const target = targetResult?.user;
  if (targetError || !target) return json({ error: "Conta de acesso não encontrada." }, 404);

  if (action === "update_email") {
    const email = normalizeEmail(body.email);
    if (!email) return json({ error: "Informe um e-mail válido." }, 400);
    if (email === target.email?.trim().toLowerCase()) return json({ success: true, unchanged: true });

    const { data, error } = await admin.auth.admin.updateUserById(targetUserId, {
      email,
      email_confirm: true,
    });
    if (error || !data.user) {
      if (error?.message?.toLowerCase().includes("already")) {
        return json({ error: "Este e-mail já está vinculado a outra conta." }, 409);
      }
      return json({ error: "Não foi possível alterar o e-mail de acesso." }, 500);
    }

    console.info("[admin-manage-user]", { admin_id: caller.id, target_user_id: targetUserId, action: "email_changed" });
    return json({ success: true, email: data.user.email ?? email });
  }

  if (action === "suspend") {
    const { error } = await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "876000h" });
    if (error) return json({ error: "Não foi possível suspender a conta." }, 500);
    console.info("[admin-manage-user]", { admin_id: caller.id, target_user_id: targetUserId, action: "suspended" });
    return json({ success: true });
  }

  if (action === "reactivate") {
    const { error } = await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "none" });
    if (error) return json({ error: "Não foi possível reativar a conta." }, 500);
    console.info("[admin-manage-user]", { admin_id: caller.id, target_user_id: targetUserId, action: "reactivated" });
    return json({ success: true });
  }

  return json({ error: "Ação administrativa inválida." }, 400);
});
