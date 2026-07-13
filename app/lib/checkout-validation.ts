export const MIN_LEAD_TIME_HOURS = 24

export const minLeadTimeMessage = `Pedidos exigem no minimo ${MIN_LEAD_TIME_HOURS}h de antecedencia`

// Brasil não tem horário de verão desde 2019, então o offset é fixo -03:00.
// Ancorar aqui torna o cálculo determinístico independente do timezone do runtime
// (browser do cliente em BRT; server na Vercel em UTC).
const BRAZIL_UTC_OFFSET = "-03:00"

// true quando o instante do evento (data + horário, horário de parede BR) está a
// menos de MIN_LEAD_TIME_HOURS de now. Fronteira exata (== 24h) retorna false.
export const isBeforeMinLeadTime = (
  dataEvento: string,
  horarioEvento: string,
  now: Date = new Date(),
): boolean => {
  const eventAt = new Date(`${dataEvento}T${horarioEvento}:00${BRAZIL_UTC_OFFSET}`)
  return eventAt.getTime() - now.getTime() < MIN_LEAD_TIME_HOURS * 3_600_000
}

// Pure mirror of the checkout submit guards, in the same order, with the same messages.
export const validateCheckout = (input: {
  address: { numero: string } | null
  addressInArea: boolean | null
  dataEvento: string
  horarioEvento: string
  tipoChopeira: "gelo" | "eletrica" | ""
  temRampas: "sim" | "nao" | ""
  now?: Date
}): string | null => {
  if (!input.address) return "Selecione um endereco valido"
  if (input.addressInArea === false) return "Infelizmente nao atendemos essa regiao"

  const eventDate = new Date(input.dataEvento + "T00:00:00")
  const today = new Date(input.now ?? new Date())
  today.setHours(0, 0, 0, 0)
  if (eventDate < today) return "A data do evento nao pode ser no passado"

  if (input.horarioEvento && isBeforeMinLeadTime(input.dataEvento, input.horarioEvento, input.now))
    return minLeadTimeMessage

  if (!input.tipoChopeira) return "Selecione o tipo de chopeira"
  if (input.address && !input.temRampas) return "Informe se o local possui rampas ou escadas"

  return null
}
