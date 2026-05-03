-- Tabela de status de disponibilidade em tempo real dos profissionais
-- status: 'disponivel' | 'reuniao' | 'ocupado'
create table if not exists status_disponibilidade (
  profissional_id uuid primary key references profiles(id) on delete cascade,
  status text not null default 'ocupado' check (status in ('disponivel', 'reuniao', 'ocupado')),
  atualizado_em timestamptz not null default now()
);

-- RLS
alter table status_disponibilidade enable row level security;

-- Qualquer usuário autenticado pode ler
create policy "Leitura autenticados"
  on status_disponibilidade for select
  to authenticated
  using (true);

-- Cada profissional só atualiza o próprio status
create policy "Escrita próprio status"
  on status_disponibilidade for all
  to authenticated
  using (profissional_id = auth.uid())
  with check (profissional_id = auth.uid());

-- Habilita Realtime para a tabela
alter publication supabase_realtime add table status_disponibilidade;

-- Se a tabela já existe com a coluna booleana, rodar este ALTER para migrar:
-- alter table status_disponibilidade
--   add column if not exists status text not null default 'ocupado'
--     check (status in ('disponivel', 'reuniao', 'ocupado'));
-- update status_disponibilidade set status = case when disponivel then 'disponivel' else 'ocupado' end;
-- alter table status_disponibilidade drop column if exists disponivel;
