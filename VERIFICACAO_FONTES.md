# ✅ Verificação de Fontes — O Que Foi Confirmado

Este documento lista **o que foi realmente verificado no código** e o que **ainda precisa de teste manual**.

---

## ✅ Confirmado (Vi no Código)

### Rotas/Páginas
- ✅ `/dashboard` — Dashboard page existe
- ✅ `/agenda` — Agenda page existe
- ✅ `/confirmacoes/cards` — Confirmações - Cartões
- ✅ `/confirmacoes/mensagens` — Confirmações - Mensagens
- ✅ `/contatos` — Contatos page existe
- ✅ `/contatos/relatorio` — Relatório de Contatos
- ✅ `/pacientes` — Pacientes page existe
- ✅ `/pacientes/novo` — Novo paciente
- ✅ `/pacientes/[id]` — Visualizar paciente
- ✅ `/pacientes/[id]/editar` — Editar paciente
- ✅ `/prontuarios` — Prontuários page existe
- ✅ `/prontuarios/[atendimentoId]` — Preencher prontuário
- ✅ `/configuracoes/disponibilidade` — Disponibilidade
- ✅ `/configuracoes/jornada` — Jornada
- ✅ `/equipe` — Equipe (Gestor only)
- ✅ `/relatorios/tempo-fabril` — Tempo Fábril (Gestor only)

### Componentes
- ✅ `FormCadastroPaciente` — Formulário novo paciente
- ✅ `FormEditarPaciente` — Formulário editar paciente
- ✅ `BtnArquivarPaciente` — Botão arquivar paciente
- ✅ `BtnWhatsApp` — Botão WhatsApp
- ✅ `KanbanContatos` — Kanban de contatos
- ✅ `DisponibilidadeEditor` — Editor de disponibilidade
- ✅ `BtnCopiarDisponibilidade` — Botão copiar disponibilidade
- ✅ `ProntuarioFormWrapper` — Formulário prontuário
- ✅ `RelatorioContatosClient` — Relatório contatos

### Funcionalidades
- ✅ Login com Supabase Auth
- ✅ Sidebar com navegação
- ✅ Logout
- ✅ Controle de role (fisioterapeuta, gestor, master)
- ✅ Paginação em listas
- ✅ Busca em listas (nome, CPF, telefone)
- ✅ Filtro "Mostrar inativos"
- ✅ Editar paciente
- ✅ Arquivar paciente (soft delete com confirm)
- ✅ Abrir WhatsApp
- ✅ Kanban de contatos (drag-drop visual)
- ✅ Editar disponibilidade
- ✅ Copiar disponibilidade de colega
- ✅ Dashboard mostra dados do mês atual
- ✅ Dashboard diferencia por role
- ✅ Status de atendimento: Confirmado, Aguardando, Em Atendimento, Concluído, Cancelado, Falta, Reposição, Reagendado
- ✅ Contatos com status: a_contactar, tentativa, em_conversa, sem_interesse, agendou

### Banco de Dados
- ✅ Tabela `atendimentos` com: id, profissional_id, data_agendamento, duracao_minutos, status, tipo, numero_sessao, paciente_id
- ✅ Tabela `pacientes` com: id, nome, cpf, telefone, email, ativo, created_at
- ✅ Tabela `profiles` com: id, full_name, role, ativo, email
- ✅ Tabela `disponibilidade_profissional` com: profissional_id, dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim, ativo
- ✅ Tabela `contatos_base` com: paciente_id, status, responsavel_id
- ✅ Tabela `prontuarios` com: atendimento_id
- ✅ Queries otimizadas com Promise.all para performance

---

## ⚠️ Parcialmente Confirmado (Vi no Código, mas Detalhes Faltam)

### Agenda
- ⚠️ **Page existe**, mas detalhes de:
  - Quantas visualizações (Dia, Semana, Mês)?
  - Como exatamente os horários aparecem?
  - Quais botões de ação aparecem?
  - Modal de novo agendamento — funciona exatamente como?

### Dashboard
- ⚠️ **Calcula KPIs**, mas não vi:
  - Layout exato das cards
  - Se tem gráficos (Recharts mencionado em package.json)
  - Tooltips ou hover information

