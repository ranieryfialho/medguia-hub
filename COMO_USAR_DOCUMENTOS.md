# 📚 Como Usar os Documentos de Usabilidade

Criei **4 documentos** para ajudar você a preparar uma análise de usabilidade do sistema. Aqui está como usá-los:

---

## 📄 Arquivos Criados

### 1. **APANHADO_PROJETO.md** (Referência Completa)
**Quando usar:** Quando você precisa entender a estrutura COMPLETA do projeto

**Contém:**
- Visão geral do projeto
- Estrutura de navegação (sidebar)
- Descrição detalhada de cada módulo (Dashboard, Agenda, Pacientes, etc.)
- Fluxos de integração
- Modelo de dados
- Design system
- Jornada típica de um fisioterapeuta

**Tamanho:** ~500 linhas  
**Tempo de leitura:** 15-20 minutos  
**Para quem:** Product managers, designers senior, stakeholders

---

### 2. **RESUMO_EXECUTIVO_UX.md** (Actionable Roadmap)
**Quando usar:** Quando você quer um PLANO DE AÇÃO concreto

**Contém:**
- Top 5 painpoints identificados (ranqueados por impacto)
- Problema + Solução para cada um
- Prioridade (P0, P1, P2) + Esforço estimado
- Roadmap de 5 fases com timeline
- Padrões de design a usar
- Métricas de sucesso para medir melhoria
- Próximos passos

**Tamanho:** ~400 linhas  
**Tempo de leitura:** 10-15 minutos  
**Para quem:** Você (desenvolvedor), product owner, designers de implementação

**👉 Recomendação:** Comece por ESTE arquivo. É o mais acionável.

---

### 3. **PROMPT_CLAUDE_DESIGN.md** (Prompt Detalhado)
**Quando usar:** Se você quer passar a análise para um **especialista em UX/Design externo**

**Contém:**
- Contexto completo do projeto
- Jornada principal do fisioterapeuta (em detalhes)
- Descrição de cada "fase" do fluxo
- Painpoints potenciais mapeados
- Estrutura de navegação atual (com análise)
- Perguntas específicas para o designer
- Formato esperado da análise
- Contexto técnico para implementação

**Tamanho:** ~600 linhas  
**Tempo de leitura:** 20-30 minutos  
**Para quem:** Agente de design externo (Claude Design, Figma plugin, etc.)

**👉 Uso:** Cole o conteúdo deste arquivo num chat com Claude Design ou Figma plugin.

---

### 4. **CLAUDE_DESIGN_PRONTO.txt** (Copy-Paste Imediato)
**Quando usar:** Você quer ir DIRETO para o Claude Design SEM ler outros arquivos

**Contém:**
- Resumo executivo super conciso
- 5 problemas + soluções propostas
- Perguntas específicas
- Informações técnicas
- Formato: TXT simples (fácil de copiar)

**Tamanho:** ~400 linhas  
**Tempo de leitura:** 5-10 minutos  
**Para quem:** Você quer ação RÁPIDA

**👉 Recomendação:** Se você tem pressa:
   1. Leia este arquivo (5 min)
   2. Copie e cole no Claude Design
   3. Espera análise de UX

---

## 🎯 Fluxo Recomendado de Uso

### Opção A: Análise Profunda (Melhor Resultado)
```
1. Leia APANHADO_PROJETO.md (entender projeto)
   ↓
2. Leia RESUMO_EXECUTIVO_UX.md (entender painpoints)
   ↓
3. Use PROMPT_CLAUDE_DESIGN.md (passear para especialista)
   ↓
4. Aguarde análise + mockups
   ↓
5. Implemente fases do RESUMO_EXECUTIVO_UX.md
```

**Tempo total:** ~1h de leitura + análise externa

---

### Opção B: Ação Rápida (Sem Analista Externo)
```
1. Leia RESUMO_EXECUTIVO_UX.md (10 min)
   ↓
2. Priorize FASE 1 (prontuários P0)
   ↓
3. Comece a implementar hoje
   ↓
4. Colete feedback de usuários
   ↓
5. Itera nas FASES 2, 3, 4, 5
```

**Tempo total:** ~10 min de leitura + início imediato de desenvolvimento

---

### Opção C: Análise com Claude Design (Rápida)
```
1. Leia CLAUDE_DESIGN_PRONTO.txt (5 min)
   ↓
2. Copie e cole no Claude Design
   ↓
3. Faça perguntas específicas
   ↓
4. Aguarde análise completa
   ↓
5. Use análise para roadmap
```

**Tempo total:** ~5 min + análise remota

---

## 📖 Roteiro por Persona

### Se você é o Developer/Você mesmo:
1. **RESUMO_EXECUTIVO_UX.md** — Entender o plano
2. **RESUMO_EXECUTIVO_UX.md → FASE 1** — Começar com prontuários (P0)
3. **Implementar iterativamente** (FASE 1 → 2 → 3 → ...)

