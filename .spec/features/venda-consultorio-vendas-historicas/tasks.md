# Tasks: Venda em Consultório vs. Conversão do Fisioterapeuta + Relatório de Vendas Históricas

> feature: venda-consultorio-vendas-historicas

## T-001 — Migration: coluna venda_em_consultorio, CHECK e índices [concluida]
- Refs: AC-063, AC-064, AC-070
- Arquivos: database/vendas_venda_em_consultorio_migration.sql
- Notas: `ALTER TABLE vendas ADD COLUMN IF NOT EXISTS venda_em_consultorio BOOLEAN` (nullable, sem DEFAULT). `ADD CONSTRAINT vendas_consultorio_apenas_origem_medico CHECK (venda_em_consultorio IS NULL OR origem = 'medico')`. Índices `idx_vendas_data_status (data_venda, status)` e `idx_vendas_medico_ref_id (medico_referenciador_id) WHERE medico_referenciador_id IS NOT NULL`. Aditiva, aplicada pelo SQL Editor do Studio — mesmo padrão de `database/vendas_*_migration.sql`. Bloqueia T-002, T-003, T-004.

## T-002 — Toggle no formulário de nova venda [concluida]
- Refs: AC-061, AC-062
- Arquivos: src/components/features/vendas/FormNovaVenda.tsx
- Notas: Toggle switch abaixo do campo de médico referenciador, visível só quando `origem === 'medico'`. Default `false` (desligado). Ao trocar origem para outro valor, limpar o valor do campo local (vira `null` no submit). Textos de rótulo e ajuda conforme PRD 1.1. Depende de T-001 (mas não bloqueia — só a persistência real depende da coluna existir).

## T-003 — Toggle no formulário de edição de venda [pendente]

- Refs: AC-061, AC-062
- Arquivos: src/components/features/vendas/FormEditarVenda.tsx
- Notas: Mesmo comportamento de T-002, adaptado ao formulário de edição (carregar valor existente da venda, incluindo `null`).

## T-004 — Validação do toggle nas Server Actions [pendente]

- Refs: AC-063, AC-064
- Arquivos: src/actions/vendas.ts
- Notas: `criarVenda` e `editarVenda` passam a receber `venda_em_consultorio` do FormData. Validar: se `origem !== 'medico'`, forçar `null` antes de gravar (defesa em profundidade — o `CHECK` do banco é a garantia real). Mensagem de erro amigável se o banco rejeitar. Depende de T-001.

## T-005 — Testes unitários do toggle nas actions [pendente]

- Refs: AC-063, AC-064
- Arquivos: src/actions/vendas.test.ts
- Notas: `node --test` com FormData montado — cobre AC-063 (persistência correta com origem médica) e AC-064 (limpeza para `null` quando origem não é médica / venda legada). Depende de T-004.

## T-006 — fn_vendas_resumo_mensal (CTE canônica de venda contável) [pendente]

- Refs: AC-065, AC-066, AC-067, AC-068, AC-070
- Arquivos: database/vendas_fn_resumo_mensal_migration.sql
- Notas: CTE única de "venda contável": `status = 'venda_confirmada'`, soma de `itens_venda.quantidade * preco_unitario`, venda confirmada sem itens conta como R$0 no numerador e +1 no denominador (AC-066). Parâmetros: `p_data_inicio, p_data_fim, p_profissional_id, p_medico_id, p_origem, p_categoria, p_modalidade` (todos exceto datas com `DEFAULT NULL`). Retorno: uma linha por mês do período (mês sem venda aparece com zeros, AC-067), com `faturamento, qtd_vendas, ticket_medio, faturamento_consultorio, qtd_consultorio, faturamento_fisio, qtd_fisio, qtd_nao_classificada, qtd_orcamento_pendente, qtd_orcamento_recusado, top_produto, top_profissional`. `SECURITY DEFINER` com `SET search_path = public, pg_temp` (AC-070). `p_origem`, `p_categoria`, `p_modalidade` validados contra lista fechada dentro da função. Depende de T-001.

## T-007 — fn_vendas_detalhe_mes (drill-down) [pendente]

- Refs: AC-069, AC-070
- Arquivos: database/vendas_fn_detalhe_mes_migration.sql
- Notas: Mesma assinatura de filtros de T-006, troca `p_data_inicio/p_data_fim` por `p_mes DATE`. Retorna quebra por origem, quebra por categoria, ranking de médicos referenciadores e ranking de fisioterapeutas do mês — reaproveitando a mesma CTE de venda contável (copiar a definição de T-006, não duplicar a regra por escrita separada). `SECURITY DEFINER` com `SET search_path = public, pg_temp`. Depende de T-006.

## T-008 — Roteiro de teste SQL manual das funções [pendente]

- Refs: AC-065, AC-066, AC-067, AC-068, AC-069
- Arquivos: database/vendas_funcoes_roteiro_teste.sql
- Notas: Script documentado no SQL Editor cobrindo os cenários críticos do TDD: mês sem venda (AC-067), venda confirmada sem itens (AC-066, cenário construído pois não existe caso real na base), orçamento pendente/recusado fora do faturamento (AC-068), filtros combinados. Serve de prova para os critérios de aceite que rodam em SQL puro — evidência anexada ao PR. Depende de T-006, T-007.

## T-009 — Segmentação consultório/fisio em /relatorios/vendas [pendente]

