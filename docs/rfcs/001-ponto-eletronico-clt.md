# RFC: Arquitetura do Módulo de Ponto Eletrônico CLT com Geolocalização

| Campo | Valor |
|-------|-------|
| **Impacto** | **ALTO** — afeta todos os colaboradores CLT, o RH, e cria exposição jurídico-trabalhista e de LGPD (dado de localização = dado pessoal) |
| **Status** | NOT STARTED — aguardando decisão |
| **Driver** | @Raniery |
| **Approver** | @Dr. Felipe (sponsor) + responsável por RH/Jurídico *(a confirmar)* |
| **Contributors** | Engenharia (MedGuia Hub), RH/DP, Contabilidade, Jurídico trabalhista |
| **Informed** | Todos os colaboradores CLT, Gestores de equipe |
| **Due Date** | TBD — sugerido decidir em até 2 semanas (bloqueia todo o desenvolvimento) |
| **Resources** | [PRD 001](../prds/001-implementacao-ponto-clt.md) · Portaria MTP 671/2021 · CLT art. 74 §2º · Súmula 338 TST · LGPD art. 7º, 11 e 16 |
| **Created** | 2026-08-06 |
| **Last Updated** | 2026-08-06 |

---

## Sumário Executivo

O PRD 001 descreve **o quê** construir. Este RFC existe porque, antes de projetar telas e tabelas, precisamos decidir **sob qual regime legal** o ponto vai operar — e essa escolha muda radicalmente a arquitetura, o custo e o prazo.

Registro de jornada no Brasil não é software comum: é um artefato regulado pela **Portaria MTP 671/2021**, que define três regimes (REP-C, REP-P, REP-A) com requisitos técnicos incompatíveis entre si. Construir "um app de ponto com GPS" sem escolher o regime produz um sistema que funciona na prática e **não vale nada numa fiscalização ou reclamatória** — que é exatamente o passivo que o PRD quer eliminar.

**Recomendação:** Opção 1 — construir in-house como **REP-A (Registrador Eletrônico de Ponto Alternativo)**, condicionado à formalização de acordo coletivo/individual escrito, sobre a stack atual (Next.js 16 + Supabase self-hosted), com **ledger append-only encadeado por hash**, validação de geocerca 100% server-side e exportação em formato AFD compatível.

---

## Background

### Situação atual

O controle de jornada dos colaboradores CLT é feito por processo manual sujeito a rasura. O MedGuia Hub já possui a infraestrutura adjacente pronta:

- **Jornada planejada por profissional** — [`jornada_mensal_profissional`](../../database/jornada_mensal_profissional_migration.sql) e [`src/lib/jornada.ts`](../../src/lib/jornada.ts) já modelam entrada, saída, intervalo de almoço, folgas, feriados e bloqueios. **Isso é a metade difícil do problema**: já existe a "jornada esperada" contra a qual comparar a "jornada realizada".
- **Controle de acesso modular** — [`src/lib/modulos.ts`](../../src/lib/modulos.ts) + [`src/lib/guard.ts`](../../src/lib/guard.ts), com níveis `basico`/`gestor`/`master` e RLS no Postgres.
- **Relatórios e exportação** — Tempo Fábril, PDF (`jspdf`) e XLSX (`xlsx`) já em produção.
- **Supabase self-hosted** (`supabase.medguia.cloud`) — controle total sobre o Postgres, `pg_cron`, Storage e retenção de dados. Não há dependência de terceiro para guarda dos registros.

Ou seja: **não partimos do zero**. Falta o núcleo de registro, a camada de validação geográfica e a camada de conformidade legal.

### Problema

| Sintoma | Custo hoje |
|---------|-----------|
| Apuração manual de inconsistências | ~1h/semana de RH |
| Marcações com rasura/erro | 15–20% dos registros |
| Ausência de prova da jornada | Passivo trabalhista aberto — em reclamatória, sem controle válido, prevalece a jornada alegada pelo empregado (Súmula 338, I, TST) |
| Sem prova de presença física | Impossível contestar alegação de trabalho fora do posto |

### Por que agora

