-- Permite reutilizar a tabela venda_termos para os dois documentos gerados a
-- partir de uma venda (contrato/termo e recibo de contratação), distinguidos
-- pela nova coluna `tipo`. Linhas existentes (só havia geração de termo até
-- aqui) recebem o padrão 'termo'.
alter table public.venda_termos
  add column if not exists tipo text not null default 'termo';

alter table public.venda_termos
  add constraint venda_termos_tipo_check check (tipo in ('termo', 'recibo'));

create index if not exists idx_venda_termos_venda_id_tipo on public.venda_termos(venda_id, tipo);
