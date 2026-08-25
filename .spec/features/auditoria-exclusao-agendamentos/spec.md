# Spec: Auditoria exclusao agendamentos

> feature: auditoria-exclusao-agendamentos
> status: rascunho

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - US-xxx = história de usuário · AC-xxx = critério de aceite
    ASM-xxx = suposição · Q-xxx = pergunta em aberto
    São códigos de rastreio: ligam a especificação às tarefas e aos testes.
  - Toda história de usuário precisa de pelo menos um critério de aceite.
  - Todo critério de aceite precisa de Dado/Quando/Então completos.
  - Os códigos são únicos no projeto inteiro (nunca reutilize um número).
  - Suposições e Perguntas em aberto são OBRIGATÓRIAS: se não há nenhuma,
    escreva "Nenhuma." — mas desconfie: quase toda feature esconde uma.
-->

## Contexto

Hoje a exclusão de agendamentos (avulso, sessão pontual, série completa ou lote) apaga o atendimento fisicamente sem exigir motivo, sem registrar quem fez e sem impedir a exclusão de sessões já "Concluído" — esta feature fecha as três lacunas com uma função transacional no Postgres, motivo obrigatório no modal e duas superfícies de leitura (aba do paciente e painel gerencial).

Origem: [PRD 003](../../../docs/prds/003-sistema-de-logs-e-motivo-de-exclusao-de-agendamentos.md) · [RFC 003](../../../docs/rfcs/003-auditoria-de-exclusao-de-agendamentos.md) (Opção 2 aprovada) · [TDD 003](../../../docs/tdds/003-auditoria-de-exclusao-de-agendamentos.md).

## Histórias

### US-010 — Exclusão de agendamento avulso com motivo obrigatório

Como recepcionista, quero informar um motivo antes de excluir um agendamento avulso, para que a exclusão fique justificada e rastreável.

#### AC-044 — Confirmação de exclusão avulsa fica bloqueada sem motivo

- **Dado** que a recepcionista abriu o modal de exclusão de um agendamento avulso
- **Quando** nenhuma categoria de motivo foi selecionada
- **Então** o botão de confirmar exclusão permanece desabilitado

#### AC-045 — Categoria "Outros" exige observação preenchida

- **Dado** que a recepcionista selecionou a categoria de motivo "Outros"
- **Quando** o campo de observação está vazio ou só tem espaços
- **Então** o botão de confirmar permanece desabilitado até haver texto na observação

#### AC-046 — Exclusão avulsa bem-sucedida remove o atendimento e grava o log

- **Dado** um agendamento avulso pendente e uma categoria de motivo válida selecionada
- **Quando** a recepcionista confirma a exclusão
- **Então** o atendimento é removido da agenda e um registro de auditoria é gravado com ação `exclusao_avulso`, o operador autenticado, o motivo e um snapshot dos dados do atendimento

### US-011 — Exclusão de sessão pontual de uma recorrência

Como recepcionista, quero excluir uma sessão pontual de uma série recorrente informando o motivo, para que a reposição automática e o registro fiquem corretos.

#### AC-047 — Exclusão pontual repõe sessão no fim da série e distingue reposição de perda no log

- **Dado** uma sessão pontual de uma recorrência pendente e uma categoria de motivo válida
- **Quando** a recepcionista confirma a exclusão dessa sessão
- **Então** a sessão é removida, uma nova sessão é reposta no fim da série, e o log é gravado com ação `exclusao_sessao_recorrente` contendo o número da sessão e o total de sessões no snapshot

### US-012 — Exclusão de série completa de recorrência

Como recepcionista, quero excluir toda a série de um paciente informando o motivo, sabendo que sessões já concluídas nunca serão apagadas junto.

#### AC-048 — Série sem sessões concluídas é removida por inteiro com log

- **Dado** uma série de recorrência em que todas as sessões estão pendentes e uma categoria de motivo válida
- **Quando** a recepcionista confirma a exclusão da série completa
- **Então** todas as sessões da série são removidas, a linha órfã da série é removida, e um log com ação `exclusao_serie_completa` é gravado

