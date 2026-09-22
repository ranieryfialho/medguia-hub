'use client'

export function ConfirmacaoSairEvolucaoModal({
  onConfirmar,
  onCancelar,
}: {
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-bold text-[#083142] mb-1">Sair sem salvar?</h3>
        <p className="text-sm text-[#6d7a75] mb-5">
          A evolução ainda não foi salva. Sair mesmo assim?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded-xl border border-[#bcc9c4] text-sm font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="flex-1 py-2.5 rounded-xl bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
          >
            Sair mesmo assim
          </button>
        </div>
      </div>
    </div>
  )
}
