alter table public.protocolos_atendimento
  add column if not exists total_sessoes integer not null default 1;

update public.protocolos_atendimento pa
set total_sessoes = coalesce((
  select max(pai.quantidade)
  from public.protocolo_atendimento_itens pai
  where pai.protocolo_atendimento_id = pa.id
), 1)
where pa.total_sessoes is null or pa.total_sessoes = 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'protocolos_atendimento_total_sessoes_positive'
  ) then
    alter table public.protocolos_atendimento
      add constraint protocolos_atendimento_total_sessoes_positive
      check (total_sessoes > 0);
  end if;
end
$$;
