# Spec: Ciclo de vida dos status personalizados

> feature: status-personalizados-ciclo-vida
> status: rascunho

Implementa a Opção 2 do [RFC 002](../../../docs/rfcs/002-ciclo-de-vida-dos-status-personalizados.md), aprovada em 10/08/2026.

## Contexto

Hoje um status personalizado ("Em reunião", "Hora administrativa") é uma etiqueta sem contexto e sem fim garantido: o profissional escolhe, o sistema registra, e se ele esquecer de sair o `pg_cron` fecha o registro no histórico mas **deixa o status ao vivo travado para sempre** — em 10/08 havia 3 profissionais nessa situação, um deles há 2 dias e 20 horas. Esta feature dá a cada bloco de status um começo, um motivo e um fim garantido, torna esse estado visível na rota de agendamento, e corrige o contrato dos status operacionais e o tratamento de profissional desligado.

**Estratégia de prova (decidida com o dono em 10/08):** as regras decidíveis são extraídas para funções TypeScript puras, testadas com `node --test`. Os artefatos SQL recebem **asserções estáticas** sobre o texto da migration — garantem forma e ordem, não comportamento do Postgres. Ver ASM-002.

## Histórias

### US-001 — Contexto no status personalizado

Como gestor, quero que o profissional registre o motivo ao assumir um status personalizado, para que eu consiga auditar no Tempo Fábril o que foi feito em cada bloco de tempo.

#### AC-021 — O gestor consegue marcar quais status exigem justificativa

- **Dado** o formulário de criação ou de edição de um status personalizado
- **Quando** o gestor marca ou desmarca "exigir justificativa" e salva
- **Então** a escolha vai junto no que é enviado para a action, e reabrir a edição mostra o valor salvo — nunca o padrão

> Escrito depois do resto da feature, já em produção. AC-001 e AC-002 provavam a
> validação a partir da marcação, mas nenhum critério cobria **fazer** a
> marcação: a coluna existia, a action aceitava o campo e o formulário nunca o
> enviava, então a regra jamais disparava. A tarefa T-010 prometia o controle no
> título e referenciava só AC-012, de outro assunto.
>
> Não virou lição registrada porque `licoes` exige lastro em sinal de auditoria,
> e esta falha não produziu nenhum — é precisamente o motivo de ter passado. O
> gate prova o que a especificação pede; uma capacidade sem critério é invisível
> para ele. A regra que sobra: quando um critério descreve **reagir** a uma
> configuração, procurar o critério irmão que cobre **definir** a configuração.

#### AC-001 — Status que exige justificativa recusa troca sem texto

- **Dado** um status personalizado configurado como "exige observação" e uma observação vazia ou só com espaços
- **Quando** o profissional tenta assumir esse status
- **Então** a troca é recusada e ele recebe a mensagem de que a observação é obrigatória (validação server-side, não só no formulário)

#### AC-002 — Status sem exigência aceita observação vazia

- **Dado** um status personalizado configurado como "não exige observação"
- **Quando** o profissional o assume sem escrever nada
- **Então** a troca é aceita normalmente

#### AC-003 — A observação fica gravada no bloco do histórico

- **Dado** a função de log que abre um bloco em `historico_status_disponibilidade`
- **Quando** a migration da feature é aplicada
- **Então** o `INSERT` do bloco grava também a observação, de modo que ela sobreviva à próxima troca de status (asserção estática no arquivo SQL)

### US-002 — Fim garantido do bloco

Como dono da empresa, quero que um status personalizado expire em 1 hora e devolva o profissional ao estado normal, para que ninguém fique marcado indevidamente e quem precisar de mais tempo reafirme o status.

#### AC-004 — O bloco é capado em 1 hora

- **Dado** o job `fechar-status-esquecidos`
- **Quando** a migration da feature é aplicada
- **Então** o teto do bloco passa a ser de 1 hora, não mais 2 (asserção estática no arquivo SQL)

#### AC-005 — O profissional volta para Disponível

- **Dado** o mesmo job
- **Quando** a migration da feature é aplicada
- **Então** o job também devolve `status_disponibilidade` para `disponivel`, marcando a origem como `fallback` (asserção estática no arquivo SQL)

