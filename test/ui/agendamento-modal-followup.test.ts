/**
 * Fluxo agendamento concluído → evolução → follow-up (AgendamentoModal.tsx).
 *
 * Não há runner de componente neste projeto (dev conecta direto em produção,
 * sem staging — ver conversa), então a prova é asserção estática sobre o
 * texto do arquivo, mesma técnica de test/ui/agendamento-modal-motivo.test.ts.
 *
 * Regressão principal coberta: o aviso de follow-up usava window.confirm(),
 * que pode ser silenciosamente suprimido em PWA instalado / webview embarcado
 * / alguns navegadores mobile — por isso foi substituído por um modal React
 * (ConfirmacaoFollowUpModal) controlado por state, no mesmo padrão do
 * PromptPreConsultaModal.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = readFileSync(
  path.join(__dirname, '../../src/components/features/agenda/AgendamentoModal.tsx'),
  'utf-8',
)
const modalSrc = readFileSync(
  path.join(__dirname, '../../src/components/features/agenda/ConfirmacaoFollowUpModal.tsx'),
  'utf-8',
)

function extrairFuncao(nome: string): string {
  const inicio = src.search(new RegExp(`function ${nome}\\(`))
  assert.notEqual(inicio, -1, `função ${nome} não encontrada em AgendamentoModal.tsx`)
  const fimRelativo = src.slice(inicio + 1).search(/\n  (async )?function /)
  assert.notEqual(fimRelativo, -1, `não foi possível delimitar o fim de ${nome}`)
  return src.slice(inicio, inicio + 1 + fimRelativo)
}

test('mudar o status para "concluído" pula direto para a aba Evolução e arma a sugestão de follow-up', () => {
  const handleStatusChange = extrairFuncao('handleStatusChange')
  assert.match(
    handleStatusChange,
    /getAtendimentoStatusKey\(novoStatus\) === 'concluido'/,
    'a transição para concluído precisa ser detectada via getAtendimentoStatusKey',
  )
  assert.match(
    handleStatusChange,
    /setActiveTab\('evolucao'\)/,
    'ao concluir, a aba ativa precisa virar "evolucao"',
  )
  assert.match(
    handleStatusChange,
    /setSugerirFollowUpAoSalvarEvolucao\(true\)/,
    'ao concluir, a flag de sugestão de follow-up precisa ser armada',
  )
})

test('o aviso de follow-up NÃO usa window.confirm (regressão: dialog nativo pode ser suprimido em PWA/webview)', () => {
  const handleEvolucaoSalva = extrairFuncao('handleEvolucaoSalva')
  assert.doesNotMatch(
    handleEvolucaoSalva,
    /window\.confirm/,
    'handleEvolucaoSalva não deve mais chamar window.confirm — use o state confirmacaoFollowUp + ConfirmacaoFollowUpModal',
  )
})

test('salvar a evolução com a sugestão armada abre o modal de follow-up (state), não decide na hora', () => {
  const handleEvolucaoSalva = extrairFuncao('handleEvolucaoSalva')
  assert.match(
    handleEvolucaoSalva,
    /if \(sugerirFollowUpAoSalvarEvolucao\)/,
    'handleEvolucaoSalva precisa checar a flag armada em handleStatusChange',
  )
  assert.match(
    handleEvolucaoSalva,
    /setConfirmacaoFollowUp\(true\)/,
    'com a flag ativa, precisa abrir o modal via setConfirmacaoFollowUp(true)',
  )
})

test('confirmar no modal de follow-up troca para a aba "followup"; cancelar só dá refresh', () => {
  const handleConfirmar = extrairFuncao('handleConfirmarFollowUp')
  assert.match(
    handleConfirmar,
    /setConfirmacaoFollowUp\(false\)/,
    'handleConfirmarFollowUp precisa fechar o modal',
  )
  assert.match(
    handleConfirmar,
    /setActiveTab\('followup'\)/,
    'handleConfirmarFollowUp precisa levar para a aba followup',
  )

  const handleCancelar = extrairFuncao('handleCancelarFollowUp')
  assert.match(
    handleCancelar,
    /setConfirmacaoFollowUp\(false\)/,
    'handleCancelarFollowUp precisa fechar o modal',
  )
  assert.match(
    handleCancelar,
    /router\.refresh\(\)/,
    'handleCancelarFollowUp precisa dar refresh sem trocar de aba',
  )
})

test('o ProntuarioEvolucao (aba Evolução) chama handleEvolucaoSalva no onSuccess', () => {
  assert.match(
    src,
    /<ProntuarioEvolucao[\s\S]{0,200}?onSuccess=\{handleEvolucaoSalva\}/,
    'a aba de evolução precisa disparar handleEvolucaoSalva quando o prontuário é salvo com sucesso',
  )
})

test('o ConfirmacaoFollowUpModal é renderizado via createPortal, controlado pelo state confirmacaoFollowUp', () => {
  assert.match(
    src,
    /confirmacaoFollowUp && createPortal\(\s*<ConfirmacaoFollowUpModal/,
    'o modal de follow-up precisa ser montado condicionalmente por state + createPortal, no mesmo padrão do ConfirmacaoFaltaModal/PromptPreConsultaModal',
  )
  assert.match(
    src,
    /onConfirmar=\{handleConfirmarFollowUp\}/,
    'o modal precisa receber handleConfirmarFollowUp',
  )
  assert.match(
    src,
    /onCancelar=\{handleCancelarFollowUp\}/,
    'o modal precisa receber handleCancelarFollowUp',
  )
})

test('ConfirmacaoFollowUpModal.tsx não depende de window.confirm/alert e expõe onConfirmar/onCancelar', () => {
  assert.doesNotMatch(modalSrc, /window\.(confirm|alert)/, 'o componente não pode cair de volta para dialog nativo')
  assert.match(modalSrc, /onConfirmar:\s*\(\)\s*=>\s*void/, 'precisa expor a prop onConfirmar')
  assert.match(modalSrc, /onCancelar:\s*\(\)\s*=>\s*void/, 'precisa expor a prop onCancelar')
})

test('a aba "followup" (TabFollowUp) fica ativa quando activeTab === \'followup\'', () => {
  assert.match(
    src,
    /<TabFollowUp[\s\S]{0,300}?isActive=\{activeTab === 'followup'\}/,
    'TabFollowUp precisa receber isActive amarrado a activeTab === "followup"',
  )
})

test('AgendamentoModal.tsx não usa mais window.confirm em lugar nenhum (regressão: dialog nativo some silenciosamente em PWA/webview)', () => {
  assert.doesNotMatch(
    src,
    /window\.confirm/,
    'nenhuma função do modal deve depender de window.confirm — use state + modal React (ConfirmacaoFollowUpModal, ConfirmacaoSairEvolucaoModal, ConfirmacaoFaltaModal)',
  )
})

test('sair da aba Evolução com alterações não salvas abre um modal (state), não window.confirm', () => {
  const guardar = extrairFuncao('guardarSaidaEvolucao')
  assert.match(
    guardar,
    /if \(!evolucaoDirty\) \{ acao\(\); return \}/,
    'sem alterações pendentes, a ação deve rodar direto, sem perguntar nada',
  )
  assert.match(
    guardar,
    /setAcaoPendenteSairEvolucao\(\(\) => acao\)/,
    'com alterações pendentes, a ação deve ficar guardada em state até a confirmação',
  )

  assert.match(
    src,
    /acaoPendenteSairEvolucao && createPortal\(\s*<ConfirmacaoSairEvolucaoModal/,
    'o modal de confirmação de saída precisa ser montado condicionalmente por state + createPortal',
  )

  assert.match(
    src,
    /function fecharComGuarda\(\) \{\s*guardarSaidaEvolucao\(onClose\)\s*\}/,
    'fechar o modal do agendamento com a evolução suja precisa passar pelo guardarSaidaEvolucao',
  )
  assert.match(
    src,
    /guardarSaidaEvolucao\(\(\) => \{ setEvolucaoDirty\(false\); setActiveTab\(aba\) \}\)/,
    'trocar de aba saindo de "evolucao" precisa passar pelo guardarSaidaEvolucao',
  )
  assert.match(
    src,
    /onClick=\{\(\) => guardarSaidaEvolucao\(\(\) => \{ router\.push\('\/confirmacoes\/cards'\); onClose\(\) \}\)\}/,
    'o botão "Ver jornada" precisa passar pelo guardarSaidaEvolucao antes de navegar',
  )
})
