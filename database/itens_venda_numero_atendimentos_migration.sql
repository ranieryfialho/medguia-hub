alter table public.itens_venda
  add column if not exists numero_atendimentos integer;

update public.itens_venda iv
set numero_atendimentos = p.numero_atendimentos
from public.produtos p
where iv.produto_id = p.id
  and iv.numero_atendimentos is null;

alter table public.itens_venda
  drop constraint if exists itens_venda_numero_atendimentos_check;

alter table public.itens_venda
  add constraint itens_venda_numero_atendimentos_check
  check (numero_atendimentos is null or numero_atendimentos >= 1);
