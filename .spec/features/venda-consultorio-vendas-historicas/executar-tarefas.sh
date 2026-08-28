#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano venda-consultorio-vendas-historicas` em 2026-08-28 01:00
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo venda-consultorio-vendas-historicas
set -u
set -o pipefail

RUN_ID='medguia-hub-venda-consultorio-vendas-historicas-mtc8wsq9'
FEATURE='venda-consultorio-vendas-historicas'
BASE_BRANCH='spec/venda-consultorio-vendas-historicas'
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
  git ls-files --error-unmatch -- '.spec/features/venda-consultorio-vendas-historicas/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/medguia-hub-venda-consultorio-vendas-historicas-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/medguia-hub-venda-consultorio-vendas-historicas"
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
    amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --faixa $1"
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

# ── sequencial T-001 (ordem do tasks.md) ──
executar_seq_T_001() {
  info 'sequencial T-001 — Migration: coluna venda_em_consultorio, CHECK e índices'
  if rodar_tarefa seq 'T-001' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-001 — "Migration: coluna venda_em_consultorio, CHECK e índices"
  critérios/refs: AC-063 (Persistência correta em criarVenda e editarVenda), AC-064 (Vendas legadas e não-médicas ficam não classificadas), AC-070 (Funções são SECURITY DEFINER com search_path fixo)
  arquivos permitidos (e seus testes): database/vendas_venda_em_consultorio_migration.sql
  mensagem de commit: "T-001 venda-consultorio-vendas-historicas: Migration: coluna venda_em_consultorio, CHECK e índices"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-001 venda-consultorio-vendas-historicas: Migration: coluna venda_em_consultorio, CHECK e índices (auto-commit do plano)'
    fi
    marcar_concluidas T-001
    verde "✔ T-001 concluída"
    return 0
  fi
  vermelho "✘ T-001 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-001"
  FALHAS="$FALHAS T-001"
  return 1
}

# ── sequencial T-002 (ordem do tasks.md) ──
executar_seq_T_002() {
  info 'sequencial T-002 — Toggle no formulário de nova venda'
  if rodar_tarefa seq 'T-002' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-002 — "Toggle no formulário de nova venda"
  critérios/refs: AC-061 (Toggle aparece somente quando origem é Médico), AC-062 (Toggle some e valor é limpo ao trocar de origem)
  arquivos permitidos (e seus testes): src/components/features/vendas/FormNovaVenda.tsx
  mensagem de commit: "T-002 venda-consultorio-vendas-historicas: Toggle no formulário de nova venda"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-002 venda-consultorio-vendas-historicas: Toggle no formulário de nova venda (auto-commit do plano)'
    fi
    marcar_concluidas T-002
    verde "✔ T-002 concluída"
    return 0
  fi
  vermelho "✘ T-002 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-002"
  FALHAS="$FALHAS T-002"
  return 1
}

# ── sequencial T-003 (ordem do tasks.md) ──
executar_seq_T_003() {
  info 'sequencial T-003 — Toggle no formulário de edição de venda'
  if rodar_tarefa seq 'T-003' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-003 — "Toggle no formulário de edição de venda"
  critérios/refs: AC-061 (Toggle aparece somente quando origem é Médico), AC-062 (Toggle some e valor é limpo ao trocar de origem)
  arquivos permitidos (e seus testes): src/components/features/vendas/FormEditarVenda.tsx
  mensagem de commit: "T-003 venda-consultorio-vendas-historicas: Toggle no formulário de edição de venda"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-003 venda-consultorio-vendas-historicas: Toggle no formulário de edição de venda (auto-commit do plano)'
    fi
    marcar_concluidas T-003
    verde "✔ T-003 concluída"
    return 0
  fi
  vermelho "✘ T-003 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-003"
  FALHAS="$FALHAS T-003"
  return 1
}

