-- Bloqueios pontuais de horário dentro de um dia (múltiplos por dia), independentes do
-- template semanal. Ex.: almoço 12h-13h + reunião 15h-16h no mesmo dia. Complementa o
-- bloqueio de dia inteiro que já existe via jornada_mensal_profissional.ativo = false.
create table if not exists jornada_mensal_bloqueio (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profiles(id) on delete cascade,
  data date not null,
  hora_inicio time without time zone not null,
  hora_fim time without time zone not null,
  motivo text not null,
  created_at timestamptz not null default now(),
  constraint jornada_mensal_bloqueio_horario_valido check (hora_fim > hora_inicio)
);

create index if not exists jornada_mensal_bloqueio_profissional_data_idx
  on jornada_mensal_bloqueio (profissional_id, data);

alter table jornada_mensal_bloqueio enable row level security;

-- Mesmo padrão de jornada_mensal_profissional / disponibilidade_profissional (já corrigido
-- em fix_jornada_mensal_rls_gestor.sql): gestor é role gestor/master OU nivel_acesso
-- gestor/master, não só role. drop if exists antes de cada create pra o script poder
-- rodar de novo sem erro (create policy não aceita "if not exists").
drop policy if exists authenticated_read_jornada_mensal_bloqueio on jornada_mensal_bloqueio;
drop policy if exists gestores_manage_all_jornada_mensal_bloqueio on jornada_mensal_bloqueio;
drop policy if exists own_manage_jornada_mensal_bloqueio on jornada_mensal_bloqueio;

create policy authenticated_read_jornada_mensal_bloqueio
  on jornada_mensal_bloqueio
  for select
  using (auth.role() = 'authenticated');

create policy gestores_manage_all_jornada_mensal_bloqueio
  on jornada_mensal_bloqueio
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and (
          profiles.role = any (array['gestor'::public.user_role, 'master'::public.user_role])
          or profiles.nivel_acesso in ('gestor', 'master')
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and (
          profiles.role = any (array['gestor'::public.user_role, 'master'::public.user_role])
          or profiles.nivel_acesso in ('gestor', 'master')
        )
    )
  );

create policy own_manage_jornada_mensal_bloqueio
  on jornada_mensal_bloqueio
  using (profissional_id = auth.uid())
  with check (profissional_id = auth.uid());

-- Confirmação (deve listar 3 policies, ambas ALL com with_check preenchido):
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'jornada_mensal_bloqueio'
order by policyname;
