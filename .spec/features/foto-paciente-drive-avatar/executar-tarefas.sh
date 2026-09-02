#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano foto-paciente-drive-avatar` em 2026-09-02 19:32
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo foto-paciente-drive-avatar
set -u
set -o pipefail

RUN_ID='medguia-hub-foto-paciente-drive-avatar-mtkht49p'
FEATURE='foto-paciente-drive-avatar'
BASE_BRANCH='spec/foto-paciente-drive-avatar'
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
  git ls-files --error-unmatch -- '.spec/features/foto-paciente-drive-avatar/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/medguia-hub-foto-paciente-drive-avatar-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/medguia-hub-foto-paciente-drive-avatar"
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
    amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --faixa $1"
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
  info 'sequencial T-001 — Migração SQL: colunas de foto em `pacientes`'
  if rodar_tarefa seq 'T-001' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-001 — "Migração SQL: colunas de foto em `pacientes`"
  critérios/refs: US-026, US-028
  arquivos permitidos (e seus testes): database/pacientes_foto_drive_migration.sql
  mensagem de commit: "T-001 foto-paciente-drive-avatar: Migração SQL: colunas de foto em `pacientes`"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-001 foto-paciente-drive-avatar: Migração SQL: colunas de foto em `pacientes` (auto-commit do plano)'
    fi
    marcar_concluidas T-001
    verde "✔ T-001 concluída"
    return 0
  fi
  vermelho "✘ T-001 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-001"
  FALHAS="$FALHAS T-001"
  return 1
}

# ── sequencial T-002 (ordem do tasks.md) ──
executar_seq_T_002() {
  info 'sequencial T-002 — Módulo cliente de validação e redimensionamento de imagem'
  if rodar_tarefa seq 'T-002' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-002 — "Módulo cliente de validação e redimensionamento de imagem"
  critérios/refs: AC-087 (Preview imediato ao selecionar imagem válida), AC-090 (Arquivo que não é imagem de verdade é rejeitado), AC-091 (Arquivo acima do limite é rejeitado pelo servidor)
  arquivos permitidos (e seus testes): src/lib/imagem.ts, src/lib/imagem.test.ts
  mensagem de commit: "T-002 foto-paciente-drive-avatar: Módulo cliente de validação e redimensionamento de imagem"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-002 foto-paciente-drive-avatar: Módulo cliente de validação e redimensionamento de imagem (auto-commit do plano)'
    fi
    marcar_concluidas T-002
    verde "✔ T-002 concluída"
    return 0
  fi
  vermelho "✘ T-002 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-002"
  FALHAS="$FALHAS T-002"
  return 1
}

# ── sequencial T-003 (ordem do tasks.md) ──
executar_seq_T_003() {
  info 'sequencial T-003 — `garantirPastaPacientePorId` chamada com `await` em `criarPaciente`; action retorna `pacienteId` em vez de redirecionar'
  if rodar_tarefa seq 'T-003' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-003 — "`garantirPastaPacientePorId` chamada com `await` em `criarPaciente`; action retorna `pacienteId` em vez de redirecionar"
  critérios/refs: AC-107 (Cadastro bem-sucedido devolve o id do paciente), AC-108 (CPF duplicado não retorna id de paciente nem tenta subir foto), AC-109 (Candidato a duplicado por nome não retorna id de paciente nem tenta subir foto), AC-110 (Criação do paciente aguarda a pasta do Drive antes de retornar)
  arquivos permitidos (e seus testes): src/actions/pacientes.ts, src/lib/types/paciente-form-state.ts
  mensagem de commit: "T-003 foto-paciente-drive-avatar: `garantirPastaPacientePorId` chamada com `await` em `criarPaciente`; action retorna `pacienteId` em vez de redirecionar"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-003 foto-paciente-drive-avatar: `garantirPastaPacientePorId` chamada com `await` em `criarPaciente`; action retorna `pacienteId` em vez de redirecionar (auto-commit do plano)'
    fi
    marcar_concluidas T-003
    verde "✔ T-003 concluída"
    return 0
  fi
  vermelho "✘ T-003 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-003"
  FALHAS="$FALHAS T-003"
  return 1
}