#### AC-049 — Série com pelo menos uma sessão concluída é recusada por inteiro

- **Dado** uma série de recorrência com ao menos uma sessão em status "Concluído"
- **Quando** a recepcionista tenta excluir a série completa com uma categoria de motivo válida
- **Então** a operação é recusada, nenhuma sessão da série é removida e nenhum log é gravado

### US-013 — Exclusão de atendimentos selecionados (lote)

Como recepcionista, quero excluir um conjunto de atendimentos selecionados de uma recorrência informando um único motivo para o lote.

#### AC-050 — Lote com sessão concluída é recusado por inteiro

- **Dado** um lote de atendimentos selecionados em que pelo menos um está em status "Concluído"
- **Quando** o operador confirma a exclusão do lote com uma categoria de motivo válida
- **Então** a operação inteira é recusada e todos os atendimentos do lote permanecem intactos

#### AC-051 — Lote totalmente pendente é excluído com log do escopo

- **Dado** um lote de atendimentos selecionados, todos pendentes, e uma categoria de motivo válida
- **Quando** o operador confirma a exclusão do lote
- **Então** todos os atendimentos do lote são removidos e o(s) log(s) com ação `exclusao_lote` são gravados

### US-014 — Bloqueio no servidor de exclusão de atendimento concluído

Como gestor clínico, quero que nenhum atendimento "Concluído" possa ser excluído por nenhum caminho, inclusive se o front-end for contornado, para que o histórico clínico nunca seja apagado por engano.

#### AC-052 — Função transacional recusa exclusão de qualquer atendimento concluído, em qualquer escopo

- **Dado** um atendimento com status "Concluído"
- **Quando** a função de exclusão transacional é chamada para removê-lo, em qualquer um dos quatro escopos (avulso, pontual, série ou lote)
- **Então** a função recusa a operação com erro e nada é removido

### US-015 — Log de auditoria imutável e transacional

Como gestor clínico, quero que o log de exclusão seja gravado com os dados de antes da remoção, na mesma transação da exclusão, e que nunca possa ser alterado, para confiar na trilha de auditoria.

#### AC-053 — Snapshot do log reflete o estado do atendimento antes da remoção

- **Dado** uma categoria de motivo válida e um operador autenticado
- **Quando** a exclusão é executada
- **Então** o snapshot gravado no log contém os dados do atendimento como estavam antes da remoção (data/hora, status, tipo, número da sessão, total de sessões)

#### AC-054 — Falha em qualquer etapa desfaz log e exclusão juntos (tudo ou nada)

- **Dado** uma tentativa de exclusão em que pelo menos um dos alvos é inválido (ex.: um atendimento "Concluído" dentro de um lote)
- **Quando** a função transacional é executada
- **Então** nenhum item do lote é removido e nenhum log é gravado — nem parcialmente

#### AC-055 — Registro de log não pode ser alterado nem apagado, nem pelo service role

- **Dado** um registro já gravado na tabela de auditoria
- **Quando** qualquer tentativa de `UPDATE` ou `DELETE` é feita sobre esse registro, inclusive usando a chave de service role
- **Então** a operação é recusada com erro e o registro permanece inalterado

### US-016 — Exclusão sem operador autenticado é recusada

Como gestor clínico, quero que nenhuma exclusão aconteça sem um operador identificado pela sessão, para que nunca exista exclusão anônima.

#### AC-056 — Operador nulo ou inexistente bloqueia a exclusão

- **Dado** um identificador de operador nulo ou que não existe na base de perfis
- **Quando** a função de exclusão é chamada com esse identificador
- **Então** a operação é recusada e nada é removido nem logado

### US-017 — Motivo inválido é recusado no servidor

Como gestor clínico, quero que a validação do motivo aconteça no banco, não só no modal, para que a regra não dependa de o front-end estar correto.

#### AC-057 — Categoria de motivo inexistente ou inativa é recusada

- **Dado** uma categoria de motivo que não existe no catálogo ou que está marcada como inativa
- **Quando** a exclusão é tentada com essa categoria
- **Então** a operação é recusada e nada é removido nem logado

### US-018 — Aba "Logs" no histórico do paciente

