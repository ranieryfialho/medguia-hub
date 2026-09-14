-- Permite registrar um pagamento como "a receber depois" dentro do pagamento
-- híbrido de uma venda: o paciente dá um sinal agora e o restante fica
-- combinado para datas futuras (ex.: plano de R$ 2.000 — R$ 1.000 à vista,
-- R$ 500 em 3 dias e R$ 500 em outra data).
--
-- Cada linha de `pagamentos_venda` passa a ter um `status`: 'pago' (o padrão,
-- comportamento de sempre) ou 'pendente' (dinheiro ainda não recebido, com
-- `data_vencimento` combinada). A soma de todas as linhas — pagas ou
-- pendentes — continua batendo com o total da venda; é isso que já valida
-- `validarPagamentos`. Nada muda no faturamento: pendente também soma no
-- total da venda, só não conta como dinheiro em caixa até ser baixado.

alter table public.pagamentos_venda
  add column if not exists status text not null default 'pago'
    check (status in ('pago', 'pendente'));

alter table public.pagamentos_venda
  add column if not exists data_vencimento date null;

alter table public.pagamentos_venda
  add column if not exists pago_em timestamptz null;

alter table public.pagamentos_venda
  drop constraint if exists pagamentos_venda_pendente_tem_vencimento;

alter table public.pagamentos_venda
  add constraint pagamentos_venda_pendente_tem_vencimento
  check (status <> 'pendente' or data_vencimento is not null);

create index if not exists idx_pagamentos_venda_pendentes
  on public.pagamentos_venda(data_vencimento)
  where status = 'pendente';

comment on column public.pagamentos_venda.status is
  'pago (padrão) ou pendente — pendente é um valor combinado mas ainda não recebido, com data_vencimento.';
comment on column public.pagamentos_venda.data_vencimento is
  'Data combinada para o recebimento do pagamento pendente. Obrigatória quando status = pendente.';
comment on column public.pagamentos_venda.pago_em is
  'Preenchido quando um pagamento pendente é marcado como recebido.';

-- Backfill: linhas existentes já são dinheiro recebido.
update public.pagamentos_venda set status = 'pago' where status is null;
