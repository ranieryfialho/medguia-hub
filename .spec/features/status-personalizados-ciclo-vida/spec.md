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

#### AC-034 — A observação chega ao Tempo Fábril

- **Dado** um bloco de status personalizado com observação gravada no histórico
- **Quando** o gestor abre a conferência de status no relatório de Tempo Fábril
- **Então** ele lê a observação ao lado do bloco — que é o lugar onde o item 1 do PRD cobra a auditoria: *"o gestor vê 3h de 'Em reunião' e não tem como saber qual reunião"*

> AC-003 provou que a migration **grava** a observação no bloco. Nenhum critério
> cobria **lê-la** — e por isso a coluna existe em produção desde 10/08, o
> gatilho a preenche, e o relatório nunca a selecionou. Metade da escrita, zero
> da leitura.
>
> É a terceira vez que a lacuna tem esta forma nesta feature (AC-021: regra sem
> tela; AC-030: componente sem catálogo). A regra que emerge: **quando um
> critério cobre gravar um dado, procurar o critério irmão que cobre consumi-lo**
> — o gate só prova o que a especificação pede, e um dado que ninguém lê é
> invisível para ele.

#### AC-036 — As exportações levam o mesmo conteúdo da tela

- **Dado** o relatório de Tempo Fábril exportado em PDF ou em Markdown
- **Quando** o gestor abre o arquivo
- **Então** a conferência de status traz o motivo e a marca de expirado, como na tela — um relatório que se exporta pela metade é pior que nenhum, porque o arquivo é o que circula fora do sistema
- **E** uma observação com `|` ou com quebra de linha **não destrói a tabela Markdown**, nem transborda a célula de altura fixa do PDF — é texto livre digitado pelo profissional, e o modo de falha é silencioso: colunas deslocadas que alguém lê como dado

> A conferência de status só é gerada quando há **um profissional filtrado**;
> exportar com "todos" produz resumo, ranking e comparativo, sem bloco nenhum.
> Comportamento anterior a esta entrega, registrado aqui porque foi descoberto
> ao escrever o teste e determina onde o gestor encontra os motivos.

#### AC-035 — Bloco expirado não se confunde com bloco anômalo

- **Dado** um bloco fechado pelo fallback, cuja duração é exatamente o teto
- **Quando** ele aparece na conferência do relatório
- **Então** é sinalizado como **expirado**, visualmente distinto do alerta de anomalia — porque expirar é um fato conhecido e esperado do desenho (a pessoa esqueceu de encerrar), não um defeito a investigar

> Com o teto em 1h o alerta fixo de 110 min nunca disparava para blocos novos.
> Com o teto de volta em 2h, **todo** bloco capado tem 120 min e cairia no
> vermelho — e um relatório inteiro em vermelho deixa de chamar atenção para o
> que é de fato anormal.

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

#### AC-028 — A tabela de status está publicada para o Realtime

- **Dado** que em 11/08 o diagnóstico mostrou `status_disponibilidade` **fora** da publicação `supabase_realtime` em produção, enquanto `atendimentos` estava dentro
- **Quando** a migration da correção é aplicada
- **Então** a tabela é adicionada à publicação de forma **idempotente** — rodar de novo não pode falhar, porque `ALTER PUBLICATION ... ADD TABLE` erra se a tabela já estiver lá, e uma migration que quebra na segunda execução não é reaplicável (asserção estática no arquivo SQL)

> A causa-raiz é instrutiva: `atendimentos` entrou pelo bloco `DO $$` guardado de
> `fn_status_equipe_agora_v2.sql`, que rodou depois da mudança para o
> self-hosted em junho. `status_disponibilidade` dependia de um `alter
> publication` solto em `status_disponibilidade_migration.sql:26`, de antes. A
> publicação foi recriada do zero no self-hosted e só a linha guardada
> sobreviveu — porque só ela era reexecutável.

#### AC-029 — O card da agenda não depende só do Realtime

- **Dado** o card de status na rota de agendamento
- **Quando** nenhum evento de Realtime chega — o estado exato de produção entre junho e 11/08
- **Então** ele ainda assim recarrega o estado periodicamente, como o widget já faz