# ── sequencial T-004 (ordem do tasks.md) ──
executar_seq_T_004() {
  info 'sequencial T-004 — Rota `POST/DELETE /api/pacientes/[id]/foto`'
  if rodar_tarefa seq 'T-004' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-004 — "Rota `POST/DELETE /api/pacientes/[id]/foto`"
  critérios/refs: AC-088 (Foto é enviada ao Drive após o paciente ser criado com sucesso), AC-089 (Cadastro conclui mesmo com o Google Drive indisponível), AC-090 (Arquivo que não é imagem de verdade é rejeitado), AC-091 (Arquivo acima do limite é rejeitado pelo servidor), AC-092 (Trocar a foto substitui o arquivo anterior no Drive), AC-093 (Remover a foto limpa o cadastro e o Drive), AC-095 (Remover foto de paciente sem foto é idempotente), AC-103 (Nenhuma permissão pública é criada no arquivo salvo)
  arquivos permitidos (e seus testes): src/app/api/pacientes/[id]/foto/route.ts, src/app/api/pacientes/[id]/foto/route.test.ts
  mensagem de commit: "T-004 foto-paciente-drive-avatar: Rota `POST/DELETE /api/pacientes/[id]/foto`"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-004 foto-paciente-drive-avatar: Rota `POST/DELETE /api/pacientes/[id]/foto` (auto-commit do plano)'
    fi
    marcar_concluidas T-004
    verde "✔ T-004 concluída"
    return 0
  fi
  vermelho "✘ T-004 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-004"
  FALHAS="$FALHAS T-004"
  return 1
}

# ── sequencial T-005 (ordem do tasks.md) ──
executar_seq_T_005() {
  info 'sequencial T-005 — Cliente orquestra pós-cadastro: upload de foto após `pacienteId`, toast de warning em falha do Drive'
  if rodar_tarefa seq 'T-005' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-005 — "Cliente orquestra pós-cadastro: upload de foto após `pacienteId`, toast de warning em falha do Drive"
  critérios/refs: AC-088 (Foto é enviada ao Drive após o paciente ser criado com sucesso), AC-089 (Cadastro conclui mesmo com o Google Drive indisponível)
  arquivos permitidos (e seus testes): src/components/features/pacientes/FormCadastroPaciente.tsx
  mensagem de commit: "T-005 foto-paciente-drive-avatar: Cliente orquestra pós-cadastro: upload de foto após `pacienteId`, toast de warning em falha do Drive"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-005 foto-paciente-drive-avatar: Cliente orquestra pós-cadastro: upload de foto após `pacienteId`, toast de warning em falha do Drive (auto-commit do plano)'
    fi
    marcar_concluidas T-005
    verde "✔ T-005 concluída"
    return 0
  fi
  vermelho "✘ T-005 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-005"
  FALHAS="$FALHAS T-005"
  return 1
}

# ── sequencial T-006 (ordem do tasks.md) ──
executar_seq_T_006() {
  info 'sequencial T-006 — Troca/remoção de foto na edição, fora do submit'
  if rodar_tarefa seq 'T-006' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-006 — "Troca/remoção de foto na edição, fora do submit"
  critérios/refs: AC-092 (Trocar a foto substitui o arquivo anterior no Drive), AC-093 (Remover a foto limpa o cadastro e o Drive), AC-094 (Editar outros campos não mexe na foto), AC-095 (Remover foto de paciente sem foto é idempotente)
  arquivos permitidos (e seus testes): src/components/features/pacientes/FormEditarPaciente.tsx
  mensagem de commit: "T-006 foto-paciente-drive-avatar: Troca/remoção de foto na edição, fora do submit"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-006 foto-paciente-drive-avatar: Troca/remoção de foto na edição, fora do submit (auto-commit do plano)'
    fi
    marcar_concluidas T-006
    verde "✔ T-006 concluída"
    return 0
  fi
  vermelho "✘ T-006 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-006"
  FALHAS="$FALHAS T-006"
  return 1
}

# ── sequencial T-007 (ordem do tasks.md) ──
executar_seq_T_007() {
  info 'sequencial T-007 — Componente único `AvatarPaciente`'
  if rodar_tarefa seq 'T-007' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-007 — "Componente único `AvatarPaciente`"
  critérios/refs: AC-096 (Avatar mostra a foto real quando ela existe), AC-097 (Avatar mostra iniciais quando não há foto), AC-098 (Falha ao carregar a imagem cai para iniciais sem quebrar a tela), AC-099 (Trocar a foto invalida o cache do navegador)
  arquivos permitidos (e seus testes): src/components/features/pacientes/AvatarPaciente.tsx, src/components/features/pacientes/AvatarPaciente.test.tsx
  mensagem de commit: "T-007 foto-paciente-drive-avatar: Componente único `AvatarPaciente`"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-007 foto-paciente-drive-avatar: Componente único `AvatarPaciente` (auto-commit do plano)'
    fi
    marcar_concluidas T-007
    verde "✔ T-007 concluída"
    return 0
  fi
  vermelho "✘ T-007 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-007"
  FALHAS="$FALHAS T-007"
  return 1
}

