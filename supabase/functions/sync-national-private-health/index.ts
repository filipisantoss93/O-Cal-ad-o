/* eslint-disable @typescript-eslint/no-explicit-any */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN_HASH = "caec7186d2264f46f018a6ee45ab34c9df2e897de9b3272dfaba744ad7cd419f";
const SOURCE_CODE = "cnes_private_health";
const CNES_URL = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos";
const PAGE_SIZE = 20;
type Db = ReturnType<typeof createClient>;
type Job = { id:number; city_id:number; status:string; cursor_offset:number; attempts:number;
  total_found:number; total_created:number; total_matched:number; total_ignored:number; total_errors:number };
type City = { id:number; name:string; state_code:string; ibge_code:number|null };
type Row = Record<string, unknown>;

function json(value:unknown, status=200) {
  return new Response(JSON.stringify(value), {status, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
}
async function sha256(value:string) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function adminKey() {
  const current=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(current) { try { const keys=JSON.parse(current) as Record<string,string>; if(keys.default)return keys.default } catch {} }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
function clean(value:unknown, max=160) { return String(value??"").replace(/\s+/g," ").trim().slice(0,max); }
function norm(value:unknown) {
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function privateLegalEntity(code:unknown) {
  // 1xxx=administração pública; 2xxx=entidades empresariais; 3xxx=sem fins lucrativos;
  // 4xxx=pessoas físicas. Não importar 1xxx ou 4xxx.
  return /^[23]\d{3}$/.test(String(code??"").replace(/\D/g,""));
}
function postal(value:unknown) { const digits=String(value??"").replace(/\D/g,""); return digits.length===8?digits:null; }
function validNumber(value:unknown) {
  const n=Number(value);
  return Number.isFinite(n)?Number(n.toFixed(6)):null;
}
async function fetchPage(ibge6:number, offset:number) {
  const url=new URL(CNES_URL);
  url.searchParams.set("codigo_municipio",String(ibge6));
  url.searchParams.set("status","1");
  url.searchParams.set("limit",String(PAGE_SIZE));
  url.searchParams.set("offset",String(offset));
  const response=await fetch(url,{
    headers:{Accept:"application/json","User-Agent":"O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)"},
    signal:AbortSignal.timeout(18000)
  });
  if(!response.ok)throw new Error("CNES_HTTP_"+response.status);
  const data=await response.json() as {estabelecimentos?:Row[]};
  if(!Array.isArray(data.estabelecimentos))throw new Error("Resposta CNES inválida.");
  return data.estabelecimentos;
}
async function coordsInsideCity(db:Db,cityId:number,lat:number|null,lon:number|null) {
  if(lat===null||lon===null||lat < -90||lat > 90||lon < -180||lon > 180)return false;
  const {data,error}=await db.rpc("resolve_city_by_coordinates",{input_latitude:lat,input_longitude:lon});
  return !error && data?.[0]?.id===cityId;
}
async function stage(db:Db,sourceId:number,jobId:number,city:City,row:Row,
  cnes:string,name:string,street:string,number:string,complement:string,neighborhood:string,
  zip:string|null,latitude:number|null,longitude:number|null) {
  const externalId="cnes:"+cnes;
  const sourceUrl=CNES_URL+"/"+encodeURIComponent(cnes);
  const {data:existing,error:lookupError}=await db.from("business_source_records").select("id,matched_business_id")
    .eq("source_id",sourceId).eq("external_id",externalId).maybeSingle();
  if(lookupError)throw lookupError;
  // Never stage CNPJ, CPF, personal phone/email, or the unrestricted upstream payload.
  const record={
    source_id:sourceId, external_id:externalId, external_unit_code:cnes,
    name,street,address_number:number,complement:complement||null,neighborhood,postal_code:zip,
    city_name:city.name,state_code:city.state_code,city_id:city.id,
    latitude,longitude,source_url:sourceUrl,
    payload:{codigo_cnes:cnes,natureza_juridica:clean(row.descricao_natureza_juridica_estabelecimento,12),
      data_atualizacao:clean(row.data_atualizacao,20)},
    dedupe_key:"cnes-private|"+cnes,processing_status:existing?.matched_business_id?"matched":"pending",
    processing_note:"CNES privado; piloto job "+jobId,
    updated_at:new Date().toISOString()
  };
  if(existing?.id) {
    const {data,error}=await db.from("business_source_records").update(record).eq("id",existing.id)
      .select("id,matched_business_id").single();
    if(error)throw error;
    return data as {id:number;matched_business_id:number|null};
  }
  const {data,error}=await db.from("business_source_records").insert({...record,found_at:new Date().toISOString()})
    .select("id,matched_business_id").single();
  if(error)throw error;
  return data as {id:number;matched_business_id:number|null};
}
async function setRecord(db:Db,recordId:number,status:string,businessId:number|null,note:string) {
  const {error}=await db.from("business_source_records").update({
    processing_status:status,matched_business_id:businessId,processing_note:note,
    processed_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }).eq("id",recordId);
  if(error)throw error;
}
async function link(db:Db,businessId:number,recordId:number) {
  const {data:existing,error:lookupError}=await db.from("business_source_links")
    .select("id").eq("business_id",businessId).eq("source_record_id",recordId).maybeSingle();
  if(lookupError)throw lookupError;
  const timestamp=new Date().toISOString();
  if(existing) {
    const {error}=await db.from("business_source_links").update({last_seen_at:timestamp})
      .eq("id",existing.id);
    if(error)throw error;
  } else {
    const {error}=await db.from("business_source_links").insert({
      business_id:businessId,source_record_id:recordId,confidence:95,
      is_primary:false,first_seen_at:timestamp,last_seen_at:timestamp
    });
    if(error)throw error;
  }
}
async function candidates(db:Db,cityId:number,name:string,street:string,number:string,complement:string) {
  // Never merge by name alone, or by address alone: different clinics may share a building.
  const {data,error}=await db.from("businesses")
    .select("id,listing_type,name,street,address_number,complement")
    .eq("city_id",cityId).ilike("name",name).limit(75);
  if(error)throw error;
  if((data??[]).length>=75)return {exact:[],ambiguous:true};
  const same=(data??[]).filter(x=>norm(x.name)===norm(name)
    &&norm(x.street)===norm(street)&&norm(x.address_number)===norm(number));
  const publicConflicts=same.some(x=>x.listing_type==="public_place");
  const exact=same.filter(x=>x.listing_type==="business"&&norm(x.complement)===norm(complement));
  // Unknown complement cannot establish that two businesses occupying one building coincide.
  const ambiguous=publicConflicts || exact.length>1 || same.some(x=>norm(x.complement)!==norm(complement)
    &&(!norm(x.complement)||!norm(complement)));
  return {exact,ambiguous};
}
Deno.serve(async request=>{
  if(request.method!=="POST")return json({error:"Método não permitido."},405);
  const token=request.headers.get("X-Geocoding-Token")??"";
  if(!token||await sha256(token)!==TOKEN_HASH)return json({error:"Não autorizado."},403);
  let body:Record<string,unknown>={};
  try { const input=await request.json(); if(input&&typeof input==="object"&&!Array.isArray(input))body=input } catch {}
  const requestedPages=Number(body.maxPages??1);
  const maxPages=Number.isSafeInteger(requestedPages)?Math.max(1,Math.min(requestedPages,3)):1;
  const requestedCity=Number(body.cityId??0);
  const cityId=Number.isSafeInteger(requestedCity)&&requestedCity>0?requestedCity:null;
  const url=Deno.env.get("SUPABASE_URL")??"";
  const key=adminKey();
  if(!url||!key)return json({error:"Ambiente indisponível."},500);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:source,error:sourceError}=await db.from("business_data_sources")
    .select("id").eq("code",SOURCE_CODE).eq("is_active",true).eq("allows_import",true).maybeSingle();
  if(sourceError||!source)return json({error:"Fonte CNES privada indisponível."},500);
  const {data:claimed,error:claimError}=await db.rpc("claim_public_place_import_job",{
    p_source_code:SOURCE_CODE,p_city_id:cityId
  });
  if(claimError)return json({error:claimError.message},500);
  const job=(claimed??null) as Job|null;
  if(!job)return json({processedCities:0,message:"Nenhum município privado pendente."});
  const {data:rawCity,error:cityError}=await db.from("cities")
    .select("id,name,state_code,ibge_code").eq("id",job.city_id).eq("is_active",true).maybeSingle();
  if(cityError||!rawCity?.ibge_code)return json({error:"Cidade sem IBGE; job "+job.id},500);
  const city=rawCity as City;
  let cursor=job.cursor_offset,found=0,created=0,matched=0,ignored=0,errors=0,review=0,done=false;
  try {
    for(let p=0;p<maxPages;p++) {
      const rows=await fetchPage(Math.floor(Number(city.ibge_code)/10),cursor);
      found+=rows.length;
      if(!rows.length){done=true;break}
      for(const row of rows) {
        if(!privateLegalEntity(row.descricao_natureza_juridica_estabelecimento)){ignored++;continue}
        const cnes=clean(row.codigo_cnes,30),name=clean(row.nome_fantasia||row.nome_razao_social,120);
        const street=clean(row.endereco_estabelecimento),number=clean(row.numero_estabelecimento,20);
        const complement=clean(row.complemento_estabelecimento,120);
        const neighborhood=clean(row.bairro_estabelecimento,120);
        if(!/^\d+$/.test(cnes)||name.length<2||street.length<2||!number||neighborhood.length<2){
          ignored++;continue;
        }
        let latitude=validNumber(row.latitude_estabelecimento_decimo_grau);
        let longitude=validNumber(row.longitude_estabelecimento_decimo_grau);
        if(!(await coordsInsideCity(db,city.id,latitude,longitude))){latitude=null;longitude=null}
        // Assis pilot: city-only validation does not prove the source point is at this street/number.
        // Keep CNES coordinates in source staging; do not publish them as precise business positions.
        const validatedLatitude=city.id===1?null:latitude;
        const validatedLongitude=city.id===1?null:longitude;
        try {
          const entry=await stage(db,source.id,job.id,city,row,cnes,name,street,number,
            complement,neighborhood,postal(row.codigo_cep_estabelecimento),latitude,longitude);
          let businessId=entry.matched_business_id;
          if(businessId) {
            // A prior linked business may have changed city/type or been claimed; no silent reassignment.
            const {data:current,error}=await db.from("businesses")
              .select("id,city_id,listing_type").eq("id",businessId).maybeSingle();
            if(error)throw error;
            if(!current||current.listing_type!=="business"||current.city_id!==city.id) {
              await setRecord(db,entry.id,"duplicate_candidate",null,"Vínculo anterior inconsistente; revisão manual.");
              review++;continue;
            }
            await link(db,businessId,entry.id);matched++;continue;
          }
          const possible=await candidates(db,city.id,name,street,number,complement);
          if(possible.ambiguous) {
            await setRecord(db,entry.id,"duplicate_candidate",null,
              "Mesmo nome/endereço com complemento divergente ou candidatos múltiplos.");
            review++;continue;
          }
          if(possible.exact.length===1) {
            businessId=possible.exact[0].id;
            await setRecord(db,entry.id,"matched",businessId,"CNES privado: nome, rua, número e complemento conferidos.");
            await link(db,businessId,entry.id);matched++;continue;
          }
          const sourceUrl=CNES_URL+"/"+encodeURIComponent(cnes);
          const slug="saude-cnes-"+cnes;
          const {data:createdRow,error:insertError}=await db.from("businesses").insert({
            owner_id:null,pre_registered:true,city_id:city.id,category_id:6,
            slug,name,street,address_number:number,complement:complement||null,neighborhood,
            postal_code:postal(row.codigo_cep_estabelecimento),latitude:validatedLatitude,longitude:validatedLongitude,
            status:"approved",plan:"free",is_active:true,publication_status:"unpublished",
            listing_type:"business",public_place_kind:null,whatsapp_e164:null,
            featured_until:null,data_source_url:sourceUrl,data_source_checked_at:new Date().toISOString(),
            tags:["cnes","saude-privada"]
          }).select("id").single();
          if(insertError)throw insertError;
          businessId=createdRow.id;
          await setRecord(db,entry.id,"created",businessId,"CNES privado: pré-cadastro criado, aguardando revisão/publicação.");
          await link(db,businessId,entry.id);created++;
        }catch(error) {
          errors++;
          console.error("CNES private record error",cnes,error instanceof Error?error.message:String(error));
        }
      }
      cursor+=PAGE_SIZE;
      if(rows.length<PAGE_SIZE){done=true;break}
    }
    const timestamp=new Date().toISOString();
    const {error:jobError}=await db.from("public_place_import_jobs").update({
      status:done?"completed":"partial",cursor_offset:cursor,attempts:0,
      total_found:job.total_found+found,total_created:job.total_created+created,
      total_matched:job.total_matched+matched,total_ignored:job.total_ignored+ignored,
      total_errors:job.total_errors+errors,completed_at:done?timestamp:null,
      next_run_at:done?"2100-01-01T00:00:00Z":new Date(Date.now()+60000).toISOString(),
      updated_at:timestamp,last_error:errors?errors+" registro(s) com erro.":null
    }).eq("id",job.id);
    if(jobError)throw jobError;
    return json({processedCities:1,city:city.name,state:city.state_code,jobId:job.id,status:done?"completed":"partial",
      found,created,matched,ignored,review,errors,cursorOffset:cursor,
      note:"Pré-cadastros privados permanecem não publicados até validação."});
  }catch(error) {
    const message=error instanceof Error?error.message:String(error);
    const attempts=job.attempts+1;
    await db.from("public_place_import_jobs").update({
      status:attempts>=5?"paused":"failed",attempts,
      last_error:message.slice(0,2000),
      next_run_at:attempts>=5?"2100-01-01T00:00:00Z":new Date(Date.now()+900000).toISOString(),
      updated_at:new Date().toISOString()
    }).eq("id",job.id);
    return json({processedCities:1,status:"failed",error:message},500);
  }
});
