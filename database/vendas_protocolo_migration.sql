alter table public.vendas
  add column if not exists protocolo_id uuid references public.protocolos(id) on delete set null;

alter table public.vendas
  add column if not exists protocolo_nome text;
