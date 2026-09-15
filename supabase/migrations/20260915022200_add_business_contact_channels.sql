begin;

alter table public.businesses
  add column phone_e164 text
    check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$'),
  add column instagram_url text
    check (
      instagram_url is null
      or (
        char_length(instagram_url) <= 500
        and instagram_url ~* '^https://www[.]instagram[.]com/.+'
      )
    ),
  add column facebook_url text
    check (
      facebook_url is null
      or (
        char_length(facebook_url) <= 500
        and facebook_url ~* '^https://www[.]facebook[.]com/.+'
      )
    );

comment on column public.businesses.phone_e164 is
  'Telefone público opcional da loja, normalizado no formato E.164.';
comment on column public.businesses.instagram_url is
  'URL pública opcional do perfil da loja no Instagram.';
comment on column public.businesses.facebook_url is
  'URL pública opcional da página da loja no Facebook.';

create or replace function private.guard_business_moderation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  privileged_actor boolean;
  privileged_fields_changed boolean;
  moderated_content_changed boolean;
begin
  privileged_actor :=
    current_user::text in ('postgres', 'service_role', 'supabase_admin')
    or private.is_admin();

  privileged_fields_changed :=
    new.owner_id is distinct from old.owner_id
    or new.status is distinct from old.status
    or new.publication_status is distinct from old.publication_status
    or new.plan is distinct from old.plan
    or new.featured_until is distinct from old.featured_until
    or new.moderation_note is distinct from old.moderation_note
    or new.moderated_at is distinct from old.moderated_at
    or new.moderated_by is distinct from old.moderated_by;

  if not privileged_actor and privileged_fields_changed then
    raise exception using
      errcode = '42501',
      message = 'Campos de moderação, publicação e plano são exclusivos da administração.';
  end if;

  if privileged_actor and privileged_fields_changed then
    if new.status is distinct from old.status then
      if new.status = 'pending' then
        new.moderation_note := null;
        new.moderated_at := null;
        new.moderated_by := null;
      else
        new.moderated_at := coalesce(new.moderated_at, now());
        new.moderated_by := coalesce(new.moderated_by, (select auth.uid()));
      end if;
    end if;

    return new;
  end if;

  moderated_content_changed :=
    new.city_id is distinct from old.city_id
    or new.category_id is distinct from old.category_id
    or new.slug is distinct from old.slug
    or new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.whatsapp_e164 is distinct from old.whatsapp_e164
    or new.phone_e164 is distinct from old.phone_e164
    or new.public_email is distinct from old.public_email
    or new.website_url is distinct from old.website_url
    or new.instagram_url is distinct from old.instagram_url
    or new.facebook_url is distinct from old.facebook_url
    or new.street is distinct from old.street
    or new.address_number is distinct from old.address_number
    or new.complement is distinct from old.complement
    or new.neighborhood is distinct from old.neighborhood
    or new.postal_code is distinct from old.postal_code
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or new.logo_path is distinct from old.logo_path
    or new.cover_path is distinct from old.cover_path;

  if moderated_content_changed and old.status in ('approved', 'rejected') then
    new.status := 'pending';
    new.moderation_note := null;
    new.moderated_at := null;
    new.moderated_by := null;

    if old.status = 'rejected' then
      new.publication_status := 'published';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_business_moderation()
from public, anon, authenticated;

commit;
