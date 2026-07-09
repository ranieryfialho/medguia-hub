alter table public.tipos_consulta
  add column if not exists duracao_padrao_minutos integer not null default 30;

comment on column public.tipos_consulta.duracao_padrao_minutos
  is 'Duração padrão em minutos usada como sugestão ao criar agendamentos deste tipo';
