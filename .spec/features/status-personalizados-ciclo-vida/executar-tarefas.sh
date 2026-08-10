#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano status-personalizados-ciclo-vida` em 2026-08-10 17:22
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo status-personalizados-ciclo-vida
set -u
set -o pipefail

RUN_ID='medguia-hub-status-personalizados-ciclo-vida-msni1mkd'
FEATURE='status-personalizados-ciclo-vida'
BASE_BRANCH='spec/status-personalizados-ciclo-vida'
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
  git ls-files --error-unmatch -- '.spec/features/status-personalizados-ciclo-vida/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/medguia-hub-status-personalizados-ciclo-vida"
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
    amarelo "  reexecute só ela: bash .spec/features/status-personalizados-ciclo-vida/executar-tarefas.sh --faixa $1"
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

# ── faixa-1: T-001 ──
executar_faixa_1() {
  local WT="$WT_BASE-faixa-1"
  preparar_worktree 'faixa-1' 'spec/status-personalizados-ciclo-vida-faixa-1' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-1' --estado executando --tentativa "$(tentativa 'faixa-1')"
  : > "$LOG_DIR/faixa-1.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-1' 'T-001' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-001 — "Regras puras de status: validação, classificação e vencimento"
  critérios/refs: AC-001 (Status que exige justificativa recusa troca sem texto), AC-002 (Status sem exigência aceita observação vazia), AC-007 (Bloco vencido é sinalizado na tela), AC-011 ("Em atendimento" não é oferecido como escolha), AC-012 (Status de sistema não pode ser editado nem removido)
  arquivos permitidos (e seus testes): src/lib/status-disponibilidade-regras.ts, src/lib/status-disponibilidade-regras.test.ts
  mensagem de commit: "T-001 status-personalizados-ciclo-vida: Regras puras de status: validação, classificação e vencimento"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium
  ) >> "$LOG_DIR/faixa-1.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-1' 'spec/status-personalizados-ciclo-vida-faixa-1' "$WT" "$st" || return 1
  marcar_concluidas T-001
  return 0
}

# ── faixa-2: T-002 ──
executar_faixa_2() {
  local WT="$WT_BASE-faixa-2"
  preparar_worktree 'faixa-2' 'spec/status-personalizados-ciclo-vida-faixa-2' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-2' --estado executando --tentativa "$(tentativa 'faixa-2')"
  : > "$LOG_DIR/faixa-2.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-2' 'T-002' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-002 — "Catálogo no cliente: "Em atendimento" vira status de sistema"
  critérios/refs: AC-011 ("Em atendimento" não é oferecido como escolha), AC-013 (Rótulo muda, identificador permanece)
  arquivos permitidos (e seus testes): src/lib/status-disponibilidade-cores.ts
  mensagem de commit: "T-002 status-personalizados-ciclo-vida: Catálogo no cliente: "Em atendimento" vira status de sistema"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' low
  ) >> "$LOG_DIR/faixa-2.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-2' 'spec/status-personalizados-ciclo-vida-faixa-2' "$WT" "$st" || return 1
  marcar_concluidas T-002
  return 0
}

# ── faixa-3: T-004 ──
executar_faixa_3() {
  local WT="$WT_BASE-faixa-3"
  preparar_worktree 'faixa-3' 'spec/status-personalizados-ciclo-vida-faixa-3' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-3' --estado executando --tentativa "$(tentativa 'faixa-3')"
  : > "$LOG_DIR/faixa-3.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-3' 'T-004' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-004 — "Regra de inclusão de profissional no relatório"
  critérios/refs: AC-014 (Quem trabalhou no período continua no relatório), AC-015 (Quem saiu some dos períodos seguintes), AC-016 (Quem está na folha aparece mesmo sem registro)
  arquivos permitidos (e seus testes): src/lib/relatorios/inclusao-profissional.ts, src/lib/relatorios/inclusao-profissional.test.ts
  mensagem de commit: "T-004 status-personalizados-ciclo-vida: Regra de inclusão de profissional no relatório"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' low
  ) >> "$LOG_DIR/faixa-3.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-3' 'spec/status-personalizados-ciclo-vida-faixa-3' "$WT" "$st" || return 1
  marcar_concluidas T-004
  return 0
}

