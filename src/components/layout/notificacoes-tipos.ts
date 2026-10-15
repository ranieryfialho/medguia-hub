export const TIPO_CONFIG: Record<string, { cor: string; label: string }> = {
  agenda_confirmou:      { cor: 'bg-emerald-100 text-emerald-700', label: 'Agenda'      },
  agenda_vai_faltar:     { cor: 'bg-amber-100 text-amber-700',     label: 'Agenda'      },
  agenda_nao_atendeu:    { cor: 'bg-slate-100 text-slate-600',     label: 'Confirmação' },
  agenda_falta:          { cor: 'bg-red-100 text-red-700',         label: 'Agenda'      },
  prontuario_pendente:   { cor: 'bg-orange-100 text-orange-700',   label: 'Prontuário'  },
  prontuario_dor_alta:   { cor: 'bg-red-100 text-red-700',         label: 'Prontuário'  },
  acesso_alterado:       { cor: 'bg-blue-100 text-blue-700',       label: 'Acesso'      },
  follow_up_atribuido:   { cor: 'bg-teal-100 text-teal-700',       label: 'Follow-up'   },
  contato_frio:          { cor: 'bg-amber-100 text-amber-700',     label: 'Base fria'   },
  contrato_nao_assinado: { cor: 'bg-violet-100 text-violet-700',   label: 'Contrato'    },
}

const PREFIXOS_DERIVADAS = ['pending-', 'followup-', 'cold-', 'contrato-']

/** Pendências calculadas em tempo real (ids sintéticos), em oposição às persistidas. */
export function ehNotificacaoDerivada(id: string) {
  return PREFIXOS_DERIVADAS.some((p) => id.startsWith(p))
}
