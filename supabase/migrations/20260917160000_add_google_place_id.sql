alter table public.businesses
  add column if not exists google_place_id text;

create unique index if not exists businesses_google_place_id_unique
  on public.businesses (google_place_id)
  where google_place_id is not null;

comment on column public.businesses.google_place_id is
  'Google Places place ID. Only the place ID is persisted; rating content is fetched live and is not stored.';
