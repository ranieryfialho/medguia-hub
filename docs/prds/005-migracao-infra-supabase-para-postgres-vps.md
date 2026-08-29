# PRD: Migração de Infraestrutura — Supabase para PostgreSQL Nativo na VPS

Atualmente, o **MedGuia Hub** utiliza uma infraestrutura baseada no ecossistema Supabase hospedado na VPS, acoplando a aplicação a serviços auxiliares (GoTrue/Auth, PostgREST/Kong, Realtime, Studio e SDKs proprietários `@supabase/supabase-js` e `@supabase/ssr`). Como a mesma VPS já possui uma instância dedicada e robusta de **PostgreSQL** em operação contínua, a manutenção de uma stack inteira do Supabase em paralelo gera sobrecarga desnecessária de memória RAM e CPU, complexidade operacional de manutenção/backups e dependência de APIs intermediárias HTTP. O objetivo deste PRD é guiar a migração completa da base de dados e do backend da aplicação para o PostgreSQL nativo da VPS, eliminando o ecossistema Supabase sem perda de dados, garantindo compatibilidade de autenticação e mantendo a integridade transacional de todos os módulos clínicos e administrativos.

---

## Problema (O Porquê)

A migração precisa ser realizada porque:

1. **Sobrecarga de Recursos na VPS:**  
   A stack do Supabase self-hosted mantém múltiplos contêineres em execução contínua (Kong API Gateway, PostgREST, GoTrue Auth, Realtime Server, Supabase Studio, Meta e PostgreSQL containerizado), consumindo volume expressivo de memória RAM e processamento que poderiam ser economizados ou reaproveitados para a própria aplicação.
2. **Duplicidade de Bancos de Dados na Mesma Máquina:**  
   A VPS já hospeda e gerencia uma instância de PostgreSQL nativa ativa. Manter dois ecossistemas de banco de dados na mesma infraestrutura encarece a manutenção, dificulta o monitoramento unificado e fragmenta rotinas de backup e segurança.
3. **Acoplamento Arquitetural com SDK Supabase:**  
   O código-fonte da aplicação possui dependência de `@supabase/supabase-js` e `@supabase/ssr` em mais de 65 arquivos (Server Actions, páginas, componentes e middlewares). As requisições de leitura e escrita passam pela camada intermediária do PostgREST/HTTP em vez de utilizarem um pool direto e performático de conexões PostgreSQL nativas.
4. **Dependência de Autenticação Externa (GoTrue):**  
   A gestão de sessões, senhas, tokens JWT e criação administrativa de usuários depende do serviço GoTrue (`auth.users`, `supabase.auth.*`), criando barreiras para uma camada de autenticação nativa, independente e mais simples integrada ao Next.js.
5. **Complexidade de Manutenção e Atualizações:**  
   Manter a stack do Supabase atualizada na VPS exige orquestração de múltiplos contêineres Docker, enquanto o PostgreSQL nativo já conta com ciclo de vida estabelecido, rotinas de dump/restore padronizadas e monitoramento consolidado.

---

## Usuários (Para Quem)

- **DevOps / Administrador de Infraestrutura / Tech Lead:**  
  *"Quero consolidar nossos bancos de dados em uma única instância PostgreSQL nativa na VPS, reduzindo o consumo de memória/CPU ao desligar contêineres auxiliares do Supabase e padronizando as rotinas de backup (`pg_dump`), retenção e monitoramento."*

- **Desenvolvedor Full Stack (Engenharia de Software):**  
  *"Quero que a aplicação se conecte diretamente ao PostgreSQL via pool de conexões nativo (`DATABASE_URL`), com camada de autenticação desacoplada (sessões seguras via cookies HTTP-only no Next.js) e execução direta de queries e RPCs SQL, eliminando dependências dos pacotes `@supabase/*`."*

