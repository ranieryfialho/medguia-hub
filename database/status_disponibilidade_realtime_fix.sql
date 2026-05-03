-- Corrige a base do realtime de disponibilidade para que:
-- 1. cada profissional tenha no maximo uma linha materializada;
-- 2. o cron automatico consiga voltar de "ocupado" sem sobrescrever status manual;
-- 3. consultas da equipe inicializem linhas faltantes para o Realtime.

begin;

alter table public.status_disponibilidade
  add column if not exists origem text not null default 'manual';

alter table public.status_disponibilidade
  drop constraint if exists status_disponibilidade_origem_check;

alter table public.status_disponibilidade
  add constraint status_disponibilidade_origem_check
  check (origem in ('manual', 'automatico'));

alter table public.status_disponibilidade
  drop constraint if exists status_disponibilidade_status_check;

alter table public.status_disponibilidade
  add constraint status_disponibilidade_status_check
  check (status in ('disponivel', 'reuniao', 'ocupado', 'ausente'));

do $$
begin
  delete from public.status_disponibilidade sd
  using (
    select ctid
    from (
      select
        ctid,
        row_number() over (
          partition by profissional_id
          order by atualizado_em desc nulls last, ctid desc
        ) as rn
      from public.status_disponibilidade
    ) ranked
    where ranked.rn > 1
  ) dupes
  where sd.ctid = dupes.ctid;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.status_disponibilidade'::regclass
      and contype = 'p'
  ) then
    alter table public.status_disponibilidade
      add constraint status_disponibilidade_pkey primary key (profissional_id);
  end if;
end $$;

create or replace function public.fn_status_base_profissional(
  p_profissional_id uuid,
  p_ref timestamptz default now()
)
returns text
language sql
stable
as $$
  select case
    when exists (
      select 1
      from public.disponibilidade_profissional dp
      where dp.profissional_id = p_profissional_id
        and dp.dia_semana = extract(dow from p_ref at time zone 'America/Sao_Paulo')::int
        and dp.ativo = true
    ) then 'disponivel'
    else 'ausente'
  end
$$;

create or replace function public.fn_atualizar_status_em_atendimento()
returns void
language plpgsql
security definer
as $$
begin
  insert into public.status_disponibilidade (profissional_id, status, atualizado_em, origem)
  select distinct
    a.profissional_id,
    'ocupado',
    now(),
    'automatico'
  from public.atendimentos a
  where a.status in ('Aguardando', 'Confirmado')
    and a.data_agendamento <= now()
    and a.data_agendamento + (coalesce(a.duracao_minutos, 60) || ' minutes')::interval >= now()
  on conflict (profissional_id)
  do update set
    status = excluded.status,
    atualizado_em = excluded.atualizado_em,
    origem = excluded.origem
  where
    public.status_disponibilidade.status is distinct from excluded.status
    or public.status_disponibilidade.origem is distinct from excluded.origem;

  update public.status_disponibilidade sd
  set
    status = public.fn_status_base_profissional(sd.profissional_id, now()),
    atualizado_em = now(),
    origem = 'automatico'
  where sd.origem = 'automatico'
    and sd.status = 'ocupado'
    and not exists (
      select 1
      from public.atendimentos a
      where a.profissional_id = sd.profissional_id
        and a.status in ('Aguardando', 'Confirmado')
        and a.data_agendamento <= now()
        and a.data_agendamento + (coalesce(a.duracao_minutos, 60) || ' minutes')::interval >= now()
    );
end;
$$;

do $$
declare
  v_jobid bigint;
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    select jobid
    into v_jobid
    from cron.job
    where jobname = 'atualizar-status-em-atendimento'
    limit 1;

    if v_jobid is not null then
      perform cron.unschedule(v_jobid);
    end if;

    perform cron.schedule(
      'atualizar-status-em-atendimento',
      '* * * * *',
      'select public.fn_atualizar_status_em_atendimento()'
    );
  else
    raise notice 'pg_cron nao esta habilitado nesta instancia; habilite a extensao antes de agendar o job.';
  end if;
end $$;

create or replace function public.fn_trigger_concluir_atendimento()
returns trigger
language plpgsql
security definer
as $$
declare
  v_tem_proximo boolean;
begin
  if new.status <> 'Concluído' or old.status = 'Concluído' then
    return new;
  end if;

  select exists (
    select 1
    from public.atendimentos a
    where a.profissional_id = new.profissional_id
      and a.id <> new.id
      and a.status in ('Aguardando', 'Confirmado')
      and a.data_agendamento > now()
      and a.data_agendamento <= now() + interval '90 minutes'
  ) into v_tem_proximo;

  if not v_tem_proximo then
    insert into public.status_disponibilidade (profissional_id, status, atualizado_em, origem)
    values (
      new.profissional_id,
      public.fn_status_base_profissional(new.profissional_id, now()),
      now(),
      'automatico'
    )
    on conflict (profissional_id)
    do update set
      status = excluded.status,
      atualizado_em = excluded.atualizado_em,
      origem = excluded.origem
    where public.status_disponibilidade.origem = 'automatico';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_concluir_atendimento on public.atendimentos;

create trigger trg_concluir_atendimento
  after update on public.atendimentos
  for each row
  execute function public.fn_trigger_concluir_atendimento();

create or replace function public.fn_status_equipe_agora(p_ids uuid[])
returns table (
  profissional_id uuid,
  status text,
  atualizado_em timestamptz
)
language plpgsql
security definer
as $$
begin
  insert into public.status_disponibilidade (profissional_id, status, atualizado_em, origem)
  select
    p.id,
    public.fn_status_base_profissional(p.id, now()),
    now(),
    'automatico'
  from unnest(p_ids) as p(id)
  where not exists (
    select 1
    from public.status_disponibilidade sd
    where sd.profissional_id = p.id
  )
  on conflict (profissional_id) do nothing;

  return query
  select
    sd.profissional_id,
    sd.status,
    sd.atualizado_em
  from public.status_disponibilidade sd
  where sd.profissional_id = any(p_ids);
end;
$$;

commit;