# ── faixa-4: T-005 ──
executar_faixa_4() {
  local WT="$WT_BASE-faixa-4"
  preparar_worktree 'faixa-4' 'spec/status-personalizados-ciclo-vida-faixa-4' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-4' --estado executando --tentativa "$(tentativa 'faixa-4')"
  : > "$LOG_DIR/faixa-4.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-4' 'T-005' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-005 — "Migration: observação com lastro no histórico"
  critérios/refs: AC-003 (A observação fica gravada no bloco do histórico)
  arquivos permitidos (e seus testes): database/status_personalizados_observacao_migration.sql, test/sql/observacao.test.ts
  mensagem de commit: "T-005 status-personalizados-ciclo-vida: Migration: observação com lastro no histórico"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium
  ) >> "$LOG_DIR/faixa-4.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-4' 'spec/status-personalizados-ciclo-vida-faixa-4' "$WT" "$st" || return 1
  marcar_concluidas T-005
  return 0
}

# ── faixa-5: T-006 ──
executar_faixa_5() {
  local WT="$WT_BASE-faixa-5"
  preparar_worktree 'faixa-5' 'spec/status-personalizados-ciclo-vida-faixa-5' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-5' --estado executando --tentativa "$(tentativa 'faixa-5')"
  : > "$LOG_DIR/faixa-5.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-5' 'T-006' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-006 — "Migration: teto de 1 hora e devolução para Disponível"
  critérios/refs: AC-004 (O bloco é capado em 1 hora), AC-005 (O profissional volta para Disponível), AC-006 (O histórico é fechado antes do status ser resetado)
  arquivos permitidos (e seus testes): database/status_personalizados_fallback_1h_migration.sql, test/sql/fallback-1h.test.ts
  mensagem de commit: "T-006 status-personalizados-ciclo-vida: Migration: teto de 1 hora e devolução para Disponível"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' high
  ) >> "$LOG_DIR/faixa-5.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-5' 'spec/status-personalizados-ciclo-vida-faixa-5' "$WT" "$st" || return 1
  marcar_concluidas T-006
  return 0
}

# ── faixa-6: T-007 ──
executar_faixa_6() {
  local WT="$WT_BASE-faixa-6"
  preparar_worktree 'faixa-6' 'spec/status-personalizados-ciclo-vida-faixa-6' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-6' --estado executando --tentativa "$(tentativa 'faixa-6')"
  : > "$LOG_DIR/faixa-6.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-6' 'T-007' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-007 — "Migration: contrato dos operacionais e remoção do gatilho legado"
  critérios/refs: AC-013 (Rótulo muda, identificador permanece), AC-018 (O gatilho legado é removido)
  arquivos permitidos (e seus testes): database/status_operacionais_contrato_migration.sql, test/sql/contrato-operacionais.test.ts
  mensagem de commit: "T-007 status-personalizados-ciclo-vida: Migration: contrato dos operacionais e remoção do gatilho legado"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium
  ) >> "$LOG_DIR/faixa-6.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-6' 'spec/status-personalizados-ciclo-vida-faixa-6' "$WT" "$st" || return 1
  marcar_concluidas T-007
  return 0
}

