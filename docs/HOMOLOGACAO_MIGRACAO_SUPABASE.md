# Homologacao da Migracao Supabase

Gerado em: 2026-05-21

## Decisao

Vamos usar o backup do Supabase para montar um ambiente de homologacao antes de qualquer mudanca em producao.

## Restricao Importante

A aplicacao atual nao usa Postgres puro diretamente. Ela depende de:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase Auth
- Sessao via middleware do Supabase
- Realtime do Supabase
- RPCs SQL acessadas pelo client Supabase

Por isso:

- restaurar o backup em `medhub_teste` valida o banco
- subir a app apontando apenas para esse Postgres nao reproduz o ambiente real atual
- para testar a app inteira, o caminho mais proximo do ambiente atual e um Supabase self-hosted de homologacao

## O Que Vale Testar Ja

Mesmo sem self-hosted Supabase, ainda vale criar `medhub_teste` agora para validar:

- restauracao do schema
- restauracao dos dados
- compatibilidade de extensoes
- existencia dos schemas esperados
- integridade basica das tabelas mais importantes
- compatibilidade da versao do Postgres

## Estrategia Recomendada

Separar a homologacao em duas frentes:

### Frente 1: Banco

Objetivo: provar que o backup restaura no servidor de destino.

Passos:

1. Criar role dedicada da homologacao
2. Criar banco `medhub_teste`
3. Restaurar schema e dados
4. Validar extensoes e schemas
5. Executar consultas de smoke test

### Frente 2: Aplicacao

Objetivo: provar que a app funciona fora do Supabase hospedado.

Opcoes:

1. Subir Supabase self-hosted de homologacao e apontar uma copia da app para ele
2. Refatorar a app para Postgres/Auth proprios antes do teste fim a fim

Hoje, a opcao 1 e a mais segura para homologacao funcional.

## Banco de Homologacao

Exemplo de criacao:

```sql
CREATE USER medhub_teste WITH PASSWORD 'trocar-esta-senha';
CREATE DATABASE medhub_teste OWNER medhub_teste;
```

## Restauracao

Observacoes:

- o dump foi gerado em PostgreSQL 17
- usar `pg_restore` 17 para `supabase-completo.dump`
- o `schema.sql` cria schemas e extensoes, mas nao cria o database

Fluxo mais seguro:

1. Criar o banco vazio
2. Restaurar primeiro o schema
3. Restaurar depois os dados
4. Corrigir falhas de extensao, ownership ou permissao

## Smoke Test Minimo do Banco

Depois da restauracao, validar pelo menos:

- existencia dos schemas `public`, `auth`, `storage`, `realtime`
- existencia das extensoes referenciadas no dump
- contagem de linhas em tabelas centrais
- execucao das RPCs mapeadas pela auditoria

Tabelas centrais:

- `profiles`
- `pacientes`
- `atendimentos`
- `vendas`
- `produtos`
- `agendamentos`

RPCs encontradas no projeto:

- `fn_contar_contatos_kanban`
- `fn_contar_pacientes_disponiveis_contatos_base`
- `fn_contar_responsaveis_contatos_kanban`
- `fn_listar_contatos_kanban`
- `fn_materializar_pacientes_contatos_base`
- `fn_status_equipe_agora`
- `fn_ultimo_atendimento_por_pacientes`

## Critico Para a App

Nao adianta criar um segundo container da app com outro banco se ele continuar dependendo de:

- endpoint HTTP do Supabase
- JWTs assinados pelo Supabase
- cookies/sessao do Supabase
- chamadas `supabase.auth.*`

Esse segundo container so passa a fazer sentido quando existir um backend compativel com Supabase na homologacao.

## Proximo Passo Recomendado

Executar nesta ordem:

1. Criar `medhub_teste` e validar o restore
2. Levantar a decisao entre `Supabase self-hosted` e `refatoracao para Postgres puro`
3. So depois subir o segundo container da app para teste funcional

## Decisao Pratica

Se a meta for testar a restauracao do banco agora: seguir com `medhub_teste`.

Se a meta for testar a aplicacao inteira antes da migracao de producao: preparar um ambiente de homologacao com stack compativel com Supabase.
