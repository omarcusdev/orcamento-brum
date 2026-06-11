import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { askClaude } from "./bedrock"
import {
  AGENTE_FLAG_KEY,
  AGENTE_FAQ_KEY,
  DEFAULT_AGENTE_FAQ,
  agenteAtivo,
  formatCardapio,
  formatHistorico,
  buildSystemPrompt,
  type CardapioItem,
  type ThreadMsg,
} from "./bot-agente-kb"

// Atendente IA. Chamado via after() na rota inbound, só para ENTRADA. Nunca lança; fail-closed.
// Retorna { handled: true } sempre que a flag do agente está ligada (tenha enviado ou não) —
// assim o coordenador suprime a saudação rule-based. { handled: false } = flag off (ou config
// ilegível) => o coordenador cai na saudação da etapa 1.
export const maybeReplyWithAgent = async (
  telefone: string,
  waMessageId: string,
  corpo: string,
): Promise<{ handled: boolean }> => {
  try {
    const supabase = createServiceClient()

    const { data: cfg, error: cfgErr } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [AGENTE_FLAG_KEY, AGENTE_FAQ_KEY])
    if (cfgErr) {
      console.error("[whatsapp] erro lendo config do agente:", cfgErr)
      return { handled: false } // não dá pra afirmar que o agente está on -> deixa a saudação assumir
    }

    const valorDe = (chave: string) => cfg?.find((row) => row.chave === chave)?.valor
    if (!agenteAtivo(valorDe(AGENTE_FLAG_KEY))) return { handled: false }

    // Daqui pra baixo o agente "é dono" do turno (handled:true), mesmo que fique em silêncio.
    const rawFaq = valorDe(AGENTE_FAQ_KEY)
    const faq = rawFaq && rawFaq.trim() ? rawFaq : DEFAULT_AGENTE_FAQ

    const { data: conversa } = await supabase
      .from("conversas_whatsapp")
      .select("id, nome_exibicao")
      .eq("telefone", telefone)
      .maybeSingle()
    if (!conversa) return { handled: true }

    const { data: threadDesc } = await supabase
      .from("mensagens_conversa_whatsapp")
      .select("direcao, corpo, ocorrida_em")
      .eq("conversa_id", conversa.id)
      .order("ocorrida_em", { ascending: false })
      .limit(8)
    const thread: ThreadMsg[] = ((threadDesc ?? []) as { direcao: "entrada" | "saida"; corpo: string }[])
      .map((m) => ({ direcao: m.direcao, corpo: m.corpo }))
      .reverse() // cronológico

    const { data: produtos } = await supabase
      .from("produtos")
      .select("nome, volume_litros, descricao, preco_avista, preco_segundo_barril")
      .eq("ativo", true)
      .order("nome")

    const cardapio = formatCardapio((produtos ?? []) as CardapioItem[])
    const system = buildSystemPrompt({ cardapio, faq, nomeCliente: conversa.nome_exibicao })

    const historico = formatHistorico(thread)
    const userContent = historico
      ? `Conversa recente:\n${historico}\n\nResponda à última mensagem do cliente, seguindo as regras.`
      : corpo

    const reply = await askClaude(system, [{ role: "user", content: userContent }])
    if (!reply) return { handled: true } // erro/timeout/vazio -> silêncio

    const result = await sendWhatsAppMessage(telefone, reply)
    if (!result.ok) {
      console.error("[whatsapp] falha ao enviar resposta do agente:", telefone, result.error)
      return { handled: true }
    }

    // grava a resposta como saida (insert direto: NÃO usa o RPC de inbound, então não toca no
    // cliente_id da conversa; este EC2 não devolve eco, por isso gravamos nós mesmos).
    const { error: insErr } = await supabase.from("mensagens_conversa_whatsapp").insert({
      conversa_id: conversa.id,
      wa_message_id: `agente-${crypto.randomUUID()}`,
      direcao: "saida",
      corpo: reply,
      ocorrida_em: new Date().toISOString(),
    })
    if (insErr) console.error("[whatsapp] erro gravando resposta do agente:", insErr)

    return { handled: true }
  } catch (err) {
    console.error("[whatsapp] erro inesperado no agente:", err)
    // erro inesperado com a flag possivelmente on: handled:true evita uma saudação dobrada por cima.
    return { handled: true }
  }
}
