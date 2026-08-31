-- Fix: a tabela objecoes_orcamento foi criada com Row Level Security habilitado
-- (padrão do projeto para tabelas novas) e sem nenhuma policy — por isso a API
-- (usada pela sessão do usuário logado) não retornava nenhuma linha, apesar dos
-- dados existirem (visível só via service role). produtos/protocolos não têm
-- essa trava; o controle de quem acessa /objecoes já é feito na aplicação via
-- requireModulo('comercial:objecoes'), então desabilitamos RLS aqui também,
-- no mesmo padrão dessas outras tabelas de catálogo.

ALTER TABLE public.objecoes_orcamento DISABLE ROW LEVEL SECURITY;
