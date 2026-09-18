import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "ocalcadao-inep-import";
const REPOSITORY = "filipisantoss93/O-Cal-ad-o";
const WORKFLOW_PATH = ".github/workflows/import-inep-public-schools.yml";
const JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function adminKey() {
  const current = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (current) {
    try {
      const keys = JSON.parse(current) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

async function authorize(request: Request) {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new Error("missing_token");

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (payload.repository !== REPOSITORY) throw new Error("invalid_repository");
  if (payload.ref !== "refs/heads/main") throw new Error("invalid_ref");
  const workflowRef = String(payload.workflow_ref ?? "");
  if (!workflowRef.startsWith(`${REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main`)) {
    throw new Error("invalid_workflow");
  }

  return payload;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    await authorize(request);
  } catch (error) {
    return json({
      error: "Não autorizado.",
      reason: error instanceof Error ? error.message : "invalid_token",
    }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    return json({ error: "Payload inválido." }, 400);
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 500) {
    return json({ error: "rows deve conter de 1 a 500 escolas." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const secret = adminKey();
  if (!supabaseUrl || !secret) return json({ error: "Ambiente Supabase indisponível." }, 500);

  const supabase = createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("import_inep_public_school_batch", {
    p_rows: rows,
  });

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json(data ?? {});
});
