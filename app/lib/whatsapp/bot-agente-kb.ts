import type { ChatMsg } from "./bedrock"

export const AGENTE_FLAG_KEY = "whatsapp_bot_agente_ativo" as const
export const AGENTE_FAQ_KEY = "whatsapp_bot_agente_faq" as const

// Texto que o servidor (whatsapp-api/src/inbound.ts) grava no lugar de mídia (áudio/imagem/etc.),
// já que o bot não baixa nem transcreve mídia. Mantido em sincronia com o EC2 e coberto por teste.
// O em-dash é U+2014 — não redigite à mão, mantenha o literal idêntico ao do EC2.
export const MEDIA_PLACEHOLDER = "[mídia recebida — ver no celular]" as const

// Resposta quando o cliente manda áudio/mídia: o bot não "ouve" nem "vê", então pede texto
// em vez de improvisar uma resposta confusa em cima do placeholder.
export const MIDIA_NAO_SUPORTADA_MSG =
  "Ainda não consigo ouvir áudios por aqui 🙏 Pode me mandar por escrito? Assim te respondo certinho." as const

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

// Histórico cru -> turnos reais user/assistant pro Bedrock, em vez de um único bloco de texto.
// Mandar turnos reais dá ao modelo memória do que ele mesmo já respondeu, o que reduz repetição
// e re-saudações. Sanitiza para as exigências da API Anthropic/Bedrock: o primeiro turno tem que
// ser 'user' (descarta 'assistant' iniciais) e turnos consecutivos do mesmo papel são fundidos
// (a API espera alternância). Imutável.
export const threadToMessages = (thread: ThreadMsg[]): ChatMsg[] =>
  thread.reduce<ChatMsg[]>((acc, m) => {
    const role: ChatMsg["role"] = m.direcao === "entrada" ? "user" : "assistant"
    if (acc.length === 0 && role === "assistant") return acc // sem 'assistant' solto no começo
    const last = acc[acc.length - 1]
    if (last && last.role === role) {
      return [...acc.slice(0, -1), { role, content: `${last.content}\n${m.corpo}` }]
    }
    return [...acc, { role, content: m.corpo }]
  }, [])

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
- NÃO repita o link do site a cada mensagem: se você já enviou o link nesta conversa, não reenvie — só mande de novo se o cliente pedir ou se realmente ajudar.
- Não peça nem registre dados pessoais, documentos (identidade/comprovante) ou dados de pagamento por aqui — isso é tratado no site/na entrega.

CARDÁPIO (preços atuais):
${args.cardapio}

INFORMAÇÕES (FAQ):
${args.faq}

Na dúvida, é melhor dizer que vai confirmar com a equipe do que arriscar uma informação errada.`
}
