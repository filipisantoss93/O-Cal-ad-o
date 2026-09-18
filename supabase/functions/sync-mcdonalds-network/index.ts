import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN_HASH = "caec7186d2264f46f018a6ee45ab34c9df2e897de9b3272dfaba744ad7cd419f";
const SOURCES = [
  {
    url: "https://cupons.mcdonalds.com.br/restaurantesparticipantes",
    label: "McDonald's Brasil - restaurantes participantes"
  },
  {
    url: "https://cupons.mcdonalds.com.br/restaurantes-participantes-mcdiafeliz",
    label: "McDonald's Brasil - McDia Feliz"
  }
] as const;
const IMPORT_SOURCE_CODE = "mcdonalds_official_national_sync";
const NETWORK_SLUG = "mcdonalds";
const CITY_ALIASES = new Map<string,string>([
  ["RJ|BUZIOS", "ARMACAO DOS BUZIOS"],
  ["RJ|CAMPOS DOS GOITACAZES", "CAMPOS DOS GOYTACAZES"],
  ["SP|EMBU", "EMBU DAS ARTES"],
  ["PE|CABO", "CABO DE SANTO AGOSTINHO"]
]);
const CATEGORY_ID = 1;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

function decodeHtml(value: string) {
  const named: Record<string,string> = {
    amp:"&", quot:'"', apos:"'", lt:"<", gt:">", nbsp:" ",
    aacute:"á", Aacute:"Á", atilde:"ã", Atilde:"Ã", acirc:"â", Acirc:"Â",
    eacute:"é", Eacute:"É", ecirc:"ê", Ecirc:"Ê", iacute:"í", Iacute:"Í",
    oacute:"ó", Oacute:"Ó", otilde:"õ", Otilde:"Õ", ocirc:"ô", Ocirc:"Ô",
    uacute:"ú", Uacute:"Ú", ccedil:"ç", Ccedil:"Ç"
  };
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n,16)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => named[n] ?? m);
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function cityKey(value: string) {
  return normalize(value).replace(/\bD[AO]S?\b/g, "").replace(/\s+/g, "");
}

function canonicalAddress(value: string) {
  let v = normalize(value)
    .replace(/^AV\b/, "AVENIDA")
    .replace(/^R\b/, "RUA")
    .replace(/^ROD\b/, "RODOVIA")
    .replace(/^PC\b/, "PRACA")
    .replace(/^EST\b/, "ESTRADA");
  v = v.replace(/\bN[O0]?\b/g, " ").replace(/\bN\b/g, " ");
  v = v.replace(/\b(\d{1,3})\.(\d{3})\b/g, "$1$2");
  return v.replace(/\s+/g, " ").trim();
}

function parseRows(html: string) {
  const rows: Array<{state:string;city:string;address:string}> = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripHtml(m[1]));
    if (cells.length >= 3) {
      const state = normalize(cells[0]).slice(0,2);
      const city = cells[1].trim();
      const address = cells.slice(2).join(" ").trim();
      if (/^[A-Z]{2}$/.test(state) && city && address && normalize(city) !== "CIDADE") rows.push({state,city,address});
    }
  }
  if (rows.length) return rows;

  const text = decodeHtml(
    html.replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
  for (const line of text.split(/\n+/)) {
    const clean = line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const m = clean.match(/^([A-Z]{2})\s*[|;-]\s*([^|;]+?)\s*[|;-]\s*(.+)$/);
    if (m) rows.push({state:m[1],city:m[2].trim(),address:m[3].trim()});
  }
  return rows;
}

function cleanNumber(raw: string) {
  const v = raw.trim().toUpperCase().replace(/N[º°?O.]?\s*/g, "").replace(/\s+/g," ");
  if (/\b(S\s*\/\s*N|N\s*\/\s*S)\b/.test(v)) return "S/N";
  const m = v.match(/\d{1,6}(?:[./]\d{1,6})?(?:-[A-Z0-9]+)?/);
  if (!m) return "S/N";
  return m[0].replace(/^(\d{1,3})\.(\d{3})$/, "$1$2").slice(0,20);
}

