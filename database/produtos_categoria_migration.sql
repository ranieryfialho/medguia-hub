alter table public.produtos
  add column if not exists categoria text
    check (categoria in ('tratamento', 'consulta'))
    default null;

create index if not exists produtos_categoria_idx
  on public.produtos (categoria)
  where categoria is not null;
