# Auditoria de Dependencias do Supabase

Gerado em: 2026-05-21T13:02:32.724Z

## Resumo

- Arquivos analisados: 179
- Arquivos com indicios de uso do Supabase: 65

## Achados Criticos

- Existe uso de autenticacao Supabase no codigo.
- Existe uso de `auth.admin` / service role.
- Existe uso de Realtime, o que exige estrategia especifica na migracao.
- Existem chamadas RPC SQL que precisam ser preservadas no destino.

## Uso por Categoria

- Server client Supabase: 57 arquivo(s), 57 ocorrencia(s)
- Browser client Supabase: 7 arquivo(s), 7 ocorrencia(s)
- Auth Supabase: 21 arquivo(s), 66 ocorrencia(s)
- Admin Auth / service role: 2 arquivo(s), 16 ocorrencia(s)
- Storage Supabase: 0 arquivo(s), 0 ocorrencia(s)
- Realtime Supabase: 2 arquivo(s), 12 ocorrencia(s)
- RPC SQL: 4 arquivo(s), 7 ocorrencia(s)
- Middleware de sessao: 2 arquivo(s), 2 ocorrencia(s)

## Tabelas Mais Referenciadas

- `atendimentos`: 57 referencia(s) em 16 arquivo(s)
- `profiles`: 48 referencia(s) em 26 arquivo(s)
- `pacientes`: 21 referencia(s) em 11 arquivo(s)
- `vendas`: 20 referencia(s) em 7 arquivo(s)
- `produtos`: 14 referencia(s) em 7 arquivo(s)
- `contatos_base`: 13 referencia(s) em 4 arquivo(s)
- `disponibilidade_profissional`: 13 referencia(s) em 7 arquivo(s)
- `kanban_colunas_contatos`: 11 referencia(s) em 4 arquivo(s)
- `agendamentos`: 9 referencia(s) em 3 arquivo(s)
- `tipos_consulta`: 9 referencia(s) em 3 arquivo(s)
- `itens_venda`: 8 referencia(s) em 4 arquivo(s)
- `prontuarios`: 8 referencia(s) em 4 arquivo(s)
- `protocolos`: 8 referencia(s) em 2 arquivo(s)
- `protocolos_atendimento`: 8 referencia(s) em 1 arquivo(s)
- `origens_paciente`: 7 referencia(s) em 1 arquivo(s)
- `planos_saude`: 7 referencia(s) em 1 arquivo(s)
- `templates_mensagem`: 6 referencia(s) em 3 arquivo(s)
- `notas_contato`: 5 referencia(s) em 2 arquivo(s)
- `protocolo_atendimento_itens`: 5 referencia(s) em 1 arquivo(s)
- `eventos_paciente`: 4 referencia(s) em 2 arquivo(s)

## RPCs Encontradas

- `fn_contar_contatos_kanban`: 1 referencia(s) em 1 arquivo(s)
- `fn_contar_pacientes_disponiveis_contatos_base`: 1 referencia(s) em 1 arquivo(s)
- `fn_contar_responsaveis_contatos_kanban`: 1 referencia(s) em 1 arquivo(s)
- `fn_listar_contatos_kanban`: 1 referencia(s) em 1 arquivo(s)
- `fn_materializar_pacientes_contatos_base`: 1 referencia(s) em 1 arquivo(s)
- `fn_status_equipe_agora`: 1 referencia(s) em 1 arquivo(s)
- `fn_ultimo_atendimento_por_pacientes`: 1 referencia(s) em 1 arquivo(s)

## Arquivos por Categoria

### Server client Supabase

