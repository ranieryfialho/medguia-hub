-- CORREÇÃO 2: a policy checava só profiles.role, mas o app trata como "gestor" quem tem
-- role = 'gestor'/'master' OU nivel_acesso = 'gestor'/'master' (ver podeGerirEquipe em
-- src/lib/permissoes.ts). Caso real: Jéssica Teixeira (a772e18c-f7a3-427d-bae6-d82cecac8c12)
-- tem role = 'fisioterapeuta' mas nivel_acesso = 'gestor' — a UI deixa ela gerir a equipe,
-- mas a policy antiga bloqueava porque só olhava role. Alinhando a policy com a mesma regra
-- do podeGerirEquipe().
drop policy if exists gestores_manage_all_jornada_mensal on public.jornada_mensal_profissional;
drop policy if exists own_manage_jornada_mensal on public.jornada_mensal_profissional;

create policy gestores_manage_all_jornada_mensal
  on public.jornada_mensal_profissional
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and (
          profiles.role = any (array['gestor'::public.user_role, 'master'::public.user_role])
          or profiles.nivel_acesso in ('gestor', 'master')
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and (
          profiles.role = any (array['gestor'::public.user_role, 'master'::public.user_role])
          or profiles.nivel_acesso in ('gestor', 'master')
        )
    )
  );

create policy own_manage_jornada_mensal
  on public.jornada_mensal_profissional
  using (profissional_id = auth.uid())
  with check (profissional_id = auth.uid());

-- Confirme que ficou como esperado (deve listar 3 policies, todas com with_check preenchido
-- pras duas de ALL):
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'jornada_mensal_profissional'
order by policyname;

-- MESMA CORREÇÃO na tabela do template SEMANAL (disponibilidade_profissional), que tem o
-- exato mesmo problema: policy "gestores_manage_all" só olha profiles.role e não tem
-- WITH CHECK explícito. Sem isso, editar o template semanal ("Editar jornada de trabalho")
-- de outro profissional vai bater na mesma trava.
drop policy if exists gestores_manage_all on public.disponibilidade_profissional;
drop policy if exists own_manage on public.disponibilidade_profissional;

create policy gestores_manage_all
  on public.disponibilidade_profissional
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and (
          profiles.role = any (array['gestor'::public.user_role, 'master'::public.user_role])
          or profiles.nivel_acesso in ('gestor', 'master')
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and (
          profiles.role = any (array['gestor'::public.user_role, 'master'::public.user_role])
          or profiles.nivel_acesso in ('gestor', 'master')
        )
    )
  );

create policy own_manage
  on public.disponibilidade_profissional
  using (profissional_id = auth.uid())
  with check (profissional_id = auth.uid());

select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'disponibilidade_profissional'
order by policyname;
