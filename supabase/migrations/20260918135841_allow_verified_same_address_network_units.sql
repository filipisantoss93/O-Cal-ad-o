do $$
declare
  v_def text;
  v_old text := E'if v_business_id is null then\n        select count(*),min(b.id)';
  v_new text := E'if v_business_id is null and not coalesce(lower(v_item->>''allow_same_address'') = ''true'', false) then\n        select count(*),min(b.id)';
begin
  select pg_get_functiondef(
    'public.admin_import_network_units(text,text,bigint,bigint,jsonb,boolean)'::regprocedure
  ) into v_def;

  if (
    (length(v_def)-length(replace(v_def,v_old,''))) / length(v_old)
  ) <> 2 then
    raise exception 'Quantidade inesperada de blocos de deduplicacao.';
  end if;

  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end $$;
