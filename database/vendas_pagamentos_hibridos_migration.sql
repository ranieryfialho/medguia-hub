-- Permite registrar mais de uma forma de pagamento por venda (pagamento híbrido).
--
-- Antes: `vendas.forma_pagamento` guardava uma única forma. Agora o detalhamento
-- completo vive em `pagamentos_venda` (1:N). `vendas.forma_pagamento` continua
-- existindo como resumo derivado — o valor da forma quando há só 1 pagamento,
-- ou 'hibrido' quando há 2 ou mais. Isso mantém funcionando tudo que ainda lê a
-- coluna escalar (listagem, filtros legados) sem migração em massa.
--
-- Formato de cada linha: { forma_pagamento, valor, parcelas }. `parcelas` só
-- tem sentido para 'cartao_credito', mas fica sempre presente (default 1).

create table if not exists public.pagamentos_venda (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  forma_pagamento text not null check (forma_pagamento in (
    'pix',
    'cartao_credito',
    'cartao_debito',
    'dinheiro',
    'transferencia',
    'boleto'
  )),
  valor numeric(10,2) not null check (valor >= 0),
  parcelas integer not null default 1 check (parcelas >= 1),
  criado_em timestamptz not null default now()
);

create index if not exists idx_pagamentos_venda_venda_id on public.pagamentos_venda(venda_id);

comment on table public.pagamentos_venda is
  'Detalhamento dos pagamentos de uma venda. Uma venda com pagamento único tem 1 linha; uma venda híbrida tem 2+.';

alter table public.vendas
  drop constraint if exists vendas_forma_pagamento_check;

alter table public.vendas
  add constraint vendas_forma_pagamento_check
  check (forma_pagamento in (
    'pix',
    'cartao_credito',
    'cartao_debito',
    'dinheiro',
    'transferencia',
    'boleto',
    'hibrido'
  ));

-- Habilita RLS e replica o padrão de policy já usado em itens_venda.
-- Antes de rodar em produção, confirme o texto exato das policies existentes com:
--   select policyname, cmd, qual, with_check from pg_policies where tablename = 'itens_venda';
-- e ajuste os nomes/roles abaixo se divergirem.
alter table public.pagamentos_venda enable row level security;

drop policy if exists "pagamentos_venda_select_authenticated" on public.pagamentos_venda;
create policy "pagamentos_venda_select_authenticated"
  on public.pagamentos_venda for select
  to authenticated
  using (true);

drop policy if exists "pagamentos_venda_insert_authenticated" on public.pagamentos_venda;
create policy "pagamentos_venda_insert_authenticated"
  on public.pagamentos_venda for insert
  to authenticated
  with check (true);

drop policy if exists "pagamentos_venda_update_authenticated" on public.pagamentos_venda;
create policy "pagamentos_venda_update_authenticated"
  on public.pagamentos_venda for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "pagamentos_venda_delete_authenticated" on public.pagamentos_venda;
create policy "pagamentos_venda_delete_authenticated"
  on public.pagamentos_venda for delete
  to authenticated
  using (true);

-- Backfill: cada venda existente vira 1 linha em pagamentos_venda, com o valor
-- total calculado a partir de itens_venda (idempotente — não duplica se já
-- houver linhas para a venda).
insert into public.pagamentos_venda (venda_id, forma_pagamento, valor)
select v.id, v.forma_pagamento, coalesce(sum(iv.quantidade * iv.preco_unitario), 0)
from public.vendas v
left join public.itens_venda iv on iv.venda_id = v.id
where not exists (select 1 from public.pagamentos_venda pv where pv.venda_id = v.id)
group by v.id, v.forma_pagamento;
