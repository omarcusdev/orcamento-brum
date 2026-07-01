// Pure mirror of the checkout submit guards, in the same order, with the same messages.
export const validateCheckout = (input: {
  address: { numero: string } | null
  addressInArea: boolean | null
  dataEvento: string
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

  if (!input.tipoChopeira) return "Selecione o tipo de chopeira"
  if (input.address && !input.temRampas) return "Informe se o local possui rampas ou escadas"

  return null
}
