# MedGuia Hub — Resumo Executivo de Usabilidade

> **Para usar no Claude Design:** Copie este arquivo inteiro ou a seção relevante e cole no prompt.

---

## 🎯 Situação Atual (Snapshop de Usabilidade)

### Projeto
- **Nome:** MedGuia Hub
- **Propósito:** Plataforma de gestão para clínicas de fisioterapia
- **Público Primary:** Fisioterapeutas (profissionais de linha de frente)
- **Tech:** Next.js 16, React 19, Supabase, Tailwind CSS

### Jornada Principal de um Fisioterapeuta

```
LOGIN → DASHBOARD (KPIs) → AGENDA (confirmar dia)
   ↓
CONFIRMAR ATENDIMENTOS (com pacientes)
   ↓
EXECUTAR ATENDIMENTOS (agenda)
   ↓
PREENCHER PRONTUÁRIOS (documentação)
   ↓
REATIVAR PACIENTES (contatos/kanban)
   ↓
REVISAR PROGRESSO (dashboard mensal)
```

---

## ⚠️ Top 5 Painpoints Identificados

### 1️⃣ **Prontuários Pendentes: Difíceis de Descobrir**
**Problema:** Fisioterapeutas concluem atendimento, saem da agenda, e depois "esquecem" de preencher prontuário.

**Por quê:** 
- Prontuários é um menu separado na sidebar (não conectado à Agenda)
- Badge "Prontuários pendentes" fica em lugar pequeno na sidebar
- Não há fluxo guiado: Agenda → Concluído → [Preencher Prontuário agora?]

**Impacto:** 
- Taxa de incompleção de prontuários (métrica desconhecida)
- Falta de documentação clínica
- Não conformidade legal

**Prioridade:** 🔴 **P0 — CRÍTICA**

---

### 2️⃣ **Sidebar Desordenada: Muitos Itens, Priorização Não Clara**
**Problema:** Sidebar tem ~15 itens. Qual clico primeiro após login?

**Estrutura atual:**
```
Dashboard ← óbvio
Agenda ← faz sentido
Pacientes ← background info
Prontuários ← tarefas pós-atendimento?
Contatos ← reativação
Confirmações ← tarefas de checagem
Equipe ← GESTOR ONLY (confunde fisio)
Comercial ← GESTOR ONLY (confunde fisio)
Configurações ← discovery baixa
```

**Por quê:**
- Não reflete frequência real de uso
- Menus "Equipe" e "Comercial" (gestor) aparecem para fisio confundindo
- Tarefas relacionadas estão separadas

**Impacto:**
- Confusão em novos usuários
- Baixa descobribilidade de features importantes

**Prioridade:** 🟡 **P1 — ALTA**

---

### 3️⃣ **Confirmação vs. Agenda: Dois Fluxos Para Uma Tarefa**
**Problema:** Confirmar atendimento requer 2 ações separadas:
1. Ir para "Confirmações" → cartões
2. Confirmar com paciente
3. Depois, voltar para "Agenda" → marcar como "Em atendimento"

**Por quê:**
- "Confirmações" (com paciente) é separado de "Agenda" (seu estado interno)
- Conceitos misturados: status do sistema vs. confirmação com paciente

**Impacto:**
- Fluxo fragmentado
- Confusão sobre "onde estou no processo"

**Prioridade:** 🟡 **P1 — ALTA**

---

### 4️⃣ **Contatos/Reativação: Kanban Pode Ser Pouco Intuitivo**
**Problema:** Kanban com 4 colunas (Recuperação Base → Aguardando → Confirmado → Finalizado). Nem todo user entende drag-and-drop.

**Por quê:**
- Kanban é um padrão modern, mas não intuitivo para todos
- Colunas não têm indicação clara de "o que fazer em cada uma"
- Não há documentação em-app

**Impacto:**
- Baixa adoção da feature de reativação
- Perda de oportunidade de trazer pacientes de volta

**Prioridade:** 🟡 **P1 — MÉDIA** (depende de quem usa)

---

### 5️⃣ **Dashboard: KPIs Bonitos Mas Sem Contexto**
**Problema:** Vê "Taxa de Ocupação: 73%". E aí? É bom? Devo fazer algo?

**Por quê:**
- Faltam benchmarks ("meta é 80%")
- Faltam insights acionáveis ("você teve 2 cancelamentos essa semana")
- Falta comparação temporal ("semana passada foi 68%")

**Impacto:**
- KPIs se tornam "números bonitos" sem significado
- Fisio não sabe como melhorar

**Prioridade:** 🟡 **P2 — MÉDIA** (nice-to-have após P0, P1)

---

## 🔧 Recomendações de UX (Roadmap)

### FASE 1: Fixar Fluxo de Prontuários (P0)
**Objetivo:** Garantir que prontuários sejam preenchidos e não fiquem pendentes.

**Soluções:**
1. **Modal pós-agendamento:** Ao mudar status para "Concluído", abrir modal com:
   - "Prontuário pendente para este atendimento. Quer preencher agora?"
   - Botão "Preencher" (abre form em modal)
   - Botão "Depois" (com lembrante posterior)

2. **Badge Acionável:** Badge "Prontuários pendentes: 3" na sidebar → ao clicar, vai direto para lista de pendentes

3. **Notificação Daily:** Ao logar, se houver prontuários > 3 dias pendentes, exibir banner no topo

**Esforço:** 🟢 Médio (1-2 semanas)  
**Impacto:** 🔴 Crítico (compliance, documentação)

---

### FASE 2: Reorganizar Sidebar (P1)
**Objetivo:** Refletir frequência real de uso e fluxo lógico.

**Nova Estrutura Proposta (Fisio):**
```
📊 Dashboard (início rápido)
📅 Agenda (principal, diária)
✅ Confirmações (relacionada à agenda)
  ├── Cartões (confirmar com paciente)
  └── Mensagens (templates)
📄 Prontuários (pós-agenda)
💬 Contatos (reativação)
👥 Pacientes (background info)
⚙️  Configurações
  ├── Disponibilidade
  └── Jornada
```

**Para Gestor:**
```
[Tudo acima] +
👔 Equipe (submenu)
  ├── Listagem
  └── Tempo Fábril (relatório)
🛍️  Comercial (submenu)
  ├── Vendas
  └── Produtos
```

**Esforço:** 🟢 Baixo (UI only, 3-4 dias)  
**Impacto:** 🟡 Alto (descobribilidade, fluxo)

---

### FASE 3: Integrar Confirmação à Agenda (P1)
**Objetivo:** Fluxo 1-click de "confirmar" direto no card de agendamento.

**Solução:**
- Card de agendamento na Agenda exibe:
  - Status do sistema (Confirmado, Aguardando, etc.) com badge
  - Botão "Confirmar com Paciente" → abre modal com:
    - Paciente: [nome]
    - Tipo: [sessão/avaliação]
    - Template de mensagem WhatsApp pré-preenchido
    - Botão "Enviar WhatsApp"
    - Checkbox: "Paciente confirmou? Marcar como Confirmado"

**Esforço:** 🟡 Médio (2-3 semanas, envolve refactor)  
**Impacto:** 🟡 Alto (reduz cliques, clareza de fluxo)

---

### FASE 4: Melhorar Kanban de Contatos (P1)
**Objetivo:** Tornar claro o que fazer em cada coluna.

**Soluções:**
1. **Helptexts:** Cada coluna exibe um subtítulo:
   - "🔄 Recuperação Base" → "Pacientes que ainda não responderam"
   - "⏳ Aguardando Retorno" → "Marcado retorno, aguardando confirmação"
   - "✅ Confirmado Retorno" → "Agendamento confirmado"
   - "🎯 Finalizado" → "Reativado com sucesso"

2. **Empty States:** Se coluna vazia:
   - "Nenhum paciente aqui. Parabéns! 🎉"
   - Ou: "Clique em 'Adicionar' para trazer pacientes"

3. **Tutorial Inline:** Primeira vez que acessa, exibe tour rápido (3 steps)
   - "Arraste pacientes entre colunas para rastrear reativação"
   - Seta apontando para coluna

**Esforço:** 🟢 Médio (1-2 semanas)  
**Impacto:** 🟡 Médio (depende de uso, mas melhora adoção)

---

### FASE 5: Contexto no Dashboard (P2)
**Objetivo:** Deixar KPIs acionáveis e com significado.

**Soluções:**
1. **Micro-insights:** Abaixo de cada KPI, adicionar:
   - "📈 +5% vs. semana passada"
   - "🎯 Meta: 80% (você está em 73%)"
   - "💡 Dica: Você teve 2 cancelamentos. Enviar confirmação com 24h de antecedência reduz isso"

2. **Comparação Histórica:** Card com minigráfico (7 dias) de tendência

3. **Recomendações:** Section "Ações Recomendadas"
   - "Você tem 3 prontuários pendentes há > 3 dias"
   - "2 pacientes sem atendimento há > 3 meses — considere reativar"

**Esforço:** 🟡 Médio (dados + UI, 2-3 semanas)  
**Impacto:** 🟢 Médio-Alto (engagement, retenção)

---

## 📐 Padrões de Design a Usar

| Padrão | Aplicar Em | Por Quê |
|--------|-----------|--------|
| **Progressive Disclosure** | Modais de agendamento, prontuário | Não sobrecarregar com campos |
| **Inline Guidance** | Kanban de contatos, dashboard | Ajudar novatos sem tutorial separado |
| **Contextual Actions** | Agenda (confirmar, editar, marcar falta) | Reduzir cliques e navegação |
| **Empty States** | Contatos, prontuários, pacientes | Guiar usuário quando vazio |
| **Micro-interactions** | Mover status, drag-drop kanban | Feedback imediato de ação |
| **Breadcrumbs** | Todas as páginas internas | Orientação de localização |
| **Informative Badging** | Status, prontuários pendentes, etc | Status visual rápido |

---

## 📊 Métricas de Sucesso (Para Medir Melhoria)

**Após implementar mudanças, rastrear:**

1. **Taxa de Conclusão de Prontuário** (GOAL: > 95%)
   - Métrica: Atendimentos concluídos com prontuário preenchido / Total concluído
   - Baseline: (desconhecido, coletar agora)

2. **Tempo para Completar Agendamento** (GOAL: < 2 min)
   - Métrica: Tempo médio do clique "Novo" até "Salvar"
   - Analytics: Adicionar event tracking

3. **Descobribilidade de Contatos** (GOAL: > 70% de usuários usam/mês)
   - Métrica: % de profissionais que acessam /contatos pelo menos 1x/mês
   - Baseline: (coletar agora)

4. **Satisfação Subjetiva** (GOAL: NPS > 50)
   - Método: Enviar survey simples (2 perguntas) todo mês
   - Timing: Ao logar (ou sair)

5. **Taxa de Erro / Confusão** (GOAL: Reduzir)
   - Métrica: Quantas vezes fisio vai para sidebar errado
   - Proxy: Clicks em "Equipe" por fisio (deve ser zero)

---

## 🚀 Priorização Final (Roadmap)

```
SEMANA 1-2: FASE 1 (Prontuários P0)
├── Modal pós-conclusão
├── Badge acionável
└── Notificação daily

SEMANA 3-4: FASE 2 (Sidebar reorganizada)
├── Reordenar itens
├── Esconder menus de gestor para fisio
└── Testes com usuários

SEMANA 5-6: FASE 3 (Integrar Confirmação)
├── Refactor cards de agenda
├── Modal de confirmação inline
└── Testes

SEMANA 7-8: FASE 4 (Kanban UX)
├── Helptexts e empty states
├── Tutorial inline
└── Testes com novatos

MÊS 2: FASE 5 (Dashboard context)
├── Micro-insights
├── Recomendações
└── Analytics e validação

```

---

## 💾 Arquivos de Suporte

**Consulte também:**
- `APANHADO_PROJETO.md` — Detalhamento completo de features e fluxos
- `PROMPT_CLAUDE_DESIGN.md` — Prompt detalhado com todas as perguntas

---

## ✅ Próximos Passos

1. ✏️ **Validar com usuários reais** — Mostrar protótipos de FASE 1 e 2 para 2-3 fisioterapeutas
2. 🎨 **Criar mockups** — Prototipar mudanças propostas em Figma/Sketch
3. 📊 **Configurar analytics** — Começar a rastrear eventos de uso
4. 🔧 **Implementar FASE 1** — Começar por prontuários (P0, maior impacto)
5. 🧪 **Testar iterativamente** — Cada fase + feedback

---

**Última atualização:** 2026-04-29  
**Responsável:** Raniery Fialho  
**Email:** ranieryfialho@gmail.com