> Este critério nasce de uma falha real, não de precaução. O card foi ao ar em
> 10/08 assinando um canal que nunca recebeu evento, e ficou congelado no estado
> do carregamento da página. Ninguém percebeu porque a mesma quebra, no widget,
> era mascarada pelo polling de `useRealtimeDisponibilidade`. A rede não existe
> para o caso de o Realtime falhar — existe porque ele **já falhou em silêncio
> por dois meses**, e a diferença entre notar e não notar foi exatamente ela.

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

### US-008 — Status personalizado visível em Configurações → Disponibilidade

Como gestor, quero que a tela de Disponibilidade mostre os status que eu mesmo criei, com o mesmo contador e a mesma legibilidade das outras telas, para não precisar abrir a agenda só para saber o que a equipe está fazendo.

> **O defeito, achado em 11/08.** A página monta `StatusEquipeRealtime` **sem
> passar `opcoes`** — nas duas visões. O componente cai em `DEFAULT_OPCOES`,
> quatro slugs fixos no código, e um status criado pelo gestor não está lá. O
> fallback `{ label: p.status, isManual: false }` produz **dois** estragos: o
> rótulo vira o slug cru na tela (`hora_administrativa_1784653432533`) e
> `isManual: false` desliga o ping, o tempo decorrido **e o contador
> regressivo**.
>
> Por isso "Em reunião" aparecia certo e os personalizados não: `reuniao` está
> no `DEFAULT_OPCOES`. A rota de agenda sempre passou o catálogo; esta nunca
> passou.
>
> AC-025 dá verde nesta tela e continua correto — ele prova que o componente
> **consome** a regra do contador. Não prova que a página **alimenta** o
> componente com o catálogo certo. AC-030 fecha essa fronteira.

#### AC-030 — A tela recebe o catálogo real, não o de emergência

- **Dado** as duas visões da rota de disponibilidade (geral e individual)
- **Quando** o painel de status da equipe é montado
- **Então** ele recebe o catálogo vindo do banco — de modo que um status criado pelo gestor apareça com rótulo, cor e contador, e nunca com o identificador cru

#### AC-031 — O catálogo de emergência não finge ser o catálogo

- **Dado** um status cujo identificador não está no catálogo recebido
- **Quando** a tela precisa exibi-lo
- **Então** ela o trata como status **declarado** (com contador e destaque), não como derivado do sistema — porque um identificador desconhecido é muito mais provavelmente um status novo do gestor do que um status de sistema, e a suposição contrária foi exatamente o que escondeu o defeito

#### AC-033 — Status removido continua legível onde já foi usado

- **Dado** um status personalizado que o gestor removeu — o que grava `ativo = false`, sem apagar linha nenhuma
- **Quando** uma tela ou relatório precisa exibir um bloco de tempo registrado sob esse status
- **Então** o rótulo continua disponível, e o status apenas deixa de ser oferecido como escolha

> Mesmo princípio já decidido nesta feature para profissionais desligados
> (US-005): *`ativo` governa o presente, não o passado*. Remover tira das telas
> ao vivo e da lista de escolha; nunca reescreve o que já aconteceu.
>
> Não é hipótese: o catálogo de produção em 11/08 tem `gravacao_mkt_...` com
> `ativo = false`. As horas registradas sob ele apareceriam no Tempo Fábril com
> o identificador cru, porque `listarStatusOpcoes` filtra `ativo = true` e
> alimenta também o relatório.

#### AC-032 — O painel separa quem declarou algo de quem está livre

- **Dado** a equipe com profissionais em estados diferentes
- **Quando** o painel de status é montado
- **Então** os que declararam um status personalizado vêm primeiro e com mais informação — status, motivo e prazo restante — enquanto livres e ausentes ficam agrupados de forma compacta, porque são o estado que não pede ação de ninguém

### US-009 — Havendo atendimento marcado, o status para e vira "Em atendimento"

Como dono da empresa, quero que o status personalizado pare quando chega a hora de um atendimento marcado, e que o profissional passe a constar "Em atendimento", para que o mesmo minuto de relógio nunca seja contado duas vezes no Tempo Fábril — **sem depender de ninguém clicar em nada**.

