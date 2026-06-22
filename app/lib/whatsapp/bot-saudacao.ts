import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import {
  BOT_SAUDACAO_FLAG_KEY,
  BOT_SAUDACAO_MSG_KEY,
  BOT_SAUDACAO_JANELA_KEY,
  DEFAULT_BOT_SAUDACAO_MSG,
  botSaudacaoAtivo,
  parseJanelaHoras,
  isSessaoNova,
} from "./bot-saudacao-message"

// Saudação automática do bot. Chamada via after() na rota inbound, só para mensagens de ENTRADA.
// Nunca lança: a rota já respondeu 200 pro EC2. Fail-closed em todos os ramos ambíguos.
export const maybeSendBotSaudacao = async (
  telefone: string,
  waMessageId: string,
): Promise<void> => {
  try {
    const supabase = createServiceClient()

    const { data: cfg, error: cfgErr } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [BOT_SAUDACAO_FLAG_KEY, BOT_SAUDACAO_MSG_KEY, BOT_SAUDACAO_JANELA_KEY])
    if (cfgErr) {
      console.error("[whatsapp] erro lendo config do bot:", cfgErr)
      return // fail-closed: sem config confiável, não saúda
    }

    const valorDe = (chave: string) => cfg?.find((row) => row.chave === chave)?.valor
    if (!botSaudacaoAtivo(valorDe(BOT_SAUDACAO_FLAG_KEY))) return // só 'true' liga

    const janelaHoras = parseJanelaHoras(valorDe(BOT_SAUDACAO_JANELA_KEY))
    const rawMsg = valorDe(BOT_SAUDACAO_MSG_KEY)
    const mensagem = rawMsg && rawMsg.trim() ? rawMsg : DEFAULT_BOT_SAUDACAO_MSG

    // A conversa já foi criada/atualizada pelo register_inbound_whatsapp (telefone é unique, E.164).
    const { data: conversa, error: convErr } = await supabase
      .from("conversas_whatsapp")
      .select("id")
      .eq("telefone", telefone)
      .maybeSingle()
    if (convErr) {
      console.error("[whatsapp] erro buscando conversa do bot:", convErr)
      return // fail-closed
    }
    if (!conversa) return

    // Mensagem mais recente da conversa EXCLUINDO a que acabou de chegar. Todo registro tem
    // wa_message_id (o RPC register_inbound_whatsapp o exige; a coluna é nullable só no schema),
    // então o .neq não descarta linhas por NULL.
    const { data: anterior, error: antErr } = await supabase
      .from("mensagens_conversa_whatsapp")
      .select("ocorrida_em")
      .eq("conversa_id", conversa.id)
      .neq("wa_message_id", waMessageId)
      .order("ocorrida_em", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (antErr) {
      console.error("[whatsapp] erro buscando última mensagem do bot:", antErr)
      return // fail-closed: sem leitura confiável da sessão, não saúda
    }

    if (!isSessaoNova(anterior?.ocorrida_em ?? null, new Date(), janelaHoras)) return

    const result = await sendWhatsAppMessage(telefone, mensagem)
    console.info(
      "[whatsapp] saudacao:decisao",
      JSON.stringify({ tel4: telefone.slice(-4), waMessageId, decisao: result.ok ? "enviada" : "falha-envio" }),
    )
    if (!result.ok) {
      console.error("[whatsapp] falha ao enviar saudação do bot:", telefone.slice(-4), result.error)
    }
  } catch (err) {
    console.error("[whatsapp] erro inesperado na saudação do bot:", err)
  }
}
