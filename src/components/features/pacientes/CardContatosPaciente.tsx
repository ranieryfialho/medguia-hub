import { Phone, Mail, MapPin, MessageCircle, Contact } from 'lucide-react'
import { formatarTelefone } from '@/lib/input-masks'
import { whatsappLink } from '@/components/features/contatos/kanban-utils'

type Props = {
  telefone?: string | null
  telefoneSecundario?: string | null
  email?: string | null
  endereco?: string | null
  complemento?: string | null
  enderecoSemNumero?: boolean | null
}

const limpar = (valor?: string | null) => valor?.trim() || ''

export function CardContatosPaciente({
  telefone, telefoneSecundario, email, endereco, complemento, enderecoSemNumero,
}: Props) {
  const principal = limpar(telefone)
  const secundario = limpar(telefoneSecundario)
  const mail = limpar(email)
  const logradouro = limpar(endereco)
  const compl = limpar(complemento)

  const enderecoCompleto = [
    logradouro && enderecoSemNumero ? `${logradouro} (sem número)` : logradouro,
    compl,
  ].filter(Boolean).join(' · ')

  const temContato = principal || secundario || mail || enderecoCompleto

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4 text-[#006b5a]">
        <Contact size={18} />
        <h4 className="font-bold text-base">Contatos</h4>
      </div>

      {!temContato ? (
        <p className="text-sm text-slate-500">Nenhum contato cadastrado para este paciente.</p>
      ) : (
        <div className="space-y-3">
          {principal && (
            <div className="flex items-start gap-3">
              <Phone size={16} className="mt-0.5 shrink-0 text-[#33A68F]" />
              <div className="min-w-0 flex-1">
                <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold">Telefone principal</span>
                <a href={`tel:${principal.replace(/\D/g, '')}`} className="text-sm font-semibold text-slate-900 hover:text-[#006b5a]">
                  {formatarTelefone(principal) || principal}
                </a>
              </div>
              <a
                href={whatsappLink(principal)}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir no WhatsApp"
                className="shrink-0 rounded-lg p-1.5 text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
              >
                <MessageCircle size={16} />
              </a>
            </div>
          )}

          {secundario && (
            <div className="flex items-start gap-3">
              <Phone size={16} className="mt-0.5 shrink-0 text-[#33A68F]" />
              <div className="min-w-0 flex-1">
                <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold">Telefone secundário</span>
                <a href={`tel:${secundario.replace(/\D/g, '')}`} className="text-sm font-semibold text-slate-900 hover:text-[#006b5a]">
                  {formatarTelefone(secundario) || secundario}
                </a>
              </div>
              <a
                href={whatsappLink(secundario)}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir no WhatsApp"
                className="shrink-0 rounded-lg p-1.5 text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
              >
                <MessageCircle size={16} />
              </a>
            </div>
          )}

          {mail && (
            <div className="flex items-start gap-3">
              <Mail size={16} className="mt-0.5 shrink-0 text-[#33A68F]" />
              <div className="min-w-0 flex-1">
                <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold">Email</span>
                <a href={`mailto:${mail}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-[#006b5a]" title={mail}>
                  {mail}
                </a>
              </div>
            </div>
          )}

          {enderecoCompleto && (
            <div className="flex items-start gap-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#33A68F]" />
              <div className="min-w-0 flex-1">
                <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold">Endereço</span>
                <p className="text-sm font-semibold text-slate-900 leading-snug">{enderecoCompleto}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