> **O que motivou, em 12/08/2026.** Uma fisioterapeuta declarou "Hora
> administrativa" tendo atendimento agendado na mesma janela. A pergunta
> "o que vai ser contabilizado?" não tinha resposta defensável: a tela mostra
> **um** estado (o atendimento vence, decisão de 10/08) e o relatório soma **os
> dois** — `tempoFabril = horasAgendamento + tempoStatusPersonalizado`, em
> `kpis-tempo-fabril.ts`, sem nenhuma subtração de interseção. É a última
> violação de C1 (fonte única da verdade) que o RFC 002 deixou de pé, deixada
> em backlog por materialidade (0,77% em 90 dias, 960 min em 26 pares).
>
> **A decisão do dono vai além da dedup:** o bloco não deve apenas ser
> descontado na conta — deve **parar** na hora marcada do atendimento. Com isso
> a sobreposição futura deixa de existir por construção; a dedup fica valendo
> para o passado já gravado e para a sobreposição residual que a regra da hora
> marcada não alcança (AC-042).
>
> **O gancho é a hora marcada, não o clique.** A primeira versão desta história
> usava a transição para "Em Atendimento" como gatilho, e estava errada por um
> motivo que só quem opera a clínica sabe: **os fisioterapeutas nem sempre
> marcam "Em Atendimento"**. Amarrar a regra a esse clique faria o bloco
> continuar correndo justamente nos casos em que ninguém mexe no sistema — que
> são os mesmos casos em que a pessoa também esquece de sair do status. A regra
> passa a depender só do relógio e da agenda, que existem independentemente de
> alguém clicar.
>
> **A contabilização do atendimento não muda.** `isStatusFabril` continua sendo
> `Concluído` | `Em Atendimento`: o atendimento entra no Tempo Fábril quando for
> concluído, como já é hoje. Ou seja, o bloco para às 10:00 e o atendimento só
> passa a contar quando alguém o concluir. Se ele nunca for concluído, aqueles
> minutos não contam para ninguém — o que é honesto, porque de fato não se sabe
> o que aconteceu ali, e é exatamente o comportamento atual.
>
> **Tensão com AC-018, que precisa ficar registrada.** Esta feature *removeu* o
> gatilho `trg_concluir_atendimento` justamente porque "seu único efeito
> observável hoje é encerrar em silêncio um status personalizado ativo". A regra
> nova faz algo que se parece com isso — e a diferença é o que a torna legítima:
> a antiga agia na **conclusão**, encerrando a declaração num momento em que ela
> ainda podia ser verdadeira, e o fazia sem que nada na especificação previsse.
> A nova age na **hora marcada**, que é o instante a partir do qual a declaração
> deixou de poder ser verdadeira, e é regra escrita aqui — não efeito colateral
> de migração esquecida.

#### AC-037 — O bloco para e o profissional passa a constar "Em atendimento"

- **Dado** um profissional com status personalizado ao vivo e um atendimento marcado para dentro desse bloco, em que ele é responsável **ou** executor, e que não foi cancelado, não virou falta e não foi reagendado
- **Quando** a hora marcada do atendimento chega
- **Então** o bloco é fechado e o profissional passa a constar **"Em atendimento"**, sem depender de ninguém marcar "Em Atendimento" na agenda (asserção estática no arquivo SQL)

> **Como "Em atendimento" acontece — e por que o job não o escreve.** `ocupado`
> é status **derivado**: a regra 1 da `fn_status_equipe_agora` já devolve "Em
> atendimento" para quem tem atendimento na janela, com prioridade sobre
> qualquer declaração. E AC-011 o marcou como status de sistema justamente para
> que ninguém o grave à mão — gravar `'ocupado'` em `status_disponibilidade` foi
> o que o cron legado fazia, e é a Divergência 1 que o RFC 002 fechou.
>
> Então o job faz a única coisa que lhe cabe: **apaga a declaração** (grava
> `disponivel`, `origem = 'agenda'`). A derivação assume dali em diante e mostra
> "Em atendimento" enquanto durar a janela do atendimento; terminada a janela,
> cai para "Disponível" ou "Ausente", conforme a jornada. Escrever `disponivel`
> é o mecanismo; "Em atendimento" é o efeito, e é o que a equipe vê.
>
> Age sobre os dois papéis porque a tela e o relatório já tratam responsável e
> executor como ocupados durante o atendimento (ASM-007). O filtro de status do
> atendimento é positivo, não negativo: `Confirmado`, `Aguardando`, `Aguardando
> Consulta`, `Em Atendimento` e `Concluído`. Uma lista negativa erraria em
> silêncio, porque `Reagendado` tem variantes de grafia (`Reposição`,
> `reposicao`) em `STATUS_RAW_VALUES_BY_KEY` — e o erro seria encerrar o bloco
> de alguém por causa de um atendimento que não aconteceu.