#### AC-006 — O histórico é fechado antes do status ser resetado

- **Dado** o mesmo job, que agora executa dois comandos
- **Quando** a migration da feature é aplicada
- **Então** o comando que fecha o histórico aparece **antes** do que reseta o status — pois a ordem inversa faria o trigger fechar o bloco com a duração inteira e inflar o Tempo Fábril (asserção estática no arquivo SQL)

#### AC-019 — Quem já está travado também é destravado

- **Dado** um profissional com status personalizado ao vivo há mais de uma hora **sem** bloco aberto no histórico — o estado exato dos três profissionais encontrados em produção em 10/08, um deles preso há 2 dias e 20 horas
- **Quando** o job de expiração roda
- **Então** ele também é devolvido para "Disponível" — a expiração não pode depender de haver bloco aberto, senão quem já dessincronizou fica preso para sempre (asserção estática no arquivo SQL)

#### AC-007 — Bloco vencido é sinalizado na tela

- **Dado** um bloco de status aberto há mais de 1 hora
- **Quando** a tela calcula o que exibir
- **Então** o bloco é sinalizado como vencido, mesmo que o aviso do banco ainda não tenha chegado à tela

### US-003 — Estado ao vivo visível na agenda

Como quem coordena a agenda, quero ver na própria rota de agendamento em que status cada profissional está e por quê, para não precisar navegar até Configurações.

#### AC-008 — O card mostra status, motivo e tempo decorrido

- **Dado** um profissional em status personalizado com observação registrada
- **Quando** o card da agenda é montado
- **Então** ele apresenta o nome, o status com a cor do catálogo, a observação e há quanto tempo o status está valendo

#### AC-009 — Com atendimento em curso, mostra os dois

- **Dado** um profissional que declarou um status personalizado e tem um atendimento em curso
- **Quando** o card é montado
- **Então** o status principal é "Em atendimento" (a agenda vence, decisão de 10/08) e a declaração aparece como informação secundária, junto do horário e da observação

#### AC-020 — A declaração continua legível quando o atendimento vence

- **Dado** um profissional que declarou "Em reunião" com observação e tem atendimento em curso
- **Quando** o card é montado
- **Então** o rótulo do status declarado continua disponível junto da observação, para a tela poder exibir "Em atendimento · declarou: Em reunião" — sem ele, a observação aparece colada em "Em atendimento" e o leitor entende que ela descreve o atendimento, não a reunião

#### AC-010 — Profissional desligado não aparece no card

- **Dado** um profissional inativo, mesmo que tenha linha remanescente em `status_disponibilidade`
- **Quando** o card é montado
- **Então** ele não aparece na lista

### US-004 — Contrato dos status operacionais

Como gestor, quero que os status derivados do sistema não se misturem com os que o profissional declara, para que ninguém escolha um status que não faz o que promete.

#### AC-011 — "Em atendimento" não é oferecido como escolha

- **Dado** o catálogo de status com `ocupado` reclassificado como status de sistema
- **Quando** a lista "Meu status" é montada para o profissional
- **Então** "Em atendimento" não aparece entre as opções — hoje ele aparece, e quem o escolhe encerra o próprio status personalizado e passa a constar como Disponível

#### AC-012 — Status de sistema não pode ser editado nem removido

- **Dado** um status marcado como de sistema
- **Quando** o gestor tenta editá-lo ou removê-lo
- **Então** a operação é recusada

#### AC-013 — Rótulo muda, identificador permanece

- **Dado** a migration que renomeia "Ocupado" para "Em atendimento"
- **Quando** ela é aplicada
- **Então** apenas o rótulo muda e o identificador `ocupado` permanece intacto — ele está fixo em quatro pontos do sistema que não têm integridade referencial entre si (asserção estática no arquivo SQL)

### US-005 — Profissional desligado deixa de contar

Como gestão, quero que quem saiu da empresa suma das telas ao vivo sem que suas horas passadas desapareçam dos relatórios, para que períodos já fechados não mudem de número.

#### AC-014 — Quem trabalhou no período continua no relatório

