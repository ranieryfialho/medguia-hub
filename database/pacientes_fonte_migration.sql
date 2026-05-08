-- Adiciona coluna `fonte` para distinguir cadastros feitos via sistema
-- dos registros importados via seeds/SQL.
--
-- Após rodar, novos cadastros via app receberão 'sistema' automaticamente.
-- Os registros das seeds (inseridos em 29/04/2026 e 01/05/2026) serão
-- marcados como 'importacao'.

ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS fonte text;

-- Marca registros das seeds pelas datas de inserção em lote
-- 2026-04-07: seed_pacientes.sql (371 registros, sem origem/nasc/genero)
-- 2026-04-27: import com origem pré-preenchida (4658 registros, sem nasc/genero)
-- 2026-04-29: seed_clientes_excel.sql (3262 registros, sem origem/nasc/genero)
-- 2026-05-02: seed_base2022.sql (973 registros, sem origem/nasc/genero)
UPDATE pacientes
SET fonte = 'importacao'
WHERE created_at::date IN ('2026-04-07', '2026-04-27', '2026-04-29', '2026-05-02')
  AND fonte IS NULL;

-- Todos os demais registros pré-existentes sem marcação = sistema
UPDATE pacientes
SET fonte = 'sistema'
WHERE fonte IS NULL;

-- Garante default para novos cadastros
ALTER TABLE pacientes ALTER COLUMN fonte SET DEFAULT 'sistema';
