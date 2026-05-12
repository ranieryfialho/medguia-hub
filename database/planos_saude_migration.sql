create table if not exists public.planos_saude (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists planos_saude_nome_unique
  on public.planos_saude (lower(nome));

create index if not exists planos_saude_ativos_ordem_idx
  on public.planos_saude (ativo, ordem, nome);

insert into public.planos_saude (nome, ativo, ordem)
values
  ('Particular', true, 1),
  ('Unimed', true, 2),
  ('IPM', true, 3),
  ('ISSEC', true, 4)
on conflict ((lower(nome))) do nothing;
