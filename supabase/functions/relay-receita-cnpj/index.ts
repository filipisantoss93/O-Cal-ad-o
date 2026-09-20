import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "ocalcadao-rfb-cnpj-import";
const REPOSITORY = "filipisantoss93/O-Cal-ad-o";
const WORKFLOW = ".github/workflows/import-receita-cnpj.yml";
const JWKS = createRemoteJWKSet(new URL(ISSUER + "/.well-known/jwks"));
const BASE = "https://arquivos.receitafederal.gov.br/public.php/dav/files/YggdBLfdninEJX9/";
const MAX_RANGE = 4 * 1024 * 1024;

function fail(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
Deno.serve(async (request) => {
  if (request.method !== "GET") return fail("Método não permitido", 405);
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return fail("Não autorizado", 403);
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUDIENCE });
    if (payload.repository !== REPOSITORY || payload.ref !== "refs/heads/main" ||
        payload.workflow_ref !== REPOSITORY + "/" + WORKFLOW + "@refs/heads/main" ||
        !["workflow_dispatch", "push"].includes(String(payload.event_name ?? ""))) {
      return fail("Identidade do workflow inválida", 403);
    }
  } catch {
    return fail("Não autorizado", 403);
  }
  const input = new URL(request.url);
  const snapshot = input.searchParams.get("snapshot") ?? "";
  const file = input.searchParams.get("file") ?? "";
  const start = Number(input.searchParams.get("start"));
  const end = Number(input.searchParams.get("end"));
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(snapshot) ||
      !/^(Municipios|Empresas[0-9]|Estabelecimentos[0-9])\.zip$/.test(file) ||
      !Number.isSafeInteger(start) || start < 0 ||
      !Number.isSafeInteger(end) || end < start || end - start >= MAX_RANGE ||
      !["2026-08"].includes(snapshot)) {
    return fail("Requisição fora da competência ou intervalo permitido", 400);
  }
  const upstream = BASE + snapshot + "/" + file;
  let response: Response;
  try {
    response = await fetch(upstream, {
      headers: {
        Range: "bytes=" + start + "-" + end,
        Accept: "application/zip",
        "User-Agent": "O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)"
      },
      signal: AbortSignal.timeout(45000)
    });
  } catch {
    return fail("Arquivo oficial temporariamente indisponível", 502);
  }
  const contentRange = response.headers.get("content-range") ?? "";
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
  if (response.status !== 206 || !match || Number(match[1]) !== start ||
      Number(match[2]) > end || Number(match[3]) <= Number(match[2]) ||
      Number(match[2]) - start >= MAX_RANGE) {
    try { await response.body?.cancel(); } catch {}
    return fail("Resposta de intervalo da Receita inválida", 502);
  }
  return new Response(response.body, {
    status: 206,
    headers: {
      "Content-Type": "application/zip",
      "Content-Range": contentRange,
      "Content-Length": String(Number(match[2]) - Number(match[1]) + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
});
