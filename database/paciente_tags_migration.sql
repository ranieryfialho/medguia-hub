-- Tags de paciente: catálogo gerenciável (nome, cor, ordem) + vínculos N:N com pacientes
-- Exibidas na lista de pacientes e na jornada do paciente (página de detalhe)

-- ─── 1. Catálogo de tags ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paciente_tags (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT        NOT NULL,
  cor         TEXT        NOT NULL DEFAULT 'slate',
  ordem       INT         NOT NULL DEFAULT 0,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paciente_tags_nome_ativo
  ON paciente_tags (lower(nome))
  WHERE ativo = true;

ALTER TABLE paciente_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticados" ON paciente_tags;
CREATE POLICY "Leitura autenticados"
  ON paciente_tags FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Escrita gestores" ON paciente_tags;
CREATE POLICY "Escrita gestores"
  ON paciente_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role IN ('gestor', 'master') OR nivel_acesso IN ('gestor', 'master'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role IN ('gestor', 'master') OR nivel_acesso IN ('gestor', 'master'))
    )
  );

-- ─── 2. Vínculo paciente <-> tag ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paciente_tags_vinculos (
  paciente_id UUID        NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tag_id      UUID        NOT NULL REFERENCES paciente_tags(id) ON DELETE CASCADE,
  criado_por  UUID,
  criado_em   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (paciente_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_paciente_tags_vinculos_tag_id ON paciente_tags_vinculos(tag_id);

ALTER TABLE paciente_tags_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticados" ON paciente_tags_vinculos;
CREATE POLICY "Leitura autenticados"
  ON paciente_tags_vinculos FOR SELECT
  TO authenticated
  USING (true);

-- Atribuir/remover tags de um paciente é operação do dia a dia (não é
-- gerenciamento do catálogo), liberada para qualquer usuário autenticado.
DROP POLICY IF EXISTS "Escrita autenticados" ON paciente_tags_vinculos;
CREATE POLICY "Escrita autenticados"
  ON paciente_tags_vinculos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
