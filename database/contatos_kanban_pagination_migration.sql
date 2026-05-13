create or replace function public.fn_contar_contatos_kanban(
  p_busca text default null,
  p_responsavel_id uuid default null,
  p_sem_responsavel boolean default false
)
returns table (
  kanban_coluna_chave text,
  total_count bigint
)
language sql
stable
as $$
  with contatos_resolvidos as (
    select
      p.id,
      coalesce(nullif(cb.kanban_coluna_chave, ''), cb.status, case when p.recuperacao_base then 'recuperacao_base' else 'a_contactar' end) as kanban_coluna_chave,
      cb.responsavel_id
    from public.pacientes p
    left join public.contatos_base cb on cb.paciente_id = p.id
    where p.ativo = true
      and (
        p_busca is null
        or p.nome ilike '%' || p_busca || '%'
      )
      and (
        (not p_sem_responsavel and p_responsavel_id is null)
        or (p_sem_responsavel and cb.responsavel_id is null)
        or (not p_sem_responsavel and p_responsavel_id is not null and cb.responsavel_id = p_responsavel_id)
      )
  )
  select
    contatos_resolvidos.kanban_coluna_chave,
    count(*)::bigint as total_count
  from contatos_resolvidos
  group by contatos_resolvidos.kanban_coluna_chave;
$$;

create or replace function public.fn_listar_contatos_kanban(
  p_coluna_chave text,
  p_busca text default null,
  p_responsavel_id uuid default null,
  p_sem_responsavel boolean default false,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  nome text,
  telefone text,
  email text,
  recuperacao_base boolean,
  status text,
  kanban_coluna_chave text,
  responsavel_id uuid,
  responsavel_nome text,
  total_count bigint
)
language sql
stable
as $$
  with contatos_resolvidos as (
    select
      p.id,
      p.nome,
      p.telefone,
      p.email,
      p.recuperacao_base,
      coalesce(cb.status, case when p.recuperacao_base then 'recuperacao_base' else 'a_contactar' end) as status,
      coalesce(nullif(cb.kanban_coluna_chave, ''), cb.status, case when p.recuperacao_base then 'recuperacao_base' else 'a_contactar' end) as kanban_coluna_chave,
      cb.responsavel_id,
      pr.full_name as responsavel_nome
    from public.pacientes p
    left join public.contatos_base cb on cb.paciente_id = p.id
    left join public.profiles pr on pr.id = cb.responsavel_id
    where p.ativo = true
      and (
        p_busca is null
        or p.nome ilike '%' || p_busca || '%'
      )
      and (
        (not p_sem_responsavel and p_responsavel_id is null)
        or (p_sem_responsavel and cb.responsavel_id is null)
        or (not p_sem_responsavel and p_responsavel_id is not null and cb.responsavel_id = p_responsavel_id)
      )
  )
  select
    contatos_resolvidos.id,
    contatos_resolvidos.nome,
    contatos_resolvidos.telefone,
    contatos_resolvidos.email,
    contatos_resolvidos.recuperacao_base,
    contatos_resolvidos.status,
    contatos_resolvidos.kanban_coluna_chave,
    contatos_resolvidos.responsavel_id,
    contatos_resolvidos.responsavel_nome,
    count(*) over()::bigint as total_count
  from contatos_resolvidos
  where contatos_resolvidos.kanban_coluna_chave = p_coluna_chave
  order by contatos_resolvidos.nome asc, contatos_resolvidos.id asc
  limit greatest(coalesce(p_limit, 30), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.fn_contar_responsaveis_contatos_kanban()
returns table (
  responsavel_id uuid,
  total_count bigint
)
language sql
stable
as $$
  select
    cb.responsavel_id,
    count(*)::bigint as total_count
  from public.contatos_base cb
  inner join public.pacientes p on p.id = cb.paciente_id
  where p.ativo = true
    and cb.responsavel_id is not null
  group by cb.responsavel_id;
$$;

create index if not exists idx_contatos_base_kanban_coluna_chave
  on public.contatos_base (kanban_coluna_chave);

create index if not exists idx_contatos_base_responsavel_id
  on public.contatos_base (responsavel_id);
