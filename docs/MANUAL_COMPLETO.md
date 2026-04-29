# 📖 MedGuia Hub — Manual Completo

**Versão Precisa:** Contém APENAS funcionalidades confirmadas no código do sistema.

---

## 📑 Índice

1. [Login](#login)
2. [Dashboard](#dashboard)
3. [Agenda](#agenda)
4. [Confirmações](#confirmações)
5. [Prontuários](#prontuários)
6. [Contatos](#contatos)
7. [Pacientes](#pacientes)
8. [Configurações](#configurações)
9. [Relatórios](#relatórios)
10. [Estrutura de Dados](#estrutura-de-dados)

---

## Login

### Fazer Login

1. Acesse a URL do sistema
2. Você vê tela de login com:
   - Campo: Email
   - Campo: Senha
   - Botão: Entrar
3. Digite seu **email** (exato)
4. Digite sua **senha**
5. Clique **"Entrar"**

### Primeiro Acesso

Após login bem-sucedido, você é redirecionado para **Dashboard**.

---

## Dashboard

### O Que É

Dashboard é a **página inicial** que exibe dados resumidos do mês atual.

### Comportamento por Role

**Para Fisioterapeutas:**
- Vê seus dados pessoais apenas

**Para Gestor/Master:**
- Vê dados consolidados de toda a equipe
- Pode filtrar por profissional

### Dados Exibidos

#### 1. Volume de Atendimentos
- **Total:** Todos os atendimentos do mês
- **Concluídos:** Atendimentos com status "Concluído"
- **Cancelados:** Atendimentos com status "Cancelado"
- **Faltas:** Atendimentos com status "Falta"
- **Em Aberto:** Atendimentos com status "Confirmado" ou "Aguardando"

Cálculo: `Taxa Conclusão = (Concluídos / Total) × 100`

#### 2. Pacientes Novos
- **Pacientes Únicos:** Quantos pacientes diferentes atendeu
- **Novos Este Mês:** Quantos pacientes foram cadastrados neste mês

#### 3. Contatos
Status dos contatos de reativação:
- `a_contactar` — Ainda não contatou
- `tentativa` — Tentou contatar
- `em_conversa` — Conversando com paciente
- `sem_interesse` — Paciente sem interesse
- `agendou` — Paciente agendou retorno

#### 4. Período
Dashboard sempre mostra dados de **este mês** (do 1º até hoje).

### Acesso

Clique em **"Dashboard"** na sidebar para ir/voltar.

---

## Agenda

### Navegação

Clique em **"Agenda"** na sidebar.

### O Que Mostra

Lista de atendimentos do profissional com:
- **Paciente:** Nome
- **Data:** Data do agendamento
- **Hora:** Horário
- **Tipo:** Tipo de atendimento (Avaliação, Sessão, etc.)
- **Status:** Status atual

### Status Possíveis

| Status | Significado |
|--------|-------------|
| **Confirmado** | Paciente confirmou presença |
| **Aguardando** | Aguardando confirmação do paciente |
| **Em Atendimento** | Atendimento em progresso |
| **Concluído** | Atendimento finalizado |
| **Cancelado** | Atendimento foi cancelado |
| **Falta** | Paciente não compareceu |
| **Reposição** | Atendimento de reposição |
| **Reagendado** | Atendimento foi reagendado |

### Ver Detalhes

Clique em um atendimento para ver:
- Dados completos do paciente
- Profissional responsável
- Status atual
- Botões de ação (se disponíveis)

### Operações Disponíveis

**Editar:** Clique "[Editar]" para modificar:
- Data/hora
- Tipo
- Paciente

**Cancelar:** Clique "[Cancelar]" para cancelar o agendamento.

**Comparecimento:** Marcar como:
- Falta (paciente não veio)
- Outro status conforme necessário

---

## Confirmações

### Navegação

Clique em **"Confirmações"** na sidebar.

Submenu com 2 abas:
- **Cartões**
- **Mensagens**

### Aba: Cartões

Mostra atendimentos que estão com status **"Aguardando"** confirmação.

**Para cada atendimento, você vê:**
- Paciente
- Data/hora
- Tipo
- Botões de ação (se disponíveis)

### Aba: Mensagens

Mostra templates de mensagens disponíveis.

**Funcionalidades:**
- Ver mensagens pré-prontas
- Usar um template

---

## Prontuários

### Navegação

Clique em **"Prontuários"** na sidebar.

### O Que Mostra

Lista de **atendimentos concluídos que ainda não têm prontuário preenchido**.

**Para cada atendimento pendente, você vê:**
- Paciente
- Data do atendimento
- Tipo
- Botão para preencher

### Preencher Prontuário

Clique **"[Preencher]"** para abrir formulário.

**Campo disponível:**
- **Notas Clínicas:** Texto livre para registrar observações do atendimento

### Salvar

Clique **"[Salvar]"** para registrar.

---

## Contatos

### Navegação

Clique em **"Contatos"** na sidebar.

### Layout

Interface visual **Kanban** (quadro com colunas) para rastrear contatos.

**Colunas (4):**
A página exibe pacientes organizados em colunas visualmente.

### Interações

**Mover paciente:**
- Clique e segure em um paciente
- Arraste para outra coluna
- Solte para confirmar

**Ver detalhes:**
- Clique em um paciente para ver mais informações

### Relatório

Clique **"Relatório"** (se disponível na interface) para ver:
- Analytics dos contatos
- Contagem por status

---

## Pacientes

### Navegação

Clique em **"Pacientes"** na sidebar.

### Listar Pacientes

Você vê uma **lista paginada** de pacientes.

**Para cada paciente:**
- Nome
- CPF
- Telefone
- Email
- Status (Ativo/Inativo)
- Botões de ação

### Buscar Paciente

Campo de **busca** que filtra por:
- Nome
- CPF
- Telefone

Digite e a lista atualiza automaticamente.

### Filtros

**Mostrar inativos:**
- Checkbox "Mostrar inativos"
- Marca para incluir pacientes arquivados

### Paginação

- Mostra: "Página X de Y"
- Botões: "Anterior" e "Próxima"

### Ver Detalhes

Clique **"[Visualizar]"** para abrir ficha do paciente:
- Dados pessoais
- Histórico de atendimentos (se disponível)

### Editar Paciente

Clique **"[Editar]"** para:
- Modificar dados pessoais
- Salvar mudanças

### Arquivar Paciente

Clique **"[Arquivar]"** para:
- Marcar paciente como inativo
- Aparece em "Mostrar inativos" depois

### WhatsApp

Clique **"[WhatsApp]"** para:
- Abrir conversa com paciente no WhatsApp

---

## Configurações

### Navegação

Clique em **"Configurações"** na sidebar.

Submenu com 2 opções:
- **Disponibilidade**
- **Jornada**

### Disponibilidade

#### O Que É

Define quais **dias e horários você trabalha**.

#### Editar

Você pode:
- Selecionar dias (seg, ter, qua, etc.)
- Definir hora de início
- Definir hora de fim
- Definir horário de almoço

#### Copiar Disponibilidade

Existe botão **"[Copiar de Colega]"** para:
- Copiar horários de outro profissional
- Você seleciona qual colega
- Clica para copiar

### Jornada

#### O Que É

Define **quantas horas você deve trabalhar por semana**.

#### Editar

Campo para inserir **horas semanais contratadas**.

Exemplo: 40 horas/semana = 8h/dia × 5 dias

---

## Relatórios

### Tempo Fábril

**Acesso:** Clique em **"Equipe"** (sidebar) → **"Tempo Fábril"**

**Permissão:** Apenas Gestor/Master

**Dados mostrados:**
- Tabela com profissionais
- Horas contratuais vs. trabalhadas
- KPIs de produtividade

### Contatos - Relatório

**Acesso:** Clique em **"Contatos"** → **"Relatório"** (se disponível)

**Dados mostrados:**
- Contagem por status de contato
- Analytics de reativação

---

## Estrutura de Dados

### Atendimento

Um atendimento é registrado com:
- `id` — Identificador único
- `paciente_id` — Qual paciente
- `profissional_id` — Qual profissional atende
- `data_agendamento` — Data e hora
- `duracao_minutos` — Duração (se preenchida)
- `status` — Status atual
- `tipo` — Tipo (Avaliação, Sessão, etc.)
- `numero_sessao` — Número da sessão (se aplicável)

### Paciente

Um paciente tem:
- `id` — Identificador único
- `nome` — Nome completo
- `cpf` — CPF
- `telefone` — Telefone
- `email` — Email
- `ativo` — Se está ativo ou arquivado
- `created_at` — Data de cadastro

### Profissional (Profile)

Um profissional tem:
- `id` — Identificador único
- `full_name` — Nome completo
- `email` — Email
- `role` — Papel (fisioterapeuta, gestor, master)
- `ativo` — Se está ativo

### Disponibilidade

Define horário de trabalho:
- `profissional_id` — Qual profissional
- `dia_semana` — Dia da semana (0-6)
- `hora_inicio` — Horário de início
- `hora_fim` — Horário de fim
- `almoco_inicio` — Horário almoço início
- `almoco_fim` — Horário almoço fim

### Contato

Um contato de reativação tem:
- `paciente_id` — Qual paciente
- `status` — Status atual (a_contactar, tentativa, em_conversa, sem_interesse, agendou)
- `responsavel_id` — Profissional responsável

### Prontuário

Um prontuário tem:
- `atendimento_id` — Qual atendimento
- Campos de notas clínicas (conforme formulário)

---

## Roles e Permissões

### Fisioterapeuta
- Dashboard (seus dados)
- Agenda
- Confirmações
- Prontuários
- Contatos
- Pacientes
- Configurações

### Gestor
- Tudo acima +
- Dashboard (dados de toda equipe)
- Equipe (gerenciar profissionais)
- Relatório Tempo Fábril

### Master
- Tudo igual a Gestor
- Acesso administrativo completo

---

## Logout

Clique em **"Logout"** na sidebar para sair do sistema.

---

*Manual atualizado: 2026-04-29*
*Versão: Precisa (código confirmado)*