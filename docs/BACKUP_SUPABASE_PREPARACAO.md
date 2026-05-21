# Preparacao de Backup do Supabase

Gerado em: 2026-05-21T13:06:02.508Z

## Estado Atual

- Pasta sugerida para backup: `tmp/backup-supabase-2026-05-21`
- Variavel de banco detectada: nenhuma
- Minimo para dump SQL pronto: nao

## Variaveis Obrigatorias

- `NEXT_PUBLIC_SUPABASE_URL`: ausente
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: ausente
- `SUPABASE_SERVICE_ROLE_KEY`: ausente

## Variavel de Banco

- `SUPABASE_DB_URL`: ausente
- `SUPABASE_DB_DIRECT_URL`: ausente
- `SUPABASE_DATABASE_URL`: ausente

## Variaveis Opcionais

- `SUPABASE_PROJECT_REF`: ausente
- `SUPABASE_ACCESS_TOKEN`: ausente

## Comandos Sugeridos

### Criar dump completo

```bash
Defina SUPABASE_DB_URL ou SUPABASE_DB_DIRECT_URL para gerar o comando de pg_dump.
```

### Criar dump apenas de schema

```bash
Defina SUPABASE_DB_URL ou SUPABASE_DB_DIRECT_URL para gerar o comando de schema.
```

### Criar dump apenas de dados

```bash
Defina SUPABASE_DB_URL ou SUPABASE_DB_DIRECT_URL para gerar o comando de dados.
```

### Gerar checksum local

```bash
sha256sum "tmp/backup-supabase-2026-05-21/*"
```

## Checklist Operacional

- Confirmar se a URL de banco apontada e a conexao direta do projeto Supabase.
- Gerar dump completo antes de qualquer teste de migracao.
- Gerar dump de schema e de dados separadamente.
- Exportar arquivos de storage apenas se o projeto usar storage.
- Salvar os backups em mais de um local.
- Testar restauracao em ambiente isolado.

## Observacao

- Este script nao executa o backup. Ele prepara a pasta, valida variaveis e gera os comandos recomendados.
