import type { WhatsappFeatureKey } from "./features"

// Tipado como WhatsappFeatureKey: um rename em WHATSAPP_FEATURE_KEYS quebra aqui (compile-time),
// garantindo que esta chave continua igual ao gate lido pela rota/orquestrador.
export const LEMBRETE_FLAG_KEY: WhatsappFeatureKey = "whatsapp_lembrete_vespera_ativo"
export const LEMBRETE_HORA_KEY = "whatsapp_lembrete_vespera_hora" as const
export const LEMBRETE_MSG_KEY = "whatsapp_lembrete_vespera_msg" as const

export const DEFAULT_LEMBRETE_HORA = 9
export const DEFAULT_LEMBRETE_MSG =
  "Oi {nome}! 🍻 Passando pra lembrar: amanhã ({data}) às {horario} entregamos seu chopp do pedido #{pedido}. Qualquer coisa, é só chamar por aqui!"

// tokens: {nome} (1o nome), {pedido} (id curto 8 chars), {data} (DD/MM), {horario} (HH:MM)
export const renderLembreteTemplate = (
  template: string,
  vars: { nome: string; pedido: string; data: string; horario: string },
): string =>
  template
    .replaceAll("{nome}", vars.nome)
    .replaceAll("{pedido}", vars.pedido)
    .replaceAll("{data}", vars.data)
    .replaceAll("{horario}", vars.horario)

// data_evento chega como 'YYYY-MM-DD' (string) -> 'DD/MM' sem depender de fuso
export const formatDataBR = (iso: string): string => {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

// horario_evento chega como 'HH:MM:SS' -> 'HH:MM'
export const formatHorario = (t: string): string => t.slice(0, 5)

// hora atual no fuso de Sao Paulo (0-23); hourCycle h23 evita "24" na meia-noite
export const horaEmSaoPaulo = (now: Date): number =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  )

// gate do horario: envia no horario configurado ou em qualquer hora seguinte do mesmo dia
export const deveEnviarAgora = (horaConfigurada: number, now: Date): boolean =>
  horaEmSaoPaulo(now) >= horaConfigurada

// normaliza a hora lida da config (string) para 0-23 inteiro; default 9 se invalida.
// Number(null) == 0 e Number("") == 0, então guarda-se com a checagem de string vazia/nula
// antes de converter — sem isso ambos passariam no range e devolveriam 0 incorretamente.
export const parseHora = (valor: string | null | undefined): number => {
  if (!valor || valor.trim() === "") return DEFAULT_LEMBRETE_HORA
  const n = Number(valor)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : DEFAULT_LEMBRETE_HORA
}