# ── faixa-7: T-008 ──
executar_faixa_7() {
  local WT="$WT_BASE-faixa-7"
  preparar_worktree 'faixa-7' 'spec/status-personalizados-ciclo-vida-faixa-7' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-7' --estado executando --tentativa "$(tentativa 'faixa-7')"
  : > "$LOG_DIR/faixa-7.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-7' 'T-008' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-008 — "Migration: profissional inativo"
  critérios/refs: AC-017 (Desligar limpa o estado ao vivo)
  arquivos permitidos (e seus testes): database/profissional_inativo_migration.sql, test/sql/profissional-inativo.test.ts
  mensagem de commit: "T-008 status-personalizados-ciclo-vida: Migration: profissional inativo"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium
  ) >> "$LOG_DIR/faixa-7.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-7' 'spec/status-personalizados-ciclo-vida-faixa-7' "$WT" "$st" || return 1
  marcar_concluidas T-008
  return 0
}

# ── sequencial T-003 (fora da seleção do usuário) ──
executar_seq_T_003() {
  info 'sequencial T-003 — Modelo de exibição do card da agenda'
  if rodar_tarefa seq 'T-003' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-003 — "Modelo de exibição do card da agenda"
  critérios/refs: AC-008 (O card mostra status, motivo e tempo decorrido), AC-009 (Com atendimento em curso, mostra os dois), AC-010 (Profissional desligado não aparece no card)
  arquivos permitidos (e seus testes): src/lib/status-card-agenda.ts, src/lib/status-card-agenda.test.ts
  mensagem de commit: "T-003 status-personalizados-ciclo-vida: Modelo de exibição do card da agenda"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-003 status-personalizados-ciclo-vida: Modelo de exibição do card da agenda (auto-commit do plano)'
    fi
    marcar_concluidas T-003
    verde "✔ T-003 concluída"
    return 0
  fi
  vermelho "✘ T-003 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/status-personalizados-ciclo-vida/executar-tarefas.sh --seq T-003"
  FALHAS="$FALHAS T-003"
  return 1
}

# ── sequencial T-009 (fora da seleção do usuário) ──
executar_seq_T_009() {
  info 'sequencial T-009 — Ligar a validação de observação na action'
  if rodar_tarefa seq 'T-009' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-009 — "Ligar a validação de observação na action"
  critérios/refs: AC-001 (Status que exige justificativa recusa troca sem texto), AC-002 (Status sem exigência aceita observação vazia)
  arquivos permitidos (e seus testes): src/actions/status-disponibilidade.ts
  mensagem de commit: "T-009 status-personalizados-ciclo-vida: Ligar a validação de observação na action"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-009 status-personalizados-ciclo-vida: Ligar a validação de observação na action (auto-commit do plano)'
    fi
    marcar_concluidas T-009
    verde "✔ T-009 concluída"
    return 0
  fi
  vermelho "✘ T-009 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/status-personalizados-ciclo-vida/executar-tarefas.sh --seq T-009"
  FALHAS="$FALHAS T-009"
  return 1
}

# ── sequencial T-010 (fora da seleção do usuário) ──
executar_seq_T_010() {
  info 'sequencial T-010 — Configuração: marcar quais status exigem observação'
  if rodar_tarefa seq 'T-010' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-010 — "Configuração: marcar quais status exigem observação"
  critérios/refs: AC-012 (Status de sistema não pode ser editado nem removido)
  arquivos permitidos (e seus testes): src/actions/status-disponibilidade-config.ts, src/app/(painel)/configuracoes/status-disponibilidade/page.tsx
  mensagem de commit: "T-010 status-personalizados-ciclo-vida: Configuração: marcar quais status exigem observação"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-010 status-personalizados-ciclo-vida: Configuração: marcar quais status exigem observação (auto-commit do plano)'
    fi
    marcar_concluidas T-010
    verde "✔ T-010 concluída"
    return 0
  fi
  vermelho "✘ T-010 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/status-personalizados-ciclo-vida/executar-tarefas.sh --seq T-010"
  FALHAS="$FALHAS T-010"
  return 1
}

