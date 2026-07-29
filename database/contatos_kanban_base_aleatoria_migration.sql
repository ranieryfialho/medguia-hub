-- Faz o preview de "Adicionar cards da base" (modal em /contatos) devolver os
-- pacientes disponiveis em ordem aleatoria, em vez de ordem alfabetica.
-- Rodar manualmente no SQL Editor do Studio (self-hosted) — é uma criação de função (DDL).

create or replace function public.fn_listar_pacientes_disponiveis_contatos_base_aleatorio(
  p_coluna_chave text,
  p_limit integer default 50,
  p_busca text default null
)
returns table (
  id uuid,
  nome text,
  telefone text,
  email text,
  recuperacao_base boolean
)
language sql
stable
as $$
  select
    p.id,
    p.nome,
    p.telefone,
    p.email,
    p.recuperacao_base
  from public.pacientes p
  where p.ativo = true
    and p.recuperacao_base = (p_coluna_chave = 'recuperacao_base')
    and (
      p_busca is null
      or p.nome ilike '%' || p_busca || '%'
    )
    and not exists (
      select 1
      from public.contatos_base cb
      where cb.paciente_id = p.id
    )
  order by random()
  limit greatest(coalesce(p_limit, 50), 0);
$$;
