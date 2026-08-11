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

Como dono da empresa, quero que um status personalizado expire em 2 horas e devolva o profissional ao estado normal, para que ninguém fique marcado indevidamente e quem precisar de mais tempo reafirme o status.

> **Emenda de 11/08/2026 — o teto voltou de 1h para 2h.** A entrega de 10/08
> reduziu o teto a 1 hora, conforme o PRD 002. Na primeira semana em produção
> o dono reavaliou: reuniões e horas administrativas de 1h30–2h são rotina, e o
> teto de 1h obrigava reafirmar no meio delas — o atrito previsto na ASM-001 do
> RFC ("se reuniões de 2h+ forem rotina, o atrito de reafirmar pode gerar
> sub-registro sistemático no Tempo Fábril") se materializou. Os critérios
> abaixo passam a falar em 2 horas; AC-022 a AC-025 tornam o prazo visível
> **antes** de vencer, que é o que faltava para a reafirmação ser consciente em
> vez de surpresa.

#### AC-004 — O bloco é capado em 2 horas

- **Dado** o job `fechar-status-esquecidos`
- **Quando** a migration da feature é aplicada
- **Então** o teto do bloco volta a ser de 2 horas, e nenhum comando do job permanece com o teto de 1 hora da entrega anterior (asserção estática no arquivo SQL)

#### AC-005 — O profissional volta para Disponível

- **Dado** o mesmo job
- **Quando** a migration da feature é aplicada
- **Então** o job também devolve `status_disponibilidade` para `disponivel`, marcando a origem como `fallback` (asserção estática no arquivo SQL)

#### AC-006 — O histórico é fechado antes do status ser resetado

- **Dado** o mesmo job, que agora executa dois comandos
- **Quando** a migration da feature é aplicada
- **Então** o comando que fecha o histórico aparece **antes** do que reseta o status — pois a ordem inversa faria o trigger fechar o bloco com a duração inteira e inflar o Tempo Fábril (asserção estática no arquivo SQL)

#### AC-019 — Quem já está travado também é destravado

- **Dado** um profissional com status personalizado ao vivo há mais de duas horas **sem** bloco aberto no histórico — o estado exato dos três profissionais encontrados em produção em 10/08, um deles preso há 2 dias e 20 horas
- **Quando** o job de expiração roda
- **Então** ele também é devolvido para "Disponível" — a expiração não pode depender de haver bloco aberto, senão quem já dessincronizou fica preso para sempre (asserção estática no arquivo SQL)

#### AC-007 — Bloco vencido é sinalizado na tela

- **Dado** um bloco de status aberto há mais de 2 horas
- **Quando** a tela calcula o que exibir
- **Então** o bloco é sinalizado como vencido, mesmo que o aviso do banco ainda não tenha chegado à tela

### US-007 — O prazo é visível antes de vencer

Como profissional que declarou um status, quero ver quanto tempo falta para ele expirar, para reafirmar antes de ser devolvido para "Disponível" sem perceber — e como gestão, quero enxergar o mesmo prazo no card da agenda.

> Sem contador, o teto de 2 horas só se manifesta quando já passou. A pessoa
> descobre que expirou pelo efeito (voltou a constar Disponível), nunca pelo
> aviso. É a Suposição 2 do RFC 002 ("voltar automaticamente para Disponível é
> aceitável — não gera reclamação") deixando de ser um risco aceito e virando
> um prazo mostrado.

#### AC-022 — O tempo restante é calculado a partir da abertura do bloco

- **Dado** um bloco de status personalizado aberto em um instante conhecido e o teto de 2 horas
- **Quando** o tempo restante é calculado
- **Então** ele é a diferença entre o teto e o tempo já decorrido — e **nunca é negativo**: um bloco aberto há 5 horas devolve zero, não menos vinte e uma mil

#### AC-023 — O contador é legível em qualquer faixa do prazo

- **Dado** um tempo restante qualquer
- **Quando** ele é formatado para a tela
- **Então** acima de uma hora aparece em horas e minutos (`1h47`), abaixo de uma hora em minutos e segundos (`47:05`) — a precisão aumenta conforme o prazo aperta, que é quando ela importa

#### AC-024 — Ao zerar, o contador para e o bloco fica marcado como expirado

- **Dado** um bloco que passou das 2 horas e ainda não foi devolvido pelo job — a janela de até 10 minutos entre o vencimento e o próximo ciclo do `pg_cron`
- **Quando** a tela calcula o que exibir
- **Então** o bloco aparece como **expirado** e o contador para de correr, em vez de sumir da lista ou virar tempo negativo — a tela não pode afirmar que o profissional já voltou para "Disponível" antes de o banco ter feito isso, que é exatamente a divergência entre tela e banco que o RFC 002 combate

#### AC-025 — As três telas de status consomem o mesmo contador

- **Dado** o card da agenda, o widget global de disponibilidade e a tela de Configurações → Disponibilidade
- **Quando** cada componente é montado
- **Então** os três leem o tempo restante da mesma regra pura, em vez de cada um reimplementar a conta (asserção estática sobre o texto dos componentes — ver ASM-005)

#### AC-026 — O contador não depende do Realtime estar saudável

- **Dado** um bloco cujo aviso de mudança nunca chegou pelo Realtime
- **Quando** a tela recalcula o contador a cada tique do relógio
- **Então** ele continua correto, porque é derivado do instante de abertura já em mãos — e não de um evento novo do banco

#### AC-027 — O estado do Realtime é diagnosticável, não adivinhado

- **Dado** a dúvida registrada em Q-002 sobre se as escritas do `pg_cron` chegam às telas
- **Quando** o script de diagnóstico é aberto
- **Então** ele consulta a publicação `supabase_realtime`, a *replica identity* da tabela, a política de leitura e as últimas execuções do job — de modo que a resposta venha de medição em produção, e não de inferência sobre o código (asserção estática no arquivo SQL)

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

Como engenharia, quero remover o gatilho legado que sobrescreve o status do profissional, para que a garantia de vida de 2 horas do bloco não seja quebrada por um escritor invisível.

#### AC-018 — O gatilho legado é removido

- **Dado** o gatilho `trg_concluir_atendimento` e suas funções, ativos em produção
- **Quando** a migration da feature é aplicada
- **Então** o gatilho e as funções órfãs são removidos — seu único efeito observável hoje é encerrar em silêncio um status personalizado ativo (asserção estática no arquivo SQL)

## Fora de escopo

- **Deduplicar a contagem dupla** entre atendimento e status personalizado no Tempo Fábril — medida em 0,77% em 90 dias, abaixo do limiar de materialidade. Vai para backlog, a remedir depois que o teto estiver estável em produção.
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
| ASM-005 | Asserção estática sobre o texto de um componente `.tsx` prova que ele **consome** a regra pura, mas não prova o que o usuário vê na tela | confirmada | Mesma limitação e mesma escolha consciente da ASM-002, agora no front: não há runner de componente neste projeto. O que a asserção trava é a regressão que já aconteceu uma vez aqui (AC-021: regra existente, tela que nunca a chamava). O comportamento visual é validado à mão |
| ASM-006 | O contador tornar o prazo visível é suficiente para a reafirmação ser consciente — não é preciso notificar ativamente quem está prestes a expirar | aberta | Decisão do dono ainda não tomada. Se na revisão de 2 semanas (Ação 13 do RFC) muitos blocos ainda expirarem sem reafirmação, a notificação volta à mesa |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | O card da agenda deve mostrar também as horas acumuladas no dia, além do tempo do bloco atual? | respondida | Não (dono, 10/08). O card mostra só o tempo do bloco atual, com o dado que a tela já carrega. O acumulado do dia permanece no relatório de Tempo Fábril, onde é analisado com calma |
| Q-002 | O Realtime propaga de fato para as telas os updates que o `pg_cron` faz em `status_disponibilidade`? | aberta | A tabela está na publicação `supabase_realtime` desde `status_disponibilidade_migration.sql:26`, o que é condição necessária mas não suficiente. A resposta exige rodar `database/diagnostico_realtime_status.sql` no SQL Editor do Studio (`pg_publication_tables` e `cron.job_run_details` não saem via REST). **Não bloqueia esta entrega**: por AC-026 o contador é derivado do instante de abertura e continua correto mesmo se a resposta for "não" |
| Q-003 | O card da agenda deve ganhar a rede de polling de 60s que o widget já tem? | aberta | Hoje `CardStatusEquipe` só recebe estado novo por Realtime — `useRealtimeDisponibilidade` tem `setInterval` de 60s, o card não tem. Se o Realtime não propagar, o card marca o bloco como expirado (AC-024, correto) mas nunca descobre que o profissional já voltou. Decidir depois do resultado de Q-002, para não adicionar polling contra um problema que talvez não exista |
