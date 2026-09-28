-- Registra quando o paciente/contratante confirmou ter lido e aceitado as
-- cláusulas das Condições Gerais, antes de assinar o contrato. Gravado junto
-- com o registro do documento gerado (venda_termos), não como evento à parte.
alter table public.venda_termos
  add column if not exists aceite_em timestamptz;
