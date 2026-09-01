-- Registra quem editou por último um agendamento/atendimento, sem jamais
-- sobrescrever criado_por (quem marcou originalmente).
-- Ver correção: editarAtendimento não deve mais tocar em criado_por.

alter table public.agendamentos
add column if not exists editado_por uuid references auth.users(id),
add column if not exists editado_em timestamptz;

alter table public.atendimentos
add column if not exists editado_por uuid references auth.users(id),
add column if not exists editado_em timestamptz;
