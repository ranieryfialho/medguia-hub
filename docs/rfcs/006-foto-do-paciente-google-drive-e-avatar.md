
# RFC: Foto do Paciente no Google Drive e Componente Único de Avatar

| Campo                  | Valor                                                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impacto**      | **ALTO** — novas colunas em `pacientes` (10.206 linhas), mudança nas duas telas que a recepção usa todo dia, 8 pontos de renderização a migrar, e uma decisão de transporte de arquivo que hoje esbarra num limite de 1 MB do Next.js. |
| **Status**       | **DECIDED** — Opção 1 aprovada em 2026-09-02; ver *Outcome*                                                                                                                                                                                                                          |
| **Driver**       | @Raniery                                                                                                                                                                                                                                              |
| **Approver**     | @Dr. Felipe (dono)                                                                                                                                                                                                                                    |
| **Contributors** | Engenharia (MedGuia Hub), Coordenação de Recepção                                                                                                                                                                                                 |
| **Informed**     | Recepção, fisioterapeutas                                                                                                                                                                                                                           |
| **Due Date**     | TBD — sugerido decidir em até 1 semana                                                                                                                                                                                                              |
| **Resources**    | [PRD 006](../prds/006-foto-do-paciente-google-drive-e-avatar.md) · [RFC 005](005-migracao-infra-supabase-para-postgres-vps.md) · [RFC 004](004-venda-em-consultorio-e-relatorio-historico-de-vendas.md)                                                |
| **Created**      | 2026-09-02                                                                                                                                                                                                                                            |
| **Last Updated** | 2026-09-02 — rev. 3: decisões A–F respondidas pelo Approver e *Outcome* preenchido. (rev. 2: alvo de compressão 512 → 1024 px; decisões **E** e **F** adicionadas)                                                                                                       |

---

## Sumário Executivo

O PRD 006 pede quatro coisas: colunas de foto em `pacientes`, upload da imagem para a pasta do paciente no Drive, um componente `AvatarPaciente` unificado, e a troca das iniciais pela foto nas telas de paciente.

O componente e a migração são diretos. O **upload não é** — e o levantamento do código muda o enquadramento em cinco pontos que não estão no PRD:

> **1. O fluxo literal do PRD não cabe na Server Action.** O PRD manda anexar a foto ao formulário (até 10 MB) e tratá-la dentro de `criarPaciente`/`editarPaciente`. O limite padrão de corpo de uma Server Action no Next.js é **1 MB**, e o [`next.config.ts`](../../next.config.ts) deste projeto **não configura `serverActions`** — ou seja, o padrão está valendo. Uma foto de celular moderna (3–8 MB) é rejeitada pelo runtime antes de qualquer código nosso rodar. Não é um caso de borda: é o caso comum.

