-- Atualiza templates de SMS: usa link curto (/c/{token}) gerado pelo servidor.
-- A URL curta (ex: hub.medguia.cloud/c/Xk8mP2qR) não aciona filtros de spam
-- das operadoras brasileiras, ao contrário das URLs longas com UUID.

UPDATE templates_mensagem
SET conteudo = 'Instituto FOT: Olá {{nome}}! Lembramos sua consulta de {{tipo}} com {{profissional}} em {{data}} às {{hora}}. Confirme: {{link_confirmacao}} ou responda SIM. Para cancelar, responda NÃO.'
WHERE nome = 'Lembrete de consulta'
  AND categoria = 'confirmacao_sms'
  AND criado_por IS NULL;

UPDATE templates_mensagem
SET conteudo = 'Instituto FOT: {{nome}}, sua consulta de {{tipo}} está marcada para {{data}} às {{hora}} com {{profissional}}. Confirme: {{link_confirmacao}} ou responda SIM. Precisa remarcar? Nos avise!'
WHERE nome = 'Confirmação rápida'
  AND categoria = 'confirmacao_sms'
  AND criado_por IS NULL;

UPDATE templates_mensagem
SET conteudo = 'Instituto FOT: Olá {{nome}}! Passando para lembrar da sua sessão {{sessao}} de {{tipo}} em {{data}} às {{hora}} com {{profissional}}. Confirme: {{link_confirmacao}} ou responda SIM.'
WHERE nome = 'Lembrete de sessão'
  AND categoria = 'confirmacao_sms'
  AND criado_por IS NULL;
