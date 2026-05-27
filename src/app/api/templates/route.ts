import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria') ?? 'confirmacao'

    const { data: templates, error } = await supabase
      .from('templates_mensagem')
      .select('id, nome, conteudo')
      .eq('categoria', categoria)
      .or(`criado_por.is.null,criado_por.eq.${user.id}`)
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