function parseAddress(address: string) {
  const clean = address.replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
  const comma = clean.lastIndexOf(",");
  if (comma >= 0) {
    const street = clean.slice(0,comma).trim();
    const tail = clean.slice(comma+1).trim();
    const number = cleanNumber(tail);
    let complement = tail;
    if (number === "S/N") {
      complement = tail.replace(/\b(?:S\s*\/\s*N|N\s*\/\s*S)\b/i,"").replace(/^[-–—\s]+|[-–—\s]+$/g,"").trim();
    } else {
      const p = tail.toUpperCase().indexOf(number.toUpperCase());
      if (p >= 0) complement = (tail.slice(0,p) + " " + tail.slice(p + number.length)).replace(/^[-–—\s]+|[-–—\s]+$/g,"").trim();
    }
    return {street: street.slice(0,160), number, complement: complement ? complement.slice(0,120) : null};
  }
  const m = clean.match(/^(.*?)(?:\s+N[º°?O.]?\s*)?(\d{1,6}(?:[./]\d{1,6})?(?:-[A-Z0-9]+)?)\s*$/i);
  if (m) return {street:m[1].trim().slice(0,160), number:cleanNumber(m[2]), complement:null};
  return {street:clean.slice(0,160), number:"S/N", complement:null};
}

