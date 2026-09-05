import { inflateRawSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error("Informe o caminho do arquivo de migration.");
}

const urls = {
  states:
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
  cities:
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome",
  boundaries:
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio",
  matoGrosso2025:
    "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2025/UFs/MT/MT_Municipios_2025.zip",
};

const timezoneByState = {
  AC: "America/Rio_Branco",
  AL: "America/Maceio",
  AM: "America/Manaus",
  AP: "America/Belem",
  BA: "America/Bahia",
  CE: "America/Fortaleza",
  DF: "America/Sao_Paulo",
  ES: "America/Sao_Paulo",
  GO: "America/Sao_Paulo",
  MA: "America/Fortaleza",
  MG: "America/Sao_Paulo",
  MS: "America/Campo_Grande",
  MT: "America/Cuiaba",
  PA: "America/Belem",
  PB: "America/Fortaleza",
  PE: "America/Recife",
  PI: "America/Fortaleza",
  PR: "America/Sao_Paulo",
  RJ: "America/Sao_Paulo",
  RN: "America/Fortaleza",
  RO: "America/Porto_Velho",
  RR: "America/Boa_Vista",
  RS: "America/Sao_Paulo",
  SC: "America/Sao_Paulo",
  SE: "America/Maceio",
  SP: "America/Sao_Paulo",
  TO: "America/Araguaina",
};

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "O-Calcadao-location-sync/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "O-Calcadao-location-sync/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function municipalityState(city) {
  return (
    city["regiao-imediata"]?.["regiao-intermediaria"]?.UF ??
    city.microrregiao?.mesorregiao?.UF
  );
}

function unzipEntries(archive) {
  let eocdOffset = -1;
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Arquivo ZIP do IBGE inválido.");

  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  let cursor = archive.readUInt32LE(eocdOffset + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Diretório do ZIP do IBGE inválido.");
    }
    const compression = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const fileNameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const fileName = archive
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8");

    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const contentOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(
      contentOffset,
      contentOffset + compressedSize,
    );
    const content =
      compression === 0
        ? Buffer.from(compressed)
        : compression === 8
          ? inflateRawSync(compressed)
          : null;
    if (!content) {
      throw new Error(`Compressão ZIP não suportada: ${compression}`);
    }
    entries.set(fileName, content);
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function dbfRecordIndex(dbf, expectedCode) {
  const recordCount = dbf.readUInt32LE(4);
  const headerLength = dbf.readUInt16LE(8);
  const recordLength = dbf.readUInt16LE(10);
  const fields = [];
  let fieldOffset = 1;

  for (let cursor = 32; dbf[cursor] !== 0x0d; cursor += 32) {
    const name = dbf
      .subarray(cursor, cursor + 11)
      .toString("latin1")
      .replace(/\0.*$/, "")
      .trim();
    const length = dbf[cursor + 16];
    fields.push({ name, offset: fieldOffset, length });
    fieldOffset += length;
  }

  const codeField = fields.find((field) =>
    ["CD_MUN", "CD_GEOCMU", "GEOCODIGO"].includes(field.name),
  );
  if (!codeField) throw new Error("Código municipal não encontrado no DBF.");

  for (let index = 0; index < recordCount; index += 1) {
    const offset = headerLength + index * recordLength;
    if (dbf[offset] === 0x2a) continue;
    const code = dbf
      .subarray(
        offset + codeField.offset,
        offset + codeField.offset + codeField.length,
      )
      .toString("latin1")
      .trim();
    if (code === expectedCode) return index;
  }
  throw new Error(`Município ${expectedCode} não encontrado na malha 2025.`);
}

function signedArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area +=
      ring[index][0] * ring[index + 1][1] -
      ring[index + 1][0] * ring[index][1];
  }
  return area / 2;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function ringsToGeometry(rings) {
  let outerRings = rings.filter((ring) => signedArea(ring) < 0);
  let holes = rings.filter((ring) => signedArea(ring) >= 0);
  if (outerRings.length === 0) {
    outerRings = rings;
    holes = [];
  }

  const polygons = outerRings.map((ring) => [ring]);
  for (const hole of holes) {
    const polygon = polygons.find(([outer]) => pointInRing(hole[0], outer));
    if (polygon) polygon.push(hole);
    else polygons.push([hole]);
  }

  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

function shapefileGeometry(shp, expectedRecordIndex) {
  let cursor = 100;
  let recordIndex = 0;
  while (cursor + 8 <= shp.length) {
    const contentLength = shp.readUInt32BE(cursor + 4) * 2;
    const bodyOffset = cursor + 8;
    if (recordIndex === expectedRecordIndex) {
      const shapeType = shp.readInt32LE(bodyOffset);
      if (![5, 15, 25].includes(shapeType)) {
        throw new Error(`Tipo de shape municipal não suportado: ${shapeType}`);
      }
      const partCount = shp.readInt32LE(bodyOffset + 36);
      const pointCount = shp.readInt32LE(bodyOffset + 40);
      const parts = Array.from({ length: partCount }, (_, index) =>
        shp.readInt32LE(bodyOffset + 44 + index * 4),
      );
      const pointsOffset = bodyOffset + 44 + partCount * 4;
      const rings = parts.map((start, index) => {
        const end = parts[index + 1] ?? pointCount;
        const ring = [];
        for (let pointIndex = start; pointIndex < end; pointIndex += 1) {
          ring.push([
            shp.readDoubleLE(pointsOffset + pointIndex * 16),
            shp.readDoubleLE(pointsOffset + pointIndex * 16 + 8),
          ]);
        }
        if (
          ring.length > 0 &&
          (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])
        ) {
          ring.push([...ring[0]]);
        }
        return ring;
      });
      return ringsToGeometry(rings);
    }
    cursor = bodyOffset + contentLength;
    recordIndex += 1;
  }
  throw new Error("Registro municipal não encontrado no SHP.");
}

