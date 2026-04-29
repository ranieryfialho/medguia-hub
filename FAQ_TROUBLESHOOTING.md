# ❓ MedGuia Hub — FAQ & Troubleshooting

**Versão Precisa:** Contém perguntas confirmadas com base no código do sistema.

---

## 📋 Índice Rápido

- [Funcionalidades](#funcionalidades)
- [Operações](#operações)
- [Dados](#dados)
- [Problemas Técnicos](#problemas-técnicos)
- [Contato](#contato)

---

## Funcionalidades

### P: Que menus existem no sistema?

**R:** Os menus na sidebar são:
- Dashboard
- Agenda
- Confirmações (submenu: Cartões, Mensagens)
- Contatos (+ Relatório)
- Pacientes
- Prontuários
- Configurações (submenu: Disponibilidade, Jornada)
- Equipe (apenas Gestor/Master)
- Logout

---

### P: Qual é a diferença entre Confirmações e Agenda?

**R:** Com base no código:
- **Agenda:** Lista geral de atendimentos com status
- **Confirmações:** Subseção que mostra atendimentos "Aguardando" confirmação (2 abas: Cartões e Mensagens)

Ambas são formas de visualizar atendimentos, mas com propósitos diferentes.

---

### P: O que tem na aba "Mensagens" de Confirmações?

**R:** A aba "Mensagens" exibe **templates de mensagens** pré-existentes no sistema.

**Funcionalidade confirmada:** Você pode visualizar os templates.

**Não confirmado no código:** Se você pode criar novos templates ou enviar diretamente.

---

### P: Como funciona o Kanban de Contatos?

**R:** Contatos usa um layout visual em **colunas**.

**Operação confirmada:**
- Clique e segure em um paciente
- Arraste para outra coluna
- Solte para mover

**Estrutura:** 4 colunas (exatas, conforme visto no código)

**Não especificado:** Os nomes exatos das colunas

---

### P: Posso criar novo paciente no sistema?

**R:** Sim. Existe **FormCadastroPaciente** no código, indicando:
- ✅ Funcionalidade de cadastro existe
- ✅ Tem validações

**Campos exatos:** Não foram listados no código explorado.

---

## Operações

### P: Posso editar um atendimento?

**R:** Sim. Na Agenda:
- Clique em um atendimento
- Clique **"[Editar]"**
- Modifique dados
- Salve

**Campos que podem ser editados:** Data, hora, tipo, paciente (inferência baseada em componentes).

---

### P: Posso cancelar um atendimento?

**R:** Sim, existe opção **"[Cancelar]"** na Agenda.

**O que acontece:** Atendimento muda de status para "Cancelado".

---

### P: Como arquivar um paciente?

**R:** Na página de Pacientes:
- Clique **"[Arquivar]"**
- Confirmação aparece: "Deseja arquivar? Ele ficará oculto da listagem principal."
- Clique para confirmar

**Resultado:** Paciente fica com `ativo = false` (soft delete).

**Para reativar:** Marque "Mostrar inativos" e procure o paciente.

---

### P: Posso editar dados de um paciente?

**R:** Sim. Na página Pacientes:
- Clique **"[Editar]"**
- Modifique dados
- Salve

---

### P: Como buscar um paciente?

**R:** Na página Pacientes:
- Use o campo de **busca**
- Digite: nome, CPF ou telefone
- Lista atualiza automaticamente

---

### P: Posso abrir WhatsApp direto do sistema?

**R:** Sim. Existe **BtnWhatsApp** no código.

**Funcionalidade:** Clique **"[WhatsApp]"** para abrir conversa com paciente.

**Exato:** Abre conversa existente (não envia mensagem automaticamente).

---

### P: Como preencher um prontuário?

**R:** Na página Prontuários:
- Lista mostra atendimentos sem prontuário
- Clique **"[Preencher]"**
- Preencha o campo de **notas clínicas**
- Clique **"[Salvar]"**

---

### P: Que informações vou em um prontuário?

**R:** Baseado no código, existe:
- Campo para **notas clínicas** (texto livre)

**Não confirmado:** Quais outros campos existem (evolução, diagnóstico, etc.).

---

### P: Como copiar minha disponibilidade?

**R:** Em Configurações → Disponibilidade:
- Clique **"[Copiar de Colega]"**
- Selecione qual colega
- Clique para copiar

**Resultado:** Seus horários viram iguais aos dele.

---

## Dados

### P: Qual período o Dashboard mostra?

**R:** Dashboard sempre mostra **este mês** (do 1º até hoje).

---

### P: O que conta como "Concluído" no Dashboard?

**R:** Atendimentos com status **"Concluído"** na tabela `atendimentos`.

---

### P: O que são "Pacientes Novos"?

**R:** Pacientes cadastrados **este mês** (do 1º até hoje).

Cálculo: Filtra by `created_at` >= início do mês.

---

### P: Qual é a diferença entre status "Concluído" e "Falta"?

**R:** No sistema:
- **Concluído:** Atendimento foi realizado
- **Falta:** Paciente não compareceu

---

### P: Qual é a diferença entre "Aguardando" e "Confirmado"?

**R:** No sistema:
- **Aguardando:** Aguardando confirmação do paciente
- **Confirmado:** Paciente já confirmou presença

---

### P: O que significa cada status de Contato?

**R:** Baseado no código, existem 5 status:
- `a_contactar` — Ainda não contatou
- `tentativa` — Tentou contatar
- `em_conversa` — Conversando
- `sem_interesse` — Sem interesse
- `agendou` — Agendou retorno

---

### P: Posso ver histórico de atendimentos do paciente?

**R:** Na página Pacientes, ao clicar **"[Visualizar]"**, você pode ver:
- Dados pessoais do paciente
- **Histórico de atendimentos** (se implementado na ficha)

---

## Problemas Técnicos

### P: Não consigo fazer login

**R:** Verifique:
- Email está correto?
- Senha está correta?
- Caps Lock está ativo?

Se problema persiste:
- Contate seu **gestor ou administrador**

---

### P: Página não carrega ou fica branca

**R:** Tente:
1. **Atualizar página** (F5 ou Ctrl+R)
2. **Limpar cache** (Ctrl+Shift+Delete)
3. **Fechar e reabrir navegador**
4. **Acessar de outro navegador** (Chrome, Firefox, Safari)

Se não funciona:
- Contate seu **administrador**

---

### P: Sistema está muito lento

**R:** Tente:
1. **Atualizar página** (F5)
2. **Fechar abas desnecessárias**
3. **Limpar cache**
4. **Verificar sua conexão internet**

Se persiste:
- Contate seu **administrador**

---

### P: Um campo está vazio ou não aparece

**R:** Possibilidades:
- Dado não foi preenchido anteriormente
- Permissão insuficiente para ver campo

Contate seu **gestor ou administrador**.

---

### P: Botão não funciona ou parece travado

**R:** Tente:
1. **Atualizar página**
2. **Fazer logout e login novamente**
3. **Acessar de outro navegador**

---

### P: Recebi mensagem de erro

**R:** Anote o **código do erro** (ex: 500, 404) e:
- Contate seu **administrador**
- Forneça: código, o que estava tentando fazer, data/hora

---

## Contato

### Preciso de ajuda com:

| Problema | Contatar |
|----------|----------|
| Senha/login | Gestor ou Administrador |
| Dados incorretos | Gestor |
| Bug/erro técnico | Administrador |
| Novo cadastro de paciente | Gestor |
| Permissões | Administrador |

---

### Informações Úteis ao Contatar

Forneça:
- Seu nome
- Seu email
- Data e hora do problema
- O que tentou fazer
- O que deu errado
- Mensagem de erro (se houver)

---

*FAQ atualizado: 2026-04-29*
*Versão: Precisa (código confirmado)*