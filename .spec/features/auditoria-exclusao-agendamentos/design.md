# Design: Auditoria exclusão agendamentos

> feature: auditoria-exclusao-agendamentos

Base: [TDD 003](../../../docs/tdds/003-auditoria-de-exclusao-de-agendamentos.md) e [RFC 003](../../../docs/rfcs/003-auditoria-de-exclusao-de-agendamentos.md) (Opção 2, aprovada). Este documento traduz a arquitetura já decidida em componentes rastreáveis pelos critérios de aceite (AC-xxx) da spec.

## Arquitetura

```
Cliente
  AgendamentoModal (avulso / pontual / série)  ─┐
  ModalSelecaoExclusao (lote)                    ├─ passo de motivo → chama Server Action
                                                  ┘
Server Actions (casca fina) — src/actions/agenda.ts
  deletarAgendamento(id, motivo)
  deletarAtendimentoPontualDaRecorrencia(id, motivo)
  deletarTodasRecorrencias(agendamentoId, motivo)
  deletarAtendimentosSelecionados(ids, agendamentoId, motivo)
  → autentica (requirePermissaoAgendaAdmin) → resolve usuario_id/usuario_nome do contexto
  → resolve os ids do escopo (lógica já existente, inalterada)
  → chama supabase.rpc('fn_excluir_atendimentos', {...})
  → reposição da sessão pontual (best-effort, fora da transação, como hoje)
  → revalidatePath

Postgres — transação única
  fn_excluir_atendimentos(p_ids, p_acao, p_motivo_categoria, p_motivo_observacao, p_usuario_id, p_usuario_nome)
    1. valida usuario_id (existe em profiles)           → AC-056
    2. valida motivo_categoria (existe, ativo)           → AC-057
    3. exige observação se catálogo pedir                → AC-045
    4. bloqueia qualquer alvo status = 'Concluído'        → AC-049, AC-050, AC-052
    5. INSERT snapshot no log (antes do delete)           → AC-053
    6. DELETE dos atendimentos                            → AC-046, AC-048, AC-051
    7. limpa linha órfã em agendamentos                   → AC-048
    RAISE em qualquer passo desfaz tudo                   → AC-054

  trigger BEFORE UPDATE OR DELETE → RAISE                 → AC-055

Leitura
  Aba "Logs" em /pacientes/[id]                           → AC-058
  Painel /relatorios/auditoria-exclusoes (isGestorSistema) → AC-059, AC-060
```

## Esquema de dados

**`agendamentos_auditoria`** (append-only, sem FK — ver TDD 003 §"Restrição de integridade deliberada"): `id`, `criado_em`, `acao`, `motivo_categoria`, `motivo_observacao`, `usuario_id` (not null), `usuario_nome`, `paciente_id`, `paciente_nome`, `profissional_id`, `profissional_nome`, `atendimento_id` (not null), `agendamento_id`, `dados_agendamento` JSONB (not null).

Índices: `(paciente_id, criado_em DESC)`, `(criado_em DESC)`, `(usuario_id)`, `(profissional_id)`, `(motivo_categoria)`.

Trigger `trg_auditoria_append_only` (`BEFORE UPDATE OR DELETE` → `RAISE EXCEPTION`) cobre AC-055.

RLS de `SELECT`: liberado para qualquer usuário autenticado com acesso ao paciente (ASM-012) — mesmo gate de módulo das demais abas de `/pacientes/[id]` (nenhum `modulo` associado, igual à aba "Agendamentos" existente).

**`motivos_exclusao_agendamento`** (catálogo): `slug` PK, `label`, `exige_observacao`, `ordem`, `ativo`. Seed com as 6 categorias do PRD (a última — `outros` — com `exige_observacao = true`).

## Contrato da função `fn_excluir_atendimentos`

`SECURITY DEFINER`, `SET search_path = public, pg_temp` (obrigatório — mitigação de escalação de privilégio, ver TDD 003 §Segurança). `EXECUTE` concedido só a `service_role` e `authenticated`.

```
fn_excluir_atendimentos(
  p_ids UUID[], p_acao TEXT, p_motivo_categoria TEXT, p_motivo_observacao TEXT,
  p_usuario_id UUID, p_usuario_nome TEXT
) RETURNS TABLE (excluidos INT, serie_removida BOOLEAN)
```

Cobre a mesma função para os 4 escopos — quem resolve *quais* ids formam o escopo continua em TypeScript (inalterado); o que muda é que a exclusão física deixa de acontecer fora da RPC.

## Contrato das Server Actions

As 4 assinaturas ganham `motivo: { categoria: string; observacao?: string }`. `usuario_id`/`usuario_nome` vêm sempre do contexto de `requirePermissaoAgendaAdmin()`, nunca de parâmetro do cliente (RFC, C3). Erro da RPC (`RAISE`) vira `{ error: string }` na resposta da action, traduzido para mensagem amigável no modal.

## Reposição de sessão pontual

Permanece em TypeScript, depois da RPC confirmar (TDD 003 §"Reposição de sessão pontual") — é regra de agenda, não de auditoria. Falha na reposição não desfaz a exclusão já confirmada; é logada e sinalizada na resposta, como já é hoje.

## UI de escrita

`AgendamentoModal` (avulso, pontual, série): passo final comum de motivo — botões de categoria, campo de observação condicional, confirmação desabilitada sem motivo válido (AC-044, AC-045). Série completa ganha aviso reforçado com contagem de sessões.

`ModalSelecaoExclusao` (lote): mesmo passo de motivo aplicado ao lote selecionado.

## UI de leitura

**Aba "Logs"** — nova entrada em `TABS` de [`PacienteTabsClient.tsx`](../../../src/components/features/pacientes/PacienteTabsClient.tsx) (padrão já estabelecido: id, label, icon, sem `modulo` — visível a todo usuário com acesso ao paciente, igual à aba "Agendamentos"). Precisa de uma query nova (`buscarLogsExclusaoPaciente(pacienteId)`) e um componente `TabLogsPaciente`, seguindo o padrão de `TabConfirmacoesPaciente`/`TabObservacoesPaciente`.

**Painel gerencial** — rota nova `src/app/(painel)/relatorios/auditoria-exclusoes/`, ao lado das rotas irmãs (`tempo-fabril`, `vendas`, `conferencia-agendamentos`). Gate `isGestorSistema` (`src/lib/permissoes.ts`). 4 filtros (período, profissional, operador, motivo), paginação server-side sobre os índices da tabela.

## Decisões já fechadas (não redecidir aqui)

- Bloqueio de "Concluído" é absoluto (ASM-011).
- Hard delete + snapshot, sem restauração (ASM-013).
- `SECURITY DEFINER` aceitável (ASM-014).
- Sem dado de contato no snapshot (ASM-015).