- **Dado** um profissional desligado que teve atendimentos em maio
- **Quando** o relatório de maio é montado
- **Então** ele aparece com as horas que fez — hoje o filtro por ativo apaga esse passado

#### AC-015 — Quem saiu some dos períodos seguintes

- **Dado** o mesmo profissional desligado, sem nenhum registro em agosto
- **Quando** o relatório de agosto é montado
- **Então** ele não aparece

#### AC-016 — Quem está na folha aparece mesmo sem registro

- **Dado** um profissional ativo que não teve nenhum atendimento no período (férias, por exemplo)
- **Quando** o relatório é montado
- **Então** ele aparece com zero horas, para constar como subutilizado

#### AC-017 — Desligar limpa o estado ao vivo

- **Dado** o gatilho de inativação em `profiles`
- **Quando** a migration da feature é aplicada
- **Então** ao marcar alguém como inativo o sistema grava a data, fecha o bloco aberto e remove a linha de estado ao vivo, preservando o histórico (asserção estática no arquivo SQL)

### US-006 — Remoção do escritor legado

Como engenharia, quero remover o gatilho legado que sobrescreve o status do profissional, para que a garantia de vida de 1 hora do bloco não seja quebrada por um escritor invisível.

#### AC-018 — O gatilho legado é removido

- **Dado** o gatilho `trg_concluir_atendimento` e suas funções, ativos em produção
- **Quando** a migration da feature é aplicada
- **Então** o gatilho e as funções órfãs são removidos — seu único efeito observável hoje é encerrar em silêncio um status personalizado ativo (asserção estática no arquivo SQL)

## Fora de escopo

- **Deduplicar a contagem dupla** entre atendimento e status personalizado no Tempo Fábril — medida em 0,77% em 90 dias, abaixo do limiar de materialidade. Vai para backlog, a remedir depois que o teto de 1 hora estiver em produção.
- **Inverter a precedência** entre atendimento e status declarado — decisão de 10/08 foi manter a agenda vencendo.
- **Editar a observação** com o status já em andamento — ela é escrita no ato da escolha e não é alterada depois.
- **Duração declarada na entrada** (Opção 3 do RFC) — reavaliar 2 semanas após o go-live.
- **Teste comportamental do Postgres** (trigger, cron, RLS executando de fato) — sem Docker/psql nesta máquina. Validação manual em produção, conforme a Ação 11 do RFC.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | Node 24 remove tipos nativamente, então `node --test` roda `.ts` sem transpilador; os testes usam import relativo porque o alias `@/` não é resolvido | confirmada | Verificado: Node v24.16.0. Decisão do runner tomada com o dono em 10/08 |
| ASM-002 | Asserção estática sobre o texto do `.sql` previne a regressão de ordem e de intervalo, mas **não prova** o comportamento do Postgres | confirmada | Limitação aceita conscientemente: sem Docker/psql no ambiente. Rotulada como verificação estática em AC-003/004/005/006/013/017/018 |
| ASM-003 | O Realtime propaga para a tela os updates feitos pelo `pg_cron`, não só os feitos pela aplicação | confirmada | **Deixou de ser carregadora.** Resolvida por desenho, não por verificação: AC-007 detecta o vencimento no cliente a partir do horário de abertura do bloco, sem depender de aviso do banco. Se o Realtime não propagar, a tela ainda marca o bloco como vencido. A suposição deixou de sustentar qualquer critério |
| ASM-004 | Tornar `profiles.ativo` obrigatório não quebra nenhum fluxo que cria usuário sem preencher esse campo | confirmada | Auditado em 10/08: o único ponto de criação é o gatilho `handle_new_user`, que insere `(id, full_name, role)` e não toca em `ativo` — o padrão `true` da coluna cobre. Nenhum código da aplicação insere em `profiles` |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | O card da agenda deve mostrar também as horas acumuladas no dia, além do tempo do bloco atual? | respondida | Não (dono, 10/08). O card mostra só o tempo do bloco atual, com o dado que a tela já carrega. O acumulado do dia permanece no relatório de Tempo Fábril, onde é analisado com calma |