#### AC-038 — Fecha na hora marcada, não na hora em que o job roda

- **Dado** que o job de expiração roda a cada 10 minutos e pode encontrar o bloco até 10 minutos depois da hora marcada
- **Quando** ele fecha o bloco
- **Então** o `fim` gravado é a **hora marcada do atendimento** — e, havendo mais de um atendimento elegível na janela, a hora do **mais cedo** deles — nunca o instante em que o job rodou; e o fechamento do histórico precede o reset do status, pelo mesmo motivo de AC-006 (asserção estática no arquivo SQL)

> Duas armadilhas num comando só. A primeira é a ordem: se o reset do status
> viesse antes, `fn_log_mudanca_status_disponibilidade` fecharia o bloco com
> `fim = NOW()` — até 10 minutos a mais de tempo fabril que não existiu. A
> segunda é o `MIN`: sem ele, um `UPDATE ... FROM` com dois atendimentos
> elegíveis deixa o Postgres escolher **qualquer** um dos dois, e o bloco fecha
> na hora errada de forma não determinística — o pior tipo de defeito para
> auditar depois.

#### AC-042 — Não fecha bloco em hora anterior ao próprio início

- **Dado** um status declarado **no meio** de um atendimento que já estava correndo — a hora marcada do atendimento é anterior ao início do bloco
- **Quando** o job roda
- **Então** esse bloco não é fechado por essa regra, porque gravar um `fim` anterior ao `inicio` produziria bloco de duração zero ou negativa; a sobreposição que sobra é tratada pelo desconto de AC-039 (asserção estática no arquivo SQL)

> É a divisão de trabalho entre as duas metades desta história: a hora marcada
> resolve o caso comum e o faz no banco, de forma definitiva; o desconto resolve
> o resíduo e o passado, e o faz no cálculo. Nenhuma das duas sozinha fecha C1.
>
> **Validado em produção em 12/08**, com o `AC-042` flagrado num caso que
> ninguém tinha construído: a Luana tinha bloco iniciado às 12:19 e agendamento
> às 12:00 marcado como `Falta`. Duas razões independentes o excluíram — a hora
> marcada é anterior ao início do bloco, e `falta` não está no filtro positivo
> de AC-037. O bloco foi cortado pelo agendamento seguinte, das 13:00.

> **Medição de aplicação (12/08).** Migration aplicada; `para_na_agenda = true`,
> `teto_2h = true`, `resquicio_1h = false`; cinco ciclos do `pg_cron`
> consecutivos com `status = succeeded`; `pg_get_constraintdef` confirma os
> quatro valores de `origem`, incluindo `'agenda'`.
>
> Sobre a leitura desses sinais: `UPDATE 0` e as consultas de conferência vazias
> **não provam** que a regra funciona — provam que não havia caso. A prova de
> comportamento veio da simulação retroativa somente-leitura sobre 30 dias, que
> aplicou o mesmo `JOIN` e os mesmos filtros a dado real. Ver ASM-009.
>
> **Ensaio executado no Postgres de produção em 12/08 — seis de seis OK**
> (`database/ensaio_para_na_hora_do_atendimento.sql`, T-032). Rodou o comando
> exato do job sobre cenário montado e desfeito no mesmo bloco. Provado por
> execução, não por leitura de texto: o `fim` gravado é a hora marcada
> (`17:00:00`) e não `NOW()`; o `MIN` pega o atendimento mais cedo mesmo tendo
> sido inserido por último; o atendimento cancelado, ainda mais cedo, não
> encerra bloco; a declaração é apagada com `origem = 'agenda'`; o gatilho de
> log não sobrescreve o `fim`, confirmando a ordem do statement; e AC-042 não
> grava fim anterior ao início.