- **Gestor Clínico / Equipe de Atendimento (Recepção e Fisioterapeutas):**  
  *"Quero que o sistema continue funcionando perfeitamente (agendamentos, pacientes, prontuários, vendas e relatórios) com maior velocidade de resposta, sem interrupções não planejadas e sem perder nenhum dado ou senha de acesso durante a migração."*

---

## Requisitos (O Quê)

---

### 1. Infraestrutura e Preparação do Banco de Dados PostgreSQL na VPS

#### 1.1. Provisionamento de Bancos e Usuários Dedicados
- Criar banco de dados de homologação (`medhub_teste`) e de produção (`medhub_prod` ou nome padronizado) na instância PostgreSQL existente da VPS.
- Criar usuário dedicado com permissões restritas e senha forte (`medhub_user`), garantindo que a aplicação não utilize o superusuário `postgres` em tempo de execução.
- Assegurar a habilitação das extensões PostgreSQL requeridas pelo schema do MedGuia Hub (ex.: `uuid-ossp`, `pgcrypto`, `pg_stat_statements`).

#### 1.2. Extração, Tratamento de Schema e Restauração de Dados
- Exportar schema (`supabase-schema.sql`) e dados (`supabase-dados.sql`) da base de origem do Supabase.
- Sanitizar schemas e dependências específicas do Supabase (como schemas internos `graphql`, `realtime`, `supabase_functions` ou `vault` que não sejam utilizados pela lógica de negócio).
- Migrar integralmente todas as tabelas de negócio do schema `public` (`atendimentos`, `profiles`, `pacientes`, `vendas`, `produtos`, `agendamentos`, `prontuarios`, `contatos_base`, `disponibilidade_profissional`, etc.) preservando chaves primárias (UUIDs), chaves estrangeiras, constraints, índices e valores padrão.
- Preservar e restaurar todas as funções SQL / RPCs ativas do projeto:
  - `fn_contar_contatos_kanban`
  - `fn_contar_pacientes_disponiveis_contatos_base`
  - `fn_contar_responsaveis_contatos_kanban`
  - `fn_listar_contatos_kanban`
  - `fn_materializar_pacientes_contatos_base`
  - `fn_status_equipe_agora`
  - `fn_ultimo_atendimento_por_pacientes`

#### 1.3. Pool de Conexões e Rotinas de Backup
- Configurar pool de conexões otimizado na aplicação via driver nativo (ex.: `postgres.js` ou `pg` pool) com limites de conexões simultâneas adequados à capacidade da VPS.
- Implementar script automatizado de backup diário na VPS (`pg_dump` compactado com compressão gzip/custom, rotação de 30 dias e logs de sucesso/falha).

---

### 2. Desacoplamento e Migração da Autenticação e Sessão (Auth)

#### 2.1. Migração de Usuários e Senhas de `auth.users`
- Estruturar tabela local de usuários/perfis (`usuarios` ou consolidação na tabela `profiles`), contendo:
  - `id` (UUID correspondente ao ID original para não quebrar relacionamentos existentes)
  - `email` (único, normalizado em minúsculo)
  - `senha_hash` (armazenamento de hash compatível com bcrypt/argon2)
  - `role` / `perfil` (`gestor`, `recepcao`, `fisioterapeuta`, etc.)
  - `ativo` (boolean)
  - `criado_em`, `atualizado_em` e `ultimo_login`
- Migrar os usuários ativos existentes de `auth.users` do Supabase para a tabela de usuários nativa, preservando os hashes de senha existentes para que nenhum usuário precise redefinir sua senha após a migração.

#### 2.2. Camada de Autenticação Própria e Gestão de Sessões no Next.js
- Implementar fluxo de autenticação nativo (Server Actions em `src/actions/auth.ts`):
  - `login(email, senha)`: verificação de hash via biblioteca criptográfica segura (`bcryptjs` / `argon2`) e emissão de cookie de sessão assinado e criptografado.
  - `logout()`: revogação/invalidação e limpeza do cookie de sessão.
  - `redefinirSenha()` / `alterarSenha()`: fluxo nativo de atualização de hash de senha.
- Configurar cookies de sessão com atributos de segurança rigorosos: `HttpOnly`, `Secure`, `SameSite=Lax` e tempo de expiração configurável (ex.: 7 dias com renovação deslizante).

#### 2.3. Middleware de Sessão e Guardas de Rota
- Refatorar o middleware (`src/lib/supabase/middleware.ts` -> `src/middleware.ts` ou `src/lib/auth/middleware.ts`) e `src/lib/guard.ts`:
  - Decodificar e validar o token de sessão localmente de forma síncrona/rápida, sem realizar chamadas de rede externas ou chamadas ao Supabase Auth.
  - Bloquear rotas protegidas (`/dashboard`, `/agenda`, `/pacientes`, `/vendas`, etc.) para usuários não autenticados e redirecionar para `/login`.

#### 2.4. Gestão Administrativa de Usuários (`auth.admin`)
- Substituir o uso de `supabase.auth.admin.createUser` / `deleteUser` em `src/actions/acessos.ts` e `src/actions/equipe.ts`:
  - Criar e inativar contas de colaboradores da equipe diretamente via transações SQL no PostgreSQL, com geração de hash seguro e registro de auditoria.

---

### 3. Substituição da Camada de Acesso a Dados (Data Layer)

#### 3.1. Cliente de Banco de Dados Nativo
- Criar módulo central de conexão (ex.: `src/lib/db.ts`) utilizando conexão direta via `DATABASE_URL` (ex.: `postgresql://medhub_user:senha@localhost:5432/medhub_prod`).
- Garantir suporte a transações (`BEGIN`, `COMMIT`, `ROLLBACK`) para operações críticas (ex.: exclusão com log de auditoria, lançamento de vendas com itens e baixa de estoque).

#### 3.2. Refatoração de Server Actions e Rotas de API
- Substituir as chamadas de API do cliente Supabase (`supabase.from('...').select/insert/update/delete`) nas Server Actions (`src/actions/*.ts`) e rotas de API (`src/app/api/*`) por consultas SQL parametrizadas tipadas ou query builder enxuto.
- Substituir chamadas `.rpc('nome_da_funcao', params)` por queries diretas `SELECT * FROM nome_da_funcao($1, $2, ...)`.
- Remover pacotes `@supabase/supabase-js` e `@supabase/ssr` das dependências do `package.json` ao término da refatoração.

#### 3.3. Adaptação de Funcionalidades que Usavam Realtime
- Avaliar os 2 pontos de uso de Realtime identificados na auditoria (`KanbanContatos.tsx` e `useRealtimeDisponibilidade.ts`):
  - Substituir o Realtime do Supabase por estratégia leve e desacoplada: **Polling inteligente com revalidação automática via SWR / React Query** ou **Server-Sent Events (SSE)** nativo via rota de API Next.js.
  - Eliminar canais de WebSocket do Supabase no cliente React (`createBrowserClient`, `.channel(...)`, `.removeChannel(...)`).

---

### 4. Plano de Homologação, Cutover (Virada) e Rollback

#### 4.1. Ambiente de Homologação / Staging
- Restaurar a base integral em `medhub_teste` na VPS.
- Executar testes funcionais cobrindo 100% dos módulos do sistema:
  - Autenticação e controle de níveis de acesso (Admin, Gestor, Fisioterapeuta, Recepção).
  - Agenda: criação, edição, movimentação e exclusão de agendamentos com auditoria.
  - Pacientes e Prontuários: visualização de fichas, históricos e relatórios.
  - Vendas e Financeiro: lançamentos de vendas, orçamentos, relatórios analíticos e históricos.
  - Contatos / CRM: Kanban de contatos, filtros e execução das RPCs.

#### 4.2. Procedimento de Cutover (Virada em Produção)
1. **Janela de Manutenção Programada:** Agendar janela fora do horário de atendimento clínico (ex.: domingo ou período noturno).
2. **Pausa / Modo Manutenção:** Ativar página de manutenção temporária no Nginx/Reverse Proxy.
3. **Dump Final do Supabase:** Executar `pg_dump` final consistente da base de produção do Supabase.
4. **Carga no PostgreSQL Nativo:** Restaurar o dump final no banco oficial `medhub_prod`.
5. **Validação de Integridade (Smoke Test):** Executar script de validação de contagem de linhas e checagem cruzada de tabelas centrais.
6. **Atualização de Variáveis de Ambiente:** Configurar `DATABASE_URL` e `AUTH_SECRET` na aplicação, removendo as variáveis `NEXT_PUBLIC_SUPABASE_*` e `SUPABASE_SERVICE_ROLE_KEY`.
7. **Deploy e Desligamento do Supabase:** Subir a nova versão da aplicação apontando para o PostgreSQL nativo e, após validação, parar e desativar os contêineres Docker do Supabase na VPS.

#### 4.3. Plano de Rollback Imediato
- Se for detectada inconsistência crítica durante a janela de manutenção:
  - Manter o banco Supabase original intacto como backup até a homologação final do cutover.
  - Reverter as variáveis de ambiente da aplicação para o Supabase.
  - Fazer o redeploy da versão estável anterior em menos de **10 minutos**.

---

## NUNCA PODE:

- **Perder ou corromper qualquer dado histórico:** pacientes, prontuários, agendamentos, logs de auditoria, vendas e transações financeiras devem ser 100% preservados.
- **Invalidar senhas de usuários existentes:** as credenciais migradas devem manter compatibilidade de hash sem forçar redefinição em massa de senhas pela equipe.
- **Deixar o banco PostgreSQL exposto à internet pública:** a porta 5432 deve aceitar conexões apenas locais (`localhost` / `127.0.0.1`) ou via rede interna protegida por firewall (UFW/Docker network).
- **Executar a virada em produção sem homologação prévia:** a virada de chave só pode ocorrer após homologação total com sucesso no banco `medhub_teste`.
- **Realizar a migração sem backup imediatamente anterior:** é obrigatório ter o dump completo gerado segundos antes de bloquear escritas na base antiga.
- **Manter chamadas ou dependências ocultas do Supabase ativas:** após o deploy final, nenhuma requisição HTTP para o Kong/PostgREST/GoTrue deve ser emitida pela aplicação.

---

## Métricas

- **100% de Integridade dos Dados:** Divergência de registros igual a **0** na conferência de contagem de linhas entre o Supabase de origem e o PostgreSQL de destino.
- **Zero Senhas Quebradas:** **100%** dos usuários ativos conseguindo efetuar login normalmente com suas senhas habituais no primeiro acesso.
- **Janela de Manutenção (Downtime Total):** Menor que **30 minutos** durante a virada em produção (meta de execução automatizada em menos de **15 minutos**).
- **Economia de Recursos na VPS:** Redução de pelo menos **40% a 60%** no consumo total de memória RAM e processos ociosos de banco/auth na VPS ao desligar a stack de contêineres do Supabase.
- **Tempo de Resposta (Latência de Queries):** Redução do tempo médio de resposta de Server Actions e APIs em virtude da eliminação do intermediário HTTP (PostgREST).
- **Zero Dependências do Supabase:** Remoção completa dos pacotes `@supabase/supabase-js` e `@supabase/ssr` do repositório.

---

## Fora do Escopo (V1)

- Migração para cluster multi-region ou réplicas de leitura (Read Replicas) — a V1 consolida no PostgreSQL primário da VPS.
- Alteração ou refatoração das regras de negócio e estrutura relacional das tabelas clínicas (o modelo de dados permanece idêntico, mudando apenas a infraestrutura e a camada de acesso).
- Criação de um servidor de WebSockets genérico para substituir Realtime — funcionalidades em tempo real serão atendidas via polling otimizado ou SSE.
- Migração de provedor de hospedagem / troca da VPS atual (todo o processo ocorre dentro da mesma VPS já contratada).
