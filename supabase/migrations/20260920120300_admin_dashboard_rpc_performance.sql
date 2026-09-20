-- O dashboard agregado deve retornar totais nacionais ao administrador autorizado.
-- A execução como invoker fazia mais de 100 mil linhas atravessarem as
-- políticas RLS do catálogo repetidamente, causando falhas intermitentes no PWA.
-- A função já valida auth.uid() e private.is_admin() ANTES de ler qualquer dado;
-- private.is_admin() exige a conta administradora autorizada no auth.users.
-- O proprietário da função é postgres, que pode executar as agregações sem RLS.
-- Mantemos search_path vazio, argumentos fixos e EXECUTE somente para authenticated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_dashboard_metrics'
      AND pg_get_function_identity_arguments(p.oid) = 'p_days integer'
      AND pg_get_functiondef(p.oid) LIKE '%private.is_admin()%'
      AND pg_get_functiondef(p.oid) LIKE '%auth.uid()%'
      AND pg_get_userbyid(p.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'admin_dashboard_metrics: verifique o guard de permissao e o owner antes da alteracao';
  END IF;
END;
$$;

ALTER FUNCTION public.admin_dashboard_metrics(integer) SECURITY DEFINER;
ALTER FUNCTION public.admin_dashboard_metrics(integer) SET search_path = '';
REVOKE ALL ON FUNCTION public.admin_dashboard_metrics(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics(integer) TO authenticated;
