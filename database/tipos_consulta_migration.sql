create table if not exists public.tipos_consulta (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tipos_consulta_nome_unique
  on public.tipos_consulta (lower(nome));

create index if not exists tipos_consulta_ativos_ordem_idx
  on public.tipos_consulta (ativo, ordem, nome);

insert into public.tipos_consulta (nome, ativo, ordem)
values
  ('FOT Fisioterapia', true, 1),
  ('FOT Avaliação', true, 2),
  ('CTA', true, 3),
  ('Consulta', true, 4),
  ('Laser', true, 5),
  ('Ondas de Choque', true, 6),
  ('Reavaliação', true, 7),
  ('Ativação Base 2026', true, 8)
on conflict ((lower(nome))) do nothing;