Como qualquer usuário com acesso à página do paciente, quero ver as exclusões de agendamento daquele paciente — quem excluiu, quando e por quê — para responder "o que aconteceu com este paciente?" sem precisar de perfil de gestor.

#### AC-058 — Aba Logs lista as exclusões do paciente em ordem cronológica decrescente

- **Dado** um paciente com pelo menos uma exclusão de agendamento registrada
- **Quando** um usuário com acesso à página desse paciente abre a aba "Logs"
- **Então** a lista mostra, da mais recente para a mais antiga, quem excluiu, quando, o escopo da exclusão, o motivo (categoria e observação) e os dados da sessão apagada

### US-019 — Painel gerencial de auditoria de exclusões

Como gestor clínico, quero consultar e filtrar todas as exclusões de agendamento por período, profissional, operador e motivo, para identificar padrões de perda e auditar inconsistências.

#### AC-059 — Painel gerencial é restrito a gestor do sistema

- **Dado** um usuário autenticado sem perfil de gestor do sistema
- **Quando** ele tenta acessar o painel de auditoria de exclusões
- **Então** o acesso é negado

#### AC-060 — Painel filtra por período, profissional, operador e motivo simultaneamente

- **Dado** logs de exclusão de múltiplos pacientes, profissionais, operadores e motivos
- **Quando** um gestor aplica filtros de período, profissional, operador e/ou motivo
- **Então** somente os logs que atendem a todos os filtros aplicados juntos são exibidos

## Fora de escopo

- Soft delete com lixeira visual para restauração em 1 clique — a exclusão continua física, com snapshot completo no log (PRD, "Fora do Escopo V1").
- Auditoria de edição de agendamento (reagendamento, troca de profissional) e de dados cadastrais do paciente.
- Notificação automática ao paciente (WhatsApp/e-mail) no momento da exclusão.
- Exportação CSV do painel gerencial na V1.
- Backfill retroativo de exclusões passadas — o dado não existe, porque o `DELETE` histórico é físico.
- Escopo "somente pendentes" para excluir parte de uma série pulando as sessões concluídas — o bloqueio de "Concluído" é absoluto na V1 (ver ASM-001).
- Política de expurgo/retenção do log — retenção é indefinida na V1 (ver Q-001).

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-011 | O bloqueio de exclusão de atendimento "Concluído" é absoluto, sem escopo alternativo "somente pendentes" | confirmada | Decidido com o usuário em 25/08/2026: bloqueio absoluto; se precisar excluir parte de uma série com sessões concluídas, o operador desmarca manualmente as concluídas do lote |
| ASM-012 | A aba "Logs" do paciente é visível para qualquer usuário com acesso ao módulo/paciente, sem restrição adicional a gestor | confirmada | Decidido com o usuário em 25/08/2026, alinhado à recomendação do RFC 003 |
| ASM-013 | A exclusão continua física (hard delete); não há restauração em 1 clique na V1 — o snapshot no log é o mecanismo de reconstrução manual | confirmada | Definido no PRD 003, seção "Fora do Escopo" |
| ASM-014 | `SECURITY DEFINER` é aceitável como padrão de implementação neste projeto | confirmada | Já em uso em `fn_status_equipe_agora` (RFC 003, Suposição 5) |
| ASM-015 | O snapshot gravado no log não inclui dados de contato do paciente (telefone, e-mail) | confirmada | TDD 003, seção "Nunca logar" |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-006 | Qual é a política de expurgo/retenção do log de auditoria de dado de saúde? | aberta | — (TDD 003, Questão 5: owner @Dr. Felipe + Gestão, prazo +90 dias após go-live; retenção fica indefinida até lá) |
| Q-007 | O painel gerencial precisa de exportação CSV na V1? | respondida | Não — fora do escopo por padrão, pode entrar depois como incremento (~0,5d) |
| Q-008 | Auditoria de edição de agendamento (reagendamento, troca de profissional) entra na mesma tabela em V2? | aberta | — a coluna `acao` já comporta `edicao_*` sem migration nova; decisão de V2 fica para depois do go-live desta feature |