# ── sequencial T-004 (ordem do tasks.md) ──
executar_seq_T_004() {
  info 'sequencial T-004 — Validação do toggle nas Server Actions'
  if rodar_tarefa seq 'T-004' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-004 — "Validação do toggle nas Server Actions"
  critérios/refs: AC-063 (Persistência correta em criarVenda e editarVenda), AC-064 (Vendas legadas e não-médicas ficam não classificadas)
  arquivos permitidos (e seus testes): src/actions/vendas.ts
  mensagem de commit: "T-004 venda-consultorio-vendas-historicas: Validação do toggle nas Server Actions"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-004 venda-consultorio-vendas-historicas: Validação do toggle nas Server Actions (auto-commit do plano)'
    fi
    marcar_concluidas T-004
    verde "✔ T-004 concluída"
    return 0
  fi
  vermelho "✘ T-004 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-004"
  FALHAS="$FALHAS T-004"
  return 1
}

# ── sequencial T-005 (ordem do tasks.md) ──
executar_seq_T_005() {
  info 'sequencial T-005 — Testes unitários do toggle nas actions'
  if rodar_tarefa seq 'T-005' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-005 — "Testes unitários do toggle nas actions"
  critérios/refs: AC-063 (Persistência correta em criarVenda e editarVenda), AC-064 (Vendas legadas e não-médicas ficam não classificadas)
  arquivos permitidos (e seus testes): src/actions/vendas.test.ts
  mensagem de commit: "T-005 venda-consultorio-vendas-historicas: Testes unitários do toggle nas actions"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-005 venda-consultorio-vendas-historicas: Testes unitários do toggle nas actions (auto-commit do plano)'
    fi
    marcar_concluidas T-005
    verde "✔ T-005 concluída"
    return 0
  fi
  vermelho "✘ T-005 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-005"
  FALHAS="$FALHAS T-005"
  return 1
}

# ── sequencial T-006 (ordem do tasks.md) ──
executar_seq_T_006() {
  info 'sequencial T-006 — fn_vendas_resumo_mensal (CTE canônica de venda contável)'
  if rodar_tarefa seq 'T-006' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-006 — "fn_vendas_resumo_mensal (CTE canônica de venda contável)"
  critérios/refs: AC-065 (Agregação mensal correta com filtros), AC-066 (Venda confirmada sem itens conta como R$ 0,00 no denominador), AC-067 (Mês sem vendas não quebra o MoM), AC-068 (Orçamentos ficam fora do faturamento), AC-070 (Funções são SECURITY DEFINER com search_path fixo)
  arquivos permitidos (e seus testes): database/vendas_fn_resumo_mensal_migration.sql
  mensagem de commit: "T-006 venda-consultorio-vendas-historicas: fn_vendas_resumo_mensal (CTE canônica de venda contável)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-006 venda-consultorio-vendas-historicas: fn_vendas_resumo_mensal (CTE canônica de venda contável) (auto-commit do plano)'
    fi
    marcar_concluidas T-006
    verde "✔ T-006 concluída"
    return 0
  fi
  vermelho "✘ T-006 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-006"
  FALHAS="$FALHAS T-006"
  return 1
}

# ── sequencial T-007 (ordem do tasks.md) ──
executar_seq_T_007() {
  info 'sequencial T-007 — fn_vendas_detalhe_mes (drill-down)'
  if rodar_tarefa seq 'T-007' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-007 — "fn_vendas_detalhe_mes (drill-down)"
  critérios/refs: AC-069 (Drill-down mensal sob demanda), AC-070 (Funções são SECURITY DEFINER com search_path fixo)
  arquivos permitidos (e seus testes): database/vendas_fn_detalhe_mes_migration.sql
  mensagem de commit: "T-007 venda-consultorio-vendas-historicas: fn_vendas_detalhe_mes (drill-down)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-007 venda-consultorio-vendas-historicas: fn_vendas_detalhe_mes (drill-down) (auto-commit do plano)'
    fi
    marcar_concluidas T-007
    verde "✔ T-007 concluída"
    return 0
  fi
  vermelho "✘ T-007 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-007"
  FALHAS="$FALHAS T-007"
  return 1
}

