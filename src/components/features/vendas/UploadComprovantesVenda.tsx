'use client'

import { useRef, useState } from 'react'
import { LoaderCircle, Upload, FileText, X, ExternalLink } from 'lucide-react'
import { criarPastaPaciente } from '@/actions/google-drive'
import { MAX_COMPROVANTES_VENDA, extensaoDoNome, type ComprovanteVenda } from '@/lib/comprovantes-venda'

const TAMANHO_MAXIMO = 50 * 1024 * 1024

interface Props {
  pacienteId: string
  pacienteNome: string
  comprovantes: ComprovanteVenda[]
  onChange: (comprovantes: ComprovanteVenda[]) => void
  /** Desabilita o botão de anexar (ex.: paciente ainda não selecionado). */
  desabilitado?: boolean
}

export function UploadComprovantesVenda({
  pacienteId,
  pacienteNome,
  comprovantes,
  onChange,
  desabilitado = false,
}: Props) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const restantes = MAX_COMPROVANTES_VENDA - comprovantes.length

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? [])
    if (arquivos.length === 0 || !pacienteId) return

    if (arquivos.length > restantes) {
      setErro(`Você pode anexar no máximo ${MAX_COMPROVANTES_VENDA} comprovantes por venda.`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const grande = arquivos.find((f) => f.size > TAMANHO_MAXIMO)
    if (grande) {
      setErro(`"${grande.name}" é muito grande. Máximo 50MB por arquivo.`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setErro('')
    setEnviando(true)
    try {
      const pasta = await criarPastaPaciente(pacienteId, pacienteNome)
      if (!pasta.success) {
        setErro(pasta.error ?? 'Erro ao preparar pasta no Drive.')
        return
      }

      const enviados: ComprovanteVenda[] = []
      const falhas: string[] = []

      // Sequencial: o Drive costuma recusar uploads paralelos na mesma pasta.
      for (const file of arquivos) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('pacienteId', pacienteId)
        const res = await fetch('/api/drive/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) {
          falhas.push(`${file.name}: ${json.error ?? 'erro no upload'}`)
        } else {
          const nome = json.nome ?? file.name
          enviados.push({ fileId: json.id, fileUrl: json.fileUrl ?? null, nome, extensao: extensaoDoNome(nome) })
        }
      }

      if (enviados.length > 0) {
        const jaAnexados = new Set(comprovantes.map((c) => c.fileId))
        onChange([...comprovantes, ...enviados.filter((c) => !jaAnexados.has(c.fileId))])
      }
      if (falhas.length > 0) {
        setErro(`Não foi possível enviar: ${falhas.join('; ')}`)
      }
    } catch {
      setErro('Erro ao enviar comprovante.')
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remover = (fileId: string) => {
    setErro('')
    onChange(comprovantes.filter((c) => c.fileId !== fileId))
  }

  return (
    <div className="space-y-2">
      {comprovantes.length > 0 && (
        <div className="space-y-2">
          {comprovantes.map((comprovante) => (
            <div
              key={comprovante.fileId}
              className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-page"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-primary-500 shrink-0" />
                <span className="text-sm text-text-primary truncate">{comprovante.nome}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`/api/drive/file/${comprovante.fileId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-white rounded transition-colors"
                  title="Ver comprovante"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => remover(comprovante.fileId)}
                  className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-white rounded transition-colors"
                  title="Remover"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {restantes > 0 && (
        <button
          type="button"
          disabled={desabilitado || !pacienteId || enviando}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-border-input text-sm font-medium text-text-secondary hover:bg-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
          {enviando
            ? 'Enviando...'
            : comprovantes.length > 0
              ? 'Anexar outro comprovante'
              : 'Anexar comprovante'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {comprovantes.length > 1 && (
        <p className="text-xs text-text-secondary">
          {comprovantes.length} comprovantes anexados.
        </p>
      )}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  )
}
