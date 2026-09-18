revoke execute on function public.get_public_business_logo_paths(bigint[])
from anon, authenticated;

grant execute on function public.get_public_business_logo_paths(bigint[])
to service_role;

comment on function public.get_public_business_logo_paths(bigint[]) is
'RPC interno para resolução de logos públicas. Acesso externo deve passar pela Edge Function resolve-business-logos.';