async function boaEsperancaBoundary() {
  const archive = await fetchBuffer(urls.matoGrosso2025);
  const entries = unzipEntries(archive);
  const shpEntry = [...entries.entries()].find(([name]) =>
    name.toLowerCase().endsWith(".shp"),
  );
  const dbfEntry = [...entries.entries()].find(([name]) =>
    name.toLowerCase().endsWith(".dbf"),
  );
  if (!shpEntry || !dbfEntry) {
    throw new Error("Malha SHP/DBF de Mato Grosso não encontrada.");
  }
  const recordIndex = dbfRecordIndex(dbfEntry[1], "5101837");
  return shapefileGeometry(shpEntry[1], recordIndex);
}

const [rawStates, rawCities, rawBoundaries, boaEsperancaGeometry] =
  await Promise.all([
    fetchJson(urls.states),
    fetchJson(urls.cities),
    fetchJson(urls.boundaries),
    boaEsperancaBoundary(),
  ]);

const states = rawStates.map((state) => ({
  code: state.sigla,
  ibge_code: state.id,
  slug: slugify(state.nome),
  name: state.nome,
  region_code: state.regiao.sigla,
  region_name: state.regiao.nome,
}));

const cities = rawCities.map((city) => {
  const state = municipalityState(city);
  if (!state) throw new Error(`UF ausente para o município ${city.id}.`);
  return {
    ibge_code: city.id,
    slug: `${slugify(city.nome)}-${state.sigla.toLowerCase()}`,
    name: city.nome,
    state_code: state.sigla,
    timezone: timezoneByState[state.sigla] ?? "America/Sao_Paulo",
  };
});

const boundaryIds = new Set(
  rawBoundaries.features.map((feature) => String(feature.properties.codarea)),
);
if (!boundaryIds.has("5101837")) {
  rawBoundaries.features.push({
    type: "Feature",
    properties: { codarea: "5101837" },
    geometry: boaEsperancaGeometry,
  });
}

if (states.length !== 27 || cities.length !== 5571) {
  throw new Error(
    `Quantidade inesperada do IBGE: ${states.length} UFs e ${cities.length} municípios.`,
  );
}
if (rawBoundaries.features.length !== 5571) {
  throw new Error(
    `Quantidade inesperada de polígonos: ${rawBoundaries.features.length}.`,
  );
}

const coreSql = `-- Estados e municípios do Brasil (IBGE 2025).
begin;

create extension if not exists postgis with schema extensions;

create table public.states (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  ibge_code smallint not null unique check (ibge_code between 11 and 53),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  region_code text not null check (region_code in ('N', 'NE', 'CO', 'SE', 'S')),
  region_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.states enable row level security;

create trigger states_set_updated_at
before update on public.states
for each row execute function private.set_updated_at();

create policy states_public_read
on public.states for select
to anon, authenticated
using (is_active = true);

create policy states_admin_manage
on public.states for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.states from public, anon, authenticated;
grant select on public.states to anon, authenticated;
grant insert, update, delete on public.states to authenticated;

insert into public.states (
  code, ibge_code, slug, name, region_code, region_name
)
select
  item.code,
  item.ibge_code,
  item.slug,
  item.name,
  item.region_code,
  item.region_name
from jsonb_to_recordset($states$${JSON.stringify(states)}$states$::jsonb) as item(
  code text,
  ibge_code smallint,
  slug text,
  name text,
  region_code text,
  region_name text
)
on conflict (code) do update set
  ibge_code = excluded.ibge_code,
  slug = excluded.slug,
  name = excluded.name,
  region_code = excluded.region_code,
  region_name = excluded.region_name,
  is_active = true;

insert into public.cities (
  ibge_code, slug, name, state_code, timezone
)
select
  item.ibge_code,
  item.slug,
  item.name,
  item.state_code,
  item.timezone
from jsonb_to_recordset($cities$${JSON.stringify(cities)}$cities$::jsonb) as item(
  ibge_code integer,
  slug text,
  name text,
  state_code text,
  timezone text
)
on conflict (ibge_code) do update set
  slug = excluded.slug,
  name = excluded.name,
  state_code = excluded.state_code,
  timezone = excluded.timezone,
  is_active = true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cities_state_code_fkey'
      and conrelid = 'public.cities'::regclass
  ) then
    alter table public.cities
      add constraint cities_state_code_fkey
      foreign key (state_code) references public.states(code)
      on update cascade on delete restrict;
  end if;
end;
$$;

create index if not exists cities_state_name_idx
on public.cities (state_code, name)
where is_active = true;

create table private.city_boundaries (
  city_id bigint primary key
    references public.cities(id) on delete cascade,
  ibge_code integer not null unique,
  boundary extensions.geometry(MultiPolygon, 4326) not null,
  updated_at timestamptz not null default now()
);

alter table private.city_boundaries enable row level security;
revoke all on private.city_boundaries from public, anon, authenticated;

create index city_boundaries_boundary_idx
on private.city_boundaries using gist (boundary);

commit;
`;

