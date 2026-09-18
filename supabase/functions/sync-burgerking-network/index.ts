import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN_HASH="caec7186d2264f46f018a6ee45ab34c9df2e897de9b3272dfaba744ad7cd419f";
const PDF_URL="https://bk-latam-prod.s3.amazonaws.com/sites/burgerking.com.br/files/documents/Lojas%20Participantes%20V5%20-%20Delivery.pdf";

async function sha256(v:string){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));
  return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
}
function adminKey(){
  const current=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(current){try{const keys=JSON.parse(current) as Record<string,string>;if(keys.default)return keys.default}catch{}}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
}

Deno.serve(async(req)=>{
  if(req.method!=="POST") return json({error:"Método não permitido."},405);
  const token=req.headers.get("X-Network-Sync-Token")??"";
  if(!token||await sha256(token)!==TOKEN_HASH) return json({error:"Não autorizado."},403);

  const source=await fetch(PDF_URL,{
    headers:{
      "accept":"application/pdf",
      "range":"bytes=0-1023",
      "user-agent":"O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)"
    },
    signal:AbortSignal.timeout(15000)
  });
  const bytes=new Uint8Array(await source.arrayBuffer());
  const prefix=new TextDecoder().decode(bytes.slice(0,8));
  const sourceOk=(source.ok||source.status===206)&&prefix.startsWith("%PDF");

  const url=Deno.env.get("SUPABASE_URL")??"";
  const key=adminKey();
  if(!url||!key) return json({error:"Ambiente Supabase indisponível.",source_ok:sourceOk},500);
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:network,error:networkError}=await supabase
    .from("business_networks").select("id,slug,name").eq("slug","burger-king").maybeSingle();
  if(networkError) return json({error:networkError.message,source_ok:sourceOk},500);

  let units=0;
  let sourceCreated=0;
  let sourceReview=0;
  if(network?.id){
    const unitResult=await supabase.from("business_network_units").select("id",{count:"exact",head:true}).eq("network_id",network.id);
    units=unitResult.count??0;
    const createdResult=await supabase.from("business_source_records").select("id",{count:"exact",head:true}).eq("network_id",network.id).eq("processing_status","created");
    sourceCreated=createdResult.count??0;
    const reviewResult=await supabase.from("business_source_records").select("id",{count:"exact",head:true}).eq("network_id",network.id).eq("processing_status","ignored");
    sourceReview=reviewResult.count??0;
  }

  return json({
    source_ok:sourceOk,
    source_status:source.status,
    source_content_type:source.headers.get("content-type"),
    source_url:PDF_URL,
    network:network??null,
    units,
    source_created:sourceCreated,
    source_review:sourceReview,
    mode:"official_static_pdf_audited_import"
  });
});