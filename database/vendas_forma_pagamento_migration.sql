alter table public.vendas
  add column if not exists forma_pagamento text;

update public.vendas
set forma_pagamento = coalesce(forma_pagamento, 'pix')
where forma_pagamento is null;

alter table public.vendas
  alter column forma_pagamento set not null;

alter table public.vendas
  drop constraint if exists vendas_forma_pagamento_check;

alter table public.vendas
  add constraint vendas_forma_pagamento_check
  check (forma_pagamento in (
    'pix',
    'cartao_credito',
    'cartao_debito',
    'dinheiro',
    'transferencia',
    'boleto'
  ));