# ── sequencial T-008 (ordem do tasks.md) ──
executar_seq_T_008() {
  info 'sequencial T-008 — Roteiro de teste SQL manual das funções'
  if rodar_tarefa seq 'T-008' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-008 — "Roteiro de teste SQL manual das funções"
  critérios/refs: AC-065 (Agregação mensal correta com filtros), AC-066 (Venda confirmada sem itens conta como R$ 0,00 no denominador), AC-067 (Mês sem vendas não quebra o MoM), AC-068 (Orçamentos ficam fora do faturamento), AC-069 (Drill-down mensal sob demanda)
  arquivos permitidos (e seus testes): database/vendas_funcoes_roteiro_teste.sql
  mensagem de commit: "T-008 venda-consultorio-vendas-historicas: Roteiro de teste SQL manual das funções"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-008 venda-consultorio-vendas-historicas: Roteiro de teste SQL manual das funções (auto-commit do plano)'
    fi
    marcar_concluidas T-008
    verde "✔ T-008 concluída"
    return 0
  fi
  vermelho "✘ T-008 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-008"
  FALHAS="$FALHAS T-008"
  return 1
}

# ── sequencial T-009 (ordem do tasks.md) ──
executar_seq_T_009() {
  info 'sequencial T-009 — Segmentação consultório/fisio em /relatorios/vendas'
  if rodar_tarefa seq 'T-009' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-009 — "Segmentação consultório/fisio em /relatorios/vendas"
  critérios/refs: AC-071 (Filtro de modalidade de fechamento), AC-072 (Cards de faturamento por modalidade e taxa de conversão), AC-073 (Tabelas de médico referenciador e profissional mostram a divisão), AC-074 (Tag visual na listagem detalhada)
  arquivos permitidos (e seus testes): src/app/(painel)/relatorios/vendas/page.tsx
  mensagem de commit: "T-009 venda-consultorio-vendas-historicas: Segmentação consultório/fisio em /relatorios/vendas"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-009 venda-consultorio-vendas-historicas: Segmentação consultório/fisio em /relatorios/vendas (auto-commit do plano)'
    fi
    marcar_concluidas T-009
    verde "✔ T-009 concluída"
    return 0
  fi
  vermelho "✘ T-009 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-009"
  FALHAS="$FALHAS T-009"
  return 1
}

# ── sequencial T-010 (ordem do tasks.md) ──
executar_seq_T_010() {
  info 'sequencial T-010 — Bloco de resumo médico no PDF de vendas'
  if rodar_tarefa seq 'T-010' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-010 — "Bloco de resumo médico no PDF de vendas"
  critérios/refs: AC-075 (PDF do relatório inclui o resumo por modalidade)
  arquivos permitidos (e seus testes): src/lib/relatorios/pdf-vendas.ts
  mensagem de commit: "T-010 venda-consultorio-vendas-historicas: Bloco de resumo médico no PDF de vendas"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-010 venda-consultorio-vendas-historicas: Bloco de resumo médico no PDF de vendas (auto-commit do plano)'
    fi
    marcar_concluidas T-010
    verde "✔ T-010 concluída"
    return 0
  fi
  vermelho "✘ T-010 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-010"
  FALHAS="$FALHAS T-010"
  return 1
}

