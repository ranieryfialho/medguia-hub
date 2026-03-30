import { createClient } from '@/lib/supabase/server'
import { Users, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: avaliacoes } = await supabase
    .from('atendimentos')
    .select('*')
    .eq('tipo', 'avaliacao')

  const totalAvaliacoes = avaliacoes?.length || 0
  const convertidas = avaliacoes?.filter(a => a.fechou).length || 0
  const perdidas = totalAvaliacoes - convertidas
  
  const taxaConversao = totalAvaliacoes > 0 
    ? Math.round((convertidas / totalAvaliacoes) * 100) 
    : 0

  const motivosMap = avaliacoes
    ?.filter(a => !a.fechou && a.motivo_nao_fechamento)
    .reduce((acc, curr) => {
      const motivo = curr.motivo_nao_fechamento!
      acc[motivo] = (acc[motivo] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const topMotivos = Object.entries(motivosMap || {} as Record<string, number>)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard Gerencial</h1>
        <p className="text-sm text-text-secondary mt-1">
          Acompanhe os indicadores do funil de conversão em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Avaliações Realizadas</h3>
            <Users size={18} className="text-primary-500" />
          </div>
          <p className="text-3xl font-semibold text-text-primary">{totalAvaliacoes}</p>
        </div>
        
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Tratamentos Fechados</h3>
            <TrendingUp size={18} className="text-[#25D366]" />
          </div>
          <p className="text-3xl font-semibold text-text-primary">{convertidas}</p>
        </div>
        
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Taxa de Conversão</h3>
            <BarChart3 size={18} className="text-primary-500" />
          </div>
          <p className="text-3xl font-semibold text-primary-500">{taxaConversao}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4 border-b border-border pb-3">
            <AlertCircle size={16} className="text-error" /> Principais Motivos de Perda
          </h3>
          
          {totalAvaliacoes === 0 ? (
            <p className="text-sm text-text-tertiary">Ainda não há avaliações registradas.</p>
          ) : perdidas === 0 ? (
            <p className="text-sm text-[#25D366] font-medium">Excelente! Nenhuma perda registrada.</p>
          ) : (
            <div className="space-y-4">
              {topMotivos.map(([motivo, quantidade]: any) => (
                <div key={motivo}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-secondary font-medium">{motivo}</span>
                    <span className="text-text-primary font-bold">{quantidade} ({Math.round((quantidade / perdidas) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-page rounded-full h-2">
                    <div 
                      className="bg-error h-2 rounded-full" 
                      style={{ width: `${(quantidade / perdidas) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}