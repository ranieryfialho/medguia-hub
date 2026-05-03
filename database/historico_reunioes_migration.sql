-- ─── Tabela de histórico de períodos em reunião ───────────────────────────────
create table if not exists historico_reunioes (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profiles(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz,
  duracao_minutos int generated always as (
    case when fim is not null
      then extract(epoch from (fim - inicio))::int / 60
      else null
    end
  ) stored
);

-- RLS
alter table historico_reunioes enable row level security;

create policy "Leitura autenticados"
  on historico_reunioes for select
  to authenticated
  using (true);

create policy "Escrita próprio histórico"
  on historico_reunioes for all
  to authenticated
  using (profissional_id = auth.uid())
  with check (profissional_id = auth.uid());

-- ─── Trigger: grava início/fim de reunião ao mudar status_disponibilidade ─────
create or replace function fn_trigger_historico_reuniao()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Entrou em reunião: abre novo registro
  if NEW.status = 'reuniao' and (OLD.status is null or OLD.status <> 'reuniao') then
    insert into historico_reunioes (profissional_id, inicio)
    values (NEW.profissional_id, now());
  end if;

  -- Saiu de reunião: fecha o registro em aberto
  if OLD.status = 'reuniao' and NEW.status <> 'reuniao' then
    update historico_reunioes
    set fim = now()
    where
      profissional_id = NEW.profissional_id
      and fim is null
    ;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_historico_reuniao on status_disponibilidade;

create trigger trg_historico_reuniao
  after update on status_disponibilidade
  for each row
  execute function fn_trigger_historico_reuniao();
