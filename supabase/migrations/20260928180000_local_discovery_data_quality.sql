-- Compatibilidade para os CNPJs alfanuméricos e deduplicação segura do fallback INEP.
-- Os identificadores externos (CNPJ e CO_ENTIDADE) continuam sendo a chave primária
-- de idempotência; o endereço e complemento apenas restringem a associação a vitrines existentes.
do $migration$
declare
  function_ddl text;
  old_fragment text;
  new_fragment text;
begin
  function_ddl := pg_get_functiondef('public.import_rfb_cnpj_batch(jsonb,text)'::regprocedure);
  old_fragment := $$^[0-9]{14}$$;
  new_fragment := $$^[A-Z0-9]{12}[0-9]{2}$$;
  if position(old_fragment in function_ddl) > 0 then
    function_ddl := replace(function_ddl, old_fragment, new_fragment);
    execute function_ddl;
  elsif position(new_fragment in function_ddl) = 0 then
    raise exception 'Não foi possível localizar a validação do CNPJ na função import_rfb_cnpj_batch';
  end if;

  function_ddl := pg_get_functiondef('public.import_inep_public_school_batch(jsonb)'::regprocedure);
  old_fragment := $$and private.normalize_business_text(b.name)=private.normalize_business_text(school_name)$$;
  new_fragment := old_fragment || E'\n        and private.normalize_business_text(b.street)=private.normalize_business_text(street_name)\n        and private.normalize_business_text(b.address_number)=private.normalize_business_text(address_no)\n        and private.normalize_business_text(coalesce(b.complement, ''''))=private.normalize_business_text(coalesce(complement_text, ''''))';
  if position(old_fragment in function_ddl) > 0 then
    function_ddl := replace(function_ddl, old_fragment, new_fragment);
    execute function_ddl;
  elsif position('private.normalize_business_text(b.address_number)' in function_ddl) = 0
     or position('private.normalize_business_text(coalesce(b.complement' in function_ddl) = 0 then
    raise exception 'Não foi possível localizar o fallback de deduplicação INEP esperado';
  end if;

  old_fragment := 'found_at=now(),';
  if position(old_fragment in function_ddl) > 0 then
    function_ddl := replace(function_ddl, old_fragment, '');
    execute function_ddl;
  end if;
end;
$migration$;
