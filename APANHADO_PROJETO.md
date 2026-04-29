# MedGuia Hub - Apanhado Geral do Projeto

## 📋 Visão Geral

**MedGuia Hub** é uma plataforma web de gestão para clínicas de fisioterapia. Desenvolvida em **Next.js 16 + React 19** com **Supabase** como banco de dados e autenticação. Sistema responsivo com Tailwind CSS.

**URL:** http://localhost:3000  
**Banco:** Supabase (Cloud PostgreSQL)  
**Tech Stack:** Next.js, React 19, TypeScript, Supabase, Tailwind CSS, Recharts (gráficos)

---

## 🎯 Públicos-alvo do Sistema

### 1. **Fisioterapeutas (Profissionais)**
- Executam atendimentos
- Gerenciam sua agenda pessoal
- Preenchem prontuários
- Monitoram seus KPIs individuais
- Gerenciam disponibilidade/jornada
- Acompanham contatos de pacientes para reativação

### 2. **Gestores/Administradores**
- Visualizam KPIs globais de toda a equipe
- Gerenciam equipe (cadastro, edição)
- Monitoram produtividade geral
- Acessam relatórios consolidados
- Gerenciam produtos e vendas
- Definem configurações do sistema

### 3. **Médicos**
- Podem visualizar dados de pacientes (papel ainda em desenvolvimento)

---

## 🗂️ Estrutura Principal do Aplicativo

### Navegação (Sidebar)
Localizada em `src/components/layout/Sidebar.tsx` com seções:

```
├── Dashboard (Todos)
├── Agenda (Todos)
├── Pacientes (Todos)
├── Prontuários (Todos)
├── Contatos (Todos)
├── Confirmações (Gestor/Fisio)
│   ├── Cartões de Confirmação
│   └── Mensagens
├── Equipe (Gestor/Master)
│   ├── Listagem
│   ├── Novo Profissional
│   └── Tempo Fábril (Relatório)
├── Comercial (Gestor)
│   ├── Vendas
│   ├── Produtos
│   └── Relatório de Vendas
├── Configurações
│   ├── Disponibilidade
│   └── Jornada
└── Logout
```

---

## 📱 Principais Módulos e Fluxos de UX

### 1. **Dashboard** (`/dashboard`)
**Público:** Todos (interface diferente por role)

**Para Fisioterapeutas:**
- KPIs individuais do mês: Taxa de Ocupação, Volume de Atendimentos, Pacientes Ativos, Status Distribution
- Tendência 7 dias (mini-gráfico)
- Dados personalizados em cards com gradiente verde

**Para Gestores:**
- KPIs globais (agregado de toda a equipe)
- Ranking de profissionais por Taxa de Ocupação
- Visualização de tendências e distribuição

**KPIs Exibidos:**
- Taxa de Ocupação (%) = tempo fábril / jornada contratada
- Volume de atendimentos no mês
- Pacientes únicos ativos
- Distribuição por status (Concluído, Cancelado, Falta, Em Aberto)

---

### 2. **Agenda** (`/agenda`)
**Público:** Todos

**Visualizações:**
- Por **dia** (lista horária com slots de 07:00 às 20:00)
- Por **semana** (cards por dia)
- Por **mês** (calendário mini)

**Funcionalidades:**
- Novo agendamento (modal unificado que busca pacientes do Supabase em tempo real)
- Status com badges coloridas:
  - Confirmado (verde)
  - Aguardando (âmbar)
  - Em atendimento (azul)
  - Concluído (roxo)
  - Cancelado (vermelho)
  - Falta (cinza)
  - Reposição (ciano)
  - Reagendado (laranja)
- Edição de atendimentos
- Filtros por período/profissional
- Integração com disponibilidade

**Filtros de Profissional:**
- Fisioterapeutas veem apenas sua agenda
- Gestores veem agenda de todos ou filtram por profissional

---

### 3. **Pacientes** (`/pacientes`)
**Público:** Todos

**Fluxos:**
1. **Listagem** (`/pacientes`)
   - Busca por nome, CPF ou telefone
   - Filtro: Mostrar inativos (toggle)
   - Paginação (padrão 50 pacientes/página)
   - Botões: Novo, Visualizar, Editar, WhatsApp, Arquivar

2. **Novo Paciente** (`/pacientes/novo`)
   - Formulário com: nome, CPF, telefone, email, data nascimento, etc.
   - Validações

3. **Visualizar/Editar** (`/pacientes/[id]`)
   - Card com dados do paciente
   - Histórico de atendimentos
   - Badge "Prontuários pendentes"
   - Opção de editar e arquivar

**Ações:**
- WhatsApp direto
- Arquivar paciente (soft delete, ativo=false)

