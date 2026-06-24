-- Adiciona a categoria 'aniversario' ao constraint da tabela templates_mensagem
ALTER TABLE templates_mensagem
  DROP CONSTRAINT IF EXISTS templates_mensagem_categoria_check;

ALTER TABLE templates_mensagem
  ADD CONSTRAINT templates_mensagem_categoria_check
  CHECK (categoria IN ('confirmacao', 'reativacao', 'confirmacao_sms', 'confirmacao_email', 'aniversario'));

-- Insere 3 templates globais padrão de aniversário (criado_por IS NULL = visível a todos)
INSERT INTO templates_mensagem (nome, conteudo, categoria, criado_por) VALUES
(
  'Parabéns — Simples',
  E'Olá, {{nome}}! 🎂\n\nA equipe da clínica deseja a você um feliz aniversário!\n\nQue este novo ano seja repleto de saúde e conquistas. Você é muito especial para nós! 💚',
  'aniversario',
  NULL
),
(
  'Parabéns — Com Idade',
  E'Feliz aniversário, {{nome}}! 🎉\n\nHoje você completa {{idade}} anos e toda a nossa equipe está comemorando junto com você!\n\nDesejamos muita saúde, felicidade e que possamos continuar cuidando de você por muitos anos. 🌟',
  'aniversario',
  NULL
),
(
  'Parabéns — Dia da Semana',
  E'Olá, {{nome}}! 🎂\n\nSua equipe de saúde está lembrando que nesta {{dia_semana}} é o seu aniversário!\n\nParabéns! Que você tenha um dia incrível e que sua saúde continue em dia. Estamos aqui sempre que precisar! 💚',
  'aniversario',
  NULL
)
ON CONFLICT DO NOTHING;