> **2. O "toast de warning" que o PRD exige é impossível hoje.** As duas actions terminam em `redirect()` — [`pacientes.ts:176`](../../src/actions/pacientes.ts#L176) e [`pacientes.ts:269`](../../src/actions/pacientes.ts#L269). Uma Server Action que redireciona **não devolve estado** para o `useActionState` do formulário. O requisito de resiliência do PRD ("o paciente deve ser criado normalmente e um toast de *warning* deve alertar que a foto não foi salva") não é implementável sem mudar como essas actions terminam.

> **3. A pasta do paciente é criada em fire-and-forget — e 572 pacientes não têm pasta.** [`pacientes.ts:173`](../../src/actions/pacientes.ts#L173) chama `void criarPastaPaciente(...)` sem `await`, e a linha 176 redireciona logo em seguida. O passo 2 do PRD ("garante a existência da pasta antes do upload") depende de uma promise que hoje ninguém aguarda. Os números de produção confirmam o efeito: **10.206 pacientes, 9.634 pastas em `paciente_pastas_drive` → 572 pacientes (5,6%) sem pasta no Drive.**

> **4. A rota de upload que o PRD pede para criar já existe — e não serve como está.** [`/api/drive/upload`](../../src/app/api/drive/upload/route.ts) já sobe arquivo para a pasta do paciente. Mas ela **retorna 404 se a pasta não existir** ([L55](../../src/app/api/drive/upload/route.ts#L55)), aceita **qualquer MIME até 50 MB** ([L29](../../src/app/api/drive/upload/route.ts#L29)) e grava em `paciente_midias` — tabela que tem **0 linhas em produção**. Esse caminho nunca rodou de verdade (`atendimento_midias` tem 42 linhas; o caminho por paciente, zero).

> **5. Sem redimensionamento no cliente, a listagem vira um problema de banda.** A listagem carrega **50 pacientes por página** ([`page.tsx:23`](../../src/app/(painel)/pacientes/page.tsx#L23)) e o proxy baixa o **original em tamanho cheio** (`alt=media`, [`route.ts:21`](../../src/app/api/drive/file/%5BfileId%5D/route.ts#L21)). Com o teto de 10 MB do PRD, uma página fria custa até **500 MB de tráfego Drive→VPS→navegador** e 50 chamadas a `getClienteAutenticado()`, cada uma lendo `configuracoes_sistema`. A compressão que o PRD chama de "recomendada" é, na prática, **requisito de viabilidade**.

**Recomendação: Opção 1 — a foto é um recurso separado do formulário.** Redimensionamento obrigatório no cliente (≤1024 px, WebP/JPEG, alvo ~150 KB), upload por rota dedicada `/api/pacientes/[id]/foto` fora do submit, `criarPaciente` passando a **aguardar** a pasta e a devolver o id em vez de redirecionar do servidor. Isso resolve os cinco pontos de uma vez: cabe em qualquer limite, permite o toast de warning, garante a pasta, não toca em `paciente_midias`, e derruba a página fria de 500 MB para ~7,5 MB.

> **Nota de revisão (2026-09-02).** A versão inicial desta RFC propunha 512 px. O alvo subiu para **1024 px** para viabilizar a ampliação da foto ao clique — ver **Decisão E**. O custo é ~7,5 MB por página fria em vez de ~3 MB; ainda ~27× menor que o fluxo literal do PRD.

---

## Background

### Situação atual

**Identificação visual.** Nenhum paciente tem foto. Todas as telas renderizam iniciais, cada uma com sua própria lógica duplicada:

| Tela                       | Onde                                                                                                                                      | Tamanho                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Prontuário digital        | [`[id]/page.tsx:374`](../../src/app/(painel)/pacientes/%5Bid%5D/page.tsx#L374)                                                           | `w-28 h-28 rounded-3xl`, fundo `#006b5a` |
| Listagem — tabela         | [`pacientes/page.tsx:106`](../../src/app/(painel)/pacientes/page.tsx#L106)                                                               | `w-9 h-9 rounded-full`                     |
| Listagem — cards mobile   | [`pacientes/page.tsx:175`](../../src/app/(painel)/pacientes/page.tsx#L175)                                                               | `w-10 h-10 rounded-full`                   |
| Card de confirmação      | [`CardConfirmacaoPaciente.tsx:139`](../../src/components/features/pacientes/CardConfirmacaoPaciente.tsx#L139)                            | —                                           |
| Confirmações da semana   | [`confirmacoes/semana/page.tsx:254`](../../src/app/(painel)/confirmacoes/semana/page.tsx#L254)                                           | —                                           |
| Follow-ups                 | [`follow-ups/page.tsx:424`](../../src/app/(painel)/follow-ups/page.tsx#L424)                                                             | —                                           |
| Prontuários — listagem   | [`prontuarios/page.tsx:421`](../../src/app/(painel)/prontuarios/page.tsx#L421) e [L498](../../src/app/(painel)/prontuarios/page.tsx#L498) | —                                           |
| Prontuário de atendimento | [`prontuarios/[atendimentoId]/page.tsx:93`](../../src/app/(painel)/prontuarios/%5BatendimentoId%5D/page.tsx#L93)                         | —                                           |

**O PRD lista 4 desses pontos. Existem 8.** (`equipe/page.tsx` e `layout.tsx` também renderizam iniciais, mas de **usuários da equipe**, não de pacientes — ficam fora.)

**Integração Drive.** OAuth2 com escopo `https://www.googleapis.com/auth/drive`, tokens em `configuracoes_sistema`, renovação automática em [`getClienteAutenticado()`](../../src/lib/google-drive.ts#L78). Pastas por paciente sob `MedGuia - Pacientes / [Nome] [ID8]`. O proxy autenticado [`/api/drive/file/[fileId]`](../../src/app/api/drive/file/%5BfileId%5D/route.ts) já entrega `Cache-Control: private, max-age=3600` e suporta `Range`.

**Modelo de dados.** `pacientes` tem 24 colunas, **nenhuma de foto** e **nenhum `updated_at`** — o `foto_atualizada_em` proposto pelo PRD é, portanto, o único cache-buster disponível. A listagem usa `select` de **colunas explícitas** ([`page.tsx:30`](../../src/app/(painel)/pacientes/page.tsx#L30)); o prontuário usa `select('*')` ([`[id]/page.tsx:76`](../../src/app/(painel)/pacientes/%5Bid%5D/page.tsx#L76)).

### O problema

1. **Risco assistencial de homônimo.** Com 9.632 pacientes ativos, nomes repetidos e parecidos são rotina. A conferência de identidade hoje é verbal.
2. **Cada tela reimplementa o avatar.** Oito lugares, três geometrias, duas paletas. Qualquer mudança visual custa oito edições — e a foto entraria como a nona duplicação se não houver componente.
3. **A infraestrutura do Drive está paga e subutilizada** para este fim: `paciente_midias` está vazia.

### Por que agora

- A adoção só cresce a partir do momento em que o campo existe: cada semana sem foto é uma semana de cadastros que nascem sem ela, e o PRD colocou captação retroativa **fora do escopo**.
- Os 572 pacientes sem pasta são um defeito latente **hoje**; a foto é o que vai torná-lo visível (o upload falha com 404). Corrigir junto custa uma vez.
- A decisão de transporte (ponto 1 do sumário) define o formato do componente e da action. Errar aqui e refazer depois significa mexer nas duas telas críticas da recepção duas vezes.

### O que acontece se não decidirmos

A identificação continua por iniciais e conferência verbal; a duplicação do avatar cresce a cada tela nova; e o fire-and-forget da pasta segue produzindo pacientes sem pasta no Drive sem que ninguém perceba.

---

## Dados Relevantes

**Produção, medido em 2026-09-02 via REST (service role):**

| Métrica                               | Valor                |
| -------------------------------------- | -------------------- |
| Pacientes cadastrados                  | **10.206**     |
| Pacientes ativos                       | **9.632**      |
| Pastas em`paciente_pastas_drive`     | **9.634**      |
| **Pacientes sem pasta no Drive** | **572 (5,6%)** |
| Linhas em`paciente_midias`           | **0**          |
| Linhas em`atendimento_midias`        | **42**         |

**Limites técnicos verificados:**

- Server Action: **1 MB** por padrão ([`serverActions.md`](../../node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md#L26)); `next.config.ts` não sobrescreve.
- Route Handler: **sem** esse limite (por isso `/api/drive/upload` aceita 50 MB hoje).
- Listagem: **50 pacientes/página** por padrão.
- Next.js **16.2.1**, `output: 'standalone'`, VPS única.

**Custo de banda por page load frio da listagem (50 avatares):**

| Cenário                                                                | Tamanho médio    | Tráfego                        |
| ----------------------------------------------------------------------- | ----------------- | ------------------------------- |
| Original de celular (teto de 10 MB do PRD)                              | ~4 MB             | **~200 MB** (pico 500 MB) |
| JPEG original sem tratamento                                            | ~1,5 MB           | ~75 MB                          |
| Redimensionado 512 px WebP q80                                          | ~60 KB            | ~3 MB                           |
| **Redimensionado 1024 px WebP q80** (recomendado, ver Decisão E) | **~150 KB** | **~7,5 MB**               |

Após o primeiro acesso, o `Cache-Control: private, max-age=3600` do proxy zera esse custo por 1 hora.

**Reuso disponível para a ampliação ao clique:** o lightbox de mídia já existe em [`TabMidiasPaciente.tsx:265`](../../src/components/features/pacientes/TabMidiasPaciente.tsx#L265) — portal, `fixed inset-0`, fechar por clique no fundo e botão `X`. A Decisão E não exige componente novo de modal.

**Cobertura de avatar hoje:** a agenda exibe o nome do paciente mas **não tem avatar** — `CartaoAgendamento.tsx` não renderiza iniciais de paciente (o `w-10 h-10 rounded-full` da [L216](../../src/components/features/agenda/CartaoAgendamento.tsx#L216) é o ícone de status). Incluir foto lá é ampliação de escopo, tratada na **Decisão F**.

---

## Premissas

| # | Premissa                                                                                                                                                              | Dono        | Confiança       | Gatilho de invalidação                                        |
| - | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------- | --------------------------------------------------------------- |
| 1 | O Drive continua sendo o repositório oficial de mídia de paciente da clínica (requisito do gestor no PRD)                                                          | @Dr. Felipe | Alta             | Se houver decisão de consolidar mídia no Supabase Storage     |
| 2 | 1024 px é resolução suficiente tanto para o maior avatar (`w-28` ≈ 112 px CSS, 224 px em 2×) quanto para a foto ampliada em modal (`max-h-[80vh]` ≈ 860 px) | @Raniery    | Alta             | Se surgir requisito de foto em documento impresso ou laudo      |
| 3 | Todo usuário autenticado do Hub pode legitimamente ver a foto de qualquer paciente (não há segregação por profissional hoje)                                     | @Dr. Felipe | **Média** | Se entrarem perfis com acesso restrito a carteira de pacientes  |
| 4 | A cota do Drive suporta ~10 mil arquivos adicionais de ~60 KB (≈600 MB)                                                                                              | @Raniery    | Alta             | Se o Drive da clínica se aproximar do limite do plano          |
| 5 | Navegadores da recepção suportam`canvas.toBlob` com WebP (Chrome/Edge atuais)                                                                                     | @Raniery    | Alta             | Se houver estação com navegador legado — fallback JPEG cobre |
| 6 | Há capacidade de engenharia para ~1 sprint neste módulo                                                                                                             | @Raniery    | Média           | Se prioridade mudar                                             |

---

## Critérios de Decisão

| Prioridade | Critério                                      | Descrição                                                                                                 | Peso                |
| ---------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------- |
| 1          | **Não travar o cadastro**               | Falha, lentidão ou token expirado no Drive nunca pode impedir a criação/edição textual do paciente     | **Must-have** |
| 2          | **LGPD — sem link público**            | Nenhum arquivo com permissão`anyoneWithLink`; acesso só via proxy autenticado                           | **Must-have** |
| 3          | **Aceitar foto de celular**              | O fluxo tem que funcionar com o arquivo que a recepção realmente tem em mãos (3–8 MB), sem erro obscuro | **Must-have** |
| 4          | **Validação estrita de tipo**          | Só`image/jpeg`, `image/png`, `image/webp` — no cliente **e** no servidor                      | **Must-have** |
| 5          | **Custo de renderização da listagem**  | 50 avatares por página não podem degradar a tela mais usada do sistema                                    | Alto                |
| 6          | **Não abrir superfície de risco nova** | Mudanças de configuração global (ex.: teto de corpo de requisição) devem ser escopadas                 | Alto                |
| 7          | **Reuso do que já existe**              | Preferir estender proxy/rotas/tabelas existentes a criar paralelos                                          | Médio              |
| 8          | **Reversibilidade**                      | Poder desligar a foto sem perder dado textual nem quebrar tela                                              | Médio              |
| 9          | **Esforço de implementação**          | Menor é melhor, empatados os demais                                                                        | Médio              |

**Regra de decisão:** a opção recomendada satisfaz os quatro Must-haves e pontua melhor nos critérios Alto. Trade-offs explicitados quando nenhuma opção vence em tudo.

---

## Opções Consideradas

### Opção 1: Foto como recurso separado do formulário ⭐ (Recomendada)

**Descrição.** A foto deixa de ser um campo do `<form>` e passa a ser um recurso com ciclo de vida próprio: comprimida no cliente, enviada por rota dedicada, salva em `pacientes` por uma função de servidor única. O formulário continua sendo o formulário.

**Como funciona:**

1. **Migração** `database/pacientes_foto_drive_migration.sql` — `foto_drive_file_id`, `foto_atualizada_em` (e `foto_drive_url` só se o Approver decidir mantê-lo; ver *Decisões em aberto*), com índice parcial. Padrão aditivo `ADD COLUMN IF NOT EXISTS` do projeto.
2. **Compressão no cliente** (`src/lib/imagem.ts`): valida MIME e extensão, desenha em `<canvas>` com lado maior **1024 px**, exporta WebP q80 com fallback JPEG. Rejeita >10 MB **antes** de ler o arquivo. Saída típica: 100–200 KB. **Arquivo único** — serve tanto o avatar de 36 px quanto a ampliação em modal.
3. **Rota dedicada** `POST /api/pacientes/[id]/foto` (Route Handler — sem limite de 1 MB): valida sessão, revalida MIME **pelos magic bytes** (não pelo `file.type`, que o cliente controla), chama `garantirPastaPacientePorId()` — que já existe e cobre os 572 sem pasta —, sobe como `foto_perfil_[ID8].webp`, **apaga o `fileId` anterior** se houver, e atualiza as colunas. `DELETE` na mesma rota faz a remoção.
4. **`/pacientes/novo`**: `criarPaciente` passa a **`await criarPastaPaciente(...)`** (fim do `void`) e a devolver `{ pacienteId }` em vez de `redirect()`. O cliente sobe a foto, e só então navega com `router.push('/pacientes')`. Falha no Drive → `toast.warning` e navega assim mesmo. **É isto que torna o requisito de resiliência do PRD implementável.**
5. **`/pacientes/[id]/editar`**: trocar/remover a foto age na hora, fora do submit, com `router.refresh()`. Editar telefone não dispara nenhuma chamada ao Drive.
6. **`AvatarPaciente`** com a assinatura do PRD mais a prop `ampliavel?: boolean` (Decisão E), `<img>` apontando para `/api/drive/file/${id}?v=${foto_atualizada_em}`, `onError` → iniciais, `loading="lazy"` fora do prontuário. Com `ampliavel` e foto presente, o clique abre o lightbox reusado de `TabMidiasPaciente`; sem foto, o avatar não é clicável (não faz sentido ampliar iniciais). Migrar os **8** pontos; incluir as colunas novas no `select` explícito da listagem.

**Prós:**

- Único caminho que satisfaz os quatro Must-haves sem exceção.
- Corrige o fire-and-forget da pasta e absorve os 572 pacientes legados sem migração à parte.
- Página fria da listagem cai de ~200 MB para ~7,5 MB, e zera por 1 h no cache do proxy.
- Arquivo único a 1024 px cobre avatar e ampliação sem duplicar arquivos no Drive nem a lógica de troca/exclusão.
- Reusa proxy, `garantirPastaPacientePorId` e o padrão de Route Handler que já existe.
- Reversível: remover a coluna do `select` volta o sistema ao estado atual; os dados textuais nunca dependem do Drive.

**Contras:**

- Mexe no fim de `criarPaciente` (`redirect` → retorno de id) — regressão possível no fluxo de duplicados/CPF, que precisa de teste.
- Mais arquivos que a Opção 2: rota nova + `lib/imagem.ts`.
- O `/novo` passa a ter dois passos de rede em vez de um (mitigado: o segundo é de ~150 KB).

**Custo estimado:** MÉDIO — ~5–7 dias-pessoa · Financeiro: R$ 0 (~1,5 GB no Drive existente, a 1024 px) · Risco: **BAIXO**

> **Revisado após as decisões de 2026-09-02:** com a Decisão F (avatar na agenda na entrega inicial, com baseline e remedição), a estimativa sobe para **~8–10 dias-pessoa** e o risco para **BAIXO-MÉDIO** — a agenda é a tela com histórico de regressão nas RFCs 002/003.

---

### Opção 2: Tudo dentro da Server Action (leitura literal do PRD)

**Descrição.** O `<input type="file">` é campo do formulário; `criarPaciente`/`editarPaciente` recebem o `File` via `FormData` e falam com o Drive.

**Como funciona:**

1. `next.config.ts` ganha `experimental.serverActions.bodySizeLimit: '10mb'`.
2. As actions ganham os ramos upload / remoção / inalterada.
3. Componente e migração iguais à Opção 1.

**Prós:**

- Menos arquivos novos; um único submit.
- Aderente ao texto do PRD.

**Contras:**

- **`bodySizeLimit` é global.** Não existe por-action. Subir para 10 MB levanta o teto de **todas** as Server Actions do sistema (agenda, vendas, confirmações) numa VPS única — superfície de esgotamento de recurso que hoje não existe.
- **Não entrega o toast de warning** enquanto as actions terminarem em `redirect()`. Ou seja: mesmo aqui é preciso mexer no fim das actions — o suposto ganho de simplicidade evapora.
- Sem compressão no cliente, sobe o original: os 200–500 MB por page load frio da listagem (critério 5).
- Bloqueia a resposta do cadastro no round-trip do Drive: uma lentidão do Google vira formulário travado (roça o Must-have 1).

**Custo estimado:** PEQUENO/MÉDIO — ~4 dias-pessoa · Financeiro: R$ 0 · Risco: **MÉDIO-ALTO**

---

### Opção 3: Reusar `/api/drive/upload` como está

**Descrição.** Chamar a rota de upload existente passando `pacienteId`, e guardar o `fileId` retornado nas colunas novas.

**Prós:**

- Praticamente zero código de backend novo.
- Já valida sessão e já registra em `paciente_midias`.

**Contras:**

- **Falha para 572 pacientes**: retorna 404 "Pasta do paciente não encontrada" ([L55](../../src/app/api/drive/upload/route.ts#L55)) e não cria a pasta.
- **Aceita qualquer MIME até 50 MB** ([L29](../../src/app/api/drive/upload/route.ts#L29)) — viola o Must-have 4 e o "NUNCA PODE" de tipos do PRD.
- Grava em `paciente_midias` (0 linhas hoje): o avatar passa a se misturar com mídia clínica na aba de mídias do paciente, sem campo que os distinga.
- Não remove o arquivo anterior → arquivos órfãos a cada troca, contrariando o último "NUNCA PODE" do PRD.
- Endurecer a rota para atender tudo isso a transforma na rota da Opção 1, mas agora **compartilhada com o upload de mídia clínica** — regras conflitantes no mesmo endpoint.

**Custo estimado:** PEQUENO (aparente) — ~2 dias · Risco: **ALTO** (falha os Must-haves 3 e 4)

---

### Opção 4: Supabase Storage em vez do Google Drive

**Descrição.** Bucket privado `pacientes-fotos` no Supabase self-hosted, acesso por signed URL de curta duração.

**Prós:**

- Sem OAuth de terceiro no caminho crítico (o token do Drive já expirou/foi revogado antes — ver `getStatusConexao`).
- RLS nativa: a autorização por paciente sai de graça, resolvendo também a Premissa 3.
- Sem cota de API do Drive; latência menor (mesma VPS).

**Contras:**

- **Contraria o requisito do gestor no PRD**: as fotos deixam de estar na pasta do paciente no Drive, junto do resto.
- Cria uma **segunda fonte de verdade** para mídia de paciente, com dois modelos de backup e dois de acesso.
- Consome disco e banda da mesma VPS que roda app e Postgres.
- A rotina de backup em vigor (rclone → Google Drive, diária às 3h) precisaria cobrir o bucket também.

**Custo estimado:** MÉDIO — ~6 dias · Risco: **MÉDIO** (técnico baixo, desalinhamento com o PRD alto)

---

### Opção 5: Não fazer nada

**Prós:** custo zero; nenhum risco de regressão nas telas críticas da recepção.

**Contras:** a conferência de identidade continua verbal com 9.632 ativos; a duplicação do avatar cresce a cada tela; os 572 pacientes sem pasta seguem invisíveis.

**Custo estimado:** PEQUENO agora · **MÉDIO** acumulado

---

## Comparação das Opções

| Critério                                    | Opção 1 ⭐ | Opção 2                | Opção 3       | Opção 4           | Opção 5 |
| -------------------------------------------- | ------------ | ------------------------ | --------------- | ------------------- | --------- |
| **1. Não travar o cadastro** (Must)   | ✅           | ⚠️ bloqueia no Drive   | ✅              | ✅                  | ✅        |
| **2. LGPD / sem link público** (Must) | ✅           | ✅                       | ✅              | ✅                  | n/a       |
| **3. Aceita foto de celular** (Must)   | ✅           | ⚠️ só com teto global | ✅              | ✅                  | ❌        |
| **4. MIME estrito** (Must)             | ✅           | ✅                       | ❌              | ✅                  | n/a       |
| **5. Custo da listagem**               | ~7,5 MB      | ~200 MB                  | ~200 MB         | ~7,5 MB (transform) | 0         |
| **Ampliação ao clique** (Decisão E) | ✅ nítida   | ⚠️ pesa mais ainda     | ⚠️ idem       | ✅                  | ❌        |
| **6. Superfície de risco nova**       | Nenhuma      | Teto global 10 MB        | Rota permissiva | Bucket + backup     | Nenhuma   |
| **7. Reuso**                           | Alto         | Alto                     | Máximo         | Baixo               | —        |
| **8. Reversibilidade**                 | Fácil       | Fácil                   | Fácil          | Difícil            | —        |
| **9. Esforço**                        | 5–7 dias    | 4 dias                   | 2 dias          | 6 dias              | 0         |
| **Resolve os 572 sem pasta**           | ✅           | ⚠️ parcial             | ❌              | n/a                 | ❌        |

**Recomendada: Opção 1.** É a única que passa nos quatro Must-haves sem ressalva. A Opção 3 é descartada por falhar nos Must-haves 3 e 4. A Opção 2 é a mais tentadora pelo esforço, mas o suposto atalho é falso: ela **também** exige mexer no fim das duas actions (Must-have de resiliência) e, além disso, cobra um teto global de 10 MB em todas as Server Actions. A Opção 4 é tecnicamente sólida e seria a escolha num projeto novo — aqui ela contraria uma decisão de negócio já tomada e documentada no PRD.

---

## Decisões Complementares — DECIDIDAS em 2026-09-02

| #           | Questão                                                                    | Recomendação do Driver                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A           | Guardar`foto_drive_url` (webViewLink)?                                    | **Não.** O PRD proíbe link público e a exibição é 100% via proxy — o campo nasceria morto. Manter só `foto_drive_file_id` + `foto_atualizada_em`.                                                                                                                                                                                                         |
| B           | Registrar a foto em`paciente_midias` com tag `avatar`?                  | **Não na V1.** A tabela está vazia; misturar avatar com mídia clínica exigiria filtro em toda leitura futura da aba de mídias.                                                                                                                                                                                                                                   |
| C           | Endurecer o proxy para validar que o`fileId` pertence a um paciente?      | **Fora do escopo desta RFC, mas registrar.** Hoje [`route.ts:11`](../../src/app/api/drive/file/%5BfileId%5D/route.ts#L11) só checa "está logado" — qualquer usuário autenticado baixa qualquer arquivo do Drive da clínica pelo id. A foto não cria o problema, mas é o primeiro dado **biométrico** a trafegar por ele. Sugerido abrir item próprio. |
| D           | Foto obrigatória no cadastro?                                              | **Não.** Meta do PRD é 70% de adoção, não 100% — obrigar geraria fotos ruins só para passar da validação.                                                                                                                                                                                                                                                    |
| **E** | **Clicar no avatar amplia a foto?** (não consta no PRD)              | **Sim, com arquivo único a 1024 px.** Ver análise abaixo.                                                                                                                                                                                                                                                                                                           |
| **F** | **Colocar avatar na agenda**, que hoje não tem? (não consta no PRD) | **Sim, mas em fase 2**, depois que os 8 pontos existentes estiverem estáveis. Ver análise abaixo.                                                                                                                                                                                                                                                                   |

**Decisões do Approver (@Dr. Felipe, 2026-09-02):** A ✅ aceita · B ✅ aceita · C ✅ aceita · D ✅ aceita · E ✅ aceita · **F ⚠️ decidida CONTRA a recomendação — agenda entra na entrega inicial** (ver ressalva registrada abaixo).

### Decisão E — ampliação da foto ao clique

Não está no PRD; surgiu na revisão. É barato de construir (o lightbox de [`TabMidiasPaciente.tsx:265`](../../src/components/features/pacientes/TabMidiasPaciente.tsx#L265) é reusável quase como está), mas **não é neutro em relação à compressão** — e é por isso que vira decisão e não detalhe de implementação:

| Estratégia                          | Qualidade ampliada (`max-h-[80vh]` ≈ 860 px) | Listagem fria | Complexidade                                                                                                                               |
| ------------------------------------ | ----------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 512 px, arquivo único               | **Borrada** — upscale de ~1,7×          | ~3 MB         | Baixa                                                                                                                                      |
| **1024 px, arquivo único** ⭐ | **Boa** — cobre o modal sem upscale      | ~7,5 MB       | Baixa                                                                                                                                      |
| 512 px + original, dois arquivos     | Ótima                                          | ~3 MB         | **Alta** — dobra arquivos no Drive, e cada troca/remoção passa a ter que apagar dois `fileId`, com risco de órfão pela metade |

**Recomendação: 1024 px em arquivo único.** Os ~4,5 MB a mais por página fria são pagos uma vez por hora (cache do proxy) e continuam ~27× abaixo do fluxo literal do PRD. A alternativa de dois arquivos compra 4,5 MB ao preço de duplicar exatamente a lógica que o último "NUNCA PODE" do PRD manda manter limpa (nada de arquivo órfão no Drive).

**Escopo:** prop `ampliavel` ligada no prontuário digital, no card de confirmação e no prontuário do atendimento — onde há espaço e intenção de conferir identidade. Desligada na listagem de 50 linhas, onde o clique já é navegação para o paciente.

### Decisão F — avatar na agenda

`CartaoAgendamento.tsx` mostra nome do paciente e nenhum avatar hoje. É, provavelmente, a tela onde o fisioterapeuta mais olha antes de receber alguém — o argumento de segurança assistencial do PRD se aplica com força.

Mas: é a tela mais densa e mais sensível a performance do sistema (semana/mês renderizam dezenas de cartões), e a RFC 002/003 já registram histórico de regressão ali. Recomendação é **fase 2**, com medição de carga antes, e não junto da entrega inicial.

**DECIDIDO: entra na entrega inicial** (@Dr. Felipe, 2026-09-02), contra a recomendação do Driver. O argumento clínico prevaleceu: é a tela que o fisioterapeuta consulta antes de receber o paciente, e é exatamente onde a confusão de homônimo do PRD acontece.

**Ressalva registrada pelo Driver.** A preocupação não é o avatar em si — é a densidade da agenda. Nas views de semana e mês, dezenas de cartões renderizam de uma vez; a `?v=` por paciente impede o navegador de reaproveitar uma imagem entre cartões de pacientes diferentes, e uma agenda cheia pode disparar 40–60 requisições simultâneas ao proxy, cada uma passando por `getClienteAutenticado()` com leitura em `configuracoes_sistema`. Mitigações obrigatórias, não opcionais:

1. `loading="lazy"` em **todo** avatar de agenda (nenhum `priority`).
2. Avatar só nas views **dia e semana**; na view **mês** o cartão é pequeno demais para uma foto ser útil e é onde a densidade explode.
3. **Medir antes e depois** o tempo de render das três views com um dia cheio e comparar — se a semana regredir de forma perceptível, o avatar da agenda sai e volta como fase 2, sem bloquear o resto da entrega.
4. `ampliavel` **desligado** na agenda: o clique no cartão já abre o agendamento.

O item 3 é a válvula de escape: a decisão de incluir na entrega inicial é revertível sem afetar os outros 8 pontos.

---

## Action Items

| Ação                                                                                                      | Dono        | Prazo        | Status      |
| ----------------------------------------------------------------------------------------------------------- | ----------- | ------------ | ----------- |
| ~~Decidir entre as opções e responder A–F~~                                                              | @Dr. Felipe | 2026-09-02   | **DONE** |
| Criar e aplicar`database/pacientes_foto_drive_migration.sql` (SQL Editor do Studio)                       | @Raniery    | —           | NOT STARTED |
| Implementar`src/lib/imagem.ts` (validação + resize **1024 px** WebP)                              | @Raniery    | —           | NOT STARTED |
| Criar`POST/DELETE /api/pacientes/[id]/foto` com validação por magic bytes e limpeza do arquivo anterior | @Raniery    | —           | NOT STARTED |
| Trocar`void criarPastaPaciente` por `await` e o `redirect()` por retorno de id em `criarPaciente`   | @Raniery    | —           | NOT STARTED |
| Criar`AvatarPaciente` (com prop `ampliavel`) e migrar os **8** pontos de renderização           | @Raniery    | —           | NOT STARTED |
| Extrair o lightbox de`TabMidiasPaciente` para componente reusável e ligar no avatar (Decisão E)         | @Raniery    | —           | NOT STARTED |
| **Medir baseline** de render da agenda (dia/semana/mês, dia cheio) **antes** de tocar nela (Decisão F) | @Raniery | —           | NOT STARTED |
| Incluir avatar em`CartaoAgendamento` — views dia e semana, `loading="lazy"`, sem `ampliavel` (Decisão F) | @Raniery | —      | NOT STARTED |
| Remedir a agenda e comparar com o baseline; regressão perceptível ⇒ reverter para fase 2 (Decisão F) | @Raniery | —          | NOT STARTED |
| Incluir as colunas novas no`select` explícito de `/pacientes`                                          | @Raniery    | —           | NOT STARTED |
| Teste de regressão do fluxo de duplicados/CPF em`/pacientes/novo` e `/pacientes/[id]/editar`           | @Raniery    | —           | NOT STARTED |
| Teste de resiliência: desconectar o Drive e confirmar que cadastro e edição concluem com warning         | @Raniery    | —           | NOT STARTED |
| Abrir item separado para a autorização do proxy (decisão C)                                              | @Raniery    | —           | NOT STARTED |

**Nota:** aprovada esta RFC, o detalhamento de implementação (contratos da rota, estados do componente, plano de teste) vai para um TDD.

---

## Outcome

**Decisão:** **Opção 1 — a foto é um recurso separado do formulário.** Aprovada, com as decisões complementares A–F resolvidas.

**Data da decisão:** 2026-09-02

**Decidido por:** @Dr. Felipe (Approver)

**Justificativa:**
A Opção 1 é a única que satisfaz os quatro Must-haves sem ressalva. As alternativas foram descartadas por motivos concretos, não de preferência: a **Opção 2** (leitura literal do PRD) exigiria subir o `bodySizeLimit` para 10 MB **globalmente** — afetando agenda, vendas e todas as demais Server Actions numa VPS única — e ainda assim não entregaria o toast de warning sem mexer no fim das actions, que é justamente o custo que ela prometia evitar. A **Opção 3** reprova em dois Must-haves (falha para os 572 pacientes sem pasta; aceita qualquer MIME até 50 MB). A **Opção 4** é tecnicamente sólida, mas contraria a decisão de negócio já registrada no PRD de manter toda a mídia do paciente na pasta dele no Drive.

**Fatores-chave:**

- Só a Opção 1 torna o requisito de resiliência do PRD ("nunca travar o cadastro, avisar por toast") de fato implementável.
- Absorve os **572 pacientes sem pasta no Drive** sem migração separada, corrigindo de quebra o `void criarPastaPaciente` de [`pacientes.ts:173`](../../src/actions/pacientes.ts#L173).
- Derruba a página fria da listagem de ~200 MB para ~7,5 MB.
- Não abre superfície de risco nova: nenhuma configuração global é alterada.
- Reversível: remover as colunas do `select` devolve o sistema ao estado atual sem perda de dado textual.

**Decisões complementares:**

| # | Decisão |
|---|---|
| A | `foto_drive_url` **não** será criada. Só `foto_drive_file_id` + `foto_atualizada_em`. |
| B | A foto **não** será registrada em `paciente_midias` na V1. |
| C | A brecha de autorização do proxy fica **registrada como item separado**, sem bloquear esta entrega. |
| D | Foto **opcional** no cadastro. |
| E | Clique **amplia** a foto, com **arquivo único a 1024 px**. `ampliavel` no prontuário, card de confirmação e prontuário do atendimento. |
| F | Avatar **na agenda, já na entrega inicial** — contra a recomendação do Driver, com as quatro mitigações obrigatórias registradas na análise da Decisão F. |

**Condições / ressalvas:**

- **Decisão F é condicional na medição.** Baseline de render da agenda antes de tocar nela; remedição depois. Regressão perceptível na view de semana ⇒ o avatar da agenda sai e volta como fase 2, **sem bloquear os outros 8 pontos**.
- Avatar de agenda restrito às views **dia e semana** (não mês), sempre `loading="lazy"`, sem `ampliavel`.
- A entrega não sobe sem o teste de resiliência com o Drive desconectado.
- Estimativa revisada para **~8–10 dias-pessoa** por conta da Decisão F.

**Follow-up:**

- [ ] Criar TDD de implementação
- [ ] Comunicar a recepção sobre o novo passo do cadastro
- [ ] Medir a adoção 30 dias após a liberação (meta do PRD: 70% dos novos cadastros com foto)
- [ ] Revisar a decisão C (autorização do proxy) no próximo ciclo
- [ ] Retrospectiva da Decisão F após a medição pós-entrega
