export const AGENTE_FLAG_KEY = "whatsapp_bot_agente_ativo" as const
export const AGENTE_FAQ_KEY = "whatsapp_bot_agente_faq" as const

// Fail-closed (igual ao bot da etapa 1): só o literal "true" liga.
export const agenteAtivo = (valor: string | null | undefined): boolean =>
  valor?.trim().toLowerCase() === "true"

export const DEFAULT_AGENTE_FAQ = `Horário: todos os dias, 10h às 22h.
Pagamento: Pix, cartão (crédito/débito) e dinheiro na entrega.
Cobertura: RJ e Baixada Fluminense. O endereço exato é confirmado na hora do pedido no site.
Como pedir: pelo site https://www.alfachopp.com.br.`

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export type CardapioItem = {
  nome: string
  volume_litros: number
  descricao: string | null
  preco_avista: number
  preco_segundo_barril: number | null
}

// Cardápio -> bloco de texto pro prompt. Uma linha por item; 2º barril só quando existir.
export const formatCardapio = (itens: CardapioItem[]): string => {
  if (itens.length === 0) return "(Cardápio sem itens disponíveis no momento.)"
  return itens
    .map((i) => {
      const desc = i.descricao ? ` — ${i.descricao}` : ""
      const segundo = i.preco_segundo_barril != null ? ` (2º barril: ${brl(i.preco_segundo_barril)})` : ""
      return `- ${i.nome} ${i.volume_litros}L${desc}: ${brl(i.preco_avista)}${segundo}`
    })
    .join("\n")
}

export type ThreadMsg = { direcao: "entrada" | "saida"; corpo: string }

// Histórico recente -> texto "Cliente:/Atendente:" em ordem cronológica (thread vazia -> "").
export const formatHistorico = (thread: ThreadMsg[]): string =>
  thread.map((m) => `${m.direcao === "entrada" ? "Cliente" : "Atendente"}: ${m.corpo}`).join("\n")

// System prompt: papel + guardrails + cardápio + FAQ. nomeCliente opcional (a coluna
// conversas_whatsapp.nome_exibicao pode vir null) p/ personalizar pelo primeiro nome.
export const buildSystemPrompt = (args: {
  cardapio: string
  faq: string
  nomeCliente?: string | null
}): string => {
  const primeiroNome = args.nomeCliente?.trim().split(" ")[0]
  const saudacaoNome = primeiroNome ? ` O cliente se chama ${primeiroNome} — pode chamar pelo primeiro nome.` : ""
  return `Você é o atendente virtual da ALFA Chopp Delivery no WhatsApp.${saudacaoNome}
Responda em português do Brasil, de forma cordial e breve (2 a 3 frases), em tom de WhatsApp.

REGRAS IMPORTANTES:
- Responda SOMENTE com base nas informações abaixo.
- NUNCA invente preço, prazo, promoção, taxa ou área de entrega. Se a informação não estiver abaixo, NÃO chute: responda algo como "Boa pergunta! Vou confirmar com a equipe e já te respondo por aqui."
- Responda apenas sobre o ALFA Chopp Delivery (chopp, chopeiras, pedidos, entrega). Se perguntarem algo fora desse assunto, redirecione com gentileza para o atendimento, sem entrar no mérito.
- Para fechar o pedido, oriente o cliente a acessar o site https://www.alfachopp.com.br (lá o endereço é validado).
- Não peça nem registre dados pessoais ou de pagamento por aqui.

CARDÁPIO (preços atuais):
${args.cardapio}

INFORMAÇÕES (FAQ):
${args.faq}

Na dúvida, é melhor dizer que vai confirmar com a equipe do que arriscar uma informação errada.`
}