- `src/actions/acessos.ts`
- `src/actions/agenda.ts`
- `src/actions/atendimentos.ts`
- `src/actions/auth.ts`
- `src/actions/confirmacoes.ts`
- `src/actions/contatos.ts`
- `src/actions/disponibilidade.ts`
- `src/actions/equipe.ts`
- `src/actions/eventos.ts`
- `src/actions/origens-paciente.ts`
- `src/actions/pacientes.ts`
- `src/actions/planos-saude.ts`
- `src/actions/produtos.ts`
- `src/actions/prontuarios.ts`
- `src/actions/protocolos-atendimento.ts`
- `src/actions/protocolos.ts`
- `src/actions/status-disponibilidade.ts`
- `src/actions/templates.ts`
- `src/actions/tipos-consulta.ts`
- `src/actions/vendas.ts`
- `src/app/(painel)/agenda/page.tsx`
- `src/app/(painel)/configuracoes/disponibilidade/page.tsx`
- `src/app/(painel)/configuracoes/jornada/page.tsx`
- `src/app/(painel)/confirmacoes/cards/page.tsx`
- `src/app/(painel)/confirmacoes/semana/page.tsx`
- `src/app/(painel)/contatos/page.tsx`
- `src/app/(painel)/contatos/relatorio/page.tsx`
- `src/app/(painel)/dashboard/page.tsx`
- `src/app/(painel)/equipe/[id]/editar/page.tsx`
- `src/app/(painel)/equipe/acessos/page.tsx`
- `src/app/(painel)/equipe/page.tsx`
- `src/app/(painel)/layout.tsx`
- `src/app/(painel)/pacientes/[id]/editar/page.tsx`
- `src/app/(painel)/pacientes/[id]/page.tsx`
- `src/app/(painel)/pacientes/page.tsx`
- `src/app/(painel)/pacientes/relatorio-cadastros/page.tsx`
- `src/app/(painel)/pacientes/relatorio-consultas/page.tsx`
- `src/app/(painel)/pacientes/tipos-consulta/page.tsx`
- `src/app/(painel)/produtos/[id]/editar/page.tsx`
- `src/app/(painel)/produtos/page.tsx`
- `src/app/(painel)/prontuarios/[atendimentoId]/page.tsx`
- `src/app/(painel)/prontuarios/page.tsx`
- `src/app/(painel)/relatorios/tempo-fabril/page.tsx`
- `src/app/(painel)/relatorios/vendas/page.tsx`
- `src/app/(painel)/vendas/[id]/editar/page.tsx`
- `src/app/(painel)/vendas/[id]/page.tsx`
- `src/app/(painel)/vendas/nova/page.tsx`
- `src/app/(painel)/vendas/page.tsx`
- `src/app/(painel)/vendas/protocolos/page.tsx`
- `src/app/api/contatos/kanban/route.ts`
- `src/app/api/templates/route.ts`
- `src/lib/agendamento-conflitos.ts`
- `src/lib/contatos-kanban-data.ts`
- `src/lib/guard.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/server.ts`

### Browser client Supabase

- `src/components/features/agenda/SlideNovoAgendamento.tsx`
- `src/components/features/contatos/KanbanContatos.tsx`
- `src/components/features/vendas/FormEditarVenda.tsx`
- `src/components/features/vendas/FormNovaVenda.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/hooks/useRealtimeDisponibilidade.ts`
- `src/lib/supabase/client.ts`

### Auth Supabase

- `src/actions/acessos.ts`
- `src/actions/agenda.ts`
- `src/actions/atendimentos.ts`
- `src/actions/auth.ts`
- `src/actions/contatos.ts`
- `src/actions/disponibilidade.ts`
- `src/actions/equipe.ts`
- `src/actions/eventos.ts`
- `src/actions/prontuarios.ts`
- `src/actions/status-disponibilidade.ts`
- `src/actions/templates.ts`
- `src/actions/vendas.ts`
- `src/app/(painel)/layout.tsx`
- `src/components/features/contatos/KanbanContatos.tsx`
- `src/components/features/vendas/FormEditarVenda.tsx`
- `src/components/features/vendas/FormNovaVenda.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/hooks/useRealtimeDisponibilidade.ts`
- `src/lib/guard.ts`
- `src/lib/supabase/middleware.ts`
- `src/proxy.ts`

### Admin Auth / service role

- `src/actions/acessos.ts`
- `src/actions/equipe.ts`

### Storage Supabase

- Nenhum arquivo encontrado.

### Realtime Supabase

- `src/components/features/contatos/KanbanContatos.tsx`
- `src/hooks/useRealtimeDisponibilidade.ts`

### RPC SQL

- `src/actions/contatos.ts`
- `src/actions/status-disponibilidade.ts`
- `src/lib/contatos-kanban-data.ts`
- `src/lib/ultimo-atendimento.ts`

### Middleware de sessao

- `src/lib/supabase/middleware.ts`
- `src/proxy.ts`

## Proximos Passos Sugeridos

- Validar manualmente os arquivos marcados em `Auth Supabase`.
- Validar se `auth.admin` precisa ser mantido ou substituido.
- Levantar estrategia para Realtime, se permanecer necessario.
- Revisar tabelas e RPCs mais referenciadas antes do plano de cutover.
- Mapear se existe uso real de Storage; o scanner textual pode sinalizar falso positivo.
