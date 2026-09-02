# Tasks: Foto do paciente com Google Drive e avatar dinâmico

> feature: foto-paciente-drive-avatar

## T-001 — Migração SQL: colunas de foto em `pacientes` [concluida]
- Refs: US-026, US-028
- Arquivos: database/pacientes_foto_drive_migration.sql
- Notas: `ADD COLUMN IF NOT EXISTS foto_drive_file_id TEXT`, `foto_atualizada_em TIMESTAMPTZ`, índice parcial. Sem `foto_drive_url` (Decisão A). Aplicar via SQL Editor do Studio (DDL não passa por REST). Nenhum AC de teste automatizado directo — é pré-requisito das demais tarefas.

## T-002 — Módulo cliente de validação e redimensionamento de imagem [concluida]
- Refs: AC-087, AC-090, AC-091
- Arquivos: src/lib/imagem.ts, src/lib/imagem.test.ts
- Notas: valida extensão/MIME/tamanho (rejeita >10MB antes de ler o arquivo), redimensiona lado maior para 1024px, exporta WebP q80 com fallback JPEG. Gera o preview usado no AC-087.

## T-003 — `garantirPastaPacientePorId` chamada com `await` em `criarPaciente`; action retorna `pacienteId` em vez de redirecionar [pendente]

- Refs: AC-107, AC-108, AC-109, AC-110
- Arquivos: src/actions/pacientes.ts, src/lib/types/paciente-form-state.ts
- Notas: troca `void criarPastaPaciente(...)` por `await`; troca `redirect('/pacientes')` por retorno de `{ pacienteId }` no `PacienteFormState`. Os caminhos de CPF duplicado e candidato a duplicado (que já retornam estado) precisam continuar sem `pacienteId`. É o risco mais alto da entrega — implementar e provar antes de qualquer tarefa de UI depender dela.

## T-004 — Rota `POST/DELETE /api/pacientes/[id]/foto` [pendente]

- Refs: AC-088, AC-089, AC-090, AC-091, AC-092, AC-093, AC-095, AC-103
- Arquivos: src/app/api/pacientes/[id]/foto/route.ts, src/app/api/pacientes/[id]/foto/route.test.ts
- Notas: valida sessão (401), valida MIME por magic bytes (400), teto de 2MB (400), garante pasta do paciente, sobe o arquivo (nome `foto_perfil_[ID8].{ext}`, permissão herdada da pasta — sem `anyoneWithLink`), persiste `foto_drive_file_id`/`foto_atualizada_em`, só então apaga o `fileId` anterior. `DELETE` idempotente em paciente sem foto (200, AC-095). Depende de T-001 (colunas) e T-002 (limite de 2MB pressupõe compressão no cliente).

## T-005 — Cliente orquestra pós-cadastro: upload de foto após `pacienteId`, toast de warning em falha do Drive [pendente]

- Refs: AC-088, AC-089
- Arquivos: src/components/features/pacientes/FormCadastroPaciente.tsx
- Notas: após a action retornar `pacienteId`, se há foto selecionada chama a rota de T-004; sucesso → toast + navega; falha do Drive → `toast.warning` e navega assim mesmo (não trava o cadastro). Depende de T-003 e T-004.

## T-006 — Troca/remoção de foto na edição, fora do submit [pendente]

- Refs: AC-092, AC-093, AC-094, AC-095
- Arquivos: src/components/features/pacientes/FormEditarPaciente.tsx
- Notas: troca e remoção chamam a rota de T-004 imediatamente (com `router.refresh()`), fora do fluxo de `editarPaciente`. Editar outros campos não dispara nenhuma chamada ao Drive (AC-094). Depende de T-004.

## T-007 — Componente único `AvatarPaciente` [pendente]

- Refs: AC-096, AC-097, AC-098, AC-099
- Arquivos: src/components/features/pacientes/AvatarPaciente.tsx, src/components/features/pacientes/AvatarPaciente.test.tsx
- Notas: estados fallback/carregando/foto/fallback-degradado; URL `/api/drive/file/{fotoDriveFileId}?v={fotoAtualizadaEm}`; `onError` volta para iniciais sem ícone de imagem quebrada; `priority` só quando pedido explicitamente. Depende de T-001 (campos existirem no tipo de paciente).

## T-008 — Lightbox extraído de `TabMidiasPaciente` + prop `ampliavel` no `AvatarPaciente` [pendente]