### Confirmações
- ⚠️ **Abas existem**, mas não confirmado:
  - Exatamente o que mostra em "Cartões"
  - Exatamente o que mostra em "Mensagens"
  - Como interagir com templates

### Prontuários
- ⚠️ **Formulário existe**, mas não vi:
  - Quais campos exatamente
  - Se tem validações
  - Se gera PDF (html2canvas e jspdf estão no package.json)

### Relatórios
- ⚠️ **Tempo Fábril existe**, mas não vi:
  - Layout da tabela
  - Quais colunas exatamente
  - Filtros disponíveis

### WhatsApp
- ⚠️ **BtnWhatsApp existe**, mas:
  - Envia mensagem automaticamente?
  - Abre chat existente?
  - Qual é o fluxo exato?

---

## ❌ Não Confirmado (Mencionado em Memória, Mas Não Vi no Código)

- ❌ Modal automático ao marcar como "Concluído" para preencher prontuário
- ❌ Notificações automáticas (badges, banners)
- ❌ Envio automático de mensagens WhatsApp
- ❌ Confirmação de atendimento com paciente (fluxo completo)
- ❌ Gerar PDF de prontuário
- ❌ Migração e campos como `recuperacao_base`
- ❌ Sistema de templates de mensagem
- ❌ Atribuição de responsável em contatos
- ❌ Visualização por Dia/Semana/Mês na agenda

---

## 🧪 Recomendação: Teste Manual Completo

Para documentação 100% precisa, faça:

### Teste 1: Login & Dashboard
- [ ] Fazer login
- [ ] Verificar dados exibidos
- [ ] Comparar com o que código calcula

### Teste 2: Agenda
- [ ] Ir para Agenda
- [ ] Notar visualizações disponíveis
- [ ] Ver como horários são exibidos
- [ ] Verificar buttons de ação

### Teste 3: Novo Agendamento
- [ ] Clicar em criar agendamento
- [ ] Notar campos do modal
- [ ] Verificar validações

### Teste 4: Confirmações
- [ ] Ir para Confirmações
- [ ] Checar aba "Cartões"
- [ ] Checar aba "Mensagens"
- [ ] Ver o que pode fazer

### Teste 5: Prontuários
- [ ] Ir para Prontuários
- [ ] Clicar em preencher
- [ ] Notar campos exatos
- [ ] Ver se existe botão PDF

### Teste 6: Contatos
- [ ] Ir para Contatos
- [ ] Tentar mover paciente (drag-drop)
- [ ] Clicar em paciente
- [ ] Checar relatório

### Teste 7: Pacientes
- [ ] Listar pacientes
- [ ] Buscar paciente
- [ ] Editar dados
- [ ] Arquivar paciente

### Teste 8: Configurações
- [ ] Ir para Disponibilidade
- [ ] Editar horário
- [ ] Tentar copiar de colega
- [ ] Ir para Jornada
- [ ] Definir horas

### Teste 9: WhatsApp
- [ ] Clicar botão WhatsApp
- [ ] Verificar o que acontece

### Teste 10: Relatórios (Gestor)
- [ ] Ir para Tempo Fábril
- [ ] Notar dados mostrados
- [ ] Ver contatos - Relatório

---

## 📊 Resumo de Confiança

| Seção | Confiança | Status |
|-------|-----------|--------|
| **Rotas/Estrutura** | 95% | ✅ Confirmado |
| **Componentes** | 90% | ✅ Confirmado |
| **Banco de Dados** | 95% | ✅ Confirmado |
| **Funcionalidades Básicas** | 70% | ⚠️ Parcial |
| **Fluxos Detalhados** | 40% | ❌ Especulação |
| **Mensagens/Confirmações** | 30% | ❌ Incerteza |
| **Integrações** | 50% | ⚠️ Parcial |

---

## 🎯 Próximas Ações

1. **Teste Manual Completo** — siga checklist acima
2. **Atualize Documentos** — com achados do teste
3. **Documente Exatamente** — o que encontrou
4. **Compare com Código** — se não bate, pergunte ao dev

---

*Última atualização: 2026-04-29*