# ── sequencial T-008 (ordem do tasks.md) ──
executar_seq_T_008() {
  info 'sequencial T-008 — Lightbox extraído de `TabMidiasPaciente` + prop `ampliavel` no `AvatarPaciente`'
  if rodar_tarefa seq 'T-008' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-008 — "Lightbox extraído de `TabMidiasPaciente` + prop `ampliavel` no `AvatarPaciente`"
  critérios/refs: AC-100 (Clicar no avatar com foto e ampliação habilitada abre a visualização ampliada), AC-101 (Avatar sem foto não é clicável mesmo com ampliação habilitada)
  arquivos permitidos (e seus testes): src/components/features/pacientes/LightboxMidia.tsx, src/components/features/pacientes/AvatarPaciente.tsx, src/components/features/pacientes/TabMidiasPaciente.tsx
  mensagem de commit: "T-008 foto-paciente-drive-avatar: Lightbox extraído de `TabMidiasPaciente` + prop `ampliavel` no `AvatarPaciente`"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-008 foto-paciente-drive-avatar: Lightbox extraído de `TabMidiasPaciente` + prop `ampliavel` no `AvatarPaciente` (auto-commit do plano)'
    fi
    marcar_concluidas T-008
    verde "✔ T-008 concluída"
    return 0
  fi
  vermelho "✘ T-008 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-008"
  FALHAS="$FALHAS T-008"
  return 1
}

# ── sequencial T-009 (ordem do tasks.md) ──
executar_seq_T_009() {
  info 'sequencial T-009 — Migrar os 8 pontos de renderização existentes para `AvatarPaciente`'
  if rodar_tarefa seq 'T-009' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-009 — "Migrar os 8 pontos de renderização existentes para `AvatarPaciente`"
  critérios/refs: AC-096 (Avatar mostra a foto real quando ela existe), AC-097 (Avatar mostra iniciais quando não há foto), AC-098 (Falha ao carregar a imagem cai para iniciais sem quebrar a tela), AC-099 (Trocar a foto invalida o cache do navegador), AC-100 (Clicar no avatar com foto e ampliação habilitada abre a visualização ampliada), AC-101 (Avatar sem foto não é clicável mesmo com ampliação habilitada), AC-113 (Paciente inativo por outro motivo continua exibindo a foto normalmente)
  arquivos permitidos (e seus testes): src/app/(painel)/pacientes/[id]/page.tsx, src/app/(painel)/pacientes/page.tsx, src/components/features/pacientes/CardConfirmacaoPaciente.tsx, src/app/(painel)/confirmacoes/semana/page.tsx, src/app/(painel)/follow-ups/page.tsx, src/app/(painel)/prontuarios/page.tsx, src/app/(painel)/prontuarios/[atendimentoId]/page.tsx
  mensagem de commit: "T-009 foto-paciente-drive-avatar: Migrar os 8 pontos de renderização existentes para `AvatarPaciente`"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-009 foto-paciente-drive-avatar: Migrar os 8 pontos de renderização existentes para `AvatarPaciente` (auto-commit do plano)'
    fi
    marcar_concluidas T-009
    verde "✔ T-009 concluída"
    return 0
  fi
  vermelho "✘ T-009 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-009"
  FALHAS="$FALHAS T-009"
  return 1
}

# ── sequencial T-010 (ordem do tasks.md) ──
executar_seq_T_010() {
  info 'sequencial T-010 — Autenticação do proxy de leitura de foto (comportamento existente, sem alteração)'
  if rodar_tarefa seq 'T-010' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-010 — "Autenticação do proxy de leitura de foto (comportamento existente, sem alteração)"
  critérios/refs: AC-102 (Leitura da foto exige sessão autenticada)
  arquivos permitidos (e seus testes): src/app/api/drive/file/[fileId]/route.test.ts
  mensagem de commit: "T-010 foto-paciente-drive-avatar: Autenticação do proxy de leitura de foto (comportamento existente, sem alteração)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-010 foto-paciente-drive-avatar: Autenticação do proxy de leitura de foto (comportamento existente, sem alteração) (auto-commit do plano)'
    fi
    marcar_concluidas T-010
    verde "✔ T-010 concluída"
    return 0
  fi
  vermelho "✘ T-010 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-010"
  FALHAS="$FALHAS T-010"
  return 1
}

# ── sequencial T-011 (ordem do tasks.md) ──
executar_seq_T_011() {
  info 'sequencial T-011 — Medir baseline de performance da agenda (dia cheio, views dia/semana/mês)'
  if rodar_tarefa seq 'T-011' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-011 — "Medir baseline de performance da agenda (dia cheio, views dia/semana/mês)"
  critérios/refs: AC-104 (Avatar aparece nos itens de agendamento das views dia e semana), AC-106 (Avatares da agenda carregam sem bloquear a renderização)
  arquivos permitidos (e seus testes): docs/tdds/006-foto-do-paciente-google-drive-e-avatar.md
  mensagem de commit: "T-011 foto-paciente-drive-avatar: Medir baseline de performance da agenda (dia cheio, views dia/semana/mês)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-011 foto-paciente-drive-avatar: Medir baseline de performance da agenda (dia cheio, views dia/semana/mês) (auto-commit do plano)'
    fi
    marcar_concluidas T-011
    verde "✔ T-011 concluída"
    return 0
  fi
  vermelho "✘ T-011 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-011"
  FALHAS="$FALHAS T-011"
  return 1
}