---

### Se você é o Product Owner/Stakeholder:
1. **RESUMO_EXECUTIVO_UX.md** — Entender painpoints e roadmap
2. **RESUMO_EXECUTIVO_UX.md → Métricas** — Definir como medir sucesso
3. **Validar prioridades** com time

---

### Se você é o Designer/UX Specialist:
1. **APANHADO_PROJETO.md** — Entender projeto completo
2. **PROMPT_CLAUDE_DESIGN.md** — Detalhamento de problemas
3. **Criar mockups** das soluções propostas
4. **Propor refatorações** de componentes

---

### Se você é um Analista de UX Externo (Claude Design, etc.):
1. **Cole CLAUDE_DESIGN_PRONTO.txt** no chat
   OU
2. **Cole PROMPT_CLAUDE_DESIGN.md** no chat
3. **Faça perguntas refinando** contexto
4. **Entregue análise completa**

---

## 🎯 O Que Cada Documento Enfatiza

| Documento | Foco | Audiência | Ação |
|-----------|------|-----------|------|
| APANHADO_PROJETO.md | Compreensão | Todos | Lereferência |
| RESUMO_EXECUTIVO_UX.md | Implementação | Dev + PO | Executar roadmap |
| PROMPT_CLAUDE_DESIGN.md | Análise profunda | Designers | Receber análise |
| CLAUDE_DESIGN_PRONTO.txt | Rapidez | Dev solo | Copy-paste + ação |

---

## 🚀 Quick Start (5 minutos)

Se você só tem 5 minutos agora:

1. Abra **RESUMO_EXECUTIVO_UX.md**
2. Leia "Top 5 Painpoints"
3. Escolha qual PROBLEMA quer resolver primeiro
4. Leia a "Solução Proposta" para esse problema
5. Comece a implementar HOJE

**Resultado:** Você vai ter prioridade clara para as próximas 2 semanas.

---

## 📊 Checklist de Uso

- [ ] Li APANHADO_PROJETO.md ou RESUMO_EXECUTIVO_UX.md
- [ ] Entendi os 5 painpoints principais
- [ ] Identifiquei qual FASE implementar primeiro
- [ ] Defini métricas de sucesso
- [ ] Comecei prototipagem/desenvolvimento
- [ ] Coletei feedback de usuários reais (fisioterapeutas)
- [ ] Iterado em FASE 2, 3, 4
- [ ] Consolidei ganhos e nova roadmap

---

## ✉️ Perguntas Frequentes

### P: Qual arquivo ler PRIMEIRO?
**R:** Depende:
- Se quer agir HOJE → RESUMO_EXECUTIVO_UX.md
- Se quer entender tudo → APANHADO_PROJETO.md
- Se vai passar para designer → PROMPT_CLAUDE_DESIGN.md
- Se está com pressa → CLAUDE_DESIGN_PRONTO.txt

### P: Preciso ler TODOS?
**R:** Não. Escolha 1 arquivo baseado em seu objetivo.
- **Recomendação:** Sempre comece por RESUMO_EXECUTIVO_UX.md

### P: E se descobrir novo painpoint?
**R:** Adicione à lista. Use o mesmo formato:
```
PROBLEMA #N: [Nome]
- Situação Atual: ...
- Por Quê: ...
- Impacto: ...
- Minha Solução: ...
- Prioridade: P0/P1/P2
- Esforço: ...
```

### P: Quanto tempo leva implementar tudo?
**R:** ~8-10 semanas (5 FASES de 2 semanas cada)
- Mas FASE 1 sozinha traz valor em 2 semanas

### P: Preciso de analista de UX externo?
**R:** Recomendado para:
- Validação de prioridades
- Mockups/protótipos finalizados
- Feedback de usuários
  
Mas você consegue começar HOJE com esses documentos.

---

## 🎨 Como Usar com Claude Design (Passo a Passo)

1. Abra https://claude.ai/design (ou use CLI Claude Code)
2. Crie novo chat
3. Cole o conteúdo de **CLAUDE_DESIGN_PRONTO.txt**
   OU **PROMPT_CLAUDE_DESIGN.md**
4. Adicione prompt personalizado:
   ```
   "Com base neste contexto do MedGuia Hub, 
   faça uma análise de usabilidade focada em:
   1) Prontuários pendentes não são óbvios
   2) Sidebar confusa
   3) Como priorizar as mudanças
   
   Forneça mockups/recomendações de design."
   ```
5. Aguarde análise
6. Use feedback para refinaro roadmap

---

## 📝 Atualizações Futuras

Estes documentos são **vivos**. Após implementar mudanças:
- Adicione o que aprendeu
- Remova painpoints já resolvidos
- Revise prioridades baseado em feedback real

**Recomendação:** Revise este roadmap a cada 4 semanas.

---

**Última atualização:** 2026-04-29  
**Documentos criados por:** Análise automática do MedGuia Hub  
**Responsável:** Raniery Fialho
