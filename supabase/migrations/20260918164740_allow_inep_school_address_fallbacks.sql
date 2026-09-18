do $patch$
declare
  fn text;
  patched text;
begin
  select pg_get_functiondef(p.oid)
  into fn
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='import_inep_public_school_batch'
  limit 1;

  if fn is null then
    raise exception 'Função import_inep_public_school_batch não encontrada';
  end if;

  patched := replace(
    fn,
    $old$
      address_no := nullif(btrim(row_data->>'NU_ENDERECO'),'');
      complement_text := nullif(btrim(row_data->>'DS_COMPLEMENTO'),'');
      neighborhood_name := nullif(btrim(row_data->>'NO_BAIRRO'),'');
$old$,
    $new$
      address_no := coalesce(nullif(btrim(row_data->>'NU_ENDERECO'),''),'S/N');
      complement_text := nullif(btrim(row_data->>'DS_COMPLEMENTO'),'');
      neighborhood_name := coalesce(
        nullif(btrim(row_data->>'NO_BAIRRO'),''),
        case
          when coalesce(row_data->>'TP_LOCALIZACAO','')='2' then 'Zona Rural'
          else 'Não informado'
        end
      );
$new$
  );

  patched := replace(
    patched,
    $old$
      if street_name is null or length(street_name) < 2
         or address_no is null or length(address_no) < 1
         or neighborhood_name is null or length(neighborhood_name) < 2
      then
        ignored_count := ignored_count + 1;
        error_items := error_items || jsonb_build_array(
          jsonb_build_object('school_code',school_code,'reason','incomplete_address')
        );
        continue;
      end if;
$old$,
    $new$
      if street_name is null or length(street_name) < 2
      then
        ignored_count := ignored_count + 1;
        error_items := error_items || jsonb_build_array(
          jsonb_build_object('school_code',school_code,'reason','missing_street')
        );
        continue;
      end if;
$new$
  );

  if patched = fn then
    raise exception 'Nenhuma alteração aplicada à função INEP';
  end if;

  execute patched;
end
$patch$;

revoke all on function public.import_inep_public_school_batch(jsonb)
from public,anon,authenticated;
grant execute on function public.import_inep_public_school_batch(jsonb)
to service_role;
