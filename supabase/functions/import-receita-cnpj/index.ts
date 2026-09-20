import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const ISSUER="https://token.actions.githubusercontent.com";
const AUDIENCE="ocalcadao-rfb-cnpj-import";
const REPOSITORY="filipisantoss93/O-Cal-ad-o";
const WORKFLOW=".github/workflows/import-receita-cnpj.yml";
const JWKS=createRemoteJWKSet(new URL(ISSUER+"/.well-known/jwks"));
function json(data:unknown,status=200) {
  return new Response(JSON.stringify(data),{
    status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
  });
}
function adminKey() {
  const current=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(current){try{const keys=JSON.parse(current) as Record<string,string>;if(keys.default)return keys.default}catch{}}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
}
Deno.serve(async request=>{
  if(request.method!=="POST")return json({error:"Método não permitido."},405);
  const auth=request.headers.get("Authorization")??"";
  const token=auth.startsWith("Bearer ")?auth.slice(7).trim():"";
  if(!token)return json({error:"Não autorizado."},403);
  try {
    const {payload}=await jwtVerify(token,JWKS,{issuer:ISSUER,audience:AUDIENCE});
    if(payload.repository!==REPOSITORY ||
       payload.ref!=="refs/heads/main" ||
       String(payload.workflow_ref??"")!==REPOSITORY+"/"+WORKFLOW+"@refs/heads/main" ||
       !["workflow_dispatch","push"].includes(String(payload.event_name))){
      throw new Error("invalid_workflow_identity");
    }
  }catch{
    return json({error:"Não autorizado."},403);
  }
  let data:Record<string,unknown>;
  try { const parsed=await request.json();
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error();
    data=parsed as Record<string,unknown>;
  }catch{return json({error:"Payload inválido."},400)}
  if(!Array.isArray(data.rows)||data.rows.length<1||data.rows.length>100 ||
     typeof data.snapshot!=="string"||!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(data.snapshot)) {
    return json({error:"rows (1..100) e snapshot (AAAA-MM) obrigatórios."},400);
  }
  const url=Deno.env.get("SUPABASE_URL")??"",key=adminKey();
  if(!url||!key)return json({error:"Serviço indisponível."},500);
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:out,error}=await client.rpc("import_rfb_cnpj_batch",{
    p_rows:data.rows,p_snapshot:data.snapshot
  });
  if(error)return json({error:error.message},500);
  return json(out??{});
});
