import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { configValue } from "./config"
import { logWa, logWaError, errInfo } from "./wa-log"
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
      logWaError("saudacao:erro-config", errInfo(cfgErr))
      return // fail-closed: sem config confiável, não saúda
    }

    const valorDe = (chave: string) => configValue(cfg, chave)
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
      logWaError("saudacao:erro-conversa", errInfo(convErr))
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
      logWaError("saudacao:erro-ultima-msg", errInfo(antErr))
      return // fail-closed: sem leitura confiável da sessão, não saúda
    }

    if (!isSessaoNova(anterior?.ocorrida_em ?? null, new Date(), janelaHoras)) return

    const result = await sendWhatsAppMessage(telefone, mensagem)
    logWa("saudacao:decisao", { tel4: telefone.slice(-4), waMessageId, decisao: result.ok ? "enviada" : "falha-envio" })
    if (!result.ok) {
      logWaError("saudacao:envio-falhou", { tel4: telefone.slice(-4), waMessageId, erro: result.error })
    }
  } catch (err) {
    logWaError("saudacao:erro-inesperado", errInfo(err))
  }
}