# ── sequencial T-011 (ordem do tasks.md) ──
executar_seq_T_011() {
  info 'sequencial T-011 — Migrar KPIs de /relatorios/vendas para fn_vendas_resumo_mensal + paginação da listagem'
  if rodar_tarefa seq 'T-011' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-011 — "Migrar KPIs de /relatorios/vendas para fn_vendas_resumo_mensal + paginação da listagem"
  critérios/refs: AC-076 (KPIs de topo batem com a função canônica), AC-077 (Query de listagem usa paginação explícita)
  arquivos permitidos (e seus testes): src/app/(painel)/relatorios/vendas/page.tsx
  mensagem de commit: "T-011 venda-consultorio-vendas-historicas: Migrar KPIs de /relatorios/vendas para fn_vendas_resumo_mensal + paginação da listagem"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-011 venda-consultorio-vendas-historicas: Migrar KPIs de /relatorios/vendas para fn_vendas_resumo_mensal + paginação da listagem (auto-commit do plano)'
    fi
    marcar_concluidas T-011
    verde "✔ T-011 concluída"
    return 0
  fi
  vermelho "✘ T-011 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-011"
  FALHAS="$FALHAS T-011"
  return 1
}

# ── sequencial T-012 (ordem do tasks.md) ──
executar_seq_T_012() {
  info 'sequencial T-012 — Testes unitários de agregação e MoM (funções puras)'
  if rodar_tarefa seq 'T-012' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-012 — "Testes unitários de agregação e MoM (funções puras)"
  critérios/refs: AC-067 (Mês sem vendas não quebra o MoM), AC-076 (KPIs de topo batem com a função canônica), AC-078 (Cards executivos de resumo), AC-080 (Tabela mês a mês com MoM)
  arquivos permitidos (e seus testes): src/lib/relatorios/vendas-historicas.ts, src/lib/relatorios/vendas-historicas.test.ts
  mensagem de commit: "T-012 venda-consultorio-vendas-historicas: Testes unitários de agregação e MoM (funções puras)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-012 venda-consultorio-vendas-historicas: Testes unitários de agregação e MoM (funções puras) (auto-commit do plano)'
    fi
    marcar_concluidas T-012
    verde "✔ T-012 concluída"
    return 0
  fi
  vermelho "✘ T-012 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-012"
  FALHAS="$FALHAS T-012"
  return 1
}

# ── sequencial T-013 (ordem do tasks.md) ──
executar_seq_T_013() {
  info 'sequencial T-013 — Menu lateral: link para /relatorios/vendas-historicas'
  if rodar_tarefa seq 'T-013' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-013 — "Menu lateral: link para /relatorios/vendas-historicas"
  critérios/refs: AC-085 (Link de acesso no menu lateral)
  arquivos permitidos (e seus testes): src/components/layout/Sidebar.tsx
  mensagem de commit: "T-013 venda-consultorio-vendas-historicas: Menu lateral: link para /relatorios/vendas-historicas"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-013 venda-consultorio-vendas-historicas: Menu lateral: link para /relatorios/vendas-historicas (auto-commit do plano)'
    fi
    marcar_concluidas T-013
    verde "✔ T-013 concluída"
    return 0
  fi
  vermelho "✘ T-013 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-013"
  FALHAS="$FALHAS T-013"
  return 1
}

# ── sequencial T-014 (ordem do tasks.md) ──
executar_seq_T_014() {
  info 'sequencial T-014 — Rota /relatorios/vendas-historicas: cards, gráfico, tabela, filtros'
  if rodar_tarefa seq 'T-014' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-014 — "Rota /relatorios/vendas-historicas: cards, gráfico, tabela, filtros"
  critérios/refs: AC-078 (Cards executivos de resumo), AC-079 (Gráfico com seletores de período e alternância de métrica), AC-080 (Tabela mês a mês com MoM), AC-082 (Filtros globais por profissional, médico, origem e categoria), AC-083 (Responsividade do gráfico e da tabela), AC-086 (Rota histórica bloqueada para perfil sem permissão de relatório consolidado)
  arquivos permitidos (e seus testes): src/app/(painel)/relatorios/vendas-historicas/page.tsx
  mensagem de commit: "T-014 venda-consultorio-vendas-historicas: Rota /relatorios/vendas-historicas: cards, gráfico, tabela, filtros"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-014 venda-consultorio-vendas-historicas: Rota /relatorios/vendas-historicas: cards, gráfico, tabela, filtros (auto-commit do plano)'
    fi
    marcar_concluidas T-014
    verde "✔ T-014 concluída"
    return 0
  fi
  vermelho "✘ T-014 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-014"
  FALHAS="$FALHAS T-014"
  return 1
}