# ── sequencial T-012 (ordem do tasks.md) ──
executar_seq_T_012() {
  info 'sequencial T-012 — Avatar na agenda (views dia e semana)'
  if rodar_tarefa seq 'T-012' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-012 — "Avatar na agenda (views dia e semana)"
  critérios/refs: AC-104 (Avatar aparece nos itens de agendamento das views dia e semana), AC-105 (View mês não recebe avatar), AC-106 (Avatares da agenda carregam sem bloquear a renderização)
  arquivos permitidos (e seus testes): src/components/features/agenda/AgendamentoItem.tsx, src/app/(painel)/agenda/page.tsx
  mensagem de commit: "T-012 foto-paciente-drive-avatar: Avatar na agenda (views dia e semana)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-012 foto-paciente-drive-avatar: Avatar na agenda (views dia e semana) (auto-commit do plano)'
    fi
    marcar_concluidas T-012
    verde "✔ T-012 concluída"
    return 0
  fi
  vermelho "✘ T-012 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-012"
  FALHAS="$FALHAS T-012"
  return 1
}

# ── sequencial T-013 (ordem do tasks.md) ──
executar_seq_T_013() {
  info 'sequencial T-013 — Remedir a agenda e decidir manter/reverter (Decisão F)'
  if rodar_tarefa seq 'T-013' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-013 — "Remedir a agenda e decidir manter/reverter (Decisão F)"
  critérios/refs: AC-104 (Avatar aparece nos itens de agendamento das views dia e semana), AC-105 (View mês não recebe avatar), AC-106 (Avatares da agenda carregam sem bloquear a renderização)
  arquivos permitidos (e seus testes): docs/tdds/006-foto-do-paciente-google-drive-e-avatar.md
  mensagem de commit: "T-013 foto-paciente-drive-avatar: Remedir a agenda e decidir manter/reverter (Decisão F)"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-013 foto-paciente-drive-avatar: Remedir a agenda e decidir manter/reverter (Decisão F) (auto-commit do plano)'
    fi
    marcar_concluidas T-013
    verde "✔ T-013 concluída"
    return 0
  fi
  vermelho "✘ T-013 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-013"
  FALHAS="$FALHAS T-013"
  return 1
}

# ── sequencial T-014 (ordem do tasks.md) ──
executar_seq_T_014() {
  info 'sequencial T-014 — Rotina automática de limpeza de arquivos órfãos no Drive'
  if rodar_tarefa seq 'T-014' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-014 — "Rotina automática de limpeza de arquivos órfãos no Drive"
  critérios/refs: AC-111 (Rotina automática remove arquivos órfãos detectados)
  arquivos permitidos (e seus testes): src/actions/google-drive.ts, src/lib/limpeza-orfaos-drive.ts, src/lib/limpeza-orfaos-drive.test.ts
  mensagem de commit: "T-014 foto-paciente-drive-avatar: Rotina automática de limpeza de arquivos órfãos no Drive"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-014 foto-paciente-drive-avatar: Rotina automática de limpeza de arquivos órfãos no Drive (auto-commit do plano)'
    fi
    marcar_concluidas T-014
    verde "✔ T-014 concluída"
    return 0
  fi
  vermelho "✘ T-014 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-014"
  FALHAS="$FALHAS T-014"
  return 1
}

# ── sequencial T-015 (ordem do tasks.md) ──
executar_seq_T_015() {
  info 'sequencial T-015 — Exclusão automática da foto ao inativar paciente por óbito'
  if rodar_tarefa seq 'T-015' 'Você executa UMA tarefa da feature "foto-paciente-drive-avatar" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/foto-paciente-drive-avatar/spec.md, .spec/features/foto-paciente-drive-avatar/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-015 — "Exclusão automática da foto ao inativar paciente por óbito"
  critérios/refs: AC-112 (Inativação por óbito remove a foto do paciente)
  arquivos permitidos (e seus testes): src/actions/pacientes.ts, src/lib/paciente-inativacao.ts
  mensagem de commit: "T-015 foto-paciente-drive-avatar: Exclusão automática da foto ao inativar paciente por óbito"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'claude-sonnet-5' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-015 foto-paciente-drive-avatar: Exclusão automática da foto ao inativar paciente por óbito (auto-commit do plano)'
    fi
    marcar_concluidas T-015
    verde "✔ T-015 concluída"
    return 0
  fi
  vermelho "✘ T-015 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --seq T-015"
  FALHAS="$FALHAS T-015"
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
      amarelo "  para o veredito: bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh --gate"
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
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
