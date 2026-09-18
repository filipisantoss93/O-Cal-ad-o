import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN_HASH = "caec7186d2264f46f018a6ee45ab34c9df2e897de9b3272dfaba744ad7cd419f";
const API_BASE = "https://www.smartfit.com.br/academias.json";
const SOURCE_CODE = "smartfit_official_locations";
const NETWORK_SLUG = "smart-fit";
const CATEGORY_ID = 12;
const UF_CODES = ["ac","al","ap","am","ba","ce","df","es","go","ma","mt","ms","mg","pa","pb","pr","pe","pi","rj","rn","rs","ro","rr","sc","sp","se","to"];

async function sha256(value:string){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
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
function normalize(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function parseCity(line:string,third:string){
  const m=(line||"").match(/^(.*?),\s*([A-Z]{2})\s*-\s*(\d{5}-?\d{3}|\d{8})\s*$/i);
  if(m)return {city:m[1].trim(),state:m[2].toUpperCase(),postal:m[3].replace(/\D/g,"")};
  const t=(third||"").match(/^(.*?)\s*-\s*([A-Z]{2})\s*$/i);
  return t?{city:t[1].trim(),state:t[2].toUpperCase(),postal:""}:null;
}
function parseFirstLine(line:string){
  const parts=(line||"").split(/\s+-\s+/);
  const base=(parts.shift()||"").trim();
  const neighborhood=parts.join(" - ").replace(/[.\s]+$/g,"").trim()||"Não informado";
  const idx=base.lastIndexOf(",");
  if(idx<0)return {street:base.slice(0,160)||"Endereço não informado",number:"S/N",neighborhood};
  const street=base.slice(0,idx).trim().slice(0,160);
  let number=base.slice(idx+1).trim().replace(/^N[º°.]?\s*/i,"");
  if(!number)number="S/N";
  if(number.length>20)number=number.slice(0,20);
  return {street:street||"Endereço não informado",number,neighborhood:neighborhood.slice(0,120)};
}
async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T,index:number)=>Promise<R>):Promise<R[]>{
  const out=new Array<R>(items.length);let cursor=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=cursor++;if(i>=items.length)return;out[i]=await fn(items[i],i)}});
  await Promise.all(workers);return out;
}
async function fetchPage(uf:string,page:number){
  const url=new URL(API_BASE);
  url.searchParams.set("uf",uf);
  url.searchParams.set("page",String(page));
  url.searchParams.set("except_digital","true");

  let lastStatus=0;
  for(let attempt=0;attempt<5;attempt++){
    const res=await fetch(url,{headers:{"accept":"application/json","accept-language":"pt-BR,pt;q=0.9","user-agent":"O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)"},signal:AbortSignal.timeout(20000)});
    lastStatus=res.status;
    if(res.ok)return await res.json();

    if(res.status!==429 && res.status<500){
      throw new Error(`Smart Fit ${uf} page ${page}: HTTP ${res.status}`);
    }

    const retryAfter=Number(res.headers.get("retry-after")||0);
    const delayMs=retryAfter>0?Math.min(retryAfter*1000,15000):Math.min(1000*Math.pow(2,attempt),10000);
    await new Promise(resolve=>setTimeout(resolve,delayMs));
  }
  throw new Error(`Smart Fit ${uf} page ${page}: HTTP ${lastStatus} após retries`);
}

