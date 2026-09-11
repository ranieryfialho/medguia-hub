-- Encaminhamento consulta médica <-> pré/pós-consulta de fisioterapia.
-- Vínculo feito no nível de `atendimentos` (a sessão concreta, com
-- profissional_id/data_agendamento reais), não em `agendamentos` (o
-- "molde" da série).

ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS agendamento_origem_id uuid NULL
  REFERENCES public.atendimentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atendimentos_agendamento_origem_id
  ON public.atendimentos(agendamento_origem_id);

ALTER TABLE public.atendimentos DROP CONSTRAINT IF EXISTS atendimentos_status_check;
ALTER TABLE public.atendimentos ADD CONSTRAINT atendimentos_status_check
  CHECK (status = ANY (ARRAY[
    'Aguardando','Aguardando Consulta','Confirmado','Em Atendimento',
    'Concluído','Cancelado','Falta','Reposição','Reagendado',
    'Aguardando Fisioterapeuta'
  ]));

-- Momento do encaminhamento em relação à consulta médica de origem. Criada
-- sempre como 'pre'; passa a 'pos' quando a consulta médica é concluída
-- antes da pré-consulta ter sido realizada (ver fn_marcar_pos_consulta_pendente
-- e mudarStatusAgendamento em src/actions/agenda.ts).
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS direcao_encaminhamento TEXT NULL;

ALTER TABLE public.atendimentos DROP CONSTRAINT IF EXISTS atendimentos_direcao_encaminhamento_check;
ALTER TABLE public.atendimentos ADD CONSTRAINT atendimentos_direcao_encaminhamento_check
  CHECK (direcao_encaminhamento IS NULL OR direcao_encaminhamento = ANY (ARRAY['pre', 'pos']));
