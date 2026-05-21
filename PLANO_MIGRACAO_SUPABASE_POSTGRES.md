# Plano de Migracao: Supabase para Postgres na VPS

## Objetivo

Migrar a aplicacao do banco atual no Supabase Free Tier para um PostgreSQL rodando em Docker na VPS, com o menor risco possivel, preservando dados, estrutura, autenticacao e operacao da aplicacao.

## Premissas

- O projeto usa Supabase como backend principal hoje.
- A VPS ja possui um container Docker com PostgreSQL em execucao.
- A migracao precisa prever backup, teste, cutover e rollback.
- Antes da virada final, a migracao deve ser validada em homologacao.

## Ponto Critico

Migrar "o banco" nem sempre significa migrar "o backend completo".

O Supabase pode estar sendo usado em mais de uma camada:

- Banco PostgreSQL
- Autenticacao (`auth`)
- Storage de arquivos
- Realtime
- Policies / RLS
- Functions / triggers
- Edge Functions / webhooks

Se a aplicacao usa mais do que apenas tabelas SQL, isso precisa ser tratado antes da virada.

## Estrategia Recomendada

Executar a migracao em fases:

1. Inventario tecnico completo do uso atual do Supabase
2. Backup completo antes de qualquer mudanca
3. Preparacao do Postgres na VPS
4. Restauracao e testes em ambiente de homologacao
5. Ajustes da aplicacao
6. Cutover controlado
7. Rollback pronto

## Fase 1: Inventario Tecnico

Levantar exatamente o que hoje depende do Supabase:

- Tabelas
- Views
- Indices
- Triggers
- Functions
- Policies de RLS
- Extensoes instaladas
- Uso de `auth.users`
- Uso de `storage`
- Uso de `realtime`
- Uso de Edge Functions
- Uso de cron, webhooks e secrets
- Pontos do codigo que usam `@supabase/supabase-js`

### Checklist

- Identificar versao do PostgreSQL no Supabase
- Mapear schema publico e schemas auxiliares
- Confirmar uso de autenticacao Supabase
- Confirmar uso de buckets / storage
- Confirmar uso de politicas RLS
- Confirmar se existem arquivos fora do banco
- Medir volume de dados
- Medir tamanho do banco

## Fase 2: Backup Completo

Antes de qualquer teste, gerar backups em mais de um local.

### Backups minimos

- Dump do schema
- Dump dos dados
- Dump completo do banco
- Export dos arquivos do storage, se existir
- Export / inventario dos usuarios de autenticacao, se existir

### Locais de armazenamento

- Maquina local
- VPS
- Armazenamento externo

### Regras

- Colocar data e hora no nome dos arquivos
- Gerar checksum
- Testar restauracao de pelo menos um backup

### Observacao importante

Backup nao testado nao deve ser considerado valido.

## Fase 3: Decisao de Arquitetura

Antes da migracao final, decidir qual dos dois caminhos sera seguido:

### Opcao A: Postgres puro

Usar apenas PostgreSQL na VPS e substituir recursos do Supabase por outras solucoes.

#### Vantagens

- Independencia da plataforma
- Menos lock-in

#### Riscos

- Mais trabalho com autenticacao
- Mais trabalho com storage
- Mais mudancas no codigo

### Opcao B: Self-hosted Supabase

Subir a stack do Supabase na VPS em vez de usar apenas um container de Postgres.

#### Vantagens

- Mais parecido com o ambiente atual
- Menos refatoracao se hoje o projeto usa `auth`, `storage` e RLS

#### Riscos

- Operacao mais complexa
- Mais containers e mais manutencao

### Recomendacao

Se o projeto usa fortemente `supabase.auth`, `storage` ou politicas RLS, considerar seriamente self-hosted Supabase.

Se o projeto usa basicamente CRUD SQL, a migracao para Postgres puro tende a ser mais simples.

## Fase 4: Preparacao da VPS

Preparar o banco destino antes de restaurar qualquer dado.

### Itens obrigatorios

- Volume persistente
- Usuario exclusivo da aplicacao
- Senha forte
- Firewall configurado
- Restricao de acesso por IP ou rede privada, se possivel
- Backup automatico do banco na VPS
- Retencao de backups
- Monitoramento basico

### Configuracoes a validar

- Versao do PostgreSQL
- Timezone
- Encoding
- Locale
- Extensoes necessarias
- Parametros de conexao
- Limites de memoria e disco

