-- Tabela de configurações do sistema (OAuth tokens, IDs de pasta raiz, etc.)
create table if not exists public.configuracoes_sistema (
  chave text primary key,
  valor text,
  atualizado_em timestamptz not null default now()
);

-- Tabela para rastrear pastas de pacientes no Google Drive
create table if not exists public.paciente_pastas_drive (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  google_drive_folder_id text not null,
  google_drive_folder_url text not null,
  criado_em timestamptz not null default now(),
  constraint paciente_pastas_drive_paciente_unique unique(paciente_id)
);

-- Tabela para rastrear pastas de atendimentos no Google Drive
create table if not exists public.atendimento_pastas_drive (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  google_drive_folder_id text not null,
  google_drive_folder_url text not null,
  criado_em timestamptz not null default now(),
  constraint atendimento_pastas_drive_atendimento_unique unique(atendimento_id)
);

create index if not exists idx_paciente_pastas_drive_paciente_id
  on public.paciente_pastas_drive(paciente_id);

create index if not exists idx_atendimento_pastas_drive_atendimento_id
  on public.atendimento_pastas_drive(atendimento_id);

create index if not exists idx_atendimento_pastas_drive_paciente_id
  on public.atendimento_pastas_drive(paciente_id);

-- RLS
alter table public.configuracoes_sistema enable row level security;
alter table public.paciente_pastas_drive enable row level security;
alter table public.atendimento_pastas_drive enable row level security;

-- configuracoes_sistema: somente service role (tokens OAuth são dados sensíveis)
create policy "service_role_configuracoes_sistema"
  on public.configuracoes_sistema
  for all
  using (true)
  with check (true);

-- paciente_pastas_drive: usuários autenticados
create policy "autenticados_paciente_pastas_drive"
  on public.paciente_pastas_drive
  for all
  to authenticated
  using (true)
  with check (true);

-- atendimento_pastas_drive: usuários autenticados
create policy "autenticados_atendimento_pastas_drive"
  on public.atendimento_pastas_drive
  for all
  to authenticated
  using (true)
  with check (true);

-- Função para buscar pacientes sem pasta no Drive (usada na migração em lotes)
create or replace function public.buscar_pacientes_sem_pasta_drive(p_limit integer default 50)
returns table (id uuid, nome text)
language sql
security definer
as $$
  select p.id, p.nome
  from public.pacientes p
  where p.ativo = true
  and not exists (
    select 1 from public.paciente_pastas_drive ppd
    where ppd.paciente_id = p.id
  )
  order by p.id
  limit p_limit;
$$;

-- Função para contar pacientes sem pasta no Drive
create or replace function public.contar_pacientes_sem_pasta_drive()
returns bigint
language sql
security definer
as $$
  select count(*)
  from public.pacientes p
  where p.ativo = true
  and not exists (
    select 1 from public.paciente_pastas_drive ppd
    where ppd.paciente_id = p.id
  );
$$;
