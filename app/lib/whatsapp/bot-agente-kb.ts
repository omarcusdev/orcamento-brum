import type { ChatMsg } from "./bedrock"
import { formatBRL } from "@/lib/format"

export const AGENTE_FLAG_KEY = "whatsapp_bot_agente_ativo" as const
export const AGENTE_FAQ_KEY = "whatsapp_bot_agente_faq" as const

// Texto genérico que o EC2 (whatsapp-api/src/inbound.ts) gravava no lugar de QUALQUER mídia antes
// da Task B3. Hoje o EC2 grava um placeholder rotulado por tipo (LABELED_MEDIA_PLACEHOLDERS abaixo);
// este literal genérico só continua existindo para reconhecer linhas HISTÓRICAS já gravadas no banco.
// O em-dash é U+2014 — não redigite à mão, mantenha o literal idêntico ao que está no banco.
export const MEDIA_PLACEHOLDER = "[mídia recebida — ver no celular]" as const

// Placeholders que o EC2 grava por tipo de mídia desde a Task B3 (mediaPlaceholder() e
// otherContentPlaceholder() em whatsapp-api/src/inbound.ts) quando a mensagem não tem legenda.
// Espelhado à mão — mantenha os dois arquivos em sincronia se um dos lados mudar o texto/emoji.
export const LABELED_MEDIA_PLACEHOLDERS = [
  "🖼️ Imagem recebida",
  "🎤 Áudio recebido",
  "🎵 Áudio recebido",
  "🎥 Vídeo recebido",
  "📄 Documento recebido",
  "💟 Figurinha recebida",
  "📍 Localização recebida",
  "👤 Contato recebido",
  "📊 Enquete recebida",
] as const

// Sinal por TEXTO de que `corpo` é um placeholder de mídia (não a mensagem real do cliente): o
// literal genérico histórico OU qualquer um dos rotulados por tipo. Comparação por lista exata (não
// substring solta) de propósito — um cliente pode escrever "recebido" numa frase de verdade
// ("já recebido, valeu!") e isso não deve ser tratado como mídia. Este é só UM dos dois sinais que
// ehMidia (bot-agente.ts) combina; o outro é o `midiaTipo` estruturado, quando disponível.
export const ehPlaceholderDeMidia = (corpo: string): boolean =>
  corpo === MEDIA_PLACEHOLDER || (LABELED_MEDIA_PLACEHOLDERS as readonly string[]).includes(corpo)

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
      const segundo = i.preco_segundo_barril != null ? ` (2º barril: ${formatBRL(i.preco_segundo_barril)})` : ""
      return `- ${i.nome} ${i.volume_litros}L${desc}: ${formatBRL(i.preco_avista)}${segundo}`
    })
    .join("\n")
}

export type ThreadMsg = { direcao: "entrada" | "saida"; corpo: string }

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