# ── sequencial T-011 (fora da seleção do usuário) ──
executar_seq_T_011() {
  info 'sequencial T-011 — Widget: campo de observação na troca de status'
  if rodar_tarefa seq 'T-011' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-011 — "Widget: campo de observação na troca de status"
  critérios/refs: AC-001 (Status que exige justificativa recusa troca sem texto), AC-011 ("Em atendimento" não é oferecido como escolha)
  arquivos permitidos (e seus testes): src/components/features/configuracoes/WidgetDisponibilidade.tsx
  mensagem de commit: "T-011 status-personalizados-ciclo-vida: Widget: campo de observação na troca de status"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-011 status-personalizados-ciclo-vida: Widget: campo de observação na troca de status (auto-commit do plano)'
    fi
    marcar_concluidas T-011
    verde "✔ T-011 concluída"
    return 0
  fi
  vermelho "✘ T-011 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/status-personalizados-ciclo-vida/executar-tarefas.sh --seq T-011"
  FALHAS="$FALHAS T-011"
  return 1
}

# ── sequencial T-012 (fora da seleção do usuário) ──
executar_seq_T_012() {
  info 'sequencial T-012 — Card de status na rota de agendamento'
  if rodar_tarefa seq 'T-012' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-012 — "Card de status na rota de agendamento"
  critérios/refs: AC-008 (O card mostra status, motivo e tempo decorrido), AC-009 (Com atendimento em curso, mostra os dois), AC-010 (Profissional desligado não aparece no card)
  arquivos permitidos (e seus testes): src/components/features/agenda/CardStatusEquipe.tsx, src/app/(painel)/agenda/page.tsx
  mensagem de commit: "T-012 status-personalizados-ciclo-vida: Card de status na rota de agendamento"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-012 status-personalizados-ciclo-vida: Card de status na rota de agendamento (auto-commit do plano)'
    fi
    marcar_concluidas T-012
    verde "✔ T-012 concluída"
    return 0
  fi
  vermelho "✘ T-012 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/status-personalizados-ciclo-vida/executar-tarefas.sh --seq T-012"
  FALHAS="$FALHAS T-012"
  return 1
}