#### AC-039 — A interseção conta uma vez, para o atendimento

- **Dado** um bloco de status personalizado **iniciado a partir da data de corte** que se sobrepõe no relógio a um atendimento fabril do mesmo profissional
- **Quando** o Tempo Fábril é calculado
- **Então** os minutos sobrepostos contam **uma vez**, como atendimento, e são descontados do tempo de status — o lado que vence é o mesmo da tela (decisão de 10/08), para que o gestor não precise de duas explicações para a mesma regra

> O desconto continua necessário mesmo com a regra da hora marcada em produção,
> porque ela não alcança o caso do AC-042: status declarado **no meio** de um
> atendimento já em curso. Aí a hora marcada é anterior ao bloco, o job não
> toca nele, e a sobreposição nasce mesmo assim.

#### AC-043 — O passado não é reescrito

- **Dado** um bloco iniciado **antes** da data de corte — inclusive os 960 minutos em 26 pares medidos em 10/08
- **Quando** o Tempo Fábril de um período antigo é calculado
- **Então** nenhum desconto é aplicado, e o relatório devolve exatamente o mesmo número que devolvia antes desta entrega

> **Decisão do dono, 12/08:** *"o que já passou não devemos mexer. foi um erro
> na nossa regra de negócio, então já passou. precisamos focar no daqui para
> frente."*
>
> A versão anterior desta feature descontava tudo, retroativamente. O efeito
> seria mudar números de períodos **já fechados e já usados em decisão de
> gestão** — reunião de equipe, avaliação de ocupação — sem que nada na tela
> explicasse por que o mês passado encolheu. É a mesma classe de dano que esta
> feature já rejeitou uma vez, na seção Profissional Inativo do RFC 002:
> *`ativo` governa o presente, não o passado*. O princípio vale aqui igual.
>
> A contagem dupla do passado passa a ser **erro conhecido e datado**, não
> defeito em aberto: 0,77% em 90 dias, documentado no RFC 002 e nesta
> especificação. Quem for auditar um período anterior ao corte sabe o que
> procurar e de quanto é.
>
> Este critério existe por si porque a regressão contrária é silenciosa —
> alguém remove a checagem de data por parecer supérflua, e meses de relatório
> mudam de valor sem erro nenhum aparecer.

#### AC-040 — Descontar não inventa nem destrói tempo

- **Dado** um bloco que não se sobrepõe a atendimento nenhum, e um atendimento que cobre um bloco inteiro e ainda sobra
- **Quando** o desconto é aplicado
- **Então** o primeiro fica intacto e o segundo vai a zero, **nunca abaixo de zero** — e dois atendimentos que se sobrepõem entre si não descontam o mesmo minuto duas vezes do bloco

#### AC-041 — O bloco descontado não encolhe em silêncio

- **Dado** um bloco cujo tempo foi reduzido pela dedup
- **Quando** o gestor abre a conferência de status
- **Então** ele lê quanto foi descontado e por quê — porque um total que muda sem explicação é pior para a auditoria do que um total inflado que se sabe inflado, e a conferência é onde o item 1 do PRD cobra a justificativa linha a linha

> Terceira aplicação da mesma lição já registrada nesta feature (AC-021,
> AC-034): **um critério que muda um número precisa do critério irmão que torna
> a mudança legível**. Aqui o risco é concreto — as horas da Luana caem 2,4h no
> acumulado de 90 dias sem que nada na tela diga por quê.

## Fora de escopo

