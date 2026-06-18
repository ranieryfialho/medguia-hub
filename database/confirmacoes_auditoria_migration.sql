-- Tabela de auditoria de ações de confirmação
CREATE TABLE IF NOT EXISTS confirmacoes_auditoria (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID    NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  tipo        TEXT        NOT NULL,   -- 'status_alterado' | 'whatsapp_enviado' | 'sms_enviado' | 'email_enviado'
  descricao   TEXT        NOT NULL,
  usuario_id  UUID        REFERENCES auth.users(id),
  usuario_nome TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB
);

CREATE INDEX IF NOT EXISTS confirmacoes_auditoria_atendimento_idx ON confirmacoes_auditoria(atendimento_id);
CREATE INDEX IF NOT EXISTS confirmacoes_auditoria_criado_em_idx   ON confirmacoes_auditoria(criado_em DESC);

ALTER TABLE confirmacoes_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler auditoria" ON confirmacoes_auditoria
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem inserir auditoria" ON confirmacoes_auditoria
  FOR INSERT TO authenticated WITH CHECK (true);

-- Service role ignora RLS, mas deixamos explícito para clareza
CREATE POLICY "Service role tem acesso total" ON confirmacoes_auditoria
  FOR ALL TO service_role USING (true) WITH CHECK (true);
