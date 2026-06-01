ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS sms_sid text,
  ADD COLUMN IF NOT EXISTS sms_status text,
  ADD COLUMN IF NOT EXISTS sms_error_code text,
  ADD COLUMN IF NOT EXISTS sms_error_message text,
  ADD COLUMN IF NOT EXISTS data_ultimo_envio_sms timestamp with time zone;
