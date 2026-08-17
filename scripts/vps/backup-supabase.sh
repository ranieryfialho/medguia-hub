#!/usr/bin/env bash
#
# Backup do Supabase self-hosted (VPS) — banco, storage e config.
# Roda via cron, uma vez por dia. Mantém 7 diários + 4 semanais em disco,
# sincroniza tudo pro Google Drive via rclone e avisa por WhatsApp (Evolution API)
# se algo falhar.
#
# Instalar em: /root/backups/supabase/backup-supabase.sh (na VPS)
# Ver docs/BACKUP_SUPABASE.md para o passo a passo de setup.

set -uo pipefail

# ── Configuração ────────────────────────────────────────────────────────────
SUPABASE_DIR="${SUPABASE_DIR:-$HOME/supabase/docker}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"

BACKUP_ROOT="${BACKUP_ROOT:-$HOME/backups/supabase}"
DAILY_DIR="$BACKUP_ROOT/daily"
WEEKLY_DIR="$BACKUP_ROOT/weekly"
LOG_FILE="$BACKUP_ROOT/backup.log"

RETENTION_DAILY_DAYS="${RETENTION_DAILY_DAYS:-7}"
RETENTION_WEEKLY_COUNT="${RETENTION_WEEKLY_COUNT:-4}"

# Remote do rclone (configurado com `rclone config`, ver guia). Ex: "gdrive:medguia-backups"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:MedHub}"

# Evolution API (alerta via WhatsApp)
EVOLUTION_URL="${EVOLUTION_URL:-https://evolution.medguia.cloud}"
EVOLUTION_APIKEY="${EVOLUTION_APIKEY:-MedGuia@2026}"
EVOLUTION_INSTANCE="${EVOLUTION_INSTANCE:-}"   # preencher após criar a instância
EVOLUTION_NUMBER="${EVOLUTION_NUMBER:-5585999985587}"

# ── Preparação ───────────────────────────────────────────────────────────────
TODAY="$(date +%F)"                 # 2026-08-17
WEEKDAY="$(date +%u)"                # 1=segunda ... 7=domingo
WORKDIR="$DAILY_DIR/$TODAY"
mkdir -p "$WORKDIR" "$WEEKLY_DIR"
touch "$LOG_FILE"

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"
}

notify_failure() {
  local reason="$1"
  local tail_log
  tail_log="$(tail -n 20 "$LOG_FILE" | sed 's/"/\\"/g')"

  if [ -z "$EVOLUTION_INSTANCE" ]; then
    log "AVISO: EVOLUTION_INSTANCE não configurado, não foi possível enviar alerta de falha."
    return
  fi

  curl -s -X POST "$EVOLUTION_URL/message/sendText/$EVOLUTION_INSTANCE" \
    -H "Content-Type: application/json" \
    -H "apikey: $EVOLUTION_APIKEY" \
    -d "{\"number\": \"$EVOLUTION_NUMBER\", \"text\": \"🔴 Backup do Supabase FALHOU em $TODAY\\nMotivo: $reason\\n\\nÚltimas linhas do log:\\n$tail_log\"}" \
    >> "$LOG_FILE" 2>&1
}

fail() {
  log "ERRO: $*"
  notify_failure "$*"
  exit 1
}

notify_success() {
  local summary="$1"

  if [ -z "$EVOLUTION_INSTANCE" ]; then
    return
  fi

  curl -s -X POST "$EVOLUTION_URL/message/sendText/$EVOLUTION_INSTANCE" \
    -H "Content-Type: application/json" \
    -H "apikey: $EVOLUTION_APIKEY" \
    -d "{\"number\": \"$EVOLUTION_NUMBER\", \"text\": \"✅ Backup do Supabase OK em $TODAY\\n\\n$summary\"}" \
    >> "$LOG_FILE" 2>&1
}

# ── 1. Dump do banco (schema + dados + roles) ───────────────────────────────
log "Iniciando dump do banco ($DB_NAME)..."

docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --format=custom --no-owner \
  -f "/tmp/supabase-db-$TODAY.dump" \
  || fail "pg_dump falhou"