- Refs: AC-071, AC-072, AC-073, AC-074
- Arquivos: src/app/(painel)/relatorios/vendas/page.tsx
- Notas: Filtro de modalidade de fechamento (todos/consultório/fisio), cards comparativos de faturamento consultório vs. fisio + taxa de conversão da equipe (denominador inclui orçamento recusado; `venda_em_consultorio = NULL` fora dos dois lados), colunas nas tabelas de médico referenciador e de profissional, tag `[Médico · Consultório]`/`[Médico · Conversão Fisio]` na listagem detalhada. Depende de T-001 (coluna existir).

## T-010 — Bloco de resumo médico no PDF de vendas [pendente]

- Refs: AC-075
- Arquivos: src/lib/relatorios/pdf-vendas.ts
- Notas: Bloco separando faturamento fechado em consultório vs. convertido pelo fisio, alimentado pelos mesmos totais calculados em T-009.

## T-011 — Migrar KPIs de /relatorios/vendas para fn_vendas_resumo_mensal + paginação da listagem [pendente]

- Refs: AC-076, AC-077
- Arquivos: src/app/(painel)/relatorios/vendas/page.tsx
- Notas: Item de maior risco (TDD). KPIs de topo (faturamento, volume, ticket médio) passam a vir de `fn_vendas_resumo_mensal` somada sobre o intervalo filtrado. Query de listagem detalhada ganha `.range()` explícito. Protocolo de corte do TDD: manter o cálculo antigo em paralelo até validação lado a lado fechar (comparar mês corrente, mês anterior, trimestre, ano, filtro por profissional, filtro por médico — divergência só esperada no ticket médio pela regra de venda-sem-itens, que a medição do TDD já mostrou ser zero na base). Remover o caminho antigo só depois da comparação bater. Depende de T-006, T-009.

## T-012 — Testes unitários de agregação e MoM (funções puras) [pendente]

- Refs: AC-067, AC-076, AC-078, AC-080
- Arquivos: src/lib/relatorios/vendas-historicas.ts, src/lib/relatorios/vendas-historicas.test.ts
- Notas: Extrair para funções puras testáveis por `node --test`: cálculo de MoM sobre linhas adjacentes (divisão por zero → `—`, nunca `-100%`), derivação dos cards executivos (total, volume, ticket médio consolidado, melhor mês, crescimento médio MoM) a partir do array de linhas mensais. Essas funções são consumidas tanto pela rota nova (T-014) quanto pela validação lado a lado de T-011.

## T-013 — Menu lateral: link para /relatorios/vendas-historicas [pendente]

- Refs: AC-085
- Arquivos: src/components/layout/Sidebar.tsx
- Notas: Entrada no grupo Comercial, ao lado do link existente para `/relatorios/vendas`.

## T-014 — Rota /relatorios/vendas-historicas: cards, gráfico, tabela, filtros [pendente]

- Refs: AC-078, AC-079, AC-080, AC-082, AC-083, AC-086
- Arquivos: src/app/(painel)/relatorios/vendas-historicas/page.tsx
- Notas: Server Component seguindo o padrão das rotas de relatório existentes; `searchParams` viram parâmetros de `fn_vendas_resumo_mensal`. Cards executivos derivados das linhas mensais via funções de T-012 (sem chamada extra). Gráfico com `recharts`, seletores de período (6/12/24 meses, YTD, personalizado) refazendo a consulta, alternância de métrica resolvida no cliente sobre o mesmo dataset. Tabela mês a mês em ordem cronológica decrescente com MoM. Filtros globais: profissional, médico referenciador (por id, com `medico_nome` aceito como fallback resolvido para id), origem, categoria. Responsivo: `overflow-x: auto` e redução adaptativa de rótulos de mês (AC-083). Controle de acesso idêntico ao de `/relatorios/vendas` (AC-086 — mesmo guard/verificação de perfil, nunca mais permissivo). Depende de T-006, T-012, T-013.

## T-015 — Drill-down expansível por linha da tabela histórica [pendente]

- Refs: AC-081
- Arquivos: src/app/(painel)/relatorios/vendas-historicas/DrillDownMes.tsx
- Notas: Componente cliente que chama `fn_vendas_detalhe_mes` ao expandir a linha (não no carregamento inicial). Exibe quebra por origem, quebra por categoria, ranking de médicos referenciadores e ranking de fisioterapeutas do mês. Depende de T-007, T-014.

## T-016 — Exportação PDF e XLSX do relatório histórico [pendente]

- Refs: AC-084
- Arquivos: src/lib/relatorios/pdf-vendas-historicas.ts, src/lib/relatorios/xlsx-vendas-historicas.ts
- Notas: `jspdf` já em uso no projeto (`pdf-vendas.ts` como referência). `xlsx` está instalado mas nunca foi usado — validar cedo que bundle e download funcionam no ambiente do projeto. Ambos consomem os dados já calculados em tela (cards + tabela mês a mês). Depende de T-014.

## T-017 — Verificação de controle de acesso da rota histórica [pendente]

- Refs: AC-086
- Arquivos: src/app/(painel)/relatorios/vendas-historicas/page.test.ts
- Notas: Teste (ou verificação documentada, se o guard de acesso não for testável por `node --test` isoladamente) confirmando que o mesmo mecanismo de controle de acesso de `/relatorios/vendas` está aplicado à rota nova. Depende de T-014.
