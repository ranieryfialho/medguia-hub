create table if not exists jornada_mensal_profissional (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profiles(id) on delete cascade,
  data date not null,
  jornada_inicio time without time zone,
  jornada_fim time without time zone,
  intervalo_inicio time without time zone,
  intervalo_fim time without time zone,
  ativo boolean not null default true,
  origem text not null default 'template'
    check (origem in ('template', 'ajuste_manual', 'folga', 'feriado', 'extra', 'afastamento')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jornada_mensal_profissional_unique unique (profissional_id, data),
  constraint jornada_mensal_profissional_horario_valido
    check (
      (
        ativo = false
        and jornada_inicio is null
        and jornada_fim is null
        and intervalo_inicio is null
        and intervalo_fim is null
      )
      or
      (
        ativo = true
        and jornada_inicio is not null
        and jornada_fim is not null
        and jornada_fim > jornada_inicio
      )
    )
);

create index if not exists jornada_mensal_profissional_profissional_data_idx
  on jornada_mensal_profissional (profissional_id, data);

create index if not exists jornada_mensal_profissional_data_idx
  on jornada_mensal_profissional (data);

create or replace function fn_jornada_mensal_profissional_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_jornada_mensal_profissional_updated_at on jornada_mensal_profissional;

create trigger trg_jornada_mensal_profissional_updated_at
  before update on jornada_mensal_profissional
  for each row
  execute function fn_jornada_mensal_profissional_set_updated_at();

alter table jornada_mensal_profissional enable row level security;

create policy authenticated_read_jornada_mensal
  on jornada_mensal_profissional
  for select
  using (auth.role() = 'authenticated');

create policy gestores_manage_all_jornada_mensal
  on jornada_mensal_profissional
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['gestor'::public.user_role, 'master'::public.user_role])
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['gestor'::public.user_role, 'master'::public.user_role])
    )
  );

create policy own_manage_jornada_mensal
  on jornada_mensal_profissional
  using (profissional_id = auth.uid())
  with check (profissional_id = auth.uid());