- **Corrigir a contagem dupla do passado** — decisão do dono em 12/08. Blocos anteriores à data de corte ficam como estão; os números de períodos já fechados não mudam. Ver AC-043.
- **Inverter a precedência** entre atendimento e status declarado — decisão de 10/08 foi manter a agenda vencendo.
- **Editar a observação** com o status já em andamento — ela é escrita no ato da escolha e não é alterada depois.
- **Duração declarada na entrada** (Opção 3 do RFC) — reavaliar 2 semanas após o go-live.
- **Teste comportamental do Postgres** (trigger, cron, RLS executando de fato) — sem Docker/psql nesta máquina. Validação manual em produção, conforme a Ação 11 do RFC.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | Node 24 remove tipos nativamente, então `node --test` roda `.ts` sem transpilador; os testes usam import relativo porque o alias `@/` não é resolvido | confirmada | Verificado: Node v24.16.0. Decisão do runner tomada com o dono em 10/08 |
| ASM-002 | Asserção estática sobre o texto do `.sql` previne a regressão de ordem e de intervalo, mas **não prova** o comportamento do Postgres | confirmada | Limitação aceita conscientemente: sem Docker/psql no ambiente. Rotulada como verificação estática em AC-003/004/005/006/013/017/018. **Contornada para AC-037/038/042 em 12/08**, sem deixar de ser verdadeira: o ensaio de T-032 roda o comando no Postgres de produção dentro de um bloco `DO` que termina em `RAISE EXCEPTION`, e a exceção é ao mesmo tempo a saída (o SQL Editor só mostra linhas e erros — `RAISE NOTICE` não aparece) e o desfazimento. Executado em 12/08 com seis conferências OK. O caminho existe e é reaplicável aos demais critérios de SQL quando alguém quiser |
| ASM-003 | O Realtime propaga para a tela os updates feitos pelo `pg_cron`, não só os feitos pela aplicação | confirmada | **Deixou de ser carregadora.** Resolvida por desenho, não por verificação: AC-007 detecta o vencimento no cliente a partir do horário de abertura do bloco, sem depender de aviso do banco. Se o Realtime não propagar, a tela ainda marca o bloco como vencido. A suposição deixou de sustentar qualquer critério |
| ASM-004 | Tornar `profiles.ativo` obrigatório não quebra nenhum fluxo que cria usuário sem preencher esse campo | confirmada | Auditado em 10/08: o único ponto de criação é o gatilho `handle_new_user`, que insere `(id, full_name, role)` e não toca em `ativo` — o padrão `true` da coluna cobre. Nenhum código da aplicação insere em `profiles` |
| ASM-005 | Asserção estática sobre o texto de um componente `.tsx` prova que ele **consome** a regra pura, mas não prova o que o usuário vê na tela | confirmada | Mesma limitação e mesma escolha consciente da ASM-002, agora no front: não há runner de componente neste projeto. O que a asserção trava é a regressão que já aconteceu uma vez aqui (AC-021: regra existente, tela que nunca a chamava). O comportamento visual é validado à mão |
| ASM-007 | Encerrar o bloco do **responsável** junto com o do executor não gera reclamação de quem só assina o agendamento sem entrar na sala | aberta | Decisão do dono em 12/08, tomada com o trade-off na mesa: ganha coerência com a tela e com o relatório, que já marcam os dois como ocupados. O risco é o inverso do AC-018 — se um coordenador que assina muitos agendamentos tiver a reunião encerrada por atendimento que outra pessoa executou, a queixa aparece rápido e é visível (ele volta a constar "Disponível" no meio da reunião). Reavaliar junto da Ação 13 do RFC |
| ASM-009 | Encerrar o bloco na hora marcada é aceitável mesmo quando o atendimento nunca vira fabril — o tempo cortado é, na esmagadora maioria, substituído por atendimento real | confirmada | **Medido em produção em 12/08, 30 dias retroativos.** A regra alcançaria 22 blocos; em **19 deles (86%)** o agendamento que dispara o corte virou `Concluído`/`Em Atendimento`, e o instante do corte é **idêntico** nas duas medições — o filtro amplo não antecipa o corte em nenhum caso confirmado. Total cortado: 1.285 min no filtro amplo, 1.010 min no filtro só-fabril. A diferença de **275 min** vem inteira de 3 blocos da Luana, de 11–12/08, cujos agendamentos seguem em `Aguardando` — não marcados, não cancelados. **Restringir o filtro a só-fabril foi avaliado e recusado:** faria a regra depender do clique que o dono excluiu como gancho (os fisios nem sempre marcam) e a tornaria impossível de aplicar na hora, já que às 10:00 não se sabe se o atendimento será concluído. Nota que corrige a conta: agendamento parado em `Aguardando` **já contribui zero** ao Tempo Fábril hoje (`isStatusFabril`), então os 275 min não são perda nova — o que muda é o bloco deixar de inflar para cobri-los. Ver também ASM-010 |
| ASM-010 | O `pg_cron` roda a cada 10 minutos, então o corte pode ser observado com até 10 min de atraso — mas o `fim` gravado é sempre a hora marcada | confirmada | Resolvida por desenho (AC-038): o job grava `fim = MIN(data_agendamento)`, não `NOW()`. O atraso afeta **quando** a tela reflete a mudança, nunca **quanto** foi contado. É a mesma janela de até 10 minutos que AC-024 já cobre marcando o bloco como expirado antes de o banco agir |
| ASM-008 | O desconto precisa ser medido na mesma moeda em que o tempo foi somado — interseção de relógio **capada pela jornada**, não interseção crua | confirmada | **Resolvida por desenho.** O bloco entra no relatório já capado por `calcularMinutosStatusNaJornada`; o atendimento entra pela duração cheia, sem cap. Descontar a interseção crua tiraria do bloco minutos que ele nunca somou — um atendimento fabril fora da jornada cadastrada zeraria um bloco legítimo. A dedup aplica a mesma função de cap sobre o intervalo de interseção, de modo que só saia o que entrou duas vezes |
| ASM-006 | O contador tornar o prazo visível é suficiente para a reafirmação ser consciente — não é preciso notificar ativamente quem está prestes a expirar | aberta | Decisão do dono ainda não tomada. Se na revisão de 2 semanas (Ação 13 do RFC) muitos blocos ainda expirarem sem reafirmação, a notificação volta à mesa |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | O card da agenda deve mostrar também as horas acumuladas no dia, além do tempo do bloco atual? | respondida | Não (dono, 10/08). O card mostra só o tempo do bloco atual, com o dado que a tela já carrega. O acumulado do dia permanece no relatório de Tempo Fábril, onde é analisado com calma |
| Q-002 | O Realtime propaga de fato para as telas os updates que o `pg_cron` faz em `status_disponibilidade`? | respondida | **NÃO — medido em produção em 11/08.** E a causa é mais básica do que a pergunta supunha: a tabela **não está na publicação `supabase_realtime`**, então nenhum update propaga — nem os do cron, nem os da aplicação. Os outros três elos estão sadios: `pubupdate = true`, replica identity `d`, política `"Leitura autenticados"` com `SELECT true` para `authenticated`. Ver AC-028 |
| Q-004 | Qual versão de `fn_status_equipe_agora` está em produção? A de 09/07 preserva o timestamp só para `'reuniao'` e devolve `now()` para os demais — nela o contador ficaria travado em 2h00 para status personalizados | respondida | **A de 13/07 (`status_disponibilidade_opcoes_migration.sql`)**, medida em 11/08: `versao_13_07 = true`, `preserva_timestamp = true`. A contraprova direta fecha por evidência, não por leitura de código: dois profissionais em `hora_administrativa_...`, `status_resolvido` igual ao declarado e `timestamp_preservado = true` nos dois. O contador funciona nas três telas |
| Q-005 | O profissional deve ser **avisado** ao declarar um status personalizado tendo atendimento agendado na janela? | respondida | **Não agora (dono, 12/08).** O ajuste escolhido ataca a consequência (a conta) e o fato (o bloco para no início do atendimento), não a intenção. Declarar hora administrativa tendo agendamento não é necessariamente erro — o RFC 002 mediu que quase todos os 26 pares têm `fim = inicio + 2h exatas`, ou seja, são status **esquecidos**, e o esquecimento já é tratado pelo teto e pelo contador. Reavaliar na Ação 13 se sobrarem pares que não sejam esquecimento |
| Q-003 | O card da agenda deve ganhar a rede de polling de 60s que o widget já tem? | respondida | **Sim (dono, 11/08), junto com a correção da publicação.** O argumento decisivo veio do próprio achado: a falha ficou invisível por ~2 meses porque o widget tinha rede e o card não. Corrigir só a publicação devolve o card ao ar e deixa a próxima falha igualmente silenciosa. Ver AC-029 |