# ── sequencial T-015 (ordem do tasks.md) ──
executar_seq_T_015() {
  info 'sequencial T-015 — Drill-down expansível por linha da tabela histórica'
  if rodar_tarefa seq 'T-015' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-015 — "Drill-down expansível por linha da tabela histórica"
  critérios/refs: AC-081 (Drill-down expansível por linha)
  arquivos permitidos (e seus testes): src/app/(painel)/relatorios/vendas-historicas/DrillDownMes.tsx
  mensagem de commit: "T-015 venda-consultorio-vendas-historicas: Drill-down expansível por linha da tabela histórica"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-015 venda-consultorio-vendas-historicas: Drill-down expansível por linha da tabela histórica (auto-commit do plano)'
    fi
    marcar_concluidas T-015
    verde "✔ T-015 concluída"
    return 0
  fi
  vermelho "✘ T-015 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-015"
  FALHAS="$FALHAS T-015"
  return 1
}

# ── sequencial T-016 (ordem do tasks.md) ──
executar_seq_T_016() {
  info 'sequencial T-016 — Exportação PDF e XLSX do relatório histórico'
  if rodar_tarefa seq 'T-016' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-016 — "Exportação PDF e XLSX do relatório histórico"
  critérios/refs: AC-084 (Exportação PDF e XLSX)
  arquivos permitidos (e seus testes): src/lib/relatorios/pdf-vendas-historicas.ts, src/lib/relatorios/xlsx-vendas-historicas.ts
  mensagem de commit: "T-016 venda-consultorio-vendas-historicas: Exportação PDF e XLSX do relatório histórico"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-016 venda-consultorio-vendas-historicas: Exportação PDF e XLSX do relatório histórico (auto-commit do plano)'
    fi
    marcar_concluidas T-016
    verde "✔ T-016 concluída"
    return 0
  fi
  vermelho "✘ T-016 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-016"
  FALHAS="$FALHAS T-016"
  return 1
}

