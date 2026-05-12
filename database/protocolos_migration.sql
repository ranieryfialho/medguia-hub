-- Tabela de protocolos (templates de venda)
create table if not exists public.protocolos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists protocolos_nome_unique
  on public.protocolos (lower(nome));

-- Itens padrão de cada protocolo
create table if not exists public.protocolo_itens (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references public.protocolos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  quantidade integer not null default 1,
  constraint protocolo_itens_quantidade_positive check (quantidade > 0)
);

-- Permite nomear uma venda (pre-preenchido ao selecionar protocolo)
alter table public.vendas
  add column if not exists nome text default null;
