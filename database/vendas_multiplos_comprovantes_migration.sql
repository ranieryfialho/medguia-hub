-- Permite anexar mais de um comprovante de pagamento por venda.
--
-- Antes: 3 colunas escalares (comprovante_pagamento_google_drive_file_id/_url/
-- _nome) guardavam um único arquivo. Agora a lista completa vive em
-- `comprovantes_pagamento` (JSONB, array de objetos).
--
-- As colunas antigas continuam existindo e são mantidas em sincronia com o
-- PRIMEIRO item do array pelo código (src/actions/vendas.ts). Isso mantém
-- funcionando tudo que ainda lê a coluna escalar (listagem de vendas,
-- relatórios, integrações externas) sem migração em massa.
--
-- Formato de cada item:
--   { "file_id": "...", "file_url": "..." | null, "nome": "..." | null }

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS comprovantes_pagamento JSONB NULL;

COMMENT ON COLUMN vendas.comprovantes_pagamento IS
  'Array JSONB com todos os comprovantes de pagamento anexados: [{file_id, file_url, nome}]. As colunas comprovante_pagamento_* refletem o primeiro item (compatibilidade).';

-- Backfill: vendas que já tinham um comprovante viram um array de 1 item.
UPDATE vendas
SET comprovantes_pagamento = jsonb_build_array(
      jsonb_build_object(
        'file_id',  comprovante_pagamento_google_drive_file_id,
        'file_url', comprovante_pagamento_google_drive_file_url,
        'nome',     comprovante_pagamento_nome
      )
    )
WHERE comprovante_pagamento_google_drive_file_id IS NOT NULL
  AND comprovantes_pagamento IS NULL;