# ── sequencial T-017 (ordem do tasks.md) ──
executar_seq_T_017() {
  info 'sequencial T-017 — Verificação de controle de acesso da rota histórica'
  if rodar_tarefa seq 'T-017' 'Você executa UMA tarefa da feature "venda-consultorio-vendas-historicas" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/venda-consultorio-vendas-historicas/spec.md, .spec/features/venda-consultorio-vendas-historicas/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-017 — "Verificação de controle de acesso da rota histórica"
  critérios/refs: AC-086 (Rota histórica bloqueada para perfil sem permissão de relatório consolidado)
  arquivos permitidos (e seus testes): src/app/(painel)/relatorios/vendas-historicas/page.test.ts
  mensagem de commit: "T-017 venda-consultorio-vendas-historicas: Verificação de controle de acesso da rota histórica"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-017 venda-consultorio-vendas-historicas: Verificação de controle de acesso da rota histórica (auto-commit do plano)'
    fi
    marcar_concluidas T-017
    verde "✔ T-017 concluída"
    return 0
  fi
  vermelho "✘ T-017 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --seq T-017"
  FALHAS="$FALHAS T-017"
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
      amarelo "  para o veredito: bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh --gate"
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
  executar_seq_T_001 || true
  executar_seq_T_002 || true
  executar_seq_T_003 || true
  executar_seq_T_004 || true
  executar_seq_T_005 || true
  executar_seq_T_006 || true
  executar_seq_T_007 || true
  executar_seq_T_008 || true
  executar_seq_T_009 || true
  executar_seq_T_010 || true
  executar_seq_T_011 || true
  executar_seq_T_012 || true
  executar_seq_T_013 || true
  executar_seq_T_014 || true
  executar_seq_T_015 || true
  executar_seq_T_016 || true
  executar_seq_T_017 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-001 (sequencial)"
  echo "  seq       T-002 (sequencial)"
  echo "  seq       T-003 (sequencial)"
  echo "  seq       T-004 (sequencial)"
  echo "  seq       T-005 (sequencial)"
  echo "  seq       T-006 (sequencial)"
  echo "  seq       T-007 (sequencial)"
  echo "  seq       T-008 (sequencial)"
  echo "  seq       T-009 (sequencial)"
  echo "  seq       T-010 (sequencial)"
  echo "  seq       T-011 (sequencial)"
  echo "  seq       T-012 (sequencial)"
  echo "  seq       T-013 (sequencial)"
  echo "  seq       T-014 (sequencial)"
  echo "  seq       T-015 (sequencial)"
  echo "  seq       T-016 (sequencial)"
  echo "  seq       T-017 (sequencial)"
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
      T-001) evento --tipo inicio --escopo "seq:T-001"; iniciar_resumos; executar_seq_T_001 || true; encerrar "seq:T-001" ;;
      T-002) evento --tipo inicio --escopo "seq:T-002"; iniciar_resumos; executar_seq_T_002 || true; encerrar "seq:T-002" ;;
      T-003) evento --tipo inicio --escopo "seq:T-003"; iniciar_resumos; executar_seq_T_003 || true; encerrar "seq:T-003" ;;
      T-004) evento --tipo inicio --escopo "seq:T-004"; iniciar_resumos; executar_seq_T_004 || true; encerrar "seq:T-004" ;;
      T-005) evento --tipo inicio --escopo "seq:T-005"; iniciar_resumos; executar_seq_T_005 || true; encerrar "seq:T-005" ;;
      T-006) evento --tipo inicio --escopo "seq:T-006"; iniciar_resumos; executar_seq_T_006 || true; encerrar "seq:T-006" ;;
      T-007) evento --tipo inicio --escopo "seq:T-007"; iniciar_resumos; executar_seq_T_007 || true; encerrar "seq:T-007" ;;
      T-008) evento --tipo inicio --escopo "seq:T-008"; iniciar_resumos; executar_seq_T_008 || true; encerrar "seq:T-008" ;;
      T-009) evento --tipo inicio --escopo "seq:T-009"; iniciar_resumos; executar_seq_T_009 || true; encerrar "seq:T-009" ;;
      T-010) evento --tipo inicio --escopo "seq:T-010"; iniciar_resumos; executar_seq_T_010 || true; encerrar "seq:T-010" ;;
      T-011) evento --tipo inicio --escopo "seq:T-011"; iniciar_resumos; executar_seq_T_011 || true; encerrar "seq:T-011" ;;
      T-012) evento --tipo inicio --escopo "seq:T-012"; iniciar_resumos; executar_seq_T_012 || true; encerrar "seq:T-012" ;;
      T-013) evento --tipo inicio --escopo "seq:T-013"; iniciar_resumos; executar_seq_T_013 || true; encerrar "seq:T-013" ;;
      T-014) evento --tipo inicio --escopo "seq:T-014"; iniciar_resumos; executar_seq_T_014 || true; encerrar "seq:T-014" ;;
      T-015) evento --tipo inicio --escopo "seq:T-015"; iniciar_resumos; executar_seq_T_015 || true; encerrar "seq:T-015" ;;
      T-016) evento --tipo inicio --escopo "seq:T-016"; iniciar_resumos; executar_seq_T_016 || true; encerrar "seq:T-016" ;;
      T-017) evento --tipo inicio --escopo "seq:T-017"; iniciar_resumos; executar_seq_T_017 || true; encerrar "seq:T-017" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
