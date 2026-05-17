create table if not exists public.protocolos_atendimento (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists protocolos_atendimento_nome_unique
  on public.protocolos_atendimento (lower(nome));

create table if not exists public.protocolo_atendimento_itens (
  id uuid primary key default gen_random_uuid(),
  protocolo_atendimento_id uuid not null references public.protocolos_atendimento(id) on delete cascade,
  tipo_consulta_id uuid not null references public.tipos_consulta(id) on delete cascade,
  quantidade integer not null default 1,
  constraint protocolo_atendimento_itens_quantidade_positive check (quantidade > 0)
);