- Refs: AC-100, AC-101
- Arquivos: src/components/features/pacientes/LightboxMidia.tsx, src/components/features/pacientes/AvatarPaciente.tsx, src/components/features/pacientes/TabMidiasPaciente.tsx
- Notas: extrai o lightbox existente (`TabMidiasPaciente.tsx`) para componente reusável; `AvatarPaciente` abre-o no clique somente quando `ampliavel && fotoDriveFileId`. Depende de T-007.

## T-009 — Migrar os 8 pontos de renderização existentes para `AvatarPaciente` [pendente]

- Refs: AC-096, AC-097, AC-098, AC-099, AC-100, AC-101, AC-113
- Arquivos: src/app/(painel)/pacientes/[id]/page.tsx, src/app/(painel)/pacientes/page.tsx, src/components/features/pacientes/CardConfirmacaoPaciente.tsx, src/app/(painel)/confirmacoes/semana/page.tsx, src/app/(painel)/follow-ups/page.tsx, src/app/(painel)/prontuarios/page.tsx, src/app/(painel)/prontuarios/[atendimentoId]/page.tsx
- Notas: prontuário digital (`2xl`, ampliável), listagem tabela (`sm`), listagem cards (`md`), card de confirmação (`md`, ampliável), confirmações da semana (`sm`), follow-ups (`sm`), prontuários listagem (`sm`, 2 pontos), prontuário de atendimento (`lg`, ampliável). Cada `select` precisa incluir `foto_drive_file_id` e `foto_atualizada_em` — é o passo mais fácil de esquecer (AC-113 cobre o caso de paciente inativo, que deve continuar mostrando a foto). Depende de T-007 e T-008.

## T-010 — Autenticação do proxy de leitura de foto (comportamento existente, sem alteração) [pendente]

- Refs: AC-102
- Arquivos: src/app/api/drive/file/[fileId]/route.test.ts
- Notas: teste de integração confirmando 401 sem sessão no `/api/drive/file/[fileId]` já existente — só criação de teste, sem mudança de código (a rota já bloqueia sem sessão).

## T-011 — Medir baseline de performance da agenda (dia cheio, views dia/semana/mês) [pendente]

- Refs: AC-104, AC-106
- Arquivos: docs/tdds/006-foto-do-paciente-google-drive-e-avatar.md
- Notas: registrar os números medidos antes de tocar em `AgendamentoItem.tsx`, conforme Decisão F da RFC. Bloqueia T-012.

## T-012 — Avatar na agenda (views dia e semana) [pendente]

- Refs: AC-104, AC-105, AC-106
- Arquivos: src/components/features/agenda/AgendamentoItem.tsx, src/app/(painel)/agenda/page.tsx
- Notas: `AvatarPaciente` em `AgendamentoItemDia`/`AgendamentoItemSemana` (`xs`/`sm`, `ampliavel=false`, sempre `loading="lazy"`); view mês intocada; as 4 variantes da query leve da agenda passam a selecionar `pacientes (nome, foto_drive_file_id, foto_atualizada_em)`. Depende de T-007, T-009 (padrão já estabelecido) e T-011 (baseline).

## T-013 — Remedir a agenda e decidir manter/reverter (Decisão F) [pendente]

- Refs: AC-104, AC-105, AC-106
- Arquivos: docs/tdds/006-foto-do-paciente-google-drive-e-avatar.md
- Notas: compara com o baseline de T-011; regressão perceptível na view semana ⇒ reverter T-012 isoladamente (Nível 1 do plano de rollback), sem afetar as demais tarefas. Depende de T-012.

## T-014 — Rotina automática de limpeza de arquivos órfãos no Drive [pendente]

- Refs: AC-111
- Arquivos: src/actions/google-drive.ts, src/lib/limpeza-orfaos-drive.ts, src/lib/limpeza-orfaos-drive.test.ts
- Notas: quando a rota de T-004 falha ao apagar o `fileId` anterior, registra o órfão (log `warn` já previsto no TDD); a rotina lê esses registros e apaga os arquivos no Drive. Depende de T-004 (é a origem do registro de órfãos).

## T-015 — Exclusão automática da foto ao inativar paciente por óbito [pendente]

- Refs: AC-112
- Arquivos: src/actions/pacientes.ts, src/lib/paciente-inativacao.ts
- Notas: no mesmo salvamento em que `editarPaciente` processa `ativo=false` com `obito_inatividade=on` (fluxo já existente de inativação), chama a exclusão de foto de T-004 e zera as colunas. Depende de T-004.
