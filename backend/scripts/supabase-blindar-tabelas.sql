-- Blindagem das tabelas no Supabase — rode no SQL Editor do projeto.
--
-- POR QUÊ: o Supabase publica automaticamente uma API REST (PostgREST) sobre o
-- schema `public`, e concede acesso às roles `anon` e `authenticated` por
-- default privileges. A chave `anon` é pública por definição (vai no frontend).
-- Como as tabelas aqui são criadas pelo migrationRunner via Knex, elas nascem
-- SEM Row Level Security — ou seja, a contabilidade dos clientes ficaria
-- legível em
--     https://<project-ref>.supabase.co/rest/v1/companies?select=*
-- para qualquer pessoa com a chave anon.
--
-- O QUE ISTO FAZ: liga RLS em todas as tabelas do schema `public` e não cria
-- nenhuma policy. Sem policy, as roles `anon`/`authenticated` não veem nada. O
-- backend não é afetado: ele conecta como dona das tabelas, e no PostgreSQL a
-- dona ignora RLS (a menos que se use FORCE ROW LEVEL SECURITY, que não usamos).
--
-- Rodar de novo é seguro: só mexe no que ainda não tem RLS.
--
-- Se algum dia você quiser expor uma tabela via API do Supabase, aí sim escreva
-- uma policy explícita para ela — de forma consciente, tabela por tabela.

DO $$
DECLARE
  tabela record;
  total int := 0;
BEGIN
  FOR tabela IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'          -- só tabelas comuns
       AND c.relrowsecurity = false -- ainda sem RLS
     ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela.relname);
    RAISE NOTICE 'RLS habilitado: %', tabela.relname;
    total := total + 1;
  END LOOP;

  RAISE NOTICE '% tabela(s) blindada(s).', total;
END $$;

-- Reforço: tira os privilégios das roles públicas do PostgREST. RLS já barra a
-- leitura, mas sem GRANT nem o metadado da tabela é exposto. O bloco é
-- condicional porque `anon`/`authenticated` só existem em projetos Supabase.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    RAISE NOTICE 'Privilégios da role anon revogados no schema public.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    RAISE NOTICE 'Privilégios da role authenticated revogados no schema public.';
  END IF;
END $$;

-- Conferência: nenhuma linha deve aparecer aqui depois de rodar.
SELECT c.relname AS tabela_sem_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relrowsecurity = false
 ORDER BY 1;