## Fase 5: Restauracao de Homologacao

Criar um ambiente de teste antes da producao.

### Objetivo

Validar se o schema, os dados e o comportamento da aplicacao continuam funcionando no novo banco.

### Passos

1. Restaurar schema
2. Restaurar dados
3. Recriar extensoes
4. Validar ownership e permissoes
5. Rodar a aplicacao apontando para esse banco
6. Executar testes funcionais

### Fluxos que precisam ser testados

- Login
- Sessao
- Agenda
- Pacientes
- Prontuarios
- Vendas
- Relatorios
- Uploads
- Permissoes
- Rotinas administrativas

## Fase 6: Ajustes da Aplicacao

Adaptar o projeto para o novo backend.

### Possiveis pontos de ajuste

- `DATABASE_URL`
- Variaveis de ambiente
- Client/server do Supabase
- Auth
- Storage
- Regras de permissao
- Funcoes SQL usadas pela aplicacao
- Seeds e scripts operacionais

### Se houver uso de Supabase Auth

Definir antes da virada:

- Migrar para outro provedor de auth
- Implementar auth propria
- Manter stack compativel com Supabase

### Se houver uso de Storage

Definir antes da virada:

- Migrar para S3 compativel
- Migrar para filesystem gerenciado
- Manter stack compativel com Supabase

## Fase 7: Validacao de Dados

Antes da virada final, comparar origem e destino.

### Validacoes minimas

- Contagem de registros por tabela
- Integridade de chaves estrangeiras
- Registros recentes
- Dados sensiveis
- Usuarios
- Arquivos
- Tabelas transacionais principais

### Tabelas criticas sugeridas

- `profiles`
- `pacientes`
- `atendimentos`
- `prontuarios`
- `vendas`
- tabelas de relacionamento e configuracao

## Fase 8: Cutover

Fazer a virada de producao em uma janela controlada.

### Preparacao

- Avisar janela de manutencao
- Congelar escritas no app
- Garantir que nao existam jobs rodando
- Gerar backup final do Supabase imediatamente antes da virada

### Execucao

1. Colocar aplicacao em modo manutencao ou leitura
2. Fazer backup final
3. Exportar delta final de dados
4. Importar no banco da VPS
5. Validar integridade
6. Trocar variaveis de ambiente
7. Subir a aplicacao
8. Rodar smoke test manual

### Smoke test minimo

- Login
- Abrir agenda
- Criar / editar paciente
- Criar / editar agendamento
- Criar / editar prontuario
- Criar / editar venda
- Gerar relatorio
- Fazer upload, se aplicavel

## Fase 9: Rollback

Rollback precisa estar definido antes da virada.

### O plano de rollback deve responder

- Como voltar a aplicacao para o Supabase
- Quais variaveis de ambiente restaurar
- Quanto tempo a janela de rollback permite
- Como lidar com dados escritos no novo ambiente, se houver
- Quem autoriza rollback

### Regra pratica

Se houver falha em autenticacao, integridade, escrita ou fluxo critico, rollback deve ser imediato.

## Riscos Principais

- Quebra de autenticacao
- Perda de policies / RLS
- Extensoes nao compativeis
- Divergencia de schema
- Falha em storage
- Dados inconsistentes por escrita durante a migracao
- Falta de rollback validado

## Ordem Recomendada de Execucao

1. Fazer backup completo do Supabase
2. Inventariar tudo que depende dele
3. Decidir entre Postgres puro ou self-hosted Supabase
4. Preparar ambiente de homologacao na VPS
5. Restaurar e testar
6. Ajustar a aplicacao
7. Rodar checklist funcional
8. Preparar rollback
9. Executar cutover
10. Monitorar pos-virada

## Entregaveis Esperados

Ao final do planejamento, devemos ter:

- Inventario do uso do Supabase
- Backup testado
- Banco destino preparado
- Estrategia definida para auth e storage
- Checklist de homologacao
- Roteiro de cutover
- Roteiro de rollback

## Proximo Passo Recomendado

Criar uma segunda etapa pratica com base no projeto atual:

- mapear no codigo onde o Supabase esta sendo usado
- identificar dependencia de `auth`, `storage` e RLS
- escolher a estrategia final de migracao
- montar scripts de backup e restauracao
- montar checklist tecnico da virada