async function stableCode(state:string, city:string, address:string) {
  const digest = await sha256(state + "|" + normalize(city) + "|" + canonicalAddress(address));
  return "NAT-" + state + "-" + digest.slice(0,16).toUpperCase();
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({error:"Método não permitido."},405);
  const token = request.headers.get("X-Network-Sync-Token") ?? "";
  if (!token || await sha256(token) !== TOKEN_HASH) return json({error:"Não autorizado."},403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const key = adminKey();
  if (!supabaseUrl || !key) return json({error:"Ambiente Supabase indisponível."},500);
  const supabase = createClient(supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});

  let body: Record<string,unknown> = {};
  try { body = await request.json(); } catch {}
  const seedMissingOnly = body.seed_missing_only !== false;
  const maxCities = Math.max(1, Math.min(Number(body.max_cities ?? 500), 500));

  const parsed: Array<{state:string;city:string;address:string;sourceUrl:string}> = [];
  const sourceBreakdown: Array<{url:string;rows:number}> = [];
  for (const source of SOURCES) {
    const sourceResponse = await fetch(source.url,{
      headers:{
        "Accept":"text/html,application/xhtml+xml",
        "Accept-Language":"pt-BR,pt;q=0.9",
        "User-Agent":"O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)"
      },
      signal:AbortSignal.timeout(20000)
    });
    if (!sourceResponse.ok) {
      return json({error:"Falha ao carregar fonte oficial.",url:source.url,status:sourceResponse.status},502);
    }
    const rows = parseRows(await sourceResponse.text());
    if (rows.length < 20) {
      return json({error:"Formato inesperado da fonte oficial.",url:source.url,parsed:rows.length},502);
    }
    sourceBreakdown.push({url:source.url,rows:rows.length});
    parsed.push(...rows.map((row)=>({...row,sourceUrl:source.url})));
  }

  const {data:network,error:networkError} = await supabase
    .from("business_networks").select("id").eq("slug",NETWORK_SLUG).maybeSingle();
  if (networkError || !network) return json({error:"Rede McDonald's não encontrada."},500);

  await supabase.from("business_data_sources").upsert({
    code:IMPORT_SOURCE_CODE,
    name:"McDonald's Brasil - sincronização nacional de fontes oficiais",
    source_type:"official_site",
    domain:"mcdonalds.com.br",
    base_url:SOURCES[0].url,
    priority:100,
    is_active:true
  },{onConflict:"code"});

  const existingCityIds = new Set<number>();
  if (seedMissingOnly) {
    let from = 0;
    const step = 1000;
    while (true) {
      const {data,error} = await supabase
        .from("business_source_records")
        .select("city_id")
        .eq("network_id",network.id)
        .not("city_id","is",null)
        .range(from,from+step-1);
      if (error) return json({error:"Falha ao consultar cidades já importadas.",detail:error.message},500);
      for (const row of data ?? []) if (row.city_id) existingCityIds.add(Number(row.city_id));
      if (!data || data.length < step) break;
      from += step;
    }
  }

  const states = [...new Set(parsed.map((r)=>r.state))].sort();
  const cityMaps = new Map<string,Map<string,{id:number;name:string;state_code:string}>>();
  for (const state of states) {
    const {data,error} = await supabase
      .from("cities")
      .select("id,name,state_code")
      .eq("state_code",state)
      .eq("is_active",true)
      .limit(1000);
    if (error) return json({error:"Falha ao carregar cidades.",state,detail:error.message},500);
    const map = new Map<string,{id:number;name:string;state_code:string}>();
    for (const city of data ?? []) map.set(cityKey(city.name),{id:Number(city.id),name:city.name,state_code:city.state_code});
    cityMaps.set(state,map);
  }

  const grouped = new Map<string,{cityId:number;cityName:string;state:string;rows:Array<{state:string;city:string;address:string;sourceUrl:string}>}>();
  const unmatchedCities = new Set<string>();
  const duplicatesInSource: string[] = [];
  const seenAddress = new Set<string>();

  for (const row of parsed) {
    const alias = CITY_ALIASES.get(row.state + "|" + normalize(row.city));
    const city = cityMaps.get(row.state)?.get(cityKey(alias ?? row.city));
    if (!city) { unmatchedCities.add(row.state + "|" + row.city); continue; }
    if (seedMissingOnly && existingCityIds.has(city.id)) continue;

    const addrKey = row.state + "|" + city.id + "|" + canonicalAddress(row.address);
    if (seenAddress.has(addrKey)) { duplicatesInSource.push(addrKey); continue; }
    seenAddress.add(addrKey);

    const groupKey = String(city.id);
    const current = grouped.get(groupKey) ?? {cityId:city.id,cityName:city.name,state:row.state,rows:[]};
    current.rows.push(row);
    grouped.set(groupKey,current);
  }

  const groups = [...grouped.values()].sort((a,b)=>a.state.localeCompare(b.state)||a.cityName.localeCompare(b.cityName)).slice(0,maxCities);
  const results: Array<Record<string,unknown>> = [];
  let created = 0, matched = 0, duplicateCandidates = 0, errors = 0, totalFound = 0;

  for (const group of groups) {
    const units = [];
    for (const row of group.rows) {
      const parsedAddress = parseAddress(row.address);
      const code = await stableCode(row.state,row.city,row.address);
      const shortStreet = parsedAddress.street
        .replace(/^AVENIDA\s+/i,"Av. ")
        .replace(/^RODOVIA\s+/i,"Rod. ")
        .replace(/^ESTRADA\s+/i,"Estr. ")
        .replace(/^PRACA\s+/i,"Praça ");
      units.push({
        external_unit_code:code,
        unit_name:(shortStreet + ", " + parsedAddress.number).slice(0,200),
        business_name:("McDonald's - " + shortStreet + ", " + parsedAddress.number).slice(0,120),
        street:parsedAddress.street,
        address_number:parsedAddress.number,
        complement:parsedAddress.complement,
        neighborhood:"Não informado",
        source_url:row.sourceUrl,
        operational_status:"unknown"
      });
    }

    const {data,error} = await supabase.rpc("admin_import_network_units",{
      p_network_slug:NETWORK_SLUG,
      p_source_code:IMPORT_SOURCE_CODE,
      p_city_id:group.cityId,
      p_category_id:CATEGORY_ID,
      p_units:units,
      p_publish:true
    });
    if (error) {
      errors += units.length;
      results.push({city:group.cityName,state:group.state,status:"failed",error:error.message,units:units.length});
      continue;
    }
    totalFound += Number(data?.total_found ?? units.length);
    created += Number(data?.created ?? 0);
    matched += Number(data?.matched ?? 0);
    duplicateCandidates += Number(data?.duplicate_candidates ?? 0);
    errors += Array.isArray(data?.errors) ? data.errors.length : 0;
    results.push({city:group.cityName,state:group.state,...data});
  }

  return json({
    source_rows:parsed.length,
    source_breakdown:sourceBreakdown,
    source_states:states,
    eligible_cities:grouped.size,
    processed_cities:groups.length,
    skipped_existing_city_count:existingCityIds.size,
    source_exact_duplicates_skipped:duplicatesInSource.length,
    unmatched_cities:[...unmatchedCities].sort(),
    totals:{found:totalFound,created,matched,duplicate_candidates:duplicateCandidates,errors},
    results
  });
});