---

### 4. **Prontuários** (`/prontuarios`)
**Público:** Todos

**Fluxos:**
1. **Lista de Pendentes** (`/prontuarios`)
   - Mostra atendimentos **Concluídos** sem prontuário
   - Para fisioterapeutas: apenas seus atendimentos
   - Para gestores: todos
   - Cards com: paciente, data, tipo, profissional
   - Links para preencher prontuário

2. **Editar Prontuário** (`/prontuarios/[atendimentoId]`)
   - Formulário unificado com campos:
     - Observações/notas
     - Evolução clínica
     - Próximo agendamento
   - Botão gerar PDF
   - Integração com `html2canvas` e `jspdf`

---

### 5. **Contatos** (`/contatos`)
**Público:** Todos

**Layout:**
- **Kanban com 4 colunas:**
  1. Recuperação Base
  2. Aguardando Retorno
  3. Confirmado Retorno
  4. Finalizado

**Funcionalidades:**
- Drag-and-drop entre colunas
- Busca/filtros
- Responsável por contato (assign a um profissional)
- Templates de mensagem para reativação
- WhatsApp direto
- Relatório de contatos (com analytics)

**Campo Novo:** `recuperacao_base` na tabela `pacientes` (migração recente)

---

### 6. **Confirmações** (`/confirmacoes`)
**Público:** Fisioterapeutas + Gestores

**2 Abas:**
1. **Cartões** — Cards de atendimentos para confirmar/marcar falta
2. **Mensagens** — Templates de confirmação via WhatsApp

**Estados:**
- Aguardando → Confirmado / Falta / Cancelado

---

### 7. **Relatórios**

#### a) **Tempo Fábril** (`/relatorios/tempo-fabril`)
**Público:** Gestor/Master apenas

- **Filtros:** Período (esta semana, mês, mês passado, custom), Profissional, Visão (geral/individual)
- **Tabela com KPIs:**
  - Jornada Contratada
  - Tempo Fábril (horas realmente atendendo)
  - Taxa de Ocupação (%)
  - Qtd de Atendimentos
  - Tempo Médio por atendimento
  - Dias Subutilizados (ocupação < 50%)
  - Gráfico: Evolução Semanal

- **Permissão:** Apenas gestor/master pode acessar

#### b) **Vendas** (`/relatorios/vendas`)
**Público:** Gestor

- Consolidado de vendas por período
- Filtros de data e vendedor

---

### 8. **Equipe** (`/equipe`)
**Público:** Gestor/Master

**Fluxos:**
1. **Listagem** (`/equipe`)
   - Cards de profissionais
   - Nome, role, link para editar
   - Ações: Editar, Excluir

2. **Novo** (`/equipe/novo`)
   - Formulário: nome, email, role, jornada semanal
   - Criar usuário no Auth Supabase

3. **Editar** (`/equipe/[id]/editar`)
   - Atualizar dados do profissional

---

### 9. **Vendas** (`/vendas`)
**Público:** Todos

**Fluxos:**
- Nova venda
- Lista de vendas (filtros por período/vendedor)
- Editar/Deletar
- Gerar PDF

---

### 10. **Produtos** (`/produtos`)
**Público:** Todos

**CRUD simples:**
- Novo produto
- Editar produto
- Deletar produto
- Listagem com filtros

---

### 11. **Configurações** (`/configuracoes`)
**Público:** Todos (personalizadas por profissional)

#### a) **Disponibilidade** (`/configuracoes/disponibilidade`)
- Editar disponibilidade (quais dias/horários trabalha)
- Copiar disponibilidade de outro profissional
- Validação de sobreposição de horários

#### b) **Jornada** (`/configuracoes/jornada`)
- Horas contratuais por semana
- Período de almoço padrão
- Feriados/folgas

---

## 🔐 Sistema de Permissões e Roles

### Roles Definidos:
1. **master** — Super admin, acesso total
2. **gestor** — Gestor/administrador, acesso a relatórios, equipe, configurações
3. **fisioterapeuta** (default) — Profissional, acesso limitado
4. **medico** — Visualização apenas (estrutura preparada)

### Padrão de Controle de Acesso:
- **Sidebar:** Itens de menu aparecem/desaparecem por role
- **Páginas:** Redirecionam se role não autorizado
- **Queries:** Filtram dados por profissional_id se fisio

---

## 📊 Modelo de Dados Principais

