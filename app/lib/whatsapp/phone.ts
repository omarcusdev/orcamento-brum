export const toBrazilE164 = (raw: string): string => {
  const digits = raw.replace(/\D/g, "")
  if (digits.length <= 11) return `55${digits}`
  return digits
}

export const digitsOf = (raw: string): string => raw.replace(/\D/g, "")

export const last8 = (raw: string): string => digitsOf(raw).slice(-8)

type ClienteLike = { id: string; nome: string; telefone: string | null }
export type ClienteMatch = { id: string; nome: string } | null

export const matchClienteByPhone = (telefone: string, clientes: ClienteLike[]): ClienteMatch => {
  const alvoE164 = toBrazilE164(telefone)
  const exato = clientes.find((c) => c.telefone && toBrazilE164(c.telefone) === alvoE164)
  if (exato) return { id: exato.id, nome: exato.nome }

  const alvo8 = last8(telefone)
  const porFinal = clientes.find((c) => c.telefone && last8(c.telefone) === alvo8)
  return porFinal ? { id: porFinal.id, nome: porFinal.nome } : null
}