1. **Risco jurídico é contínuo e cumulativo** — cada mês sem controle válido amplia o período passível de reclamatória (prescrição quinquenal).
2. **A base técnica já existe** — o custo marginal de construir agora é a fração mais baixa que teremos.
3. **Escala** — o processo manual não sobrevive ao crescimento do quadro CLT.

### O que acontece se não decidirmos

- O passivo continua acumulando mês a mês.
- Risco real de a equipe construir o sistema "errado" na pressa: um app de ponto sem regime legal definido é retrabalho quase total (formato de arquivo, imutabilidade e comprovante são estruturais, não cosméticos).

---

## Suposições

| # | Suposição | Owner | Confiança | Gatilho de invalidação |
|---|-----------|-------|-----------|------------------------|
| 1 | Adotar REP-A é viável: conseguimos formalizar acordo coletivo (sindicato) **ou** acordo individual escrito com cada CLT, conforme art. 75 da Portaria 671/2021 | Jurídico/RH | **Média** | Se o sindicato da categoria recusar ou exigir REP-P certificado → Opção 1 cai, vai para Opção 2 ou 3 |
| 2 | O quadro CLT é de dezenas, não centenas, de colaboradores, em poucos locais fixos | RH | Alta | Se ultrapassar ~200 CLT ou multi-cidade, o TCO da Opção 3 (SaaS) muda |
| 3 | 100% dos colaboradores possuem smartphone com GPS e navegador moderno | RH | **Média** | Se houver colaborador sem aparelho → é obrigatório prever posto alternativo (tablet/quiosque na recepção) |
| 4 | O Supabase self-hosted tem durabilidade e backup adequados para guarda legal de 5 anos dos registros | Engenharia | **Média** | Se a política de backup não cobrir retenção legal → exige WORM/backup externo antes do go-live |
| 5 | Há capacidade de engenharia para ~6–9 semanas de desenvolvimento focado | @Raniery | Média | Mudança de prioridade de roadmap |
| 6 | Precisão de GPS de smartphone (10–50m em área urbana, degradada indoor) é suficiente para o raio operacional adotado | Engenharia | **Baixa** | Se a clínica for em prédio comercial/andar alto, a precisão indoor pode inviabilizar raio pequeno → exige raio maior + camada complementar (SSID de rede, beacon) |
| 7 | O relógio do dispositivo **não** é confiável; toda marcação usa horário do servidor sincronizado por NTP | Engenharia | Alta | — (premissa de projeto, não negociável) |

---

## Critérios de Decisão

Definidos **antes** das opções. A opção escolhida deve satisfazer todos os *Must-have* e pontuar melhor nos demais.

| # | Critério | Descrição | Peso |
|---|----------|-----------|------|
| 1 | **Validade jurídica** | O registro deve ser oponível em fiscalização do MTE e em reclamatória trabalhista, sob um regime legal explícito | **Must-have** |
| 2 | **Inviolabilidade / integridade** | Impossibilidade técnica de alterar ou apagar um registro já efetuado, com trilha de auditoria verificável | **Must-have** |
| 3 | **Conformidade LGPD** | Geolocalização é dado pessoal; exige base legal, minimização, transparência e retenção definida | **Must-have** |
| 4 | **Comprovante ao trabalhador** | Todo registro deve gerar comprovante recuperável pelo colaborador (art. 74 CLT / Portaria 671) | **Must-have** |
| 5 | **Time to production** | Preferir entrega em até 1 trimestre | Alto |
| 6 | **TCO em 3 anos** | Custo total (desenvolvimento + manutenção + licença/colaborador) | Alto |
| 7 | **Integração com o que já existe** | Reuso de `jornada_mensal_profissional`, perfis, RLS e relatórios | Alto |
| 8 | **Domínio técnico da equipe** | Preferir Next.js + Supabase, stack já dominada | Médio |
| 9 | **Reversibilidade** | Facilidade de trocar de abordagem se a premissa legal mudar | Médio |
| 10 | **Lock-in de fornecedor** | Evitar que os dados de jornada fiquem reféns de terceiro | Baixo |

---

## Dados Relevantes

