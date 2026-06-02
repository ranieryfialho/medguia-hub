-- Atualiza templates de SMS: texto puro com número do WhatsApp para confirmação.
-- URLs bloqueadas por operadoras brasileiras via número +1 (Twilio error 30007).
-- Paciente confirma diretamente pelo WhatsApp +55 85 8193-1488.

UPDATE templates_mensagem
SET conteudo = 'Instituto FOT: Olá {{nome}}! Lembramos sua consulta de {{tipo}} com {{profissional}} em {{data}} às {{hora}}. Para confirmar ou cancelar, entre em contato pelo WhatsApp: (85) 8193-1488.'
WHERE nome = 'Lembrete de consulta'
  AND categoria = 'confirmacao_sms'
  AND criado_por IS NULL;

UPDATE templates_mensagem
SET conteudo = 'Instituto FOT: {{nome}}, sua consulta de {{tipo}} está marcada para {{data}} às {{hora}} com {{profissional}}. Confirme ou remarque pelo WhatsApp: (85) 8193-1488.'
WHERE nome = 'Confirmação rápida'
  AND categoria = 'confirmacao_sms'
  AND criado_por IS NULL;

UPDATE templates_mensagem
SET conteudo = 'Instituto FOT: Olá {{nome}}! Lembramos sua sessão {{sessao}} de {{tipo}} em {{data}} às {{hora}} com {{profissional}}. Confirme pelo WhatsApp: (85) 8193-1488.'
WHERE nome = 'Lembrete de sessão'
  AND categoria = 'confirmacao_sms'
  AND criado_por IS NULL;