# ── sequencial T-013 (fora da seleção do usuário) ──
executar_seq_T_013() {
  info 'sequencial T-013 — Relatório passa a incluir por presença de dado'
  if rodar_tarefa seq 'T-013' 'Você executa UMA tarefa da feature "status-personalizados-ciclo-vida" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/status-personalizados-ciclo-vida/spec.md, .spec/features/status-personalizados-ciclo-vida/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-013 — "Relatório passa a incluir por presença de dado"
  critérios/refs: AC-014 (Quem trabalhou no período continua no relatório), AC-015 (Quem saiu some dos períodos seguintes), AC-016 (Quem está na folha aparece mesmo sem registro)
  arquivos permitidos (e seus testes): src/app/(painel)/relatorios/tempo-fabril/page.tsx
  mensagem de commit: "T-013 status-personalizados-ciclo-vida: Relatório passa a incluir por presença de dado"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-013 status-personalizados-ciclo-vida: Relatório passa a incluir por presença de dado (auto-commit do plano)'
    fi
    marcar_concluidas T-013
    verde "✔ T-013 concluída"
    return 0
  fi
  vermelho "✘ T-013 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/status-personalizados-ciclo-vida/executar-tarefas.sh --seq T-013"
  FALHAS="$FALHAS T-013"
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
      amarelo "  para o veredito: bash .spec/features/status-personalizados-ciclo-vida/executar-tarefas.sh --gate"
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
  # onda 1: faixa-1 ∥ faixa-2 ∥ faixa-3
  info "onda 1: faixa-1 ∥ faixa-2 ∥ faixa-3 — janelas limpas em paralelo"
  executar_faixa_1 & PID_FAIXA_1=$!
  executar_faixa_2 & PID_FAIXA_2=$!
  executar_faixa_3 & PID_FAIXA_3=$!
  wait "$PID_FAIXA_1" || true
  wait "$PID_FAIXA_2" || true
  wait "$PID_FAIXA_3" || true
  # onda 2: faixa-4 ∥ faixa-5 ∥ faixa-6
  info "onda 2: faixa-4 ∥ faixa-5 ∥ faixa-6 — janelas limpas em paralelo"
  executar_faixa_4 & PID_FAIXA_4=$!
  executar_faixa_5 & PID_FAIXA_5=$!
  executar_faixa_6 & PID_FAIXA_6=$!
  wait "$PID_FAIXA_4" || true
  wait "$PID_FAIXA_5" || true
  wait "$PID_FAIXA_6" || true
  # onda 3: faixa-7
  info "onda 3: faixa-7 — janelas limpas em paralelo"
  executar_faixa_7 & PID_FAIXA_7=$!
  wait "$PID_FAIXA_7" || true
  executar_seq_T_003 || true
  executar_seq_T_009 || true
  executar_seq_T_010 || true
  executar_seq_T_011 || true
  executar_seq_T_012 || true
  executar_seq_T_013 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  faixa-1  onda 1  T-001"
  echo "  faixa-2  onda 1  T-002"
  echo "  faixa-3  onda 1  T-004"
  echo "  faixa-4  onda 2  T-005"
  echo "  faixa-5  onda 2  T-006"
  echo "  faixa-6  onda 2  T-007"
  echo "  faixa-7  onda 3  T-008"
  echo "  seq       T-003 (sequencial)"
  echo "  seq       T-009 (sequencial)"
  echo "  seq       T-010 (sequencial)"
  echo "  seq       T-011 (sequencial)"
  echo "  seq       T-012 (sequencial)"
  echo "  seq       T-013 (sequencial)"
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
      faixa-1) evento --tipo inicio --escopo "faixa:faixa-1"; iniciar_resumos; executar_faixa_1 || true; encerrar "faixa:faixa-1" ;;
      faixa-2) evento --tipo inicio --escopo "faixa:faixa-2"; iniciar_resumos; executar_faixa_2 || true; encerrar "faixa:faixa-2" ;;
      faixa-3) evento --tipo inicio --escopo "faixa:faixa-3"; iniciar_resumos; executar_faixa_3 || true; encerrar "faixa:faixa-3" ;;
      faixa-4) evento --tipo inicio --escopo "faixa:faixa-4"; iniciar_resumos; executar_faixa_4 || true; encerrar "faixa:faixa-4" ;;
      faixa-5) evento --tipo inicio --escopo "faixa:faixa-5"; iniciar_resumos; executar_faixa_5 || true; encerrar "faixa:faixa-5" ;;
      faixa-6) evento --tipo inicio --escopo "faixa:faixa-6"; iniciar_resumos; executar_faixa_6 || true; encerrar "faixa:faixa-6" ;;
      faixa-7) evento --tipo inicio --escopo "faixa:faixa-7"; iniciar_resumos; executar_faixa_7 || true; encerrar "faixa:faixa-7" ;;
      *) falhar "faixa desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
  seq)
    case "$ALVO" in
      T-003) evento --tipo inicio --escopo "seq:T-003"; iniciar_resumos; executar_seq_T_003 || true; encerrar "seq:T-003" ;;
      T-009) evento --tipo inicio --escopo "seq:T-009"; iniciar_resumos; executar_seq_T_009 || true; encerrar "seq:T-009" ;;
      T-010) evento --tipo inicio --escopo "seq:T-010"; iniciar_resumos; executar_seq_T_010 || true; encerrar "seq:T-010" ;;
      T-011) evento --tipo inicio --escopo "seq:T-011"; iniciar_resumos; executar_seq_T_011 || true; encerrar "seq:T-011" ;;
      T-012) evento --tipo inicio --escopo "seq:T-012"; iniciar_resumos; executar_seq_T_012 || true; encerrar "seq:T-012" ;;
      T-013) evento --tipo inicio --escopo "seq:T-013"; iniciar_resumos; executar_seq_T_013 || true; encerrar "seq:T-013" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
