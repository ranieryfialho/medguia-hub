-- Cadastro de origens de venda, gerenciável pelo comercial em /vendas/origens.
-- Substitui a lista fixa (medico, leads, indicacao, renovacao, campanha) que
-- estava duplicada no front e no banco. Mesmo padrão de objecoes_orcamento.
--
-- `valor` é o identificador estável gravado em vendas.origem (nunca muda,
-- mesmo que o `nome` seja renomeado — o histórico e os relatórios continuam
-- casando). `sistema` marca origens com regra de negócio no código
-- (medico → médico referenciador / venda em consultório): não podem ser
-- excluídas nem desativadas.

CREATE TABLE IF NOT EXISTS public.origens_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor text NOT NULL UNIQUE,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  sistema boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.origens_venda (valor, nome, ordem, sistema) VALUES
  ('medico', 'Médico', 1, true),
  ('leads', 'Leads', 2, false),
  ('indicacao', 'Indicação', 3, false),
  ('renovacao', 'Renovação', 4, false),
  ('campanha', 'Campanha', 5, false)
ON CONFLICT (valor) DO NOTHING;

-- Mesmo critério de objecoes_orcamento: o acesso é controlado na aplicação.
ALTER TABLE public.origens_venda DISABLE ROW LEVEL SECURITY;

-- Se vendas.origem tinha um CHECK com a lista fixa, ele impediria origens novas.
-- (vendas_consultorio_apenas_origem_medico é outra regra e é preservada.)
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.vendas'::regclass
      AND contype = 'c'
      AND conname <> 'vendas_consultorio_apenas_origem_medico'
      AND pg_get_constraintdef(oid) ILIKE '%origem%'
      AND pg_get_constraintdef(oid) ILIKE '%leads%'
  LOOP
    EXECUTE format('ALTER TABLE public.vendas DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- fn_vendas_resumo_mensal e fn_vendas_detalhe_mes validavam p_origem contra a
-- lista fixa. Troca só essa validação pela consulta ao cadastro, sem recriar o
-- corpo das funções. Idempotente: se a lista fixa já não existe, não faz nada.
DO $$
DECLARE
  fn text;
  def text;
  novo text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['fn_vendas_resumo_mensal', 'fn_vendas_detalhe_mes'] LOOP
    FOR def IN
      SELECT pg_get_functiondef(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      novo := replace(
        def,
        'p_origem NOT IN (''medico'', ''leads'', ''indicacao'', ''renovacao'', ''campanha'')',
        'NOT EXISTS (SELECT 1 FROM public.origens_venda ov WHERE ov.valor = p_origem)'
      );
      IF novo <> def THEN
        EXECUTE novo;
      END IF;
    END LOOP;
  END LOOP;
END $$;
