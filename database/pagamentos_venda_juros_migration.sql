-- Acréscimo de juros no parcelamento no cartão de crédito.
--
-- `pagamentos_venda.valor` continua sendo o valor líquido da venda (o que
-- soma para bater com o total dos produtos e o que entra no faturamento dos
-- relatórios) — juros de parcelamento é um custo/repasse entre o cliente e a
-- operadora de cartão, não é receita da clínica, então nunca deve ser somado
-- ao faturamento.
--
-- `valor_com_juros` é só informativo: quanto o cliente efetivamente pagou
-- (valor + juros) quando a forma é cartão de crédito parcelado. Fica NULL
-- quando não há juros ou quando a forma não é cartão de crédito.

alter table public.pagamentos_venda
  add column if not exists valor_com_juros numeric(10,2) null;

alter table public.pagamentos_venda
  drop constraint if exists pagamentos_venda_valor_com_juros_check;

alter table public.pagamentos_venda
  add constraint pagamentos_venda_valor_com_juros_check
  check (valor_com_juros is null or valor_com_juros >= valor);

comment on column public.pagamentos_venda.valor_com_juros is
  'Valor efetivamente cobrado do cliente com juros do parcelamento (informativo — nunca entra no faturamento). NULL quando não há juros.';
