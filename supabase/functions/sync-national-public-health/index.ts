import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN_HASH = "caec7186d2264f46f018a6ee45ab34c9df2e897de9b3272dfaba744ad7cd419f";
const CNES_URL = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos";
const SOURCE_CODE = "cnes_public_health";
const PAGE_SIZE = 20;

type Job = {
  id:number; source_id:number; city_id:number; status:string; priority:number;
  cursor_offset:number; attempts:number; total_found:number; total_created:number;
  total_matched:number; total_ignored:number; total_errors:number;
};
type City = { id:number; name:string; state_code:string; ibge_code:number|null };
type CnesRow = Record<string, unknown>;

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
}
async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function adminKey(){
  const current=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(current){try{const keys=JSON.parse(current) as Record<string,string>;if(keys.default)return keys.default}catch{}}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
function clean(v:unknown,max:number){
  return String(v ?? "").replace(/\s+/g," ").trim().slice(0,max);
}
function norm(v:unknown){
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function slugPart(v:unknown){
  return norm(v).replace(/\s+/g,"-").replace(/^-+|-+$/g,"").slice(0,78) || "local-publico";
}
function validPostal(v:unknown){
  const x=String(v ?? "").replace(/\D/g,"");
  return x.length===8 ? x : null;
}
function publicNature(v:unknown){
  const code=String(v ?? "").replace(/\D/g,"");
  return code.length>=4 && code.startsWith("1");
}
async function fetchPage(ibge6:number,page:number){
  const url=new URL(CNES_URL);
  url.searchParams.set("codigo_municipio",String(ibge6));
  url.searchParams.set("status","1");
  url.searchParams.set("limit",String(PAGE_SIZE));
  url.searchParams.set("offset",String(page));
  const res=await fetch(url,{
    headers:{Accept:"application/json","User-Agent":"O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)",Referer:"https://ocalcadao.com.br/"},
    signal:AbortSignal.timeout(18000)
  });
  if(!res.ok) throw new Error(`CNES_HTTP_${res.status}`);
  const payload=await res.json() as {estabelecimentos?:CnesRow[]};
  return Array.isArray(payload.estabelecimentos) ? payload.estabelecimentos : [];
}
async function coordinatesInsideCity(supabase:ReturnType<typeof createClient>,cityId:number,lat:number,lon:number){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)return false;
  const {data,error}=await supabase.rpc("resolve_city_by_coordinates",{input_latitude:lat,input_longitude:lon});
  return !error && data?.[0]?.id===cityId;
}
async function stageRecord(
  supabase:ReturnType<typeof createClient>, sourceId:number, jobId:number, city:City, row:CnesRow,
  name:string, street:string, number:string, neighborhood:string, postal:string|null,
  latitude:number|null, longitude:number|null
){
  const cnes=String(row.codigo_cnes ?? "").trim();
  const externalId=`cnes:${cnes}`;
  const sourceUrl=`https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/${encodeURIComponent(cnes)}`;
  const {data:existing}=await supabase.from("business_source_records")
    .select("id,matched_business_id").eq("source_id",sourceId).eq("external_id",externalId).maybeSingle();
  const payload={
    source_id:sourceId, import_id:null, external_id:externalId, external_unit_code:cnes,
    name, street, address_number:number, neighborhood, postal_code:postal,
    city_name:city.name, state_code:city.state_code, city_id:city.id,
    latitude, longitude, source_url:sourceUrl, payload:row,
    dedupe_key:`cnes|${cnes}`, processing_status:existing?.matched_business_id ? "matched" : "pending",
    processing_note:`Fila nacional CNES job ${jobId}`, found_at:new Date().toISOString(), updated_at:new Date().toISOString()
  };
  if(existing?.id){
    const {data,error}=await supabase.from("business_source_records").update(payload).eq("id",existing.id)
      .select("id,matched_business_id").single();
    if(error) throw error;
    return data as {id:number;matched_business_id:number|null};
  }
  const {data,error}=await supabase.from("business_source_records").insert(payload).select("id,matched_business_id").single();
  if(error) throw error;
  return data as {id:number;matched_business_id:number|null};
}
async function linkRecord(supabase:ReturnType<typeof createClient>,businessId:number,recordId:number){
  const {data:link}=await supabase.from("business_source_links").select("id")
    .eq("business_id",businessId).eq("source_record_id",recordId).maybeSingle();
  if(!link){
    await supabase.from("business_source_links").insert({
      business_id:businessId,source_record_id:recordId,confidence:98,is_primary:false,
      first_seen_at:new Date().toISOString(),last_seen_at:new Date().toISOString()
    });
  }else{
    await supabase.from("business_source_links").update({last_seen_at:new Date().toISOString(),confidence:98}).eq("id",link.id);
  }
}
Deno.serve(async(request)=>{
  if(request.method!=="POST") return json({error:"Método não permitido."},405);
  const token=request.headers.get("X-Geocoding-Token") ?? "";
  if(!token || await sha256(token)!==TOKEN_HASH) return json({error:"Não autorizado."},403);

  let body:Record<string,unknown>={};
  try{const parsed=await request.json();if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))body=parsed as Record<string,unknown>}catch{}
  const requestedPages=Number(body.maxPages ?? 5);
  const maxPages=Number.isSafeInteger(requestedPages)?Math.max(1,Math.min(requestedPages,10)):5;
  const requestedCityId=Number(body.cityId ?? 0);

  const supabaseUrl=Deno.env.get("SUPABASE_URL") ?? "";
  const key=adminKey();
  if(!supabaseUrl||!key) return json({error:"Ambiente Supabase indisponível."},500);
  const supabase=createClient(supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:source,error:sourceError}=await supabase.from("business_data_sources").select("id")
    .eq("code",SOURCE_CODE).eq("is_active",true).maybeSingle();
  if(sourceError||!source) return json({error:"Fonte CNES não configurada."},500);

  let jobQuery=supabase.from("public_place_import_jobs").select("*").eq("source_id",source.id)
    .in("status",["pending","partial","failed"]).lt("attempts",5).lte("next_run_at",new Date().toISOString());
  if(Number.isSafeInteger(requestedCityId)&&requestedCityId>0) jobQuery=jobQuery.eq("city_id",requestedCityId);
  const {data:jobs,error:jobError}=await jobQuery.order("priority",{ascending:false}).order("next_run_at",{ascending:true}).order("id",{ascending:true}).limit(1);
  if(jobError) return json({error:jobError.message},500);
  const job=(jobs?.[0] ?? null) as Job|null;
  if(!job) return json({processedCities:0,message:"Nenhum município pendente neste momento."});

  const now=new Date().toISOString();
  const {data:claimed,error:claimError}=await supabase.from("public_place_import_jobs").update({
    status:"processing",attempts:job.attempts+1,last_run_at:now,started_at:job.started_at ?? now,updated_at:now,last_error:null
  }).eq("id",job.id).in("status",["pending","partial","failed"]).select("*").maybeSingle();
  if(claimError||!claimed) return json({processedCities:0,message:"Job já processado por outro worker."});

  const {data:city,error:cityError}=await supabase.from("cities").select("id,name,state_code,ibge_code")
    .eq("id",job.city_id).eq("is_active",true).maybeSingle();
  if(cityError||!city||!city.ibge_code){
    await supabase.from("public_place_import_jobs").update({
      status:"failed",last_error:"Município sem código IBGE válido.",next_run_at:new Date(Date.now()+24*3600000).toISOString(),updated_at:new Date().toISOString()
    }).eq("id",job.id);
    return json({processedCities:1,cityId:job.city_id,status:"failed",error:"Município sem código IBGE válido."});
  }

  const cityRow=city as City;
  const ibge6=Math.floor(Number(cityRow.ibge_code)/10);
  let cursor=job.cursor_offset;
  let found=0,created=0,matched=0,ignored=0,errors=0;
  let done=false;
  const results:Record<string,unknown>[]=[];

  try{
    for(let p=0;p<maxPages;p++){
      const rows=await fetchPage(ibge6,cursor);
      found+=rows.length;
      if(!rows.length){done=true;break}

      const {data:existingPlaces}=await supabase.from("businesses")
        .select("id,name,street,address_number,latitude,longitude")
        .eq("city_id",cityRow.id).eq("listing_type","public_place").limit(5000);
      const placeIndex=new Map<string,any>();
      for(const place of existingPlaces ?? []) placeIndex.set(norm(place.name),place);

      for(const row of rows){
        if(!publicNature(row.descricao_natureza_juridica_estabelecimento)){ignored++;continue}
        const cnes=clean(row.codigo_cnes,30);
        const name=clean(row.nome_fantasia || row.nome_razao_social,120);
        const street=clean(row.endereco_estabelecimento,160);
        const number=clean(row.numero_estabelecimento,20);
        const neighborhood=clean(row.bairro_estabelecimento,120);
        const postal=validPostal(row.codigo_cep_estabelecimento);
        if(!cnes||!name||name.length<2||!street||street.length<2||!number||!neighborhood||neighborhood.length<2){
          ignored++;continue;
        }

        let latitude=Number(row.latitude_estabelecimento_decimo_grau);
        let longitude=Number(row.longitude_estabelecimento_decimo_grau);
        let lat:number|null=Number.isFinite(latitude)?Number(latitude.toFixed(6)):null;
        let lon:number|null=Number.isFinite(longitude)?Number(longitude.toFixed(6)):null;
        if(lat!==null&&lon!==null&&!(await coordinatesInsideCity(supabase,cityRow.id,lat,lon))){lat=null;lon=null}

        try{
          const staged=await stageRecord(supabase,source.id,job.id,cityRow,row,name,street,number,neighborhood,postal,lat,lon);
          let businessId=staged.matched_business_id ?? null;
          let recordOutcome=businessId ? "matched" : "created";

          if(businessId){
            const {data:existingBusiness}=await supabase.from("businesses").select("id,latitude,longitude").eq("id",businessId).maybeSingle();
            if(existingBusiness && (existingBusiness.latitude===null||existingBusiness.longitude===null) && lat!==null&&lon!==null){
              await supabase.from("businesses").update({
                latitude:lat,longitude:lon,data_source_checked_at:new Date().toISOString(),
                official_source_url:`https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/${encodeURIComponent(cnes)}`
              }).eq("id",businessId).eq("listing_type","public_place");
            }
            matched++;
          }else{
            const existing=placeIndex.get(norm(name));
            if(existing){
              businessId=existing.id;
              recordOutcome="matched";
              matched++;
            }else{
              const sourceUrl=`https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/${encodeURIComponent(cnes)}`;
              const slug=`${slugPart(name)}-cnes-${cnes.toLowerCase().replace(/[^a-z0-9]/g,"")}`;
              const {data:inserted,error:insertError}=await supabase.from("businesses").insert({
                owner_id:null,city_id:cityRow.id,category_id:27,slug,name,
                street,address_number:number,neighborhood,postal_code:postal,
                latitude:lat,longitude:lon,status:"approved",plan:"free",is_active:true,
                publication_status:"published",listing_type:"public_place",public_place_kind:"health",
                official_source_url:sourceUrl,pre_registered:false,data_source_url:sourceUrl,
                data_source_checked_at:new Date().toISOString(),tags:["cnes","saude-publica"]
              }).select("id,name,street,address_number,latitude,longitude").single();
              if(insertError) throw insertError;
              businessId=inserted.id;
              placeIndex.set(norm(name),inserted);
              created++;
            }

            await supabase.from("business_source_records").update({
              matched_business_id:businessId,processing_status:existing?"matched":"created",
              processed_at:new Date().toISOString(),updated_at:new Date().toISOString()
            }).eq("id",staged.id);
          }

          if(businessId) await linkRecord(supabase,businessId,staged.id);
          results.push({cnes,name,businessId,status:recordOutcome,coordinates:lat!==null&&lon!==null});
        }catch(e){
          errors++;
          results.push({cnes,name,status:"error",error:e instanceof Error?e.message:String(e)});
        }
      }

      cursor++;
      if(rows.length<PAGE_SIZE){done=true;break}
    }

    const status=done?"completed":"partial";
    await supabase.from("public_place_import_jobs").update({
      status,cursor_offset:cursor,
      total_found:job.total_found+found,total_created:job.total_created+created,total_matched:job.total_matched+matched,
      total_ignored:job.total_ignored+ignored,total_errors:job.total_errors+errors,
      completed_at:done?new Date().toISOString():null,
      next_run_at:done?new Date("2100-01-01T00:00:00Z").toISOString():new Date(Date.now()+60_000).toISOString(),
      updated_at:new Date().toISOString(),last_error:errors?`${errors} registro(s) com erro no lote.`:null
    }).eq("id",job.id);

    return json({
      processedCities:1,city:{id:cityRow.id,name:cityRow.name,state:cityRow.state_code,ibge:cityRow.ibge_code},
      source:SOURCE_CODE,status,pagesProcessed:maxPages,cursorOffset:cursor,
      found,created,matched,ignored,errors,done,results
    });
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    await supabase.from("public_place_import_jobs").update({
      status:(job.attempts+1)>=5?"paused":"failed",last_error:message.slice(0,2000),
      next_run_at:new Date(Date.now()+15*60_000).toISOString(),updated_at:new Date().toISOString()
    }).eq("id",job.id);
    return json({processedCities:1,city:{id:cityRow.id,name:cityRow.name,state:cityRow.state_code},status:"failed",error:message},500);
  }
});