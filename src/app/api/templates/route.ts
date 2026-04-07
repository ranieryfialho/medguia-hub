import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: templates, error } = await supabase
      .from('templates_mensagem')
      .select('id, nome, conteudo')
      .order('criado_em', { ascending: false })

    if (error) {
      console.error('Erro ao buscar templates:', error.message)
      return Response.json(
        { error: 'Erro ao buscar templates' },
        { status: 500 }
      )
    }

    return Response.json({ templates: templates ?? [] })
  } catch (error) {
    console.error('Erro na API de templates:', error)
    return Response.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
