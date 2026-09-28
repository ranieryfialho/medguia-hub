-- Popula configuracoes_sistema com os dados da Contratada extraídos do
-- documento oficial "Condições Gerais para Prestação de Serviços
-- Fisioterápicos e Ortopédicos". Substitui o fallback fixo que existia no
-- código (contratada-padrao.ts) — a partir daqui os PDFs (contrato/recibo)
-- devem ler só da tabela, via Configurações > Dados da Clínica.
insert into public.configuracoes_sistema (chave, valor, atualizado_em) values
  ('clinica_nome',               'FISIORTOTERAPIA ORTOPEDIA E FISIOTERAPIA LTDA.', now()),
  ('clinica_cnpj',                '40.050.187/0001-52',                            now()),
  ('clinica_especialidade',       'Fisioterapia e Ortopedia',                      now()),
  ('clinica_endereco',            'Rua Felipe Nery',                               now()),
  ('clinica_endereco_numero',     '1012',                                          now()),
  ('clinica_endereco_bairro',     'Guararapes',                                    now()),
  ('clinica_endereco_cidade',     'Fortaleza',                                     now()),
  ('clinica_endereco_estado',     'CE',                                            now()),
  ('clinica_endereco_cep',        '60810-310',                                     now())
on conflict (chave) do update
  set valor = excluded.valor,
      atualizado_em = excluded.atualizado_em;
