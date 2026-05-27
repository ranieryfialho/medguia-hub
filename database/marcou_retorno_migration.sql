-- Adiciona coluna marcou_retorno nas tabelas agendamentos e atendimentos
-- O campo indica se o agendamento é uma consulta de retorno

alter table public.agendamentos
add column if not exists marcou_retorno boolean not null default false;

alter table public.atendimentos
add column if not exists marcou_retorno boolean not null default false;
