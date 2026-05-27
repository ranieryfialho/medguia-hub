import {
  Body,
  Head,
  Html,
  Img,
  Preview,
} from '@react-email/components'
import * as React from 'react'

interface ConfirmacaoConsultaProps {
  pacienteNome: string
  tipo: string
  data: string
  hora: string
  profissional: string
  mensagem: string
  assunto: string
  logoSrc?: string
  linkConfirmacao?: string
}

export function ConfirmacaoConsulta({
  pacienteNome,
  tipo,
  data,
  hora,
  profissional,
  mensagem,
  assunto,
  logoSrc,
  linkConfirmacao,
}: ConfirmacaoConsultaProps) {
  // Separa linhas, tratando {{link_confirmacao}} como elemento especial
  const linhas = mensagem.split('\n')

  return (
    <Html>
      <Head>
        <meta charSet="UTF-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      </Head>
      <Preview>{assunto}</Preview>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }}>

        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={{ backgroundColor: '#f9fafb' }}>
          <tr>
            <td align="center" style={{ padding: '40px 16px' }}>

              <table width="600" cellPadding={0} cellSpacing={0} role="presentation" style={{ maxWidth: '600px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>

                {/* Cabeçalho */}
                <tr>
                  <td align="center" style={{ padding: '32px 32px 16px 32px' }}>
                    {logoSrc && (
                      <Img
                        src={logoSrc}
                        alt="Instituto FOT"
                        width={56}
                        height={56}
                        style={{ display: 'block', margin: '0 auto 12px auto' }}
                      />
                    )}
                    <p style={{ color: '#006b5a', fontSize: '22px', fontWeight: 'bold', margin: 0, letterSpacing: '-0.5px' }}>Instituto FOT</p>
                    <p style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0 0' }}>Fisioterapia e Osteopatia</p>
                  </td>
                </tr>

                {/* Linha divisória */}
                <tr>
                  <td style={{ padding: '0 32px' }}>
                    <div style={{ height: '2px', backgroundColor: '#006b5a', borderRadius: '2px' }} />
                  </td>
                </tr>

                {/* Bloco de detalhes da consulta */}
                <tr>
                  <td style={{ padding: '24px 32px 0 32px' }}>
                    <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={{ backgroundColor: '#f0fdf9', borderRadius: '12px', borderLeft: '4px solid #006b5a' }}>
                      <tr>
                        <td style={{ padding: '20px 24px' }}>
                          <p style={{ color: '#134e4a', fontSize: '13px', fontWeight: '600', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Dados do Agendamento
                          </p>
                          <p style={{ color: '#1f2937', fontSize: '14px', lineHeight: '1.7', margin: '0 0 6px 0' }}>
                            <strong>Paciente:</strong> {pacienteNome}
                          </p>
                          <p style={{ color: '#1f2937', fontSize: '14px', lineHeight: '1.7', margin: '0 0 6px 0' }}>
                            <strong>Serviço:</strong> {tipo}
                          </p>
                          <p style={{ color: '#1f2937', fontSize: '14px', lineHeight: '1.7', margin: '0 0 6px 0' }}>
                            <strong>Data:</strong> {data} às {hora}
                          </p>
                          <p style={{ color: '#1f2937', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
                            <strong>Profissional:</strong> {profissional}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                {/* Mensagem personalizada */}
                <tr>
                  <td style={{ padding: '24px 32px 0 32px' }}>
                    {linhas.map((linha, i) => {
                      if (linha.trim() === '{{link_confirmacao}}') return null
                      if (linha.trim() === '') return null
                      return (
                        <p key={i} style={{ color: '#374151', fontSize: '15px', lineHeight: '1.7', margin: '0 0 12px 0' }}>
                          {linha}
                        </p>
                      )
                    })}
                  </td>
                </tr>

                {/* Botão de confirmação — sempre visível quando há link */}
                {linkConfirmacao && (
                  <tr>
                    <td style={{ padding: '24px 32px 0 32px' }}>
                      <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
                        <tr>
                          <td align="center">
                            <a
                              href={linkConfirmacao}
                              style={{
                                display: 'inline-block',
                                backgroundColor: '#006b5a',
                                color: '#ffffff',
                                fontSize: '15px',
                                fontWeight: 'bold',
                                textDecoration: 'none',
                                padding: '14px 32px',
                                borderRadius: '8px',
                              }}
                            >
                              ✅ Confirmar minha consulta
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                )}

                {/* Rodapé */}
                <tr>
                  <td align="center" style={{ borderTop: '1px solid #f3f4f6', padding: '20px 32px', marginTop: '24px' }}>
                    <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>
                      Instituto FOT • Fisioterapia e Osteopatia
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>

      </Body>
    </Html>
  )
}
