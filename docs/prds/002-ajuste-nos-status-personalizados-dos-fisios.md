
## Problema (O Porquê)

Estamos tendo problemas em relação a identificação do status personalizado ao que de fato foi realizado nesse status personalizado. Essa observação sera feita extamente para isso. Esse card com o status personalizado serviará exatamente para podermos ver na rota de agendamento as horas que esse colaborador fez la. E precisamos validar se o fallback ja implementado anteriormente esta funcional. 

## Usuários (Para Quem)

Relacionado observações dos status personalizados a gestão quer poder identificar esse status, seja reunião, hora administrativa e etc alinhada com a observação que foi colocada no ato da mudança de status. Em relação ao card na rota de agendamentos dar a mesma visão gerencial a quem compete isso. E sobre o fallback foi pedido do dono da empresa. Se precisar ficar por mais tempo sera necessário mudar o status novamente.

## Requisitos (O Quê)

Precisamos fazer alguns ajustes no sistema no que se refere aos status personalizados:

* Adicionar observação nos status personalizados do medhub:
  Campo aberto para informações gerais.
* Adicionar card na rota agendamento onde mostre o status personalizado do fisio ou médico.
* ~~Mudar fallback de status personalizados de 2 para 1 hora.~~ → **revertido em
  11/08/2026: o fallback voltou para 2 horas.** Entregue como 1h em 10/08; na
  primeira semana ficou claro que reuniões e horas administrativas de 1h30–2h
  são rotina e o teto cortava no meio delas. O que a entrega de 10/08 corrigiu
  de verdade — o profissional voltar sozinho para "Disponível" em vez de ficar
  travado para sempre — **continua valendo**. O que voltou foi só o prazo.
  Ver [Emenda 1 do RFC 002](../rfcs/002-ciclo-de-vida-dos-status-personalizados.md#emenda-1-2026-08-11--o-teto-volta-de-1h-para-2h-com-contador-visível).

## Acréscimo de 11/08/2026 — contador regressivo

Um teto que só aparece depois de vencido é armadilha, em 1h ou em 2h: a pessoa
descobre que expirou pelo efeito (voltou a constar como Disponível), nunca por
um aviso.

* Mostrar, nas três telas de status (card da agenda, widget global e
  Configurações → Disponibilidade), **quanto falta para o status expirar**.
* Ao zerar, marcar como **expirado** em vez de sumir da lista — o job roda a
  cada 10 minutos, e a tela não pode afirmar que a pessoa já voltou antes de o
  banco ter feito isso.
* Verificar se o Realtime está de fato propagando as expirações automáticas para
  as telas.
