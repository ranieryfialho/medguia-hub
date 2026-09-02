# LIÇÕES — mantido pelo motor (`onp-spec licoes`)

> Não edite à mão: qualquer escrita do motor sobrescreve este arquivo.
> Estado canônico em `.spec/licoes.json`; mutação só via `onp-spec licoes`.

## Confirmadas — carregue no Especificar/Projetar

Corroboradas em múltiplas features. Aplique como guia.

_nenhuma_

## Candidatas — em observação, NÃO aplicar ainda

Vistas em uma feature só. Registradas, não confiadas.

### L-001 — Teste que compara texto-fonte com assinatura multi-linha (\n literal) quebra apos merge, pois o repo usa CRLF no Windows -- normalize o source lido (.replace(/\r\n/g, '\n')) antes de comparar.
- sinal: `VERIFY_FALHOU` · recorrência: 1 feature(s) · escopo: `testes` · penalidades: 0
- features: foto-paciente-drive-avatar
- última evidência: AC-098 (foto-paciente-drive-avatar, 2026-09-02T21:02:02.785Z)

## Quarentena — aplicadas e falharam, ignorar

A falha recorreu mesmo com a lição aplicada. Revisão é do usuário.

_nenhuma_
