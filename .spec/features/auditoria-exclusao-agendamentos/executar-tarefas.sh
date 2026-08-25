#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano auditoria-exclusao-agendamentos` em 2026-08-25 12:51
# NÃO edite à mão: mudou tasks.md ou a config, regenere o plano.
#
# uso:
#   bash executar-tarefas.sh                  tudo (ondas → sequenciais → gate)
#   bash executar-tarefas.sh --faixa <id>     reexecuta UMA faixa (+ merge + gate)
#   bash executar-tarefas.sh --seq <T-xxx>    reexecuta UMA tarefa sequencial
#   bash executar-tarefas.sh --gate           só o gate (verify + audit)
#   bash executar-tarefas.sh --listar         mostra faixas, tarefas e estados
#   (acrescente --sem-gate para não rodar o gate ao final)
#
# resumo do que está rolando, a qualquer momento: onp-spec resumo auditoria-exclusao-agendamentos
set -u
set -o pipefail

RUN_ID='medguia-hub-auditoria-exclusao-agendamentos-mt8nzfj0'
FEATURE='auditoria-exclusao-agendamentos'
BASE_BRANCH='spec/auditoria-exclusao-agendamentos'
ENGINE='.claude/skills/onp-spec-driven/scripts/onp-spec.mjs'
CLAUDE_FLAGS=(--permission-mode acceptEdits --allowedTools 'Bash(git add:*),Bash(git commit:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*),Bash(node:*)')
STREAM_FLAGS=(--output-format stream-json --verbose)
FALHAS=""
COM_GATE=1
RESUMO_MODEL='claude-haiku-4-5'
RESUMO_PID=""

verde()    { printf '\033[32m%s\033[0m\n' "$*"; }
vermelho() { printf '\033[31m%s\033[0m\n' "$*"; }
amarelo()  { printf '\033[33m%s\033[0m\n' "$*"; }
info()     { printf '· %s\n' "$*"; }
falhar()   { vermelho "✘ $*"; exit 1; }

# eventos vão para o ledger GLOBAL (~/.onp-spec/painel/ledger.jsonl):
# um arquivo para todos os projetos, é o que o onp-spec resumo lê
evento() { node "$ENGINE" evento --run "$RUN_ID" "$@" >/dev/null 2>&1 || true; }

# ── ambiente (todos os modos passam por aqui) ────────────────────────
preparar_ambiente() {
  command -v git >/dev/null 2>&1 || falhar "git não encontrado"
  command -v node >/dev/null 2>&1 || falhar "node não encontrado"
  command -v claude >/dev/null 2>&1 || falhar "Claude Code CLI (claude) não encontrado — instale-o ou siga o modo manual em plano-execucao.md"
  TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null) || falhar "fora de um repositório git"
  cd "$TOPLEVEL" || exit 1
  # artefatos recém-gerados pelo `onp-spec plano` são sujeira esperada:
  # se forem a ÚNICA sujeira, o script mesmo commita; qualquer outra, aborta
  if [ -n "$(git status --porcelain)" ]; then
    if [ -z "$(git status --porcelain | grep -v -e 'plano-execucao\.' -e 'plano\.json' -e 'executar-tarefas\.sh')" ]; then
      git add -A
      git commit -q -m "plano de execução: $FEATURE (artefatos gerados)"
      info "artefatos do plano commitados"
    else
      falhar "árvore suja além dos artefatos do plano — commite ou faça git stash antes (os worktrees partem do último commit)"
    fi
  fi
  git ls-files --error-unmatch -- '.spec/features/auditoria-exclusao-agendamentos/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
  ATUAL=$(git rev-parse --abbrev-ref HEAD)
  [ "$ATUAL" != "HEAD" ] || falhar "HEAD destacado — troque para uma branch"
  if [ "$ATUAL" != "$BASE_BRANCH" ]; then
    if git show-ref --verify --quiet "refs/heads/$BASE_BRANCH"; then
      git checkout -q "$BASE_BRANCH" || falhar "não consegui trocar para $BASE_BRANCH"
    else
      git checkout -q -b "$BASE_BRANCH" || falhar "não consegui criar $BASE_BRANCH"
    fi
    info "branch de trabalho: $BASE_BRANCH (a partir de $ATUAL)"
  fi
  git worktree prune
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/medguia-hub-auditoria-exclusao-agendamentos-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/medguia-hub-auditoria-exclusao-agendamentos"
  STREAMS_DIR="${ONP_SPEC_HOME:-$HOME/.onp-spec}/painel/streams/$RUN_ID"
  mkdir -p "$LOG_DIR" "$STREAMS_DIR"
}