Deno.serve(async(req)=>{
  if(req.method!=="POST")return json({error:"Método não permitido."},405);
  const token=req.headers.get("X-Network-Sync-Token")??"";
  if(!token||await sha256(token)!==TOKEN_HASH)return json({error:"Não autorizado."},403);

  const key=adminKey(),url=Deno.env.get("SUPABASE_URL")??"";
  if(!key||!url)return json({error:"Ambiente Supabase indisponível."},500);
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

  let body:any={};
  try{body=await req.json()}catch{}
  const requested=Array.isArray(body?.ufs)?body.ufs.map((x:any)=>String(x).toLowerCase()).filter((x:string)=>UF_CODES.includes(x)):[...UF_CODES];
  const targetUfs=[...new Set(requested)];
  if(targetUfs.length===0)return json({error:"Nenhuma UF válida informada."},400);

  const first=await mapLimit(targetUfs,4,async uf=>{
    try{return {uf,data:await fetchPage(uf,1),error:null}}catch(e){return {uf,data:null,error:String(e)}}
  });

  const pageTasks:{uf:string;page:number}[]=[];
  const allLocations:any[]=[];
  const sourceStats:any[]=[];
  const fetchErrors:any[]=[];

  for(const item of first){
    if(item.error){fetchErrors.push({uf:item.uf,error:item.error});continue}
    const data:any=item.data;
    const locs=Array.isArray(data?.locations)?data.locations:[];
    allLocations.push(...locs);
    const total=Number(data?.locations_count??locs.length??0);
    const pages=Math.max(1,Math.ceil(total/Math.max(1,locs.length||8)));
    sourceStats.push({uf:item.uf,total,pages});
    for(let p=2;p<=pages;p++)pageTasks.push({uf:item.uf,page:p});
  }

  const rest=await mapLimit(pageTasks,2,async task=>{
    try{return {task,data:await fetchPage(task.uf,task.page),error:null}}catch(e){return {task,data:null,error:String(e)}}
  });
  for(const item of rest){
    if(item.error){fetchErrors.push({uf:item.task.uf,page:item.task.page,error:item.error});continue}
    const locs=Array.isArray((item.data as any)?.locations)?(item.data as any).locations:[];
    allLocations.push(...locs);
  }

  const unique=new Map<string,any>();
  for(const loc of allLocations){
    if(!loc||loc.is_digital===true||loc.opened===false)continue;
    const code=String(loc.acronym||loc.smart_system_id||loc.id||"").trim();
    if(!code)continue;
    unique.set(code,loc);
  }

  const states=[...new Set([...unique.values()].map((loc:any)=>parseCity(loc?.address?.second_line||"",loc?.address?.third_line||"")?.state).filter(Boolean))] as string[];
  const cityMaps=new Map<string,Map<string,{id:number;name:string}>>();
  await mapLimit(states,8,async state=>{
    const {data,error}=await supabase.from("cities").select("id,name,state_code").eq("state_code",state).eq("is_active",true).limit(1000);
    if(error)throw error;
    const map=new Map<string,{id:number;name:string}>();
    for(const c of data??[])map.set(normalize(c.name),{id:Number(c.id),name:c.name});
    cityMaps.set(state,map);
    return true;
  });

  const grouped=new Map<number,{cityId:number,cityName:string,state:string,units:any[]}>();
  const unmatched:any[]=[];
  const seenOfficialAddress=new Set<string>();
  let parsedCount=0;

  for(const loc of unique.values()){
    const cityInfo=parseCity(loc?.address?.second_line||"",loc?.address?.third_line||"");
    if(!cityInfo){unmatched.push({name:loc.name,address:loc?.address});continue}
    const resolvedCityName=cityInfo.state==="DF"?"Brasília":cityInfo.city;
    const city=cityMaps.get(cityInfo.state)?.get(normalize(resolvedCityName));
    if(!city){unmatched.push({name:loc.name,city:cityInfo.city,resolved_city:resolvedCityName,state:cityInfo.state,address:loc?.address});continue}
    const a=parseFirstLine(loc?.address?.first_line||"");
    const lat=Number(loc?.address?.position?.latitude),lng=Number(loc?.address?.position?.longitude);
    const code=String(loc.acronym||loc.smart_system_id||loc.id).trim();
    const detailUrl=`https://www.smartfit.com.br/academias/${loc.permalink}`;
    const officialAddressKey=normalize(`${cityInfo.state}|${cityInfo.city}|${loc?.address?.first_line||""}`);
    const isAdditionalOfficialUnitAtSameAddress=seenOfficialAddress.has(officialAddressKey);
    seenOfficialAddress.add(officialAddressKey);
    const unit={
      external_unit_code:code,
      unit_name:String(loc.name||code).slice(0,200),
      business_name:(`Smart Fit - ${String(loc.name||code)}`).slice(0,120),
      street:a.street,
      address_number:a.number,
      neighborhood:a.neighborhood,
      postal_code:cityInfo.postal,
      latitude:Number.isFinite(lat)?lat:null,
      longitude:Number.isFinite(lng)?lng:null,
      source_url:detailUrl,
      operational_status:"active",
      allow_same_address:isAdditionalOfficialUnitAtSameAddress
    };
    const g=grouped.get(city.id)??{cityId:city.id,cityName:city.name,state:cityInfo.state,units:[]};
    g.units.push(unit);grouped.set(city.id,g);parsedCount++;
  }

  await supabase.from("business_data_sources").upsert({
    code:SOURCE_CODE,
    name:"Smart Fit Brasil - localizador oficial",
    source_type:"official_api",
    domain:"smartfit.com.br",
    base_url:API_BASE,
    priority:100,
    is_active:true
  },{onConflict:"code"});
  await supabase.from("business_networks").update({website_url:"https://www.smartfit.com.br",updated_at:new Date().toISOString()}).eq("slug",NETWORK_SLUG);

  const groups=[...grouped.values()];
  const results=await mapLimit(groups,10,async g=>{
    const {data,error}=await supabase.rpc("admin_import_network_units",{
      p_network_slug:NETWORK_SLUG,
      p_source_code:SOURCE_CODE,
      p_city_id:g.cityId,
      p_category_id:CATEGORY_ID,
      p_units:g.units,
      p_publish:true
    });
    return error?{city:g.cityName,state:g.state,status:"failed",units:g.units.length,error:error.message}:{city:g.cityName,state:g.state,...data};
  });

  let created=0,matched=0,duplicates=0,errors=0,found=0;
  for(const r of results){
    if((r as any).status==="failed"){errors+=(r as any).units||1;continue}
    found+=Number((r as any).total_found??0);
    created+=Number((r as any).created??0);
    matched+=Number((r as any).matched??0);
    duplicates+=Number((r as any).duplicate_candidates??0);
    errors+=Array.isArray((r as any).errors)?(r as any).errors.length:0;
  }

  return json({
    source_locations_raw:allLocations.length,
    unique_open_units:unique.size,
    parsed_units:parsedCount,
    cities:groups.length,
    requested_ufs:targetUfs,
    states:states.length,
    unmatched_count:unmatched.length,
    unmatched:unmatched.slice(0,30),
    fetch_errors:fetchErrors,
    source_stats:sourceStats,
    totals:{found,created,matched,duplicate_candidates:duplicates,errors}
  });
});