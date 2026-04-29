# Prompt para Claude Design - Análise de Usabilidade MedGuia Hub

## 📋 Contexto do Projeto

Estou desenvolvendo **MedGuia Hub**, uma plataforma de gestão para clínicas de fisioterapia. O sistema é usado principalmente por **fisioterapeutas** (profissionais) que realizam agendamentos, preenchem prontuários e monitoram sua produtividade.

**Stack:** Next.js 16, React 19, Supabase, Tailwind CSS  
**Usuário Primary:** Fisioterapeutas de clínica de fisioterapia  
**Contexto:** Sistema web responsivo (desktop + mobile)

---

## 🎯 Objetivo da Análise

Realizar uma **auditoria completa de usabilidade** focada na jornada do fisioterapeuta no sistema, identificando:

1. **Pontos de fricção** — onde a navegação ou fluxo é confuso
2. **Oportunidades de melhoria** — onde a UX pode ser mais intuitiva
3. **Priorização** — quais melhorias têm maior impacto
4. **Recomendações de design** — soluções concretas e aplicáveis

---

## 📱 Jornada Principal do Fisioterapeuta

### Fase 1: Entrada & Orientação (Diária)
**Ação esperada:** Login → Dashboard → Verificar dia

**Fluxo atual:**
1. Usuário faz login
2. Redirecionado para `/dashboard`
3. Vê cards com KPIs pessoais (Taxa de Ocupação, Volume, Pacientes Ativos, Tendência 7d)
4. Clica em "Ir para Agenda" ou navega via sidebar

**Painpoints potenciais:**
- Dashboard é principalmente visual (bom), mas o call-to-action para próxima ação não é claro
- Muitas opções no sidebar — qual clico primeiro?
- Informações sobre "atendimentos do dia" não está destacada

### Fase 2: Agendamento & Confirmação
**Ação esperada:** Agendar novos atendimentos → Confirmar pacientes → Marcar presença

**Fluxo atual:**
1. Clica "Agenda" (sidebar ou dashboard)
2. Vê semana/dia com horários de 07:00 a 20:00
3. Novo agendamento (modal unificado)
4. Busca paciente em tempo real
5. Salva atendimento
6. Depois, vai para "Confirmações" para confirmar com pacientes

**Painpoints potenciais:**
- Busca de pacientes pode ser lenta se muitos registros
- Não há indicação visual clara de "horários livres vs ocupados"
- Confirmação é um menu separado — poderia estar na agenda?
- Status do atendimento (Confirmado, Aguardando) são badges pequenas

### Fase 3: Execução de Atendimento
**Ação esperada:** Executar atendimento → Marcar como "Em atendimento" → "Concluído"

**Fluxo atual:**
1. Durante o atendimento, fisio está com paciente
2. Depois, volta para agenda
3. Clica no atendimento e muda status para "Em atendimento"
4. Ao terminar, muda para "Concluído"

**Painpoints potenciais:**
- Edição de status na agenda não é muito clara (é um botão pequeno?)
- Não há confirmação visual de que o status mudou
- Falta feedback imediato após mudança

### Fase 4: Documentação & Prontuários
**Ação esperada:** Preencher prontuários após atendimento

**Fluxo atual:**
1. Va para "Prontuários"
2. Vê lista de "Atendimentos Concluídos sem Prontuário"
3. Clica para abrir formulário de prontuário
4. Preenche notas clínicas
5. Salva e gera PDF (opcional)

**Painpoints potenciais:**
- Prontuários como um menu separado — tá óbvio que é uma tarefa pós-atendimento?
- Badge "Prontuários pendentes" na sidebar — mas onde clicar para ir lá?
- Formulário de prontuário pode ser longo — navegação clara?
- PDF é gerado via window.print() — é intuitivo?

### Fase 5: Reativação de Pacientes
**Ação esperada:** Gerenciar contatos para trazer pacientes de volta

**Fluxo atual:**
1. Vai para "Contatos"
2. Vê kanban com 4 colunas (Recuperação Base, Aguardando Retorno, Confirmado, Finalizado)
3. Drag-and-drop de pacientes entre colunas
4. Assign responsável
5. Enviar template de mensagem via WhatsApp

**Painpoints potenciais:**
- Kanban é um padrão novo — nem todo usuario estará familiarizado
- Não há indicação clara de "o que fazer em cada coluna"
- Templates de mensagem precisam ser clicáveis de forma óbvia
- Responsável assinalado — é claro para quem?

### Fase 6: Monitoramento & Insights
**Ação esperada:** Revisar KPIs mensais, ajustar estratégia

**Fluxo atual:**
1. Dashboard mensal (KPIs do mês)
2. Se gestor: Relatório Tempo Fábril (tabela com todos os profissionais)

**Painpoints potenciais:**
- Relatório é muito técnico para fisio — eles entendem "taxa de ocupação"?
- Falta contexto: "você está acima/abaixo da meta?"
- Falta acionabilidade: "o que fazer para melhorar?"

---

## 🗂️ Estrutura de Navegação Atual

### Sidebar Atual:
```
Dashboard
Agenda
Pacientes
Prontuários
Contatos
Confirmações (submenu)
├── Cartões
└── Mensagens
Equipe (submenu) — APENAS GESTOR
├── Listagem
└── Tempo Fábril
Comercial (submenu) — APENAS GESTOR
└── (Vendas, Produtos, Relatórios)
Configurações (submenu)
├── Disponibilidade
└── Jornada
Logout
```

**Painpoints potenciais:**
- Muitos itens no topo level — priorização não clara
- "Confirmações" e "Contatos" parecem separados mas são tarefas relacionadas?
- "Prontuários" não está conectado visualmente à "Agenda"
- Configurações no fim — descobribilidade baixa

---

## 🎨 Design Atual (Referência Visual)

### Cores Usadas:
- **Primária:** #0A4D68 (azul escuro) — botões, headers
- **Sucesso:** #006b5a → #33a68f (gradiente verde) — KPIs positivos
- **Status Badges:** 7 cores diferentes (verde, âmbar, azul, roxo, vermelho, cinza, ciano)
- **Backgrounds:** Brancos e cinzas neutros

### Componentes:
- Cards com sombra sutil
- Modals para ações (novo agendamento, etc.)
- Badges para status
- Tabelas com ordenação
- Gráficos de barras (Recharts)
- Botões com ícones + texto

---

## 📊 Dados Quantitativos (Se Disponíveis)

*Insira aqui métricas de uso, feedback de usuários, ou observações de comportamento:*
- Qual é o caminho mais clicado?
- Qual é a taxa de conclusão para "preencher prontuário"?
- Quantos fisioterapeutas usam "Contatos"?
- Qual é o ponto de abandono mais comum?

---

## 🎯 Perguntas Específicas para Claude Design

1. **Priorização:** Qual é a tarefa MAIS importante para um fisioterapeuta em um dia típico? (Agenda? Confirmações? Prontuários?) Como o sistema deveria refletir isso?

2. **Sidebar:** A navegação atual está alinhada com a frequência/importância das tarefas? Deveria haver um fluxo linear (Dashboard → Agenda → Confirmações → Prontuários)?

3. **Dashboard:** Para fisioterapeutas, qual é o KPI mais relevante? (Taxa de Ocupação? Atendimentos hoje? Pendências?)

4. **Prontuários:** É óbvio que há prontuários pendentes? Deveria ser um item de "TODO" destacado instead de um menu separado?

5. **Contatos/Reativação:** O kanban é o padrão certo? Seria mais intuitivo um list-view com filtros por status?

6. **Confirmações:** Poderia estar integrado à agenda (confirmar direto do card do atendimento)?

7. **Mobile:** Como a navegação deveria adaptar em telas pequenas?

8. **Onboarding:** Há uma jornada de onboarding clara para novos fisioterapeutas? Ou eles chegam à agenda meio perdidos?

---

## 📈 Formato Esperado da Análise

Gostaria que você entregasse:

### 1. **Heatmap de Usabilidade**
Identifique os 5 maiores painpoints, ranqueados por impacto:
```
1. [Painpoint] — Impacto: Alto | Frequência: Diária | Solução: [breve]
2. [Painpoint] — Impacto: Médio | Frequência: Semanal | Solução: [breve]
...
```

### 2. **Recomendações de UX**
Para cada painpoint, sugira:
- **Problema específico**
- **Por que é um problema** (contexto do usuário)
- **Solução recomendada** (design pattern + mockup textual)
- **Prioridade** (P0, P1, P2)

### 3. **Roadmap de Priorização**
```
FASE 1 (Próximas 2 semanas) — High Impact, Low Effort
FASE 2 (Próximas 4 semanas) — High Impact, Medium Effort
FASE 3 (Longer term) — Medium/Low Impact, ou High Effort
```

### 4. **Padrões de Design a Implementar**
Cite design patterns específicos (ex: "Progressive Disclosure", "Onboarding", "Empty States", etc.) com justificativa.

### 5. **Métricas de Sucesso**
Sugira KPIs para medir melhoria de UX:
- Taxa de conclusão de prontuário por atendimento
- Tempo para completar agendamento
- Descobribilidade de features (X% de usuários usam Contatos?)
- Satisfação (NPS, CSAT)

---

## 🔗 Contexto Técnico para Implementação

- **Framework:** Next.js 16 (App Router)
- **Componentes:** React functional components
- **Styling:** Tailwind CSS (utility-first)
- **Ícones:** Lucide React
- **Banco:** Supabase (queries diretas, sem GraphQL)
- **Restrições:** Sem bibliotecas UI pesadas (shadcn, Material-UI)

---

## 📌 Observações Finais

- **Foco:** Fisioterapeutas, não gestores (eles têm menos funcionalidades)
- **Context:** Sistema é usado em consultório (ambiente acelerado, múltiplos clientes)
- **Objetivo Final:** Aumentar adoção, reduzir confusão, acelerar fluxo de trabalho

---

## 🚀 Próximas Etapas Após Análise

Com base na sua análise:
1. Prototipo/mockup de mudanças sugeridas
2. Definir componentes a refatorar
3. Criar plano de implementação com estimativas
4. Testar com usuários reais (fisioterapeutas)

---

*Análise solicitada em: 2026-04-29*  
*Por: Raniery Fialho (ranieryfialho@gmail.com)*
