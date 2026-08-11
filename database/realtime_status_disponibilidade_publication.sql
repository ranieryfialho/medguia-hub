-- ─── Migration: pôr status_disponibilidade na publicação do Realtime ──────────
-- Feature: status-personalizados-ciclo-vida (T-019 / AC-028) · Fecha Q-002
--
-- O ACHADO (11/08/2026, via diagnostico_realtime_status.sql):
--
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime'
--     AND tablename IN ('status_disponibilidade', 'atendimentos');
--   → devolveu SÓ 'atendimentos'
--
-- status_disponibilidade está FORA da publicação. Não é que os updates do
-- pg_cron não propagam — NENHUM update propaga, nem os feitos pela aplicação.
-- Os outros três elos da corrente estão sadios: pubupdate = true, replica
-- identity 'd', e a política "Leitura autenticados" (SELECT true para
-- authenticated) permite a entrega ao assinante.
--
-- POR QUE SÓ ELA FICOU DE FORA. A diferença entre as duas tabelas é a forma
-- como cada uma entrou:
--
--   · atendimentos            → bloco DO $$ guardado por pg_publication_tables,
--                               em fn_status_equipe_agora_v2.sql
--   · status_disponibilidade  → `alter publication ... add table` solto, em
--                               status_disponibilidade_migration.sql:26
--
-- Na mudança para o self-hosted (junho/2026) a publicação foi recriada do zero.
-- Reaplicar as migrations trouxe de volta só o que era reexecutável: o bloco
-- guardado rodou de novo sem erro; o comando solto teria falhado com "table is
-- already member of publication" na primeira vez e, na recriação, ninguém o
-- rodou isolado.
--
-- A LIÇÃO, e o motivo de esta migration copiar aquele formato: um comando que
-- não pode ser reexecutado não é uma migration, é um comando avulso. Ele
-- funciona uma vez e desaparece do processo.
--
-- POR QUANTO TEMPO FICOU QUEBRADO. Desde junho, em silêncio. O widget e a tela
-- de Configurações continuaram corretos porque useRealtimeDisponibilidade tem
-- polling de 60s como rede. O card da agenda, que subiu em 10/08 sem rede,
-- ficou congelado no estado do carregamento da página — ver AC-029.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname    = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'status_disponibilidade'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.status_disponibilidade;
    RAISE NOTICE 'status_disponibilidade adicionada à publicação supabase_realtime';
  ELSE
    RAISE NOTICE 'status_disponibilidade já estava na publicação — nada a fazer';
  END IF;
END $$;

-- ─── Conferência ──────────────────────────────────────────────────────────────
-- ESPERADO: duas linhas — status_disponibilidade E atendimentos.
-- Se vier só uma, o bloco acima não teve efeito; investigue antes de seguir.
SELECT schemaname,
       tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('status_disponibilidade', 'atendimentos')
ORDER BY tablename;

-- A replica identity continua suficiente para o payload `new`?
-- ESPERADO: 'd' (default, chave primária) ou 'f'. 'n' silenciaria o UPDATE.
SELECT c.relname      AS tabela,
       c.relreplident AS replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'status_disponibilidade';