# worktree limpo mesmo depois de uma tentativa que falhou
preparar_worktree() { # $1=faixa $2=branch $3=worktree
  git worktree prune
  if [ -e "$3" ]; then git worktree remove --force "$3" >/dev/null 2>&1; rm -rf "$3"; fi
  if git show-ref --verify --quiet "refs/heads/$2"; then git branch -D "$2" >/dev/null 2>&1; fi
  git worktree add "$3" -b "$2" >/dev/null 2>&1 || { vermelho "✘ não consegui criar o worktree de $1 em $3"; return 1; }
}

tentativa() { # $1=faixa — conta reexecuções (vai para o ledger)
  local arq="$LOG_DIR/.tentativa-$1"
  local n=1
  [ -f "$arq" ] && n=$(( $(cat "$arq") + 1 ))
  printf "%s" "$n" > "$arq"
  printf "%s" "$n"
}

# uma tarefa = uma sessão claude headless com contexto limpo.
# o JSONL da sessão vira o stream da tarefa no ledger
rodar_tarefa() { # $1=escopo(faixa|seq) $2=T-xxx $3=prompt $4=modelo $5=esforço
  local chave="$1--$2"
  local stream="$STREAMS_DIR/$chave.jsonl"
  evento --tipo tarefa --tarefa "$2" --faixa "$1" --estado executando --stream "$chave"
  info "$2 — claude -p ($4 · $5) · stream: $chave"
  if claude -p "$3" --model "$4" --effort "$5" "${STREAM_FLAGS[@]}" "${CLAUDE_FLAGS[@]}" > "$stream" 2>>"$LOG_DIR/$1.log"; then
    evento --tipo tarefa --tarefa "$2" --faixa "$1" --estado concluida --stream "$chave"
    node "$ENGINE" stream-resumo "$RUN_ID" "$chave" 2>/dev/null || true
    return 0
  fi
  evento --tipo tarefa --tarefa "$2" --faixa "$1" --estado falhou --stream "$chave"
  node "$ENGINE" stream-resumo "$RUN_ID" "$chave" 2>/dev/null || true
  return 1
}

mesclar_faixa() { # $1=faixa $2=branch $3=worktree $4=exit-da-faixa
  if [ "$4" -ne 0 ]; then
    evento --tipo faixa --faixa "$1" --estado falhou
    vermelho "✘ $1 falhou (log: $LOG_DIR/$1.log) — worktree mantido para inspeção: $3"
    amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --faixa $1"
    FALHAS="$FALHAS $1"; return 1
  fi
  evento --tipo faixa --faixa "$1" --estado mesclando
  if git merge --no-ff "$2" -m "merge $1 ($FEATURE)"; then
    git worktree remove --force "$3" >/dev/null 2>&1
    git branch -d "$2" >/dev/null 2>&1
    evento --tipo faixa --faixa "$1" --estado mesclada
    verde "✔ $1 mesclada em $BASE_BRANCH"
  else
    git merge --abort >/dev/null 2>&1
    evento --tipo faixa --faixa "$1" --estado conflito
    vermelho "✘ conflito ao mesclar $1 — resolva na mão: git merge $2 (worktree mantido: $3)"
    FALHAS="$FALHAS $1"; return 1
  fi
}

marcar_concluidas() { # $@=T-xxx
  for t in "$@"; do node "$ENGINE" tarefa "$FEATURE" "$t" concluida >/dev/null || true; done
}

