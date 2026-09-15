alter table public.catalog_items
  add column if not exists contact_action text not null default 'whatsapp';

alter table public.catalog_items
  add column if not exists contact_url text;

alter table public.catalog_items
  drop constraint if exists catalog_items_contact_action_check;

alter table public.catalog_items
  add constraint catalog_items_contact_action_check
  check (contact_action in ('whatsapp', 'phone', 'link'));

alter table public.catalog_items
  drop constraint if exists catalog_items_contact_url_length_check;

alter table public.catalog_items
  add constraint catalog_items_contact_url_length_check
  check (contact_url is null or char_length(contact_url) <= 500);

alter table public.promotions
  add column if not exists contact_action text not null default 'whatsapp';

alter table public.promotions
  add column if not exists contact_url text;

alter table public.promotions
  drop constraint if exists promotions_contact_action_check;

alter table public.promotions
  add constraint promotions_contact_action_check
  check (contact_action in ('whatsapp', 'phone', 'link'));

alter table public.promotions
  drop constraint if exists promotions_contact_url_length_check;

alter table public.promotions
  add constraint promotions_contact_url_length_check
  check (contact_url is null or char_length(contact_url) <= 500);
