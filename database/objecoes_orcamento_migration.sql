-- Cadastro de objeções (motivos) usadas ao criar um orçamento em vendas.
-- Segue o mesmo padrão enxuto da tabela `protocolos` (nome + ativo + ordem).

CREATE TABLE IF NOT EXISTS public.objecoes_orcamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.objecoes_orcamento (nome, ordem) VALUES
  ('Preço alto', 1),
  ('Vai pensar / decidir depois', 2),
  ('Buscando outras opções', 3),
  ('Questões financeiras / parcelamento', 4),
  ('Falta de tempo / disponibilidade', 5),
  ('Não viu necessidade do tratamento', 6),
  ('Motivo de saúde', 7),
  ('Outro', 8)
ON CONFLICT (nome) DO NOTHING;

-- Objeção registrada no momento em que uma venda é salva como orçamento pendente.
-- objecao_motivo_id referencia o cadastro (pode virar NULL se a objeção for excluída);
-- objecao_motivo_nome é o nome "congelado" no momento da venda, para o histórico e
-- os relatórios não mudarem se o cadastro for renomeado ou removido depois
-- (mesmo padrão já usado em vendas.protocolo_id / vendas.protocolo_nome).
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS objecao_motivo_id uuid REFERENCES public.objecoes_orcamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS objecao_motivo_nome text,
  ADD COLUMN IF NOT EXISTS objecao_observacao text;

COMMENT ON COLUMN public.vendas.objecao_motivo_nome IS 'Nome da objeção no momento da venda (congelado, independe de renomear/excluir o cadastro depois).';
COMMENT ON COLUMN public.vendas.objecao_observacao IS 'Observação livre sobre a objeção, informada ao criar o orçamento.';
