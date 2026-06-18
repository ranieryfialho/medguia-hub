'use client'

import { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { Building2, Phone, MapPin, ImageIcon, Save, CheckCircle, Search, Loader2, Trash2, Upload } from 'lucide-react'
import { salvarConfigClinica } from '@/actions/clinica'
import type { ConfigClinica } from '@/lib/clinica'

const INPUT = 'w-full px-3 py-2 rounded-lg border border-border bg-page text-text-primary text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors'
const LABEL = 'block text-xs font-semibold text-text-secondary uppercase mb-1.5'

function Campo({ label, children, span2, span3 }: { label: string; children: React.ReactNode; span2?: boolean; span3?: boolean }) {
  return (
    <div className={span3 ? 'sm:col-span-3' : span2 ? 'sm:col-span-2' : undefined}>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  )
}

function SecaoHeader({ icon: Icon, titulo, descricao }: { icon: React.ElementType; titulo: string; descricao: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-border">
      <div className="w-9 h-9 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <p className="font-semibold text-text-primary">{titulo}</p>
        <p className="text-xs text-text-secondary">{descricao}</p>
      </div>
    </div>
  )
}

export function ClinicaConfigClient({ config: inicial }: { config: ConfigClinica }) {
  const [form, setForm] = useState<ConfigClinica>(inicial)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(inicial.logo_url)
  const [uploadandoLogo, setUploadandoLogo] = useState(false)
  const [removendoLogo, setRemovendoLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = (campo: keyof ConfigClinica) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [campo]: e.target.value || null }))
    setSalvo(false)
    setErro(null)
  }

  const buscarCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) return
      setForm(f => ({
        ...f,
        endereco: data.logradouro || f.endereco,
        endereco_bairro: data.bairro || f.endereco_bairro,
        endereco_cidade: data.localidade || f.endereco_cidade,
        endereco_estado: data.uf || f.endereco_estado,
      }))
      setSalvo(false)
    } catch {
      // silencia — usuário preenche manualmente
    } finally {
      setBuscandoCep(false)
    }
  }

  const buscarCnpj = async () => {
    const digits = (form.cnpj ?? '').replace(/\D/g, '')
    if (digits.length !== 14) {
      setErro('Digite um CNPJ válido (14 dígitos) antes de buscar.')
      return
    }
    setBuscandoCnpj(true)
    setErro(null)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!res.ok) throw new Error('CNPJ não encontrado.')
      const data = await res.json()

      const telefone = data.ddd_telefone_1
        ? data.ddd_telefone_1.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')
        : null

      const cepApi = data.cep?.replace(/\D/g, '') ?? null

      setForm(f => ({
        ...f,
        nome: data.nome_fantasia || data.razao_social || f.nome,
        endereco: data.logradouro || f.endereco,
        endereco_numero: data.numero || f.endereco_numero,
        endereco_complemento: data.complemento || f.endereco_complemento,
        endereco_bairro: data.bairro || f.endereco_bairro,
        endereco_cidade: data.municipio || f.endereco_cidade,
        endereco_estado: data.uf || f.endereco_estado,
        endereco_cep: cepApi
          ? cepApi.replace(/(\d{5})(\d{3})/, '$1-$2')
          : f.endereco_cep,
        email: data.email || f.email,
        telefone: telefone || f.telefone,
      }))
      setSalvo(false)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao buscar CNPJ.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadandoLogo(true)
    setErro(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/clinica/upload-logo', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro no upload')
      setLogoUrl(json.url)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao fazer upload da logo')
    } finally {
      setUploadandoLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoverLogo = async () => {
    setRemovendoLogo(true)
    setErro(null)
    try {
      const res = await fetch('/api/clinica/upload-logo', { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao remover logo')
      setLogoUrl(null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover logo')
    } finally {
      setRemovendoLogo(false)
    }
  }

  const handleSalvar = () => {
    startTransition(async () => {
      const res = await salvarConfigClinica(form)
      if (res.error) setErro(res.error)
      else setSalvo(true)
    })
  }

  return (
    <div className="space-y-5">

      {/* Logo */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <SecaoHeader icon={ImageIcon} titulo="Logo da Clínica" descricao="Exibida no cabeçalho dos PDFs gerados" />
        <div className="mt-5 flex items-center gap-6">
          {/* Preview */}
          <div className="w-40 h-24 rounded-lg border-2 border-dashed border-border bg-page flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl ? (
              <Image src={logoUrl} alt="Logo" width={160} height={96} className="object-contain w-full h-full p-2" unoptimized />
            ) : (
              <div className="flex flex-col items-center gap-1 text-text-secondary">
                <ImageIcon size={24} />
                <span className="text-xs">Sem logo</span>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Formatos aceitos: PNG, JPG, SVG · Máximo 2 MB<br />
              Recomendado: fundo transparente (PNG)
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadLogo}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadandoLogo}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-page hover:bg-border text-text-primary text-sm transition-colors disabled:opacity-50"
              >
                {uploadandoLogo
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Upload size={14} />
                }
                {logoUrl ? 'Trocar logo' : 'Enviar logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoverLogo}
                  disabled={removendoLogo}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-sm transition-colors disabled:opacity-50"
                >
                  {removendoLogo
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />
                  }
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Identificação */}
      <div className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <SecaoHeader icon={Building2} titulo="Identificação" descricao="Nome e dados legais da clínica" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Campo label="Nome da Clínica" span3>
            <input type="text" value={form.nome ?? ''} onChange={set('nome')}
              placeholder="Ex: Clínica Saúde & Vida" className={INPUT} />
          </Campo>
          <Campo label="CNPJ">
            <div className="flex gap-2">
              <input type="text" value={form.cnpj ?? ''} onChange={set('cnpj')}
                placeholder="00.000.000/0001-00" className={INPUT} />
              <button
                type="button"
                onClick={buscarCnpj}
                disabled={buscandoCnpj}
                title="Buscar dados pelo CNPJ"
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-page hover:bg-border text-text-secondary hover:text-text-primary text-sm transition-colors disabled:opacity-50"
              >
                {buscandoCnpj ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                <span className="hidden sm:inline">Buscar</span>
              </button>
            </div>
          </Campo>
          <Campo label="Especialidade" span2>
            <input type="text" value={form.especialidade ?? ''} onChange={set('especialidade')}
              placeholder="Ex: Fisioterapia, Odontologia..." className={INPUT} />
          </Campo>
        </div>
      </div>

      {/* Contato */}
      <div className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <SecaoHeader icon={Phone} titulo="Contato" descricao="Formas de contato da clínica" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Campo label="Telefone">
            <input type="text" value={form.telefone ?? ''} onChange={set('telefone')}
              placeholder="(00) 0000-0000" className={INPUT} />
          </Campo>
          <Campo label="WhatsApp">
            <input type="text" value={form.whatsapp ?? ''} onChange={set('whatsapp')}
              placeholder="(00) 00000-0000" className={INPUT} />
          </Campo>
          <Campo label="E-mail">
            <input type="email" value={form.email ?? ''} onChange={set('email')}
              placeholder="contato@clinica.com.br" className={INPUT} />
          </Campo>
          <Campo label="Site">
            <input type="text" value={form.site ?? ''} onChange={set('site')}
              placeholder="www.clinica.com.br" className={INPUT} />
          </Campo>
        </div>
      </div>

      {/* Endereço */}
      <div className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <SecaoHeader icon={MapPin} titulo="Endereço" descricao="Localização física da clínica" />
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <Campo label="CEP" span2>
            <div className="relative">
              <input
                type="text"
                value={form.endereco_cep ?? ''}
                onChange={e => { set('endereco_cep')(e); buscarCep(e.target.value) }}
                placeholder="00000-000"
                className={INPUT}
              />
              {buscandoCep && (
                <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              )}
            </div>
          </Campo>
          <div className="sm:col-span-4" />
          <Campo label="Logradouro" span3>
            <input type="text" value={form.endereco ?? ''} onChange={set('endereco')}
              placeholder="Rua, Avenida, Travessa..." className={INPUT} />
          </Campo>
          <Campo label="Número">
            <input type="text" value={form.endereco_numero ?? ''} onChange={set('endereco_numero')}
              placeholder="123" className={INPUT} />
          </Campo>
          <Campo label="Complemento" span2>
            <input type="text" value={form.endereco_complemento ?? ''} onChange={set('endereco_complemento')}
              placeholder="Sala 10, Andar 2..." className={INPUT} />
          </Campo>
          <Campo label="Bairro" span2>
            <input type="text" value={form.endereco_bairro ?? ''} onChange={set('endereco_bairro')}
              placeholder="Centro" className={INPUT} />
          </Campo>
          <Campo label="Cidade" span2>
            <input type="text" value={form.endereco_cidade ?? ''} onChange={set('endereco_cidade')}
              placeholder="São Paulo" className={INPUT} />
          </Campo>
          <Campo label="Estado (UF)">
            <input type="text" value={form.endereco_estado ?? ''} onChange={set('endereco_estado')}
              placeholder="SP" maxLength={2} className={INPUT} />
          </Campo>
          <div />
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{erro}</p>
      )}

      {/* Ações */}
      <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-4">
        {salvo ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle size={15} />
            Configurações salvas com sucesso
          </span>
        ) : (
          <span className="text-xs text-text-secondary">
            As alterações são aplicadas imediatamente nos documentos gerados.
          </span>
        )}
        <button
          onClick={handleSalvar}
          disabled={pending}
          className="inline-flex items-center gap-2 px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-4 shrink-0"
        >
          {pending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Save size={15} />
          }
          Salvar
        </button>
      </div>
    </div>
  )
}