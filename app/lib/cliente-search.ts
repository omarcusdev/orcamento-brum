// Constrói a string `.or()` do PostgREST para a busca de cliente (nome / telefone / CPF).
//
// IMPORTANTE: nunca interpolar o texto CRU do usuário numa string `.or()` do PostgREST. Os caracteres
// `,` `(` `)` são sintaxe do parser (separador de condições e agrupamento). Um telefone no formato
// mascarado brasileiro — "(21) 99999-8888" — jogado cru no filtro de nome corrompe a expressão
// inteira: as condições de telefone/CPF são reinterpretadas e a busca retorna 0 EM SILÊNCIO (sem 400).
// Sintoma reportado pelo cliente: "não busca pelo telefone". Reproduzido contra o PostgREST de prod.
//
// Regra: telefone e CPF sempre por dígitos (via telefone_digits, a coluna gerada só-dígitos). O filtro
// de nome só entra quando a query tem letras — e ainda com os metacaracteres removidos como defesa.
export const buildClienteSearchOr = (query: string): string | null => {
  const trimmed = query.trim()
  if (trimmed.length < 2) return null

  const digits = trimmed.replace(/\D/g, "")
  const filters: string[] = []

  if (/\p{L}/u.test(trimmed)) {
    const nameTerm = trimmed.replace(/[,()]/g, " ").trim()
    if (nameTerm.length >= 2) filters.push(`nome.ilike.%${nameTerm}%`)
  }

  if (digits.length >= 2) {
    filters.push(`telefone_digits.ilike.%${digits}%`)
    filters.push(`cpf.ilike.%${digits}%`)
  }

  return filters.length > 0 ? filters.join(",") : null
}
