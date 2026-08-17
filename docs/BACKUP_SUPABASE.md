# Rotina de Backup do Supabase (self-hosted na VPS)

Cobre: banco de dados completo (dump + roles), storage (arquivos enviados) e
configuração (`docker-compose.yml`, `.env`, `volumes/api/kong.yml` etc — sem os
dados do banco). Guarda 7 backups diários + 4 semanais no disco da VPS e
sincroniza tudo com o Google Drive via `rclone`. Se algo falhar, manda um aviso
por WhatsApp usando a Evolution API que já roda na VPS.

Script: [scripts/vps/backup-supabase.sh](../scripts/vps/backup-supabase.sh)

## 1. Copiar o script para a VPS

```bash
mkdir -p ~/backups/supabase
# copie o conteúdo de scripts/vps/backup-supabase.sh para:
nano ~/backups/supabase/backup-supabase.sh
chmod +x ~/backups/supabase/backup-supabase.sh
```

## 2. Instalar o rclone

```bash
curl https://rclone.org/install.sh | sudo bash
```

## 3. Configurar o remote do Google Drive

```bash
rclone config
```

Siga o assistente:
- `n` (new remote) → nome: `gdrive`
- Storage: escolha o número correspondente a `Google Drive`
- Client ID / Secret: deixe em branco (usa o padrão do rclone)
- Scope: `1` (acesso completo)
- Root folder ID: deixe em branco
- Edit advanced config: `n`
- **Use auto config**: se a VPS não tem navegador (é o caso), responda `n`.
  O rclone vai te dar um comando `rclone authorize "drive" ...` — rode esse
  comando **na sua máquina local** (que tem navegador), autorize a conta
  Google, copie o token gerado e cole de volta no prompt da VPS.
- Confirme e salve.

Teste:

```bash
rclone lsd gdrive:
```

Se não existir a pasta `MedHub` no Drive, o próprio `rclone sync`
cria automaticamente no primeiro backup.

## 4. Criar a instância da Evolution API para os alertas

A Evolution já roda na VPS (`https://evolution.medguia.cloud`), mas ainda não
tem nenhuma instância conectada. Criar uma dedicada para alertas:

```bash
curl -X POST https://evolution.medguia.cloud/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: MedGuia@2026" \
  -d '{
    "instanceName": "alertas-medguia",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

Depois, pegue o QR code para conectar o WhatsApp (o número que vai *enviar*
os alertas — pode ser o seu próprio número ou um número dedicado):

```bash
curl -X GET https://evolution.medguia.cloud/instance/connect/alertas-medguia \
  -H "apikey: MedGuia@2026"
```

A resposta traz um campo `base64` com o QR code — abra num visualizador de
imagem (ou cole o base64 num decodificador online) e escaneie com o WhatsApp
que vai mandar as mensagens de alerta. Depois de conectado, confirme:

```bash
curl -X GET https://evolution.medguia.cloud/instance/fetchInstances \
  -H "apikey: MedGuia@2026"
```

Procure `"connectionStatus": "open"` para a instância `alertas-medguia`.

## 5. Ajustar as variáveis no script

Edite `~/backups/supabase/backup-supabase.sh` e confirme/ajuste no topo:

```bash
RCLONE_REMOTE="gdrive:MedHub"
EVOLUTION_INSTANCE="alertas-medguia"
EVOLUTION_NUMBER="5585999985587"   # número que RECEBE o alerta
```

## 6. Testar manualmente antes de agendar

```bash
~/backups/supabase/backup-supabase.sh
```

Verifique:
- `~/backups/supabase/daily/<data>/` tem os 3 arquivos (`.dump`, `storage.tar.gz`, `config.tar.gz`) + `checksums.sha256`
- `rclone lsf gdrive:MedHub` mostra os mesmos arquivos
- `~/backups/supabase/backup.log` sem erros

Teste o alerta de falha forçando um erro (ex: renomeie temporariamente o
container `supabase-db` no comando ou pare o container) e confirme que a
mensagem chega no WhatsApp.

## 7. Agendar no cron

```bash
crontab -e
```

Adicione (roda todo dia às 3h da manhã):

```cron
0 3 * * * /root/backups/supabase/backup-supabase.sh >> /root/backups/supabase/cron.log 2>&1
```

## Restaurar um backup

```bash
# copiar o dump pro container
docker cp supabase-db-2026-08-17.dump supabase-db:/tmp/restore.dump

# restaurar (banco precisa estar vazio/limpo — ver checklist de migração)
docker exec supabase-db pg_restore -U postgres -d postgres --no-owner /tmp/restore.dump

# roles (se for um restore completo, ex: disaster recovery em VPS nova)
cat supabase-roles-2026-08-17.sql | docker exec -i supabase-db psql -U postgres

# storage
tar -xzf supabase-storage-2026-08-17.tar.gz -C ~/supabase/docker/volumes/
```

## Notas

- O script usa `set -uo pipefail` (sem `-e`): cada etapa crítica chama `fail`
  explicitamente, o que garante que o log e o alerta de WhatsApp sempre
  disparem antes de encerrar, mesmo em erros inesperados.
- A cópia semanal é feita aos domingos (`date +%u` = 7) e mantém as últimas 4.
- `rclone sync` (não `copy`) replica exclusões também — se um backup diário for
  podado localmente, ele desaparece do Drive na sincronização seguinte. Isso é
  intencional (mesma política de retenção nos dois lugares); se quiser manter
  histórico maior só no Drive, trocar para `rclone copy` no passo 7 do script.
