-- ─── 1. Adiciona 'ausente' ao check constraint ───────────────────────────────
alter table status_disponibilidade
  drop constraint if exists status_disponibilidade_status_check;

alter table status_disponibilidade
  add constraint status_disponibilidade_status_check
  check (status in ('disponivel', 'reuniao', 'ocupado', 'ausente'));

-- ─── 2. Function: atualiza ocupado para quem tem atendimento em curso ─────────
create or replace function fn_atualizar_status_em_atendimento()
returns void
language plpgsql
security definer
as $$
begin
  insert into status_disponibilidade (profissional_id, status, atualizado_em)
  select distinct
    profissional_id,
    'ocupado',
    now()
  from atendimentos
  where
    status in ('Aguardando', 'Aguardando Consulta', 'Confirmado')
    and data_agendamento <= now()
    and data_agendamento + (coalesce(duracao_minutos, 60) || ' minutes')::interval >= now()
  on conflict (profissional_id)
  do update set
    status = 'ocupado',
    atualizado_em = now()
  where status_disponibilidade.status <> 'ocupado';
end;
$$;

-- ─── 3. pg_cron: roda a cada minuto ──────────────────────────────────────────
select cron.schedule(
  'atualizar-status-em-atendimento',
  '* * * * *',
  'select fn_atualizar_status_em_atendimento()'
);

-- ─── 4. Trigger: ao concluir atendimento, verifica próximo em 90min ───────────
create or replace function fn_trigger_concluir_atendimento()
returns trigger
language plpgsql
security definer
as $$
declare
  v_tem_proximo boolean;
begin
  -- Só age quando status muda para Concluído
  if NEW.status <> 'Concluído' or OLD.status = 'Concluído' then
    return NEW;
  end if;

  -- Verifica se tem atendimento agendado nos próximos 90 minutos
  select exists (
    select 1
    from atendimentos
    where
      profissional_id = NEW.profissional_id
      and id <> NEW.id
      and status in ('Aguardando', 'Aguardando Consulta', 'Confirmado')
      and data_agendamento > now()
      and data_agendamento <= now() + interval '90 minutes'
  ) into v_tem_proximo;

  if not v_tem_proximo then
    insert into status_disponibilidade (profissional_id, status, atualizado_em)
    values (NEW.profissional_id, 'disponivel', now())
    on conflict (profissional_id)
    do update set
      status = 'disponivel',
      atualizado_em = now();
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_concluir_atendimento on atendimentos;

create trigger trg_concluir_atendimento
  after update on atendimentos
  for each row
  execute function fn_trigger_concluir_atendimento();

-- ─── 5. Function: retorna status e inicializa linha na tabela para o Realtime ──
-- Regra: ausente só quando não tem jornada para hoje E não tem linha na tabela.
--        Profissionais com jornada hoje mas sem linha → insere 'disponivel' para
--        que o Realtime tenha o que escutar nas próximas mudanças.
create or replace function fn_status_equipe_agora(p_ids uuid[])
returns table (
  profissional_id uuid,
  status text,
  atualizado_em timestamptz
)
language plpgsql
security definer
as $$
begin
  -- Inicializa 'disponivel' para quem tem jornada hoje mas não tem linha na tabela
  -- Isso garante que o Realtime consiga propagar mudanças futuras
  insert into status_disponibilidade (profissional_id, status, atualizado_em)
  select p.id, 'disponivel', now()
  from unnest(p_ids) as p(id)
  join disponibilidade_profissional dp
    on dp.profissional_id = p.id
    and dp.dia_semana = extract(dow from now() at time zone 'America/Sao_Paulo')::int
    and dp.ativo = true
  where not exists (
    select 1 from status_disponibilidade sd where sd.profissional_id = p.id
  )
  on conflict (profissional_id) do nothing;

  return query
  select
    p.id as profissional_id,
    case
      when sd.status is not null then sd.status
      when dp.profissional_id is null then 'ausente'
      else 'disponivel'
    end as status,
    coalesce(sd.atualizado_em, now()) as atualizado_em
  from unnest(p_ids) as p(id)
  left join status_disponibilidade sd on sd.profissional_id = p.id
  left join disponibilidade_profissional dp
    on dp.profissional_id = p.id
    and dp.dia_semana = extract(dow from now() at time zone 'America/Sao_Paulo')::int
    and dp.ativo = true;
end;
$$;