**Quantitativos (do PRD)**
- 1h/semana de RH em apuração ≈ 52h/ano ≈ R$ 3–6k/ano em custo direto.
- 15–20% de inconsistência nas marcações.
- Meta: < 2% de inconsistência; confirmação na tela < 3s.

**Regulatório — o ponto central deste RFC**

A Portaria MTP 671/2021 define três regimes:

| Regime | O que é | Exige | Cabe no PRD? |
|--------|---------|-------|--------------|
| **REP-C** | Relógio de ponto físico com bobina | Hardware homologado no INMETRO, registro no MTE | ❌ Incompatível com "bater ponto pelo celular" |
| **REP-P** | Programa de ponto eletrônico | Registro do programa no MTE, **ATRT** (Atestado Técnico de Responsabilidade Técnica) assinado por engenheiro/entidade competente, geração de **AFD** assinado, imutabilidade certificada | ✅ Tecnicamente, mas com carga regulatória alta |
| **REP-A** | Sistema alternativo de controle | **Autorização por convenção/acordo coletivo** (ou individual escrito, art. 75), vedação de restrições à marcação, identificação do empregado, comprovante ao trabalhador, extração de dados | ✅ **Melhor encaixe com o PRD** |

**Requisitos comuns aos regimes eletrônicos (valem para qualquer opção escolhida):**
- Vedação a **marcação automática** de jornada (ponto britânico).
- **Vedação a restringir a marcação** — o sistema não pode impedir o trabalhador de registrar a jornada efetivamente cumprida. *(Ver Ponto de Debate #1.)*
- Comprovante de registro entregue ao trabalhador.
- Impossibilidade de alteração/exclusão dos dados originais registrados.
- Retenção dos registros por, no mínimo, 5 anos.

**LGPD.** Geolocalização de empregado é dado pessoal tratado sob base legal de *cumprimento de obrigação legal* (art. 7º, II — controle de jornada é obrigação do art. 74 CLT) e/ou *execução de contrato*. Consequências de arquitetura, não de política:
- **Minimização:** capturar o ponto **apenas no instante da marcação** — jamais rastreamento contínuo. Rastreio contínuo é desproporcional e muda a base legal.
- **Transparência:** aviso de privacidade específico no primeiro uso.
- **Retenção:** política explícita (5 anos para os registros; a coordenada bruta pode ser descartada/reduzida antes disso, mantendo apenas o veredito "dentro/fora do raio" + distância).

**Referências externas:** Portaria MTP 671/2021 (arts. 73–84 e Anexo I — layout AFD); CLT art. 74 §2º; Súmula 338 TST; LGPD arts. 7º, 16 e 46.

---

## ⚠️ Pontos de Debate Prévios (afetam todas as opções)

Estes três itens do PRD merecem discussão explícita **antes** da escolha da opção, porque impactam o desenho de qualquer alternativa.

### Debate #1 — "Bloquear a marcação fora do raio" pode gerar o passivo que queremos evitar

O PRD determina em *NUNCA PODE*: recusar o registro fora do raio e recusar o registro sem GPS/com baixa precisão.

O risco: se o colaborador realmente trabalhou e o sistema **impediu** que ele registrasse, temos jornada trabalhada sem registro. Em reclamatória, isso tende a militar contra o empregador (Súmula 338, I, TST — a ausência de controle válido gera presunção relativa em favor da jornada alegada pelo empregado), e a Portaria 671 veda restrições à marcação. O bloqueio também cria falha operacional real: GPS falha indoor, em prédios, com bateria em economia de energia ou por permissão negada no iOS.

**Alternativa recomendada — "registrar sempre, validar depois":**

| Cenário | Comportamento proposto |
|---------|------------------------|
| Dentro do raio, precisão boa | `VALIDADO` — verde, automático, sem intervenção do RH |
| Fora do raio | `PENDENTE_VALIDACAO` — registra, exige justificativa do colaborador, sobe para fila do gestor |
| GPS off / precisão ruim / permissão negada | `PENDENTE_VALIDACAO` com motivo `sem_geo` — registra, exige justificativa |
| Ponto remoto autorizado e vigente | `VALIDADO_REMOTO` |

Isso **preserva integralmente a métrica do PRD** ("% de registros validados automaticamente sem auditoria manual") — o que muda é que a exceção vira uma fila de trabalho auditável em vez de um registro inexistente. Na prática o efeito dissuasório é o mesmo (o colaborador sabe que fora do raio gera pendência visível ao gestor), sem o passivo.

**Decisão necessária:** manter o bloqueio duro do PRD (aceitando o risco jurídico) ou adotar "registrar sempre, validar depois"? → **Recomendação: adotar.**

### Debate #2 — "Não permitir mais de 2h extras por dia"

Mesma lógica. O limite de 2h/dia é o teto legal de *autorização* de horas suplementares (CLT art. 59). Se o colaborador permaneceu no posto além disso, o tempo foi trabalhado e é devido — impedir o registro não extingue a obrigação, apenas apaga a prova.

**Proposta:** o limite de 2h incide sobre o **cômputo/aprovação**, não sobre o registro. Minutos acima do teto são registrados, sinalizados como `EXCEDENTE_NAO_AUTORIZADO` e escalados ao gestor + RH. Adicionalmente, aplicar a tolerância legal de 5 min por marcação / 10 min diários (art. 58 §1º CLT) no cálculo.

### Debate #3 — Fraude de localização (mock location)

Geocerca via navegador é falsificável: apps de fake GPS no Android, DevTools no desktop. A V1 exclui biometria, então precisamos de mitigações proporcionais:
- Registro **sempre** via app instalado como PWA no celular, com *device binding* (identificador do dispositivo vinculado ao colaborador; troca de aparelho gera pendência).
- Rejeitar marcação originada de user-agent desktop.
- Detecção de sinais: precisão suspeita (`accuracy` de 1m constante), coordenada idêntica em milímetros entre marcações, velocidade implícita impossível entre dois pontos consecutivos, IP fora da faixa esperada.
- Todos os sinais alimentam um **score de confiança** no registro — não bloqueiam, sinalizam.

Fraude determinada não é evitável sem biometria/atestação de dispositivo. O objetivo realista da V1 é **tornar a fraude detectável e documentada**, não impossível.

---

## Opções Consideradas

### Opção 1: Construir in-house como REP-A, sobre a stack atual ⭐ (Recomendada)

**Descrição.** Implementar o módulo dentro do MedGuia Hub, operando sob o regime de **sistema alternativo de controle de jornada (REP-A)**, autorizado por acordo coletivo ou individual escrito. O REP-A dispensa o registro do programa no MTE e o ATRT, mas exige rigorosamente: identificação do empregado, comprovante de registro, imutabilidade dos dados originais e capacidade de extração. Nós entregamos todos esses requisitos por arquitetura — inclusive gerando **AFD em layout compatível com o Anexo I** desde a V1, o que mantém aberta a porta para migrar a REP-P depois sem refazer o núcleo.

**Como funciona — arquitetura proposta**

**1. Núcleo: ledger append-only encadeado por hash**

```
ponto_registros  (IMUTÁVEL — sem UPDATE, sem DELETE)
├─ id, colaborador_id, tipo (entrada|saida_intervalo|volta_intervalo|saida)
├─ registrado_em          timestamptz  ← RELÓGIO DO SERVIDOR, nunca do cliente
├─ cliente_informou_em    timestamptz  ← relógio do device, só p/ detecção de divergência
├─ latitude, longitude, precisao_m, origem_geo
├─ local_trabalho_id, distancia_m, dentro_do_raio
├─ status (validado | validado_remoto | pendente_validacao | rejeitado_pelo_gestor)
├─ motivo_pendencia, score_confianca, device_id, user_agent, ip
├─ nsr                    bigint       ← Número Sequencial de Registro (nunca reutilizado)
├─ hash_anterior, hash_registro        ← encadeamento estilo blockchain
└─ comprovante_codigo                  ← código curto entregue ao colaborador
```

- `hash_registro = sha256(nsr ‖ colaborador ‖ tipo ‖ registrado_em ‖ geo ‖ hash_anterior)`. Adulterar um registro quebra toda a cadeia subsequente — verificável por um job diário que atesta a integridade da cadeia e alerta em caso de ruptura.
- **Imutabilidade forçada no banco**, não na aplicação: `REVOKE UPDATE, DELETE` na tabela + trigger `BEFORE UPDATE OR DELETE → RAISE EXCEPTION`. Isso atende o critério #2 mesmo contra bug de aplicação ou acesso direto ao Postgres.
- Correções **nunca** editam o registro. Vão para `ponto_ajustes`, uma tabela separada de solicitações com fluxo de aprovação; o espelho de ponto mostra original + ajuste aprovado, lado a lado. Isso atende ao *NUNCA PODE* "alterações manuais retroativas" do PRD de forma estrutural.

**2. Validação geográfica — 100% server-side**

O cliente envia apenas `{lat, lng, accuracy}`. Toda decisão (distância, raio, veredito, status) acontece em Server Action + função Postgres. O cliente nunca envia "estou dentro do raio". Cálculo por **fórmula de Haversine em SQL puro** — sem PostGIS. Justificativa: dezenas de locais fixos e uma comparação por marcação; PostGIS adicionaria uma extensão a manter no self-hosted sem ganho mensurável. Se um dia houver geometrias complexas (polígonos em vez de círculos), migra-se.

```
locais_trabalho: id, nome, latitude, longitude, raio_metros (default 150), ativo
```

**3. Autorizações de ponto remoto**

```
ponto_autorizacoes_remotas: colaborador_id, vigencia_inicio, vigencia_fim (NOT NULL),
                            motivo, concedida_por, revogada_em
```
Vigência obrigatória atende diretamente o requisito do PRD ("data de validade pré-estabelecida"). Validação server-side: durante a vigência, marcação fora do raio nasce `validado_remoto`.

**4. Horas extras com validação mútua**

Máquina de estados explícita, exatamente como o PRD exige (aprovação do gestor **e** do funcionário):

```
DETECTADA → AGUARDANDO_GESTOR → AGUARDANDO_COLABORADOR → COMPUTADA
     └──────────→ REJEITADA (por qualquer das partes, com motivo)
     └──────────→ EXCEDENTE_NAO_AUTORIZADO (> 2h/dia — escala p/ RH)
```
Cada transição gravada em `ponto_extras_eventos` com autor, timestamp e IP. A "validação mútua" é a assinatura eletrônica das duas partes, e é o que dá força probatória ao banco de horas.

**5. Justificativas e atestados**

`ponto_justificativas` + **Supabase Storage** em bucket privado, acesso exclusivamente por *signed URL* de curta duração. Atestado médico é **dado pessoal sensível** (LGPD art. 11) — bucket separado, RLS restrita a RH/gestor direto, retenção própria, log de todo acesso. Não usar o mesmo bucket de mídias de paciente.

**6. Cliente: PWA, não app nativo**

- `manifest.json` + service worker, instalável na home screen. Reaproveita 100% do frontend e do deploy atuais; zero fricção de app store.
- Geolocation API com `enableHighAccuracy: true` e timeout curto.
- **Fila offline:** marcação sem rede vai para IndexedDB e sincroniza depois, com `idempotency_key` (UUID gerado no cliente) para impedir duplicidade. Registro sincronizado com atraso carrega `sincronizado_com_atraso = true` e o delta de tempo — auditável, não silencioso.
- Meta de < 3s: resposta otimista na UI + confirmação do servidor. O gargalo real é o *fix* do GPS (1–8s), não a rede — a UX deve pré-aquecer a localização ao abrir a tela, antes do toque no botão.

**7. Integração com o que já existe**

- **Reuso direto** de `jornada_mensal_profissional` como jornada esperada. O cálculo de saldo é `realizado − esperado`, e `src/lib/jornada.ts` (`obterIntervalosJornada`, `calcularMinutosJornada`) já resolve o lado esperado.
- Novos módulos em `src/lib/modulos.ts`: `ponto:meu_ponto` (todos), `ponto:gestao` (gestor), `ponto:espelho` (RH), `ponto:locais` (master) — encaixando no `requireModulo` existente.
- Apuração diária consolidada por **`pg_cron`** (já em uso no projeto) em `ponto_apuracao_dia`, para o espelho não recalcular a cada leitura.
- Exportação AFD + espelho em PDF/XLSX reusando `jspdf`/`xlsx`.

**Prós**
- Único caminho que satisfaz os 4 *Must-have* dentro do custo e do prazo previstos.
- Reuso pesado da base existente — jornada planejada, permissões, RLS, relatórios, cron.
- Dados 100% sob nosso controle no Postgres self-hosted; zero lock-in; integração nativa com Tempo Fábril e demais relatórios.
- Sem custo recorrente por colaborador — escala marginalmente grátis.
- Gerando AFD compatível desde a V1, a migração para REP-P depois é incremental (registro no MTE + ATRT + assinatura ICP-Brasil), não uma reescrita.

**Contras**
- **Depende de premissa jurídica (Suposição 1).** Se o acordo coletivo não sair, a opção cai. É o maior risco do RFC.
- A responsabilidade pela conformidade é nossa — não há fornecedor para dividir o ônus numa autuação.
- Exige disciplina de engenharia contínua (imutabilidade, verificação de cadeia, retenção) por anos.
- Não elimina fraude de localização sem biometria (excluída da V1).

**Custo estimado:** **MÉDIO-GRANDE**
- Esforço: ~7 semanas de 1 dev focado — 1 (fundação/migrations/imutabilidade) + 1,5 (PWA de marcação + geo) + 1,5 (painel gestor, pendências, extras) + 1 (justificativas/atestados/remoto) + 1 (espelho, AFD, exportação) + 1 (hardening, LGPD, testes, piloto)
- Financeiro: R$ 0 recorrente (roda na VPS atual) + custo pontual do assessoramento jurídico para o acordo
- Risco: **MÉDIO** (concentrado no eixo legal, não no técnico)

---

### Opção 2: Construir in-house como REP-P certificado

**Descrição.** Mesma arquitetura da Opção 1, acrescida da conformidade formal de REP-P: registro do programa no MTE, obtenção do **ATRT**, geração de AFD estritamente no layout do Anexo I com **assinatura digital ICP-Brasil** (certificado e-CNPJ), e atendimento integral aos requisitos de inviolabilidade certificada.

**Como funciona**
1. Tudo da Opção 1.
2. Assinatura criptográfica do AFD com e-CNPJ ICP-Brasil (custódia de chave privada em servidor — não trivial).
3. Contratação de responsável técnico habilitado para emitir o ATRT.
4. Registro do programa junto ao MTE e manutenção do documento técnico atualizado a cada versão relevante.

**Prós**
- Validade jurídica máxima, **independente de negociação sindical** — remove o risco da Suposição 1.
- Aceito em qualquer categoria e qualquer convenção coletiva.
- Encerra a discussão de conformidade de forma definitiva.

**Contras**
- Carga regulatória alta e **permanente**: cada mudança relevante no sistema pode exigir revisão do ATRT.
- Custódia de chave ICP-Brasil em servidor é um problema de segurança de verdade (HSM ou equivalente).
- Prazo dominado por terceiros (responsável técnico, MTE), não por engenharia.
- Custo desproporcional para o porte atual — é a conformidade que uma empresa de folha vende como produto.

**Custo estimado:** **GRANDE**
- Esforço: ~7 semanas de dev + 4–10 semanas de trâmite externo (paralelizável parcialmente)
- Financeiro: certificado e-CNPJ (~R$ 300–800/ano) + ATRT/consultoria (estimativa R$ 5–20k, **a validar**)
- Risco: **MÉDIO-ALTO** (prazo fora do nosso controle)

---

### Opção 3: Contratar SaaS de ponto REP-P e integrar via API

**Descrição.** Adotar um produto de mercado já certificado (categoria: Pontomais, Tangerino/Sólides, Ahgora, Oitchau) e integrar ao Hub apenas para leitura — trazendo os dados apurados para dentro do Tempo Fábril e dos relatórios.

**Como funciona**
1. Seleção e contratação do fornecedor (PoC comparativa de 2–3).
2. Cadastro de colaboradores, locais e escalas na ferramenta.
3. Job de sincronização periódico puxando marcações apuradas para uma tabela espelho no nosso Postgres.
4. Colaborador usa **dois apps**: o do ponto e o Hub.

**Prós**
- Conformidade REP-P **imediata**, com o ônus regulatório no fornecedor.
- Time to production muito curto (2–4 semanas, majoritariamente configuração).
- Recursos maduros de fábrica: biometria facial, banco de horas, integração com folha, relatórios legais.
- Esforço de engenharia mínimo; libera o time para o roadmap clínico/comercial.

**Contras**
- **Custo recorrente perpétuo** — faixa típica R$ 8–20/colaborador/mês; para 40 CLT ≈ R$ 4–10k/ano, crescendo com o quadro.
- **Experiência fragmentada** — contraria o requisito implícito do PRD de área administrativa centralizada; colaborador com dois apps, RH com dois painéis.
- Lock-in: histórico de jornada dentro do fornecedor; migrar depois é doloroso.
- Integração fraca com a **jornada planejada** que já temos — provavelmente exigiria manter as escalas duplicadas em dois sistemas, criando uma nova fonte de inconsistência (justamente o problema que o PRD ataca).
- Nenhum aproveitamento do investimento já feito em `jornada_mensal_profissional`.

**Custo estimado:** **PEQUENO (upfront) / MÉDIO (recorrente)**
- Esforço: ~2–3 semanas (seleção + integração de leitura)
- Financeiro: ~R$ 4–10k/ano na escala atual, escalando linearmente
- Risco: **BAIXO** juridicamente / **MÉDIO** em produto (fragmentação e dupla manutenção de escalas)

---

### Opção 4: Não fazer nada (manter o processo atual)

**Descrição.** Manter o controle manual e aceitar o risco.

**Prós**
- Custo imediato zero; nenhuma disrupção; time 100% focado no roadmap atual.

**Contras**
- Passivo trabalhista continua acumulando — potencialmente a ordem de grandeza mais cara de todas as opções, e a única de custo não delimitado.
- Descumprimento do art. 74 §2º da CLT persiste (exposição a autuação do MTE).
- 52h/ano de RH permanecem queimadas em apuração.
- Nenhuma prova de presença física.

**Custo estimado:** **PEQUENO** (upfront) / potencialmente **MUITO GRANDE** (passivo)

---

## Comparação das Opções

| Critério (peso) | Op. 1 — REP-A in-house | Op. 2 — REP-P in-house | Op. 3 — SaaS REP-P | Op. 4 — Nada |
|---|---|---|---|---|
| Validade jurídica **(Must)** | ✅ *se houver acordo* | ✅✅ | ✅✅ | ❌ **desqualifica** |
| Inviolabilidade **(Must)** | ✅ hash chain + DB | ✅ + assinatura ICP | ✅ (do fornecedor) | ❌ **desqualifica** |
| LGPD **(Must)** | ✅ controle total | ✅ | ⚠️ operador externo, exige DPA | ❌ |
| Comprovante ao trabalhador **(Must)** | ✅ | ✅ | ✅ | ❌ |
| Time to production (Alto) | ~7 sem | ~7 sem + trâmite externo | **2–3 sem** | — |
| TCO 3 anos (Alto) | **~R$ 0 recorrente** | R$ 0 + ~R$ 10–25k inicial | R$ 12–30k | R$ 0 + passivo |
| Integração com o Hub (Alto) | **✅✅ nativa** | ✅✅ | ⚠️ fraca, escalas duplicadas | — |
| Domínio da equipe (Médio) | **✅✅** | ✅ (exceto ICP-Brasil) | ✅ | — |
| Reversibilidade (Médio) | ✅ migra p/ REP-P ou SaaS | ⚠️ investimento afundado | ⚠️ lock-in de dados | ✅ |
| Lock-in (Baixo) | **✅ nenhum** | ✅ nenhum | ❌ alto | — |

**Opção 4 é desqualificada** por falhar em todos os quatro *Must-have*. Fica documentada como linha de base de custo.

**Recomendação: Opção 1.** Ela satisfaz os quatro *Must-have* (condicionada à Suposição 1), vence com folga nos critérios de maior peso — TCO, integração nativa com a jornada planejada já existente, domínio técnico — e é a mais reversível: se o acordo coletivo falhar ou se o quadro crescer muito, o núcleo construído migra para REP-P (Opção 2) sem reescrita, porque o AFD e a imutabilidade já estarão prontos.

**Trade-off assumido, declarado:** abrimos mão da conformidade "blindada de fábrica" da Opção 3 e do time-to-market curto dela, em troca de custo recorrente zero, produto único e integração real com a jornada planejada.

**Gatilho de reavaliação:** se o jurídico concluir em até 2 semanas que o acordo REP-A não é viável, a decisão migra automaticamente para a **Opção 3 (SaaS)** como caminho de menor risco — Opção 2 só se justifica se o volume de colaboradores tornar o custo recorrente do SaaS proibitivo.

---

## Fora de Escopo deste RFC

- Design de telas e fluxos de UX (vai para o TDD).
- DDL final das tabelas — o esboço acima é ilustrativo do modelo, não a migration.
- Integração com folha de pagamento e biometria facial (já excluídos da V1 pelo PRD).
- Política de banco de horas e regras de compensação (decisão de RH, não de arquitetura).

---

## Action Items

| # | Ação | Owner | Prazo | Status |
|---|------|-------|-------|--------|
| 1 | **[BLOQUEANTE]** Validar com jurídico trabalhista a viabilidade do REP-A: convenção coletiva da categoria permite? Acordo individual escrito é suficiente? | Jurídico/RH | +2 sem | NOT STARTED |
| 2 | Decidir o Debate #1 — bloqueio duro vs. "registrar sempre, validar depois" | Approvers | +2 sem | NOT STARTED |
| 3 | Decidir o Debate #2 — teto de 2h extras no cômputo, não no registro | Approvers + RH | +2 sem | NOT STARTED |
| 4 | Levantar locais de trabalho: coordenadas reais e raio adequado por unidade (medir precisão de GPS *in loco*, indoor) | @Raniery + RH | +2 sem | NOT STARTED |
| 5 | Confirmar 100% de cobertura de smartphone no quadro CLT; definir posto alternativo se houver lacuna | RH | +2 sem | NOT STARTED |
| 6 | Verificar política de backup/retenção do Supabase self-hosted para guarda legal de 5 anos | @Raniery | +2 sem | NOT STARTED |
| 7 | Cotar 2–3 SaaS de ponto para ter o número real da Opção 3 na mesa da decisão | RH | +2 sem | NOT STARTED |
| 8 | Definir política de retenção e minimização de geolocalização (aviso de privacidade + prazo de descarte da coordenada bruta) | Jurídico + Eng. | +3 sem | NOT STARTED |
| 9 | **Após decisão:** escrever o TDD com DDL, RLS, contratos de Server Actions e plano de rollout | @Raniery | +1 sem da decisão | NOT STARTED |
| 10 | **Após decisão:** definir piloto (1 equipe, 2–4 semanas, ponto em paralelo ao processo atual antes do corte) | @Raniery + RH | +1 sem da decisão | NOT STARTED |

> Se aprovada, a Opção 1 exige um **TDD** detalhando modelo de dados, políticas RLS, contratos de Server Actions, layout do AFD e plano de migração/rollout com piloto.

---

## Outcome

**Decisão:** *(a preencher após a reunião de decisão)*

**Data da decisão:** —

**Decidido por:** —

**Racional:** —

**Fatores determinantes:**
- —

**Condições / ressalvas:**
- —

**Follow-up**
- [ ] Criar TDD de implementação
- [ ] Comunicar a decisão a RH e colaboradores CLT
- [ ] Formalizar acordo coletivo/individual (se Opção 1)
- [ ] Agendar retrospectiva 3 meses após go-live, avaliando contra as métricas do PRD (< 2% de inconsistência, < 3s de confirmação, % validado automaticamente)
