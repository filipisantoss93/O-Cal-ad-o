import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const bucket = "business-media";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Não autorizado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json({ error: "Serviço indisponível." }, 503);
  }

  let body: { confirmation?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  if (body.confirmation !== "EXCLUIR") {
    return json({ error: "Confirmação inválida." }, 400);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Não autorizado." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const paths: string[] = [];
  const folders: string[] = [user.id];
  while (folders.length > 0) {
    const prefix = folders.shift()!;
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) return json({ error: "Não foi possível remover as imagens." }, 500);
      if (!data || data.length === 0) break;

      for (const item of data) {
        const itemPath = `${prefix}/${item.name}`;
        if (item.id) paths.push(itemPath);
        else folders.push(itemPath);
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }

  for (let index = 0; index < paths.length; index += 1000) {
    const { error } = await admin.storage
      .from(bucket)
      .remove(paths.slice(index, index + 1000));
    if (error) return json({ error: "Não foi possível remover as imagens." }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: "Não foi possível excluir a conta." }, 500);

  return json({ success: true });
});
