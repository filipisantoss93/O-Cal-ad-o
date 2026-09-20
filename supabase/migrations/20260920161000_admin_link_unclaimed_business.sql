begin;

-- Auditoria restrita: não é uma tabela exposta pela Data API.
create table if not exists private.admin_business_owner_assignments (
  id bigint generated always as identity primary key,
  business_id bigint not null,
  new_owner_id uuid not null,
  admin_id uuid not null,
  allowed_businesses integer not null,
  businesses_before integer not null,
  created_at timestamptz not null default now()
);
revoke all on table private.admin_business_owner_assignments from public, anon, authenticated;

-- Busca limitada no servidor, incluindo e-mail do Auth sem expor auth.users ao navegador.
create or replace function public.admin_search_business_owner_candidates(
  p_query text,
  p_limit integer default 10
)
returns table(
  user_id uuid,
  full_name text,
  email text,
  phone_e164 text,
  used_businesses integer,
  allowed_businesses integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 10);
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;

  -- Não retornar a base inteira, mesmo quando o formulário é enviado vazio.
  if char_length(v_query) < 2 or char_length(v_query) > 80 then
    return;
  end if;
  v_query := replace(replace(replace(v_query, '%', ''), '_', ''), chr(92), '');
  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  with found_users as (
    select p.id, p.full_name, p.phone_e164, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'merchant'
      and (
        p.id::text = v_query
        or p.full_name ilike '%' || v_query || '%'
        or u.email ilike '%' || v_query || '%'
        or coalesce(p.phone_e164, '') ilike '%' || v_query || '%'
      )
    order by
      case when p.id::text = v_query or lower(u.email) = lower(v_query) then 0 else 1 end,
      p.created_at desc, p.id
    limit v_limit
  )
  select s.id, s.full_name::text, s.email::text, s.phone_e164::text,
    (select count(*)::integer from public.businesses b where b.owner_id = s.id),
    private.allowed_business_count(s.id)
  from found_users s;
end;
$function$;

revoke all on function public.admin_search_business_owner_candidates(text, integer) from public, anon, authenticated;
grant execute on function public.admin_search_business_owner_candidates(text, integer) to authenticated;

-- Operação única/atômica: verifica permissão, destino, vaga e ausência de dono
-- na MESMA transação da alteração. Bloqueia o perfil para serializar vínculos simultâneos.
create or replace function public.admin_link_unclaimed_business(
  p_business_id bigint,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_user uuid;
  v_business public.businesses%rowtype;
  v_used integer;
  v_allowed integer;
begin
  if v_actor is null or not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;
  if p_business_id is null or p_business_id <= 0 or p_user_id is null then
    raise exception using errcode = '22023', message = 'Selecione uma empresa e um usuário válidos.';
  end if;

  select p.id into v_user
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id and p.role = 'merchant'
  for update of p;

  if v_user is null then
    raise exception using errcode = '22023', message = 'Usuário não encontrado ou não autorizado a possuir empresas.';
  end if;

  select * into v_business
  from public.businesses b
  where b.id = p_business_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Empresa não encontrada.';
  end if;
  if v_business.listing_type <> 'business'
    or v_business.pre_registered is not true
    or v_business.owner_id is not null then
    raise exception using errcode = '23514', message = 'A empresa já possui responsável ou não está disponível para vínculo.';
  end if;

  v_allowed := private.allowed_business_count(p_user_id);
  select count(*)::integer into v_used
  from public.businesses b
  where b.owner_id = p_user_id;

  if v_used >= v_allowed then
    raise exception using errcode = '23514',
      message = 'Limite de lojas atingido para esta conta. Vínculo não realizado.';
  end if;

  update public.businesses b
  set owner_id = p_user_id,
      pre_registered = false
  where b.id = p_business_id
    and b.owner_id is null
    and b.pre_registered is true
    and b.listing_type = 'business';

  if not found then
    raise exception using errcode = '23514', message = 'A empresa foi vinculada por outra operação. Atualize a página.';
  end if;

  -- Não deixar reivindicações anteriores pendentes para um perfil já atribuído.
  update public.business_claim_requests c
  set status = case when c.requester_id = p_user_id then 'approved' else 'rejected' end,
      admin_note = case when c.requester_id = p_user_id
        then 'Vínculo realizado diretamente pelo administrador.'
        else 'Estabelecimento vinculado administrativamente a outro usuário.' end,
      reviewed_at = now(),
      reviewed_by = v_actor
  where c.business_id = p_business_id
    and c.status = 'pending';

  perform private.reconcile_billing_entitlements(p_user_id);

  insert into private.admin_business_owner_assignments
    (business_id, new_owner_id, admin_id, allowed_businesses, businesses_before)
  values (p_business_id, p_user_id, v_actor, v_allowed, v_used);
end;
$function$;

revoke all on function public.admin_link_unclaimed_business(bigint, uuid) from public, anon, authenticated;
grant execute on function public.admin_link_unclaimed_business(bigint, uuid) to authenticated;

-- Serializa também novas lojas criadas pelo próprio comerciante contra um
-- vínculo administrativo simultâneo da mesma conta.
create or replace function private.enforce_business_billing_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
  v_allowed integer;
  v_actor uuid;
begin
  v_actor := (select auth.uid());

  if v_actor is null or private.is_admin() then
    return new;
  end if;

  if new.owner_id <> v_actor then
    raise exception using errcode = '42501', message = 'Loja não pertence ao usuário autenticado.';
  end if;

  -- Mesma trava usada no vínculo administrativo para evitar duas vagas ocupadas
  -- simultaneamente em uma conta com apenas uma vaga restante.
  perform 1 from public.profiles p where p.id = new.owner_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Perfil do responsável não encontrado.';
  end if;

  select count(*)::integer into v_count
  from public.businesses
  where owner_id = new.owner_id;

  v_allowed := private.allowed_business_count(new.owner_id);
  if v_count >= v_allowed then
    raise exception using errcode = 'P0001', message = 'BILLING_STORE_LIMIT: limite de lojas atingido para o plano atual.';
  end if;
  return new;
end;
$function$;

commit;
