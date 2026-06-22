import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { askClaude } from "./bedrock"
import {
  AGENTE_FLAG_KEY,
  AGENTE_FAQ_KEY,
  DEFAULT_AGENTE_FAQ,
  MEDIA_PLACEHOLDER,
  MIDIA_NAO_SUPORTADA_MSG,
  agenteAtivo,
  formatCardapio,
  threadToMessages,
  buildSystemPrompt,
  type ThreadMsg,
} from "./bot-agente-kb"

// Telefone mascarado nos logs (só os últimos 4 dígitos) — privacidade/LGPD.
const last4 = (t: string) => t.slice(-4)

// Envia uma resposta e, se enviou, grava como "saida" (insert direto; este EC2 não devolve eco).
// Usado tanto pela resposta do agente quanto pela resposta enlatada de mídia.
const replyAndStore = async (
  supabase: ReturnType<typeof createServiceClient>,
  conversaId: string,
  telefone: string,
  waMessageId: string,
  texto: string,
  origem: "agente" | "midia",
): Promise<void> => {
  const result = await sendWhatsAppMessage(telefone, texto)
  console.info(
    "[whatsapp] agente:envio",
    JSON.stringify({ tel4: last4(telefone), waMessageId, origem, sendOk: result.ok, replyLen: texto.length }),
  )
  if (!result.ok) {
    console.error("[whatsapp] falha ao enviar resposta do agente:", last4(telefone), result.error)
    return
  }
  const { error: insErr } = await supabase.from("mensagens_conversa_whatsapp").insert({
    conversa_id: conversaId,
    wa_message_id: `agente-${crypto.randomUUID()}`,
    direcao: "saida",
    corpo: texto,
    ocorrida_em: new Date().toISOString(),
  })
  if (insErr) console.error("[whatsapp] erro gravando resposta do agente:", insErr)
}

// A coluna do nome do produto é "marca" (schema migração 001); CardapioItem usa "nome".
// preco_* são numeric no Postgres -> o PostgREST devolve como STRING ("380.00") -> coage abaixo.
type ProdutoRow = {
  marca: string
  volume_litros: number
  descricao: string | null
  preco_avista: number | string
  preco_segundo_barril: number | string | null
}

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
    const ehMidia = corpo === MEDIA_PLACEHOLDER
    console.info(
      "[whatsapp] agente:ativacao",
      JSON.stringify({ tel4: last4(telefone), waMessageId, ehMidia, corpoLen: corpo.length }),
    )

    const rawFaq = valorDe(AGENTE_FAQ_KEY)
    const faq = rawFaq && rawFaq.trim() ? rawFaq : DEFAULT_AGENTE_FAQ

    const { data: conversa } = await supabase
      .from("conversas_whatsapp")
      .select("id, nome_exibicao")
      .eq("telefone", telefone)
      .maybeSingle()
    if (!conversa) {
      console.info("[whatsapp] agente:sem-conversa", JSON.stringify({ tel4: last4(telefone), waMessageId }))
      return { handled: true }
    }

    // Mídia (áudio/imagem/...): o bot não baixa nem transcreve a mídia — em vez de improvisar
    // em cima do placeholder de texto, responde pedindo texto. (Wave 2: diferenciar por tipo.)
    if (ehMidia) {
      await replyAndStore(supabase, conversa.id, telefone, waMessageId, MIDIA_NAO_SUPORTADA_MSG, "midia")
      return { handled: true }
    }

    const { data: threadDesc } = await supabase
      .from("mensagens_conversa_whatsapp")
      .select("direcao, corpo, ocorrida_em")
      .eq("conversa_id", conversa.id)
      .order("ocorrida_em", { ascending: false })
      .limit(8)
    const thread: ThreadMsg[] = ((threadDesc ?? []) as { direcao: "entrada" | "saida"; corpo: string }[])
      .map((m) => ({ direcao: m.direcao, corpo: m.corpo }))
      .reverse() // cronológico

    const { data: produtos, error: prodErr } = await supabase
      .from("produtos")
      .select("marca, volume_litros, descricao, preco_avista, preco_segundo_barril")
      .eq("ativo", true)
      .order("marca")
    if (prodErr) console.error("[whatsapp] erro lendo cardápio do agente:", prodErr)

    const cardapio = formatCardapio(
      ((produtos ?? []) as ProdutoRow[]).map((p) => ({
        nome: p.marca,
        volume_litros: p.volume_litros,
        descricao: p.descricao,
        preco_avista: Number(p.preco_avista),
        preco_segundo_barril: p.preco_segundo_barril != null ? Number(p.preco_segundo_barril) : null,
      })),
    )
    const system = buildSystemPrompt({ cardapio, faq, nomeCliente: conversa.nome_exibicao })

    // Turnos reais user/assistant (não um bloco de texto achatado) -> o modelo lembra o que já
    // respondeu, reduzindo repetição/re-saudação. Fallback p/ a msg atual se o histórico vier vazio.
    const messages = threadToMessages(thread)
    const finalMessages = messages.length > 0 ? messages : [{ role: "user" as const, content: corpo }]
    console.info(
      "[whatsapp] agente:prompt",
      JSON.stringify({ tel4: last4(telefone), waMessageId, threadMsgs: thread.length, turnos: finalMessages.length, systemLen: system.length }),
    )

    const t0 = Date.now()
    const reply = await askClaude(system, finalMessages)
    console.info(
      "[whatsapp] agente:resultado",
      JSON.stringify({ tel4: last4(telefone), waMessageId, decisao: reply ? "respondeu" : "silencio", replyLen: reply?.length ?? 0, bedrockMs: Date.now() - t0 }),
    )
    if (!reply) return { handled: true } // erro/timeout/vazio -> silêncio

    await replyAndStore(supabase, conversa.id, telefone, waMessageId, reply, "agente")
    return { handled: true }
  } catch (err) {
    console.error("[whatsapp] erro inesperado no agente:", err)
    // erro inesperado com a flag possivelmente on: handled:true evita uma saudação dobrada por cima.
    return { handled: true }
  }
}