# ── resumo geral de andamento: 1/min enquanto a execução roda ─────────
# escrito por IA (claude -p, sem ferramentas) com fallback do motor; vai
# para o terminal e para o ledger — o agente repassa o texto no chat.
gerar_resumo() {
  local ctx ia
  ctx=$(node "$ENGINE" resumo "$FEATURE" --contexto 2>/dev/null) || ctx=""
  [ -n "$ctx" ] || return 0
  ia=$(claude -p "Você narra, para o dono do produto, uma execução de tarefas de código em andamento. Estado mecânico:

$ctx

Escreva o RESUMO GERAL DE ANDAMENTO: um parágrafo único de 2 a 4 frases, em português simples, dizendo o que está acontecendo agora, o que já terminou, o que falhou e se o usuário precisa agir. Sem markdown, sem listas." --model "$RESUMO_MODEL" 2>/dev/null)
  if [ -n "$ia" ]; then
    node "$ENGINE" resumo "$FEATURE" --gravar --origem ia --texto "$ia" >/dev/null 2>&1 || true
    printf '\n📣 resumo (IA): %s\n' "$ia"
  else
    node "$ENGINE" resumo "$FEATURE" --gravar >/dev/null 2>&1 || true
    printf '\n📣 resumo: %s\n' "$(node "$ENGINE" resumo "$FEATURE" 2>/dev/null)"
  fi
}

# mata o loop E o sleep filho — senão o sleep herda o stdout e quem chamou
# o script via pipe fica esperando EOF por até 60s depois do exit
parar_resumos() {
  [ -n "$RESUMO_PID" ] || return 0
  command -v pkill >/dev/null 2>&1 && pkill -P "$RESUMO_PID" 2>/dev/null
  kill "$RESUMO_PID" 2>/dev/null
  RESUMO_PID=""
}

iniciar_resumos() {
  ( while :; do sleep 60; gerar_resumo; done ) &
  RESUMO_PID=$!
  # ao sair: para o loop e grava um último resumo (o estado final, do motor)
  trap 'parar_resumos; node "$ENGINE" resumo "$FEATURE" --gravar >/dev/null 2>&1 || true' EXIT
}

# ── sequencial T-033 (ordem do tasks.md) ──
executar_seq_T_033() {
  info 'sequencial T-033 — Migration: tabela `agendamentos_auditoria` (append-only) + índices + trigger + RLS de SELECT'
  if rodar_tarefa seq 'T-033' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-033 — "Migration: tabela `agendamentos_auditoria` (append-only) + índices + trigger + RLS de SELECT"
  critérios/refs: AC-053 (Snapshot do log reflete o estado do atendimento antes da remoção), AC-055 (Registro de log não pode ser alterado nem apagado, nem pelo service role), AC-058 (Aba Logs lista as exclusões do paciente em ordem cronológica decrescente)
  arquivos permitidos (e seus testes): database/agendamentos_auditoria_migration.sql
  mensagem de commit: "T-033 auditoria-exclusao-agendamentos: Migration: tabela `agendamentos_auditoria` (append-only) + índices + trigger + RLS de SELECT"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-033 auditoria-exclusao-agendamentos: Migration: tabela `agendamentos_auditoria` (append-only) + índices + trigger + RLS de SELECT (auto-commit do plano)'
    fi
    marcar_concluidas T-033
    verde "✔ T-033 concluída"
    return 0
  fi
  vermelho "✘ T-033 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-033"
  FALHAS="$FALHAS T-033"
  return 1
}

# ── sequencial T-034 (ordem do tasks.md) ──
executar_seq_T_034() {
  info 'sequencial T-034 — Migration: catálogo `motivos_exclusao_agendamento` + seed do PRD'
  if rodar_tarefa seq 'T-034' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-034 — "Migration: catálogo `motivos_exclusao_agendamento` + seed do PRD"
  critérios/refs: AC-044 (Confirmação de exclusão avulsa fica bloqueada sem motivo), AC-045 (Categoria "Outros" exige observação preenchida), AC-057 (Categoria de motivo inexistente ou inativa é recusada)
  arquivos permitidos (e seus testes): database/motivos_exclusao_agendamento_migration.sql
  mensagem de commit: "T-034 auditoria-exclusao-agendamentos: Migration: catálogo `motivos_exclusao_agendamento` + seed do PRD"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-034 auditoria-exclusao-agendamentos: Migration: catálogo `motivos_exclusao_agendamento` + seed do PRD (auto-commit do plano)'
    fi
    marcar_concluidas T-034
    verde "✔ T-034 concluída"
    return 0
  fi
  vermelho "✘ T-034 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-034"
  FALHAS="$FALHAS T-034"
  return 1
}

# ── sequencial T-035 (ordem do tasks.md) ──
executar_seq_T_035() {
  info 'sequencial T-035 — `fn_excluir_atendimentos`: validações, bloqueio de concluídos, snapshot, delete, limpeza de série'
  if rodar_tarefa seq 'T-035' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-035 — "`fn_excluir_atendimentos`: validações, bloqueio de concluídos, snapshot, delete, limpeza de série"
  critérios/refs: AC-046 (Exclusão avulsa bem-sucedida remove o atendimento e grava o log), AC-047 (Exclusão pontual repõe sessão no fim da série e distingue reposição de perda no log), AC-048 (Série sem sessões concluídas é removida por inteiro com log), AC-049 (Série com pelo menos uma sessão concluída é recusada por inteiro), AC-050 (Lote com sessão concluída é recusado por inteiro), AC-051 (Lote totalmente pendente é excluído com log do escopo), AC-052 (Função transacional recusa exclusão de qualquer atendimento concluído, em qualquer escopo), AC-053 (Snapshot do log reflete o estado do atendimento antes da remoção), AC-054 (Falha em qualquer etapa desfaz log e exclusão juntos (tudo ou nada)), AC-056 (Operador nulo ou inexistente bloqueia a exclusão), AC-057 (Categoria de motivo inexistente ou inativa é recusada)
  arquivos permitidos (e seus testes): database/fn_excluir_atendimentos_migration.sql
  mensagem de commit: "T-035 auditoria-exclusao-agendamentos: `fn_excluir_atendimentos`: validações, bloqueio de concluídos, snapshot, delete, limpeza de série"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-035 auditoria-exclusao-agendamentos: `fn_excluir_atendimentos`: validações, bloqueio de concluídos, snapshot, delete, limpeza de série (auto-commit do plano)'
    fi
    marcar_concluidas T-035
    verde "✔ T-035 concluída"
    return 0
  fi
  vermelho "✘ T-035 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-035"
  FALHAS="$FALHAS T-035"
  return 1
}

# ── sequencial T-036 (ordem do tasks.md) ──
executar_seq_T_036() {
  info 'sequencial T-036 — Testes estáticos de SQL (forma e ordem da migration/função)'
  if rodar_tarefa seq 'T-036' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-036 — "Testes estáticos de SQL (forma e ordem da migration/função)"
  critérios/refs: AC-053 (Snapshot do log reflete o estado do atendimento antes da remoção), AC-054 (Falha em qualquer etapa desfaz log e exclusão juntos (tudo ou nada)), AC-055 (Registro de log não pode ser alterado nem apagado, nem pelo service role)
  arquivos permitidos (e seus testes): test/sql/auditoria-exclusao.test.ts
  mensagem de commit: "T-036 auditoria-exclusao-agendamentos: Testes estáticos de SQL (forma e ordem da migration/função)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-036 auditoria-exclusao-agendamentos: Testes estáticos de SQL (forma e ordem da migration/função) (auto-commit do plano)'
    fi
    marcar_concluidas T-036
    verde "✔ T-036 concluída"
    return 0
  fi
  vermelho "✘ T-036 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-036"
  FALHAS="$FALHAS T-036"
  return 1
}

# ── sequencial T-037 (ordem do tasks.md) ──
executar_seq_T_037() {
  info 'sequencial T-037 — Refatorar as 4 Server Actions de exclusão para casca fina sobre a RPC'
  if rodar_tarefa seq 'T-037' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-037 — "Refatorar as 4 Server Actions de exclusão para casca fina sobre a RPC"
  critérios/refs: AC-044 (Confirmação de exclusão avulsa fica bloqueada sem motivo), AC-046 (Exclusão avulsa bem-sucedida remove o atendimento e grava o log), AC-047 (Exclusão pontual repõe sessão no fim da série e distingue reposição de perda no log), AC-048 (Série sem sessões concluídas é removida por inteiro com log), AC-049 (Série com pelo menos uma sessão concluída é recusada por inteiro), AC-050 (Lote com sessão concluída é recusado por inteiro), AC-051 (Lote totalmente pendente é excluído com log do escopo), AC-052 (Função transacional recusa exclusão de qualquer atendimento concluído, em qualquer escopo), AC-056 (Operador nulo ou inexistente bloqueia a exclusão), AC-057 (Categoria de motivo inexistente ou inativa é recusada)
  arquivos permitidos (e seus testes): src/actions/agenda.ts
  mensagem de commit: "T-037 auditoria-exclusao-agendamentos: Refatorar as 4 Server Actions de exclusão para casca fina sobre a RPC"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-037 auditoria-exclusao-agendamentos: Refatorar as 4 Server Actions de exclusão para casca fina sobre a RPC (auto-commit do plano)'
    fi
    marcar_concluidas T-037
    verde "✔ T-037 concluída"
    return 0
  fi
  vermelho "✘ T-037 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-037"
  FALHAS="$FALHAS T-037"
  return 1
}

# ── sequencial T-038 (ordem do tasks.md) ──
executar_seq_T_038() {
  info 'sequencial T-038 — Passo de motivo no `AgendamentoModal` (avulso, pontual, série completa)'
  if rodar_tarefa seq 'T-038' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-038 — "Passo de motivo no `AgendamentoModal` (avulso, pontual, série completa)"
  critérios/refs: AC-044 (Confirmação de exclusão avulsa fica bloqueada sem motivo), AC-045 (Categoria "Outros" exige observação preenchida), AC-046 (Exclusão avulsa bem-sucedida remove o atendimento e grava o log), AC-047 (Exclusão pontual repõe sessão no fim da série e distingue reposição de perda no log), AC-048 (Série sem sessões concluídas é removida por inteiro com log), AC-049 (Série com pelo menos uma sessão concluída é recusada por inteiro)
  arquivos permitidos (e seus testes): src/components/features/agenda/AgendamentoModal.tsx
  mensagem de commit: "T-038 auditoria-exclusao-agendamentos: Passo de motivo no `AgendamentoModal` (avulso, pontual, série completa)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-038 auditoria-exclusao-agendamentos: Passo de motivo no `AgendamentoModal` (avulso, pontual, série completa) (auto-commit do plano)'
    fi
    marcar_concluidas T-038
    verde "✔ T-038 concluída"
    return 0
  fi
  vermelho "✘ T-038 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-038"
  FALHAS="$FALHAS T-038"
  return 1
}

# ── sequencial T-039 (ordem do tasks.md) ──
executar_seq_T_039() {
  info 'sequencial T-039 — Passo de motivo no `ModalSelecaoExclusao` (lote)'
  if rodar_tarefa seq 'T-039' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-039 — "Passo de motivo no `ModalSelecaoExclusao` (lote)"
  critérios/refs: AC-044 (Confirmação de exclusão avulsa fica bloqueada sem motivo), AC-045 (Categoria "Outros" exige observação preenchida), AC-050 (Lote com sessão concluída é recusado por inteiro), AC-051 (Lote totalmente pendente é excluído com log do escopo)
  arquivos permitidos (e seus testes): src/components/features/agenda/ModalSelecaoExclusao.tsx
  mensagem de commit: "T-039 auditoria-exclusao-agendamentos: Passo de motivo no `ModalSelecaoExclusao` (lote)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-039 auditoria-exclusao-agendamentos: Passo de motivo no `ModalSelecaoExclusao` (lote) (auto-commit do plano)'
    fi
    marcar_concluidas T-039
    verde "✔ T-039 concluída"
    return 0
  fi
  vermelho "✘ T-039 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-039"
  FALHAS="$FALHAS T-039"
  return 1
}

# ── sequencial T-040 (ordem do tasks.md) ──
executar_seq_T_040() {
  info 'sequencial T-040 — Aba "Logs" em `/pacientes/[id]`'
  if rodar_tarefa seq 'T-040' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-040 — "Aba "Logs" em `/pacientes/[id]`"
  critérios/refs: AC-058 (Aba Logs lista as exclusões do paciente em ordem cronológica decrescente)
  arquivos permitidos (e seus testes): src/actions/pacientes.ts, src/components/features/pacientes/TabLogsPaciente.tsx, src/components/features/pacientes/PacienteTabsClient.tsx
  mensagem de commit: "T-040 auditoria-exclusao-agendamentos: Aba "Logs" em `/pacientes/[id]`"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-040 auditoria-exclusao-agendamentos: Aba "Logs" em `/pacientes/[id]` (auto-commit do plano)'
    fi
    marcar_concluidas T-040
    verde "✔ T-040 concluída"
    return 0
  fi
  vermelho "✘ T-040 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-040"
  FALHAS="$FALHAS T-040"
  return 1
}

# ── sequencial T-041 (ordem do tasks.md) ──
executar_seq_T_041() {
  info 'sequencial T-041 — Painel `/relatorios/auditoria-exclusoes` com os 4 filtros'
  if rodar_tarefa seq 'T-041' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-041 — "Painel `/relatorios/auditoria-exclusoes` com os 4 filtros"
  critérios/refs: AC-059 (Painel gerencial é restrito a gestor do sistema), AC-060 (Painel filtra por período, profissional, operador e motivo simultaneamente)
  arquivos permitidos (e seus testes): src/app/(painel)/relatorios/auditoria-exclusoes/page.tsx, src/actions/relatorios-auditoria.ts
  mensagem de commit: "T-041 auditoria-exclusao-agendamentos: Painel `/relatorios/auditoria-exclusoes` com os 4 filtros"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-041 auditoria-exclusao-agendamentos: Painel `/relatorios/auditoria-exclusoes` com os 4 filtros (auto-commit do plano)'
    fi
    marcar_concluidas T-041
    verde "✔ T-041 concluída"
    return 0
  fi
  vermelho "✘ T-041 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-041"
  FALHAS="$FALHAS T-041"
  return 1
}

# ── sequencial T-042 (ordem do tasks.md) ──
executar_seq_T_042() {
  info 'sequencial T-042 — Roteiro de aplicação em produção + validação manual dos 4 escopos e das 2 recusas de trigger'
  if rodar_tarefa seq 'T-042' 'Você executa UMA tarefa da feature "auditoria-exclusao-agendamentos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/auditoria-exclusao-agendamentos/spec.md, .spec/features/auditoria-exclusao-agendamentos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-042 — "Roteiro de aplicação em produção + validação manual dos 4 escopos e das 2 recusas de trigger"
  critérios/refs: AC-049 (Série com pelo menos uma sessão concluída é recusada por inteiro), AC-050 (Lote com sessão concluída é recusado por inteiro), AC-052 (Função transacional recusa exclusão de qualquer atendimento concluído, em qualquer escopo), AC-054 (Falha em qualquer etapa desfaz log e exclusão juntos (tudo ou nada)), AC-055 (Registro de log não pode ser alterado nem apagado, nem pelo service role), AC-056 (Operador nulo ou inexistente bloqueia a exclusão), AC-057 (Categoria de motivo inexistente ou inativa é recusada)
  arquivos permitidos (e seus testes): docs/ROTEIRO_APLICACAO_auditoria_exclusao.md
  mensagem de commit: "T-042 auditoria-exclusao-agendamentos: Roteiro de aplicação em produção + validação manual dos 4 escopos e das 2 recusas de trigger"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-042 auditoria-exclusao-agendamentos: Roteiro de aplicação em produção + validação manual dos 4 escopos e das 2 recusas de trigger (auto-commit do plano)'
    fi
    marcar_concluidas T-042
    verde "✔ T-042 concluída"
    return 0
  fi
  vermelho "✘ T-042 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --seq T-042"
  FALHAS="$FALHAS T-042"
  return 1
}

# ── gate: quem decide é a máquina ────────────────────────────────────
rodar_gate() {
  echo
  info "gate: verify + audit --ci"
  evento --tipo gate --etapa inicio
  node "$ENGINE" verify "$FEATURE"
  local v=$?
  evento --tipo gate --etapa verify --exit "$v"
  node "$ENGINE" audit --ci
  AUDIT=$?
  evento --tipo gate --etapa audit --exit "$AUDIT"
  # fecha a contabilidade: status das tarefas + prova do verify no git
  if [ -n "$(git status --porcelain -- '.spec')" ]; then
    git add -A -- '.spec'
    git commit -q -m "$FEATURE: status das tarefas + prova do verify (plano)"
    info "status das tarefas e prova do verify commitados"
  fi
  return "$AUDIT"
}

encerrar() { # $1=escopo
  echo
  if [ -n "$FALHAS" ]; then vermelho "faixas/tarefas com falha:$FALHAS"; fi
  # sem gate não existe veredito: NUNCA anunciar alinhamento sem o audit
  if [ "$COM_GATE" -eq 0 ]; then
    evento --tipo fim --exit 1 --escopo "$1"
    if [ -z "$FALHAS" ]; then
      amarelo "○ trabalho de '$1' terminou SEM o gate (--sem-gate) — isto NÃO é prova de nada"
      amarelo "  para o veredito: bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh --gate"
      exit 0
    fi
    vermelho "e ainda há falhas — conserte e rode o gate"
    exit 1
  fi
  rodar_gate
  local audit=$?
  if [ "$audit" -eq 0 ] && [ -z "$FALHAS" ]; then
    evento --tipo fim --exit 0 --escopo "$1"
    verde "✔ plano concluído — especificação e código alinhados (audit exit 0) na branch $BASE_BRANCH"
    info "próximo passo: revise e leve para a main quando quiser (git merge $BASE_BRANCH)"
    exit 0
  fi
  evento --tipo fim --exit 1 --escopo "$1"
  vermelho "plano terminou com pendências — leia a saída do audit acima e os logs em $LOG_DIR"
  amarelo "dica: reexecute só o que falhou (--faixa <id> / --seq <T-xxx>)"
  exit 1
}

executar_tudo() {
  evento --tipo inicio --escopo tudo
  iniciar_resumos
  info "logs em: $LOG_DIR"
  info "resumo geral de andamento: a cada 1 min aqui no terminal (e via: onp-spec resumo)"
  executar_seq_T_033 || true
  executar_seq_T_034 || true
  executar_seq_T_035 || true
  executar_seq_T_036 || true
  executar_seq_T_037 || true
  executar_seq_T_038 || true
  executar_seq_T_039 || true
  executar_seq_T_040 || true
  executar_seq_T_041 || true
  executar_seq_T_042 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-033 (sequencial)"
  echo "  seq       T-034 (sequencial)"
  echo "  seq       T-035 (sequencial)"
  echo "  seq       T-036 (sequencial)"
  echo "  seq       T-037 (sequencial)"
  echo "  seq       T-038 (sequencial)"
  echo "  seq       T-039 (sequencial)"
  echo "  seq       T-040 (sequencial)"
  echo "  seq       T-041 (sequencial)"
  echo "  seq       T-042 (sequencial)"
  echo
  echo "reexecutar uma faixa:    --faixa <id>"
  echo "reexecutar sequencial:   --seq <T-xxx>"
  echo "só o gate:               --gate"
}

MODO="tudo"
ALVO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --listar) MODO="listar" ;;
    --gate) MODO="gate" ;;
    --sem-gate) COM_GATE=0 ;;
    --faixa) MODO="faixa"; ALVO="${2:-}"; shift ;;
    --seq) MODO="seq"; ALVO="${2:-}"; shift ;;
    -h|--help) sed -n "2,14p" "$0"; exit 0 ;;
    *) vermelho "argumento desconhecido: $1"; sed -n "2,14p" "$0"; exit 2 ;;
  esac
  shift
