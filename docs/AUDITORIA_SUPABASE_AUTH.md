# Auditoria Supabase Auth

Gerado em: 2026-05-21T13:06:02.572Z

## Resumo

- Arquivos analisados: 179
- Arquivos com dependencia de auth: 21
- Ocorrencias de service role: 5
- Ocorrencias de admin auth: 3

## Ponto de Atencao

- Esse relatorio foca apenas em autenticacao e sessao.
- Qualquer migracao para Postgres puro exigira substituicao dessas integracoes.

## Areas Criticas

- `src/actions/acessos.ts`
- `src/actions/auth.ts`
- `src/actions/equipe.ts`
- `src/lib/guard.ts`
- `src/lib/supabase/middleware.ts`
- `src/proxy.ts`

## Uso por Operacao

### Leitura de usuario logado

- Chave interna: `get_user`
- Ocorrencias: 23
- Arquivos: 18
- `src/actions/templates.ts`: 4
- `src/actions/prontuarios.ts`: 2
- `src/actions/vendas.ts`: 2
- `src/actions/acessos.ts`: 1
- `src/actions/agenda.ts`: 1
- `src/actions/atendimentos.ts`: 1
- `src/actions/auth.ts`: 1
- `src/actions/contatos.ts`: 1
- `src/actions/disponibilidade.ts`: 1
- `src/actions/equipe.ts`: 1
- `src/actions/eventos.ts`: 1
- `src/actions/status-disponibilidade.ts`: 1
- `src/app/(painel)/layout.tsx`: 1
- `src/components/features/vendas/FormEditarVenda.tsx`: 1
- `src/components/features/vendas/FormNovaVenda.tsx`: 1
- `src/lib/guard.ts`: 1
- `src/lib/supabase/middleware.ts`: 1
- `src/proxy.ts`: 1

### Leitura de sessao

- Chave interna: `get_session`
- Ocorrencias: 2
- Arquivos: 2
- `src/components/features/contatos/KanbanContatos.tsx`: 1
- `src/hooks/useRealtimeDisponibilidade.ts`: 1

### Login por senha

- Chave interna: `sign_in_password`
- Ocorrencias: 3
- Arquivos: 2
- `src/actions/vendas.ts`: 2
- `src/actions/auth.ts`: 1

### Logout

- Chave interna: `sign_out`
- Ocorrencias: 2
- Arquivos: 2
- `src/actions/auth.ts`: 1
- `src/components/layout/Sidebar.tsx`: 1

### Atualizacao de usuario autenticado

- Chave interna: `update_user`
- Ocorrencias: 1
- Arquivos: 1
- `src/actions/auth.ts`: 1

### Listener de auth

- Chave interna: `auth_listener`
- Ocorrencias: 2
- Arquivos: 2
- `src/components/features/contatos/KanbanContatos.tsx`: 1
- `src/hooks/useRealtimeDisponibilidade.ts`: 1

### Admin update user

- Chave interna: `admin_update_user`
- Ocorrencias: 3
- Arquivos: 1
- `src/actions/equipe.ts`: 3

### Service role key

- Chave interna: `service_role`
- Ocorrencias: 5
- Arquivos: 2
- `src/actions/equipe.ts`: 4
- `src/actions/acessos.ts`: 1

### Middleware / sessao

- Chave interna: `middleware_session`
- Ocorrencias: 2
- Arquivos: 2
- `src/lib/supabase/middleware.ts`: 1
- `src/proxy.ts`: 1

## Proximos Passos Sugeridos

- Definir o substituto para login, sessao e reset de senha antes da migracao.
- Revisar os fluxos em `actions/auth`, `guard`, `middleware` e `proxy`.
- Mapear se `auth.admin.updateUserById` sera substituido por painel administrativo proprio ou outro provider.
- Separar o que e autenticacao do que e autorizacao por `profiles` e `modulos_liberados`.
