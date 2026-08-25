# PRD: Sistema de Logs de Auditoria e Motivo de Exclusão de Agendamentos

Atualmente, a exclusão de agendamentos e consultas (sejam avulsos, pontuais de uma série ou toda a recorrência) ocorre sem a exigência de um motivo formal e sem a gravação de logs de auditoria centralizados. Quando um atendimento é removido da agenda, a gestão e a recepção perdem completamente a rastreabilidade sobre **quem executou a exclusão**, **quando ocorreu** e **qual foi a justificativa**. Isso gera insegurança operacional, atritos entre recepção e corpo clínico, perda de histórico de pacientes e falta de métricas sobre motivos de cancelamentos e perdas de consultas.

## Problema (O Porquê)

A funcionalidade precisa ser construída porque:
1. **Falta de Rastreabilidade:** Hoje, quando um atendimento desaparece da agenda, não há como identificar se foi um erro operacional, desistência do paciente, reagendamento incorreto ou ação não autorizada.
2. **Insegurança nas Séries Recorrentes:** A exclusão de sessões recorrentes (pontual, série completa ou selecionadas) apaga registros sem justificativa documentada, prejudicando o controle de evolução do tratamento do paciente.
3. **Ausência de Dados para Gestão:** Sem categorização dos motivos de exclusão (ex.: "Desistência do paciente", "Erro de agendamento", "Problema financeiro", "Mudança de horário sem reposição", "Outros"), a gestão clínica não consegue identificar gargalos de retenção nem avaliar a qualidade da operação de agendamento.

## Usuários (Para Quem)

- **Recepcionista / Atendente:** "Quando eu precisar excluir um agendamento (avulso ou de uma recorrência), quero informar de forma rápida e clara o motivo do cancelamento/exclusão, sabendo que a operação ficará registrada com segurança e transparência."
- **Gestor Clínico / Coordenação de Recepção:** "Quero ter uma trilha de auditoria completa para saber exatamente qual colaborador excluiu qualquer consulta, em qual data e horário, qual paciente foi afetado e o motivo informado, podendo auditar inconsistências e gerar relatórios de perdas."
- **Fisioterapeuta / Médico:** "Quero ter segurança de que as consultas da minha grade só sejam canceladas/excluídas com justificativa registrada, evitando 'sumiço' de pacientes da minha agenda sem explicação."

## Requisitos (O Quê)

### 1. Captura Obrigatória do Motivo de Exclusão (Frontend / Modal)
- **Modal de Confirmação com Justificativa:**
  - Toda ação de exclusão de agendamento deve exigir a seleção de um motivo pré-definido e/ou o preenchimento de uma justificativa textual.
  - O botão de confirmação de exclusão deve permanecer desabilitado até que um motivo válido seja selecionado/preenchido.
- **Categorias Pré-definidas de Motivo:**
  - O sistema deve fornecer uma lista padronizada de motivos rápidos, por exemplo:
    - *Desistência do paciente (motivos pessoais/tempo)*
    - *Desistência por questões financeiras*
    - *Erro de agendamento / duplicidade*
    - *Indisponibilidade do profissional*
    - *Alta médica / tratamento concluído antes do previsto*
    - *Outros (com campo de observação obrigatório)*
  - Campo aberto adicional de observações/detalhamento quando aplicável.
- **Cobertura de Todos os Escopos de Exclusão:**
  - **Agendamento Avulso (Único):** Exige motivo antes da exclusão definitiva.
  - **Atendimento Pontual da Recorrência:** Exige motivo antes de remover a sessão específica.
  - **Toda a Recorrência (Série Completa):** Exige motivo com aviso reforçado de impacto na série do paciente.
  - **Atendimentos Selecionados da Recorrência:** Exige motivo único aplicado ao lote de sessões selecionadas para exclusão.

### 2. Mecanismo de Logs de Auditoria (Backend / Banco de Dados)
- **Estrutura do Registro de Log:**
  - Cada evento de exclusão deve registrar obrigatoriamente:
    - `usuario_id` e `usuario_nome` (ou `usuario_email`) do operador autenticado que efetuou a ação.
    - `criado_em` (Timestamp exato com data e horário no fuso do sistema).
    - `tipo_evento` / `acao` (ex.: `exclusao_agendamento_avulso`, `exclusao_sessao_recorrente`, `exclusao_serie_completa`, `exclusao_atendimentos_selecionados`).
    - `motivo` (categoria selecionada + observação/detalhamento digitado).
    - `paciente_id` e `paciente_nome`.
    - `profissional_id` e `profissional_nome`.
    - `dados_agendamento` (JSON estruturado preservando snapshot dos dados antes da remoção: data/hora agendada, tipo de procedimento, número de sessão, série vinculada).
- **Atomicidade e Integridade:**
  - A exclusão do atendimento no banco só pode ser concluída com sucesso se o log de auditoria for gravado com êxito (transação ou garantia no Server Action).

### 3. Visualização e Consulta de Auditoria (Histórico / Painel)
- **Histórico na Aba do Paciente:**
  - Exibir no histórico/jornada do paciente o registro das consultas que foram excluídas, informando quem excluiu, quando e o motivo.
- **Painel de Auditoria para Gestão:**
  - Permitir que usuários com perfil de Gestor consultem e filtrem logs de exclusões por:
    - Período (data inicial e final)
    - Profissional da agenda
    - Operador que realizou a exclusão
    - Motivo / Categoria

## NUNCA PODE:

- Permitir que qualquer agendamento (avulso ou recorrente) seja excluído sem que um motivo válido tenha sido informado.
- Executar a exclusão sem identificar o usuário autenticado que realizou a ação (bloquear requisições anônimas ou com sessão inválida).
- Permitir edição, alteração ou exclusão dos registros da tabela de logs de auditoria (os logs devem ser imutáveis / *append-only*).
- Permitir que a falha na gravação do log resulte em exclusão silenciosa do agendamento (garantir consistência transacional).
- Excluir histórico de sessões já marcadas como "Concluído" (regra já existente mantida com bloqueio estrito).

## Métricas

- **100%** dos agendamentos excluídos com log de auditoria contendo autor, timestamp e motivo estruturado.
- **0%** de exclusões anônimas ou sem justificativa no sistema.
- Tempo médio de preenchimento do modal de exclusão pela recepção menor que **10 segundos** (UX fluida com motivos rápidos).
- Redução a zero do tempo gasto pela gestão para investigar "consultas sumidas" na agenda.

## Fora do Escopo (V1)

- Soft delete com lixeira visual pública para restauração em 1 clique (na V1, a exclusão permanece removendo da agenda ativa e gravando o log com snapshot completo dos dados para auditoria).
- Auditoria de edição de dados cadastrais gerais do paciente (nesta V1, o foco é restrito ao ciclo de agendamentos e consultas).
- Notificação automática via WhatsApp/E-mail para o paciente no momento da exclusão da consulta.
