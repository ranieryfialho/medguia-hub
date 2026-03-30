import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Stethoscope, 
  Hourglass, 
  CalendarCheck, 
  PlusCircle, 
  MoreVertical
} from 'lucide-react'

export default function AgendaPage() {
  return (
    <div className="space-y-6">
      
      <h2 className="font-bold text-2xl text-[#171d1c]">Agenda Médica</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="col-span-1 lg:col-span-8 space-y-6">
          
          <div className="bg-[#f0f5f4] rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#dee3e3] transition-colors text-[#171d1c]">
                <ChevronLeft size={24} />
              </button>
              <h3 className="font-extrabold text-2xl text-[#006b5a] tracking-tight">Outubro, 2023</h3>
              <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#dee3e3] transition-colors text-[#171d1c]">
                <ChevronRight size={24} />
              </button>
            </div>
            <div className="flex bg-[#dee3e3] p-1 rounded-full">
              <button className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all bg-white shadow-sm text-[#006b5a]">Semana</button>
              <button className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all text-[#3d4945] hover:text-[#171d1c]">Dia</button>
              <button className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all text-[#3d4945] hover:text-[#171d1c]">Mês</button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#bcc9c4]/30 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-[#bcc9c4]/30 mb-4 pb-4">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, idx) => {
                const isAtivo = dia === 'Ter';
                const numero = 22 + idx;
                return (
                  <div key={dia} className="text-center group cursor-pointer">
                    <p className="text-[10px] font-bold text-[#3d4945] uppercase tracking-tighter mb-1">{dia}</p>
                    <p className={`w-10 h-10 flex items-center justify-center mx-auto rounded-xl text-lg font-bold transition-colors ${
                      isAtivo 
                        ? 'bg-[#006b5a] text-white shadow-lg shadow-[#006b5a]/30' 
                        : 'text-[#bcc9c4] hover:bg-[#f0f5f4] hover:text-[#171d1c]'
                    }`}>
                      {numero}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              
              <div className="grid grid-cols-[80px_1fr] gap-4 group">
                <div className="text-sm font-bold text-[#3d4945]/60 flex items-start justify-end pt-2">08:00</div>
                <div className="relative py-4 border-t border-dashed border-[#bcc9c4]/50 flex items-center">
                  <div className="bg-[#cce2da] border-l-4 border-[#006b5a] p-4 rounded-xl w-full flex items-center justify-between hover:scale-[1.01] transition-transform cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#006b5a]">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#00342b] leading-none">Ana Beatriz Cavalcanti</p>
                        <p className="text-[11px] text-[#00342b]/70 mt-1 font-medium italic">Retorno Pós-Operatório</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-[#006b5a] text-white text-[10px] font-bold rounded-full uppercase tracking-widest">Confirmado</span>
                      <MoreVertical size={18} className="text-[#00342b]/40" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-4 group">
                <div className="text-sm font-bold text-[#3d4945]/60 flex items-start justify-end pt-2">09:00</div>
                <div className="relative py-4 border-t border-dashed border-[#bcc9c4]/50 flex items-center">
                  <div className="bg-[#c3e8fd] border-l-4 border-[#406375] p-4 rounded-xl w-full flex items-center justify-between hover:scale-[1.01] transition-transform cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#406375]">
                        <Stethoscope size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#083142] leading-none">Marcos Vinícius Silva</p>
                        <p className="text-[11px] text-[#083142]/70 mt-1 font-medium">Primeira Consulta - Enxaqueca</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-[#406375] text-white text-[10px] font-bold rounded-full uppercase tracking-widest">Em Atendimento</span>
                      <MoreVertical size={18} className="text-[#083142]/40" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-4 group">
                <div className="text-sm font-bold text-[#3d4945]/60 flex items-start justify-end pt-2">10:00</div>
                <div className="relative py-4 border-t border-dashed border-[#bcc9c4]/50 flex items-center">
                  <div className="bg-[#dee3e3] border-l-4 border-[#6d7a75] p-4 rounded-xl w-full flex items-center justify-between hover:scale-[1.01] transition-transform cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#6d7a75]">
                        <Hourglass size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#171d1c] leading-none">Helena Rodrigues</p>
                        <p className="text-[11px] text-[#3d4945] mt-1 font-medium">Avaliação de Exames</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-[#6d7a75] text-white text-[10px] font-bold rounded-full uppercase tracking-widest">Aguardando</span>
                      <MoreVertical size={18} className="text-[#3d4945]/40" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-4 group">
                <div className="text-sm font-bold text-[#3d4945]/60 flex items-start justify-end pt-2">11:00</div>
                <div className="relative py-4 border-t border-dashed border-[#bcc9c4]/50 flex items-center">
                  <div className="w-full h-16 border-2 border-dashed border-[#bcc9c4]/50 rounded-xl flex items-center justify-center text-[#3d4945]/50 hover:bg-[#f0f5f4] transition-colors cursor-pointer">
                    <span className="text-xs font-bold uppercase tracking-widest">+ Disponível para agendamento</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-4 space-y-8">
          
          <div className="bg-gradient-to-br from-[#006b5a] to-[#33a68f] p-6 rounded-3xl shadow-xl shadow-[#006b5a]/20 text-white">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Hoje, 24 Out</p>
                <h4 className="text-3xl font-extrabold mt-1">12 Agendamentos</h4>
              </div>
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <CalendarCheck size={24} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs opacity-70">Atendidos</p>
                <p className="text-xl font-bold">04</p>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs opacity-70">Pendentes</p>
                <p className="text-xl font-bold">08</p>
              </div>
            </div>
            <button className="w-full bg-white text-[#006b5a] rounded-2xl py-4 mt-6 font-bold flex items-center justify-center gap-2 hover:bg-[#f5faf9] transition-all active:scale-95 shadow-sm">
              <PlusCircle size={20} />
              Novo Agendamento
            </button>
          </div>

          <div className="bg-[#f0f5f4] rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-[#3d4945] uppercase tracking-widest">Novembro 2023</h4>
              <div className="flex gap-1 text-[#3d4945]">
                <ChevronLeft size={18} className="cursor-pointer hover:text-[#006b5a]" />
                <ChevronRight size={18} className="cursor-pointer hover:text-[#006b5a]" />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, i) => (
                <span key={i} className="text-[10px] font-bold text-[#3d4945]/60 py-1 uppercase">{dia}</span>
              ))}
              
              <span className="text-xs font-medium py-2 text-[#3d4945]/40">29</span>
              <span className="text-xs font-medium py-2 text-[#3d4945]/40">30</span>
              {[1, 2, 3, 4, 5, 6].map(d => (
                <span key={d} className="text-xs font-medium py-2 hover:bg-white rounded-lg cursor-pointer text-[#171d1c]">{d}</span>
              ))}
              <span className="text-xs font-medium py-2 bg-[#006b5a]/10 text-[#006b5a] font-bold rounded-lg cursor-pointer">7</span>
              {[8, 9, 10, 11, 12, 13, 14].map(d => (
                <span key={d} className="text-xs font-medium py-2 hover:bg-white rounded-lg cursor-pointer text-[#171d1c]">{d}</span>
              ))}
            </div>
          </div>

          {/* Status Legend */}
          <div className="bg-white border border-[#bcc9c4]/30 rounded-3xl p-6 shadow-sm">
            <h4 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest mb-4">Legenda de Status</h4>
            <ul className="space-y-3">
              {[
                { cor: 'bg-[#006b5a]', label: 'Confirmado' },
                { cor: 'bg-[#6d7a75]', label: 'Aguardando' },
                { cor: 'bg-[#406375]', label: 'Em Atendimento' },
                { cor: 'bg-[#4f625d]', label: 'Concluído' },
                { cor: 'bg-[#ba1a1a]', label: 'Cancelado' },
                { cor: 'bg-[#3d4945]', label: 'Falta' },
                { cor: 'bg-[#779aad]', label: 'Reposição' },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${item.cor}`}></span>
                  <span className="text-sm font-semibold text-[#3d4945]">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}