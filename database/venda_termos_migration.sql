-- Tabela para registrar termos de responsabilidade gerados por venda
create table if not exists public.venda_termos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  google_drive_file_id text,
  google_drive_file_url text,
  google_drive_folder_url text,
  gerado_por uuid references auth.users(id),
  gerado_em timestamptz not null default now()
);

create index if not exists idx_venda_termos_venda_id on public.venda_termos(venda_id);
create index if not exists idx_venda_termos_paciente_id on public.venda_termos(paciente_id);

alter table public.venda_termos enable row level security;

create policy "autenticados_venda_termos"
  on public.venda_termos
  for all
  to authenticated
  using (true)
  with check (true);