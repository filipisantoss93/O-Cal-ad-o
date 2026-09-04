-- Corrige o escape das expressões regulares E.164 da migration inicial.
begin;

alter table public.profiles
drop constraint profiles_phone_e164_check;

alter table public.profiles
add constraint profiles_phone_e164_check
check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$');

alter table public.businesses
drop constraint businesses_whatsapp_e164_check;

alter table public.businesses
add constraint businesses_whatsapp_e164_check
check (whatsapp_e164 ~ '^[+][1-9][0-9]{7,14}$');

commit;