function boundarySql(features, batchNumber, batchCount) {
  return `-- Malhas municipais do Brasil (IBGE 2025), lote ${batchNumber}/${batchCount}.
begin;

with features as (
  select jsonb_array_elements(
    ($boundaries$${JSON.stringify({ type: "FeatureCollection", features })}$boundaries$::jsonb) -> 'features'
  ) as feature
), prepared as (
  select
    (feature -> 'properties' ->> 'codarea')::integer as ibge_code,
    extensions.st_multi(
      extensions.st_collectionextract(
        extensions.st_makevalid(
          extensions.st_setsrid(
            extensions.st_geomfromgeojson((feature -> 'geometry')::text),
            4326
          )
        ),
        3
      )
    )::extensions.geometry(MultiPolygon, 4326) as boundary
  from features
)
insert into private.city_boundaries (city_id, ibge_code, boundary)
select city.id, prepared.ibge_code, prepared.boundary
from prepared
join public.cities as city using (ibge_code)
where not extensions.st_isempty(prepared.boundary)
on conflict (city_id) do update set
  ibge_code = excluded.ibge_code,
  boundary = excluded.boundary,
  updated_at = now();

commit;
`;
}

const resolverSql = `-- Identificação do município a partir das coordenadas do dispositivo.
begin;

create or replace function public.resolve_city_by_coordinates(
  input_latitude double precision,
  input_longitude double precision
)
returns table (
  id bigint,
  ibge_code integer,
  name text,
  state_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_point as (
    select extensions.st_setsrid(
      extensions.st_point(input_longitude, input_latitude),
      4326
    ) as value
    where input_latitude between -90 and 90
      and input_longitude between -180 and 180
  )
  select city.id, city.ibge_code, city.name, city.state_code
  from private.city_boundaries as city_boundary
  join public.cities as city on city.id = city_boundary.city_id
  cross join current_point
  where city.is_active = true
    and city_boundary.boundary operator(extensions.&&) current_point.value
    and extensions.st_covers(city_boundary.boundary, current_point.value)
  order by extensions.st_area(city_boundary.boundary) asc
  limit 1;
$$;

revoke all on function public.resolve_city_by_coordinates(
  double precision, double precision
) from public, anon, authenticated;
grant execute on function public.resolve_city_by_coordinates(
  double precision, double precision
) to anon, authenticated;

comment on function public.resolve_city_by_coordinates(
  double precision, double precision
) is 'Retorna somente a cidade pública correspondente às coordenadas; não persiste a localização recebida.';

analyze public.states;
analyze public.cities;
analyze private.city_boundaries;

commit;
`;

const maxBatchBytes = 260_000;
const boundaryBatches = [];
let currentBatch = [];
let currentBatchBytes = 0;

for (const feature of rawBoundaries.features) {
  const featureBytes = Buffer.byteLength(JSON.stringify(feature), "utf8");
  if (currentBatch.length > 0 && currentBatchBytes + featureBytes > maxBatchBytes) {
    boundaryBatches.push(currentBatch);
    currentBatch = [];
    currentBatchBytes = 0;
  }
  currentBatch.push(feature);
  currentBatchBytes += featureBytes;
}
if (currentBatch.length > 0) boundaryBatches.push(currentBatch);

const migrationName = basename(outputPath);
const match = migrationName.match(/^(\d{14})_(.+)\.sql$/);
if (!match) {
  throw new Error("O arquivo deve seguir o padrão AAAAMMDDhhmmss_nome.sql.");
}

const [, timestamp, migrationSuffix] = match;
const baseDate = new Date(
  `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`,
);
const outputDirectory = dirname(outputPath);
const migrationPath = (offset, suffix) => {
  const date = new Date(baseDate.getTime() + offset * 1000);
  const version = date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return join(outputDirectory, `${version}_${suffix}.sql`);
};

writeFileSync(migrationPath(0, migrationSuffix), coreSql, "utf8");
boundaryBatches.forEach((features, index) => {
  writeFileSync(
    migrationPath(index + 1, `add_brazil_boundaries_${String(index + 1).padStart(2, "0")}`),
    boundarySql(features, index + 1, boundaryBatches.length),
    "utf8",
  );
});
writeFileSync(
  migrationPath(boundaryBatches.length + 1, "add_city_coordinate_resolver"),
  resolverSql,
  "utf8",
);

console.log(
  `${boundaryBatches.length + 2} migrations geradas com ${states.length} UFs, ${cities.length} municípios e ${rawBoundaries.features.length} polígonos.`,
);
