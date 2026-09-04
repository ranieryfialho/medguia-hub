-- Adiciona qualificação da venda (Fisioterápica/Médica) e dados do
-- comprovante de pagamento anexado no Google Drive.
--
-- tipo_venda: nullable — vendas antigas ficam sem classificação, sem quebrar
-- nada. A obrigatoriedade para novas vendas/edições é garantida em código
-- (src/actions/vendas.ts), no mesmo padrão de `status`/`forma_pagamento`.
--
-- comprovante_pagamento_*: preenchido a partir do upload feito no mesmo
-- esquema de mídias já usado para pacientes/atendimentos (rota
-- /api/drive/upload, pasta em paciente_pastas_drive). Obrigatório apenas
-- quando status = 'venda_confirmada', validado em código.

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS tipo_venda TEXT NULL,
  ADD COLUMN IF NOT EXISTS comprovante_pagamento_google_drive_file_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS comprovante_pagamento_google_drive_file_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS comprovante_pagamento_nome TEXT NULL;

COMMENT ON COLUMN vendas.tipo_venda IS
  'Qualificação da venda: ''fisioterapica'' ou ''medica''. NULL = venda legada, anterior à introdução do campo.';

COMMENT ON COLUMN vendas.comprovante_pagamento_google_drive_file_id IS
  'ID do arquivo no Google Drive (pasta do paciente) com o comprovante de pagamento. Obrigatório em código quando status = venda_confirmada.';
