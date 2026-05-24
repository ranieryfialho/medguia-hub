do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'disponibilidade_profissional'
      and column_name = 'hora_inicio'
  ) then
    alter table public.disponibilidade_profissional rename column hora_inicio to jornada_inicio;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'disponibilidade_profissional'
      and column_name = 'hora_fim'
  ) then
    alter table public.disponibilidade_profissional rename column hora_fim to jornada_fim;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'disponibilidade_profissional'
      and column_name = 'almoco_inicio'
  ) then
    alter table public.disponibilidade_profissional rename column almoco_inicio to intervalo_inicio;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'disponibilidade_profissional'
      and column_name = 'almoco_fim'
  ) then
    alter table public.disponibilidade_profissional rename column almoco_fim to intervalo_fim;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jornada_mensal_profissional'
      and column_name = 'hora_inicio'
  ) then
    alter table public.jornada_mensal_profissional rename column hora_inicio to jornada_inicio;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jornada_mensal_profissional'
      and column_name = 'hora_fim'
  ) then
    alter table public.jornada_mensal_profissional rename column hora_fim to jornada_fim;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jornada_mensal_profissional'
      and column_name = 'almoco_inicio'
  ) then
    alter table public.jornada_mensal_profissional rename column almoco_inicio to intervalo_inicio;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jornada_mensal_profissional'
      and column_name = 'almoco_fim'
  ) then
    alter table public.jornada_mensal_profissional rename column almoco_fim to intervalo_fim;
  end if;
end $$;