done

if [ "$MODO" = "listar" ]; then listar; exit 0; fi

preparar_ambiente

case "$MODO" in
  tudo) executar_tudo ;;
  gate) COM_GATE=1; iniciar_resumos; encerrar gate ;;
  faixa)
    case "$ALVO" in
      *) falhar "faixa desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
  seq)
    case "$ALVO" in
      T-033) evento --tipo inicio --escopo "seq:T-033"; iniciar_resumos; executar_seq_T_033 || true; encerrar "seq:T-033" ;;
      T-034) evento --tipo inicio --escopo "seq:T-034"; iniciar_resumos; executar_seq_T_034 || true; encerrar "seq:T-034" ;;
      T-035) evento --tipo inicio --escopo "seq:T-035"; iniciar_resumos; executar_seq_T_035 || true; encerrar "seq:T-035" ;;
      T-036) evento --tipo inicio --escopo "seq:T-036"; iniciar_resumos; executar_seq_T_036 || true; encerrar "seq:T-036" ;;
      T-037) evento --tipo inicio --escopo "seq:T-037"; iniciar_resumos; executar_seq_T_037 || true; encerrar "seq:T-037" ;;
      T-038) evento --tipo inicio --escopo "seq:T-038"; iniciar_resumos; executar_seq_T_038 || true; encerrar "seq:T-038" ;;
      T-039) evento --tipo inicio --escopo "seq:T-039"; iniciar_resumos; executar_seq_T_039 || true; encerrar "seq:T-039" ;;
      T-040) evento --tipo inicio --escopo "seq:T-040"; iniciar_resumos; executar_seq_T_040 || true; encerrar "seq:T-040" ;;
      T-041) evento --tipo inicio --escopo "seq:T-041"; iniciar_resumos; executar_seq_T_041 || true; encerrar "seq:T-041" ;;
      T-042) evento --tipo inicio --escopo "seq:T-042"; iniciar_resumos; executar_seq_T_042 || true; encerrar "seq:T-042" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
