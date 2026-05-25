function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function somenteRg(valor: string) {
  return valor.toUpperCase().replace(/[^0-9X]/g, '')
}

export function formatarCPF(valor: string | null | undefined) {
  const digitos = somenteDigitos(valor ?? '').slice(0, 11)

  if (digitos.length <= 3) return digitos
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`
  if (digitos.length <= 9) return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`
}

export function formatarTelefone(valor: string | null | undefined) {
  const digitos = somenteDigitos(valor ?? '').slice(0, 11)

  if (!digitos) return ''
  if (digitos.length <= 2) return `(${digitos}`
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`

  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  }

  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

export function formatarRG(valor: string | null | undefined) {
  const rg = somenteRg(valor ?? '').slice(0, 9)

  if (rg.length <= 2) return rg
  if (rg.length <= 5) return `${rg.slice(0, 2)}.${rg.slice(2)}`
  if (rg.length <= 8) return `${rg.slice(0, 2)}.${rg.slice(2, 5)}.${rg.slice(5)}`
  return `${rg.slice(0, 2)}.${rg.slice(2, 5)}.${rg.slice(5, 8)}-${rg.slice(8)}`
}

export function mascararCPFInput(valor: string) {
  return formatarCPF(valor)
}

export function mascararTelefoneInput(valor: string) {
  return formatarTelefone(valor)
}

export function mascararRGInput(valor: string) {
  return formatarRG(valor)
}
