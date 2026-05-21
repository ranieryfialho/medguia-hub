# Passo a Passo: Homologacao do Backup Supabase no Postgres

Gerado em: 2026-05-21

## Objetivo

Criar um banco de homologacao na VPS, restaurar o backup do Supabase nele e validar se o banco sobe corretamente antes de qualquer tentativa de migracao real.

## Importante

Este procedimento valida o banco restaurado.

Ele nao valida sozinho o funcionamento completo da aplicacao atual, porque a app ainda depende de:

- Supabase Auth
- Sessao/cookies do Supabase
- Realtime do Supabase
- Chaves e URL do Supabase

Mesmo assim, este teste e obrigatorio porque reduz o risco da migracao.

## Arquivos de Backup

Pasta local:

- `/home/raniery/Documentos/RAFI DEV/medguia/medguia-hub/tmp/backup-supabase-2026-05-21`

Arquivos:

- `supabase-completo.dump`
- `supabase-schema.sql`
- `supabase-dados.sql`

## Fase 1: Entrar na VPS e localizar o container do Postgres

No host da VPS:

```bash
docker ps
```

Localize o container do Postgres e entre nele:

```bash
docker exec -it NOME_OU_ID_DO_CONTAINER_POSTGRES bash
```

Se o container nao tiver `bash`, use:

```bash
docker exec -it NOME_OU_ID_DO_CONTAINER_POSTGRES sh
```

Confirme a versao do cliente:

```bash
psql --version
```

## Fase 2: Entrar no psql

Dentro do container:

```bash
psql -U postgres
```

Se o seu ambiente usar outro usuario administrativo, ajuste o comando.

## Fase 3: Criar usuario e banco de homologacao

No prompt do `psql`, execute:

```sql
CREATE USER medhub_teste WITH PASSWORD 'SENHA_FORTE_AQUI';
CREATE DATABASE medhub_teste OWNER medhub_teste;
\l
```

Objetivo:

- criar um usuario isolado para homologacao
- criar um banco vazio para receber o restore
- confirmar na listagem que o banco foi criado

## Fase 4: Sair do psql

```sql
\q
```

## Fase 5: Copiar os backups para a VPS

Se os arquivos ainda estiverem apenas na maquina local, copie a pasta inteira para a VPS:

```bash
scp -r "/home/raniery/Documentos/RAFI DEV/medguia/medguia-hub/tmp/backup-supabase-2026-05-21" usuario@IP_DA_VPS:/tmp/
```

Depois confirme na VPS:

```bash
ls -lah /tmp/backup-supabase-2026-05-21
```

## Fase 6: Restaurar o schema

Primeiro restaure apenas a estrutura do banco:

```bash
psql -U postgres -d medhub_teste -f /tmp/backup-supabase-2026-05-21/supabase-schema.sql
```

### Observacoes

- o `schema.sql` nao cria o database
- ele cria schemas e extensoes dentro de um banco ja existente
- podem aparecer falhas se a VPS nao tiver extensoes compativeis com o backup do Supabase

### Se aparecer erro de arquivo nao encontrado

O container talvez nao enxergue `/tmp` do host. Nesse caso, copie os arquivos para dentro do container:

```bash
docker cp /tmp/backup-supabase-2026-05-21 NOME_OU_ID_DO_CONTAINER_POSTGRES:/tmp/
```

E rode de novo:

```bash
psql -U postgres -d medhub_teste -f /tmp/backup-supabase-2026-05-21/supabase-schema.sql
```

## Fase 7: Restaurar os dados

Somente depois de validar o schema:

```bash
psql -U postgres -d medhub_teste -f /tmp/backup-supabase-2026-05-21/supabase-dados.sql
```

### Observacoes

- se o schema falhou em tabelas, funcoes ou extensoes, os dados podem falhar em cascata
- por isso nao vale pular a checagem anterior

## Fase 8: Validacoes iniciais do banco restaurado

Entre no `psql` conectado ao banco:

```bash
psql -U postgres -d medhub_teste
```

### Conferir schemas

```sql
\dn
```

Esperado pelo menos:

- `public`
- `auth`
- `storage`
- `realtime`

### Conferir extensoes

```sql
\dx
```

Pelo dump auditado, ha referencia a extensoes como:

- `pg_cron`
- `pg_stat_statements`
- `pgcrypto`
- `supabase_vault`
- `uuid-ossp`

Nem todas necessariamente existirao em um Postgres comum da VPS.

### Conferir algumas tabelas centrais

```sql
SELECT COUNT(*) FROM public.profiles;
SELECT COUNT(*) FROM public.pacientes;
SELECT COUNT(*) FROM public.atendimentos;
SELECT COUNT(*) FROM public.vendas;
SELECT COUNT(*) FROM public.produtos;
SELECT COUNT(*) FROM public.agendamentos;
```

## Fase 9: Validar funcoes RPC mapeadas no projeto

O projeto usa as seguintes funcoes SQL:

- `fn_contar_contatos_kanban`
- `fn_contar_pacientes_disponiveis_contatos_base`
- `fn_contar_responsaveis_contatos_kanban`
- `fn_listar_contatos_kanban`
- `fn_materializar_pacientes_contatos_base`
- `fn_status_equipe_agora`
- `fn_ultimo_atendimento_por_pacientes`

Liste as funcoes:

```sql
\df
```

Se quiser procurar uma especifica:

```sql
\df *fn_status_equipe_agora*
```

## Fase 10: Interpretacao do resultado

### Caso A: schema e dados restauraram bem

Isso significa:

- o backup e restauravel
- a base do Supabase consegue ser carregada no Postgres da VPS com algum nivel de compatibilidade

Isso ainda nao significa:

- que a app atual vai funcionar sem Supabase

### Caso B: schema restaura com erros de extensao

Isso significa:

- a VPS nao esta com stack compativel o suficiente
- sera preciso adaptar o ambiente ou rever a estrategia

### Caso C: dados falham por objetos ausentes

Isso normalmente significa:

- parte do schema nao foi criada
- a ordem schema -> dados precisa ser corrigida
- alguma extensao, funcao ou tabela falhou antes

## Fase 11: O que fazer depois

Se o restore der certo, existem dois caminhos:

### Opcao 1: Homologacao com Supabase self-hosted

Mais fiel ao ambiente atual da app.

Indicado porque o projeto usa:

- auth do Supabase
- middleware de sessao do Supabase
- realtime
- service role

### Opcao 2: Refatoracao para Postgres puro

Mais trabalho, mas elimina dependencia do Supabase.

Exige substituir:

- autenticacao
- sessao
- chamadas client/server do Supabase
- realtime

## Checklist Rapido

- [ ] Container Postgres localizado na VPS
- [ ] Versao do `psql` conferida
- [ ] Usuario `medhub_teste` criado
- [ ] Banco `medhub_teste` criado
- [ ] Backups copiados para a VPS
- [ ] Schema restaurado
- [ ] Dados restaurados
- [ ] Schemas validados
- [ ] Extensoes validadas
- [ ] Tabelas centrais conferidas
- [ ] RPCs conferidas

## Observacao Sobre o Arquivo `.dump`

O arquivo `supabase-completo.dump` e formato custom do PostgreSQL.

Na maquina local atual, o `pg_restore` disponivel e 16.13 e nao conseguiu ler o dump gerado em formato `v1.16` do PostgreSQL 17.

Por isso, para usar `supabase-completo.dump`, o ideal e usar `pg_restore` 17 no destino.

Se isso nao estiver disponivel, prefira restaurar com:

- `supabase-schema.sql`
- `supabase-dados.sql`

## Resultado Esperado Deste Procedimento

Ao final, voce deve ter:

- um banco `medhub_teste` restaurado na VPS
- clareza sobre erros de compatibilidade
- base concreta para decidir entre `Supabase self-hosted` ou migracao para `Postgres puro`
