-- Adiciona suporte às categorias de SMS e Email nos templates de mensagem
-- e insere modelos padrão globais para cada canal.

-- ─── 1. Ajuste de constraint (só necessário se houver CHECK na coluna) ────────

ALTER TABLE templates_mensagem
  DROP CONSTRAINT IF EXISTS templates_mensagem_categoria_check;

ALTER TABLE templates_mensagem
  ADD CONSTRAINT templates_mensagem_categoria_check
  CHECK (categoria IN ('confirmacao', 'reativacao', 'confirmacao_sms', 'confirmacao_email'));

-- ─── 2. Templates padrão de SMS ───────────────────────────────────────────────

INSERT INTO templates_mensagem (nome, conteudo, categoria, criado_por)
VALUES
  (
    'Lembrete de consulta',
    'Olá {{nome}}! Lembramos sua consulta de {{tipo}} com {{profissional}} em {{data}} às {{hora}}. Confirme clicando: {{link_confirmacao}} ou respondendo SIM. Para cancelar, entre em contato.',
    'confirmacao_sms',
    NULL
  ),
  (
    'Confirmação rápida',
    '{{nome}}, sua consulta de {{tipo}} está marcada para {{data}} às {{hora}} com {{profissional}}. Confirme aqui: {{link_confirmacao}} ou responda SIM. Precisa remarcar? Nos avise!',
    'confirmacao_sms',
    NULL
  ),
  (
    'Lembrete de sessão',
    'Olá {{nome}}! Passando para lembrar da sua sessão {{sessao}} de {{tipo}} em {{data}} às {{hora}} com {{profissional}}. Confirme: {{link_confirmacao}}',
    'confirmacao_sms',
    NULL
  )
ON CONFLICT DO NOTHING;

-- ─── 3. Templates padrão de Email ─────────────────────────────────────────────
-- O campo `nome` é usado como assunto do email.

INSERT INTO templates_mensagem (nome, conteudo, categoria, criado_por)
VALUES
  (
    'Confirmação de consulta — {{data}}',
    'Olá, {{nome}}!

Gostaríamos de confirmar o seu agendamento:

  • Serviço: {{tipo}}
  • Data: {{data}}
  • Horário: {{hora}}
  • Profissional: {{profissional}}

Clique no botão abaixo para confirmar sua presença com um toque:

{{link_confirmacao}}

Caso precise remarcar, entre em contato pelo nosso telefone.

Aguardamos você!',
    'confirmacao_email',
    NULL
  ),
  (
    'Lembrete de consulta — {{data}}',
    'Olá, {{nome}}!

Este é um lembrete da sua consulta de {{tipo}} com {{profissional}}.

  • Data: {{data}}
  • Horário: {{hora}}

Confirme sua presença clicando aqui: {{link_confirmacao}}

Caso não possa comparecer, avise-nos com antecedência para que possamos reorganizar a agenda.

Até breve!',
    'confirmacao_email',
    NULL
  ),
  (
    'Lembrete de sessão — {{sessao}} em {{data}}',
    'Olá, {{nome}}!

Lembramos que sua sessão {{sessao}} de {{tipo}} está agendada para:

  • Data: {{data}}
  • Horário: {{hora}}
  • Profissional: {{profissional}}

Confirme sua presença: {{link_confirmacao}}

Em caso de dúvidas ou necessidade de reagendamento, entre em contato conosco.

Até lá!',
    'confirmacao_email',
    NULL
  )
ON CONFLICT DO NOTHING;

-- ─── 4. Atualiza templates já existentes com {{link_confirmacao}} ──────────────

UPDATE templates_mensagem SET conteudo =
  'Olá {{nome}}! Lembramos sua consulta de {{tipo}} com {{profissional}} em {{data}} às {{hora}}. Confirme clicando: {{link_confirmacao}} ou respondendo SIM. Para cancelar, entre em contato.'
WHERE nome = 'Lembrete de consulta' AND categoria = 'confirmacao_sms' AND criado_por IS NULL;

UPDATE templates_mensagem SET conteudo =
  '{{nome}}, sua consulta de {{tipo}} está marcada para {{data}} às {{hora}} com {{profissional}}. Confirme aqui: {{link_confirmacao}} ou responda SIM. Precisa remarcar? Nos avise!'
WHERE nome = 'Confirmação rápida' AND categoria = 'confirmacao_sms' AND criado_por IS NULL;

UPDATE templates_mensagem SET conteudo =
  'Olá {{nome}}! Passando para lembrar da sua sessão {{sessao}} de {{tipo}} em {{data}} às {{hora}} com {{profissional}}. Confirme: {{link_confirmacao}}'
WHERE nome = 'Lembrete de sessão' AND categoria = 'confirmacao_sms' AND criado_por IS NULL;

UPDATE templates_mensagem SET conteudo =
  E'Olá, {{nome}}!\n\nGostaríamos de confirmar o seu agendamento:\n\n  • Serviço: {{tipo}}\n  • Data: {{data}}\n  • Horário: {{hora}}\n  • Profissional: {{profissional}}\n\nClique no botão abaixo para confirmar sua presença com um toque:\n\n{{link_confirmacao}}\n\nCaso precise remarcar, entre em contato pelo nosso telefone.\n\nAguardamos você!'
WHERE nome = 'Confirmação de consulta — {{data}}' AND categoria = 'confirmacao_email' AND criado_por IS NULL;

UPDATE templates_mensagem SET conteudo =
  E'Olá, {{nome}}!\n\nEste é um lembrete da sua consulta de {{tipo}} com {{profissional}}.\n\n  • Data: {{data}}\n  • Horário: {{hora}}\n\nConfirme sua presença clicando aqui: {{link_confirmacao}}\n\nCaso não possa comparecer, avise-nos com antecedência para que possamos reorganizar a agenda.\n\nAté breve!'
WHERE nome = 'Lembrete de consulta — {{data}}' AND categoria = 'confirmacao_email' AND criado_por IS NULL;

UPDATE templates_mensagem SET conteudo =
  E'Olá, {{nome}}!\n\nLembramos que sua sessão {{sessao}} de {{tipo}} está agendada para:\n\n  • Data: {{data}}\n  • Horário: {{hora}}\n  • Profissional: {{profissional}}\n\nConfirme sua presença: {{link_confirmacao}}\n\nEm caso de dúvidas ou necessidade de reagendamento, entre em contato conosco.\n\nAté lá!'
WHERE nome = 'Lembrete de sessão — {{sessao}} em {{data}}' AND categoria = 'confirmacao_email' AND criado_por IS NULL;