docker exec "$DB_CONTAINER" pg_dumpall -U "$DB_USER" --globals-only \
  > "$WORKDIR/supabase-roles-$TODAY.sql" \
  || fail "pg_dumpall (roles) falhou"

docker cp "$DB_CONTAINER:/tmp/supabase-db-$TODAY.dump" "$WORKDIR/supabase-db-$TODAY.dump" \
  || fail "docker cp do dump falhou"
docker exec "$DB_CONTAINER" rm -f "/tmp/supabase-db-$TODAY.dump"

if [ ! -s "$WORKDIR/supabase-db-$TODAY.dump" ]; then
  fail "dump do banco ficou vazio (0 bytes)"
fi

log "Dump do banco OK ($(du -h "$WORKDIR/supabase-db-$TODAY.dump" | cut -f1))"

# ── 2. Storage (arquivos enviados) ──────────────────────────────────────────
log "Compactando volume de storage..."

if [ -d "$SUPABASE_DIR/volumes/storage" ]; then
  tar -czf "$WORKDIR/supabase-storage-$TODAY.tar.gz" \
    -C "$SUPABASE_DIR/volumes" storage \
    || fail "tar do storage falhou"
  log "Storage OK ($(du -h "$WORKDIR/supabase-storage-$TODAY.tar.gz" | cut -f1))"
else
  log "AVISO: pasta de storage não encontrada em $SUPABASE_DIR/volumes/storage — pulando."
fi

# ── 3. Config (docker-compose, .env, kong, etc — sem os dados do banco) ────
log "Compactando configuração..."

tar -czf "$WORKDIR/supabase-config-$TODAY.tar.gz" \
  -C "$SUPABASE_DIR" \
  --exclude='volumes/db/data' \
  --exclude='volumes/storage' \
  docker-compose.yml .env volumes \
  2>>"$LOG_FILE" \
  || fail "tar da configuração falhou"

log "Configuração OK ($(du -h "$WORKDIR/supabase-config-$TODAY.tar.gz" | cut -f1))"

# ── 4. Checksum ──────────────────────────────────────────────────────────────
( cd "$WORKDIR" && sha256sum -- * > checksums.sha256 ) || fail "checksum falhou"

# ── 5. Cópia semanal (domingo) ──────────────────────────────────────────────
if [ "$WEEKDAY" = "7" ]; then
  log "Hoje é domingo, guardando cópia semanal..."
  cp -r "$WORKDIR" "$WEEKLY_DIR/$TODAY"
  ls -1dt "$WEEKLY_DIR"/*/ 2>/dev/null | tail -n +$((RETENTION_WEEKLY_COUNT + 1)) | xargs -r rm -rf
fi

# ── 6. Poda de diários antigos ───────────────────────────────────────────────
find "$DAILY_DIR" -maxdepth 1 -mindepth 1 -type d -mtime "+$RETENTION_DAILY_DAYS" -exec rm -rf {} \;

# ── 7. Sincronizar com Google Drive ─────────────────────────────────────────
if command -v rclone >/dev/null 2>&1; then
  log "Sincronizando com $RCLONE_REMOTE..."
  rclone sync "$BACKUP_ROOT" "$RCLONE_REMOTE" \
    --exclude "backup.log" \
    >> "$LOG_FILE" 2>&1 \
    || fail "rclone sync falhou"
  log "Sincronização com Google Drive OK."
else
  fail "rclone não instalado — backup ficou só local"
fi

DB_SIZE="$(du -h "$WORKDIR/supabase-db-$TODAY.dump" | cut -f1)"
STORAGE_SIZE="$(du -sh "$WORKDIR/supabase-storage-$TODAY.tar.gz" 2>/dev/null | cut -f1 || echo "-")"
CONFIG_SIZE="$(du -h "$WORKDIR/supabase-config-$TODAY.tar.gz" | cut -f1)"

log "Backup de $TODAY concluído com sucesso."
notify_success "Banco: $DB_SIZE\nStorage: $STORAGE_SIZE\nConfig: $CONFIG_SIZE\nDestino: $RCLONE_REMOTE"