### Tabelas-chave:
- **profiles** — Usuários e roles
- **pacientes** — Cadastro de pacientes
- **atendimentos** — Agendamentos/consultas
- **prontuarios** — Registros clínicos por atendimento
- **contatos_base** — Rastreamento de reativação
- **disponibilidades** — Horários disponíveis
- **agendamentos** — Tipo de atendimento (nomenclatura)
- **vendas** — Transações/receitas
- **produtos** — Catálogo de produtos
- **templates** — Mensagens reutilizáveis

---

## 🎨 Design System

### Cores Principais:
- **Primária:** #0A4D68 (azul escuro) — botões, headers
- **Primária sucesso:** #006b5a → #33a68f (gradiente verde) — status positivos
- **Neutral:** Tons de cinza para backgrounds
- **Status:**
  - Verde: Confirmado/Concluído
  - Âmbar: Aguardando
  - Azul: Em Atendimento
  - Vermelho: Cancelado
  - Cinza: Falta
  - Roxo: Concluído (alternativo)
  - Ciano: Reposição

### Componentes Reutilizáveis:
- Buttons, Cards, Forms, Modals
- Badges de status
- Filtros (Dropdowns, Date pickers)
- Paginação
- Tabelas com ordenação
- Gráficos (Recharts para tendências)

---

## 🚀 Recursos Técnicos Implementados

### Bibliotecas:
- **date-fns** — Manipulação de datas
- **lucide-react** — Ícones
- **recharts** — Gráficos
- **html2canvas + jspdf** — Geração de PDFs
- **react-hot-toast** — Notificações
- **Supabase Auth** — Autenticação

### Helpers Internos:
- `src/lib/datetime.ts` — Utilitários de data/hora em timezone América/Fortaleza
- `src/lib/relatorios/kpis-tempo-fabril.ts` — Cálculo de KPIs
- `src/lib/disponibilidade.ts` — Normalização de horários
- `src/lib/sessoes.ts` — Mapeamento de sessões
- `src/lib/profissionais.ts` — Validações de acesso

---

## 🎯 Jornada do Fisioterapeuta (Típica)

### Morning:
1. Login
2. Acessar Dashboard → ver KPIs do dia
3. Ir para Agenda → confirmar atendimentos do dia
4. Navegar para Contatos → gerenciar reativação de pacientes
5. Ir para Agenda → realizar atendimento

### After Appointment:
1. Agenda → marcar como "Em atendimento" → "Concluído"
2. Prontuários → preencher notas clínicas
3. Dashboard → monitorar evolução

### End of Month:
1. Relatório Tempo Fábril (se gestor) ou Dashboard pessoal
2. Verificar taxa de ocupação e KPIs
3. Ajustar disponibilidade se necessário

---

## 🔄 Fluxos de Integração

### Novo Atendimento:
```
Agenda (nova) → Modal com busca de paciente → Criar atendimento → 
→ Salvar em atendimentos → Disponibilidade atualizada
```

### Confirmação:
```
Confirmações → Cartão → Confirmar/Falta → Atualizar status → 
→ Notificação via WhatsApp (opcional)
```

### Prontuário:
```
Prontuários → Pendentes → Abrir → Preencher notas → Salvar → 
→ Gerar PDF (html2canvas + jsPDF)
```

### Reativação:
```
Contatos → Kanban → Mover status → Assign responsável → 
→ Enviar template → Rastrear resultado
```

---

## 📌 Estados Atuais e Evoluções Recentes

### Implementado (Apr 2026):
✅ Dashboard dinâmico com KPIs  
✅ Relatório Tempo Fábril  
✅ Sistema de Prontuários com PDF  
✅ Kanban de Contatos com reativação  
✅ Campo `recuperacao_base` em pacientes  
✅ Novo modal de agendamento unificado  
✅ Badge de prontuários pendentes  
✅ Nome do profissional em cards de atendimento  

### Em Desenvolvimento:
🔄 Refinamentos de UX  
🔄 Mobile optimization  

### Roadmap Sugerido:
📋 Melhorias de usabilidade para fisioterapeutas  
📋 Analytics mais refinado  
📋 Integração com SMS/WhatsApp automático  
📋 Mobile app nativo (React Native)

---

## 📱 Responsividade

Sistema desenvolvido com **mobile-first** approach:
- Sidebar colapsável em mobile
- Grids responsivos (1 col mobile → 3 col desktop)
- Modals otimizados para toque
- Filtros adaptativos

---

## 🔗 Links Importantes

- **Repo:** GitHub (informação não disponível)
- **Staging:** (informação não disponível)
- **DB Supabase:** fmfluofmpnppdwmvznxw.supabase.co
- **Frontend:** localhost:3000

---

## 📞 Contato & Suporte

**Desenvolvedor:** Raniery Fialho  
**Email:** ranieryfialho@gmail.com

---

*Atualizado em: 2026-04-29*
