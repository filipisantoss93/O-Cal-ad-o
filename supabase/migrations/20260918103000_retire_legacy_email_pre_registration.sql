begin;

-- O fluxo antigo vinculava automaticamente uma vitrine ao usuário apenas pelo
-- e-mail pré-cadastrado. O fluxo atual exige uma reivindicação aprovada pelo admin.
drop trigger if exists users_claim_pre_registered_businesses on auth.users;

do $$
begin
  if to_regclass('public.business_claims') is not null then
    execute 'drop trigger if exists business_claims_claim_existing_user on public.business_claims';
  end if;
end
$$;

drop function if exists private.claim_pre_registered_business_after_claim_change();
drop function if exists private.claim_pre_registered_businesses_after_auth_change();
drop function if exists private.claim_pre_registered_businesses(uuid, text);

-- Os registros em public.businesses permanecem intactos. Assim, lojas ainda sem
-- proprietário continuam como perfis não reivindicados e seguem o fluxo atual.
drop table if exists public.business_claims;

commit;
