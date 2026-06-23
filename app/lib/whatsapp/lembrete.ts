import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { isWhatsappFeatureEnabled } from "./features"
import { logWaError, errInfo } from "./wa-log"
import {
  LEMBRETE_FLAG_KEY,
  LEMBRETE_HORA_KEY,
  LEMBRETE_MSG_KEY,
  DEFAULT_LEMBRETE_MSG,
  parseHora,
  deveEnviarAgora,
  renderLembreteTemplate,
  formatDataBR,
  formatHorario,
} from "./lembrete-message"

export type LembreteRunResult =
  | { skipped: true; reason: "feature_off" | "fora_da_hora" | "erro" }
  | { skipped: false; total: number; enviados: number; falhas: number }

type PedidoLembrete = {
  pedido_id: string
  nome: string | null
  telefone: string | null
  data_evento: string
  horario_evento: string
}

// Lote diario do lembrete de vespera. Acordado pela rota /api/whatsapp/lembrete (pg_cron+pg_net).
// Nunca lanca: a rota sempre responde 200.
export const runLembreteVespera = async (): Promise<LembreteRunResult> => {
  // gate master fail-open, igual FRE-22
  if (!(await isWhatsappFeatureEnabled(LEMBRETE_FLAG_KEY))) {
    return { skipped: true, reason: "feature_off" }
  }

  try {
    const supabase = createServiceClient()

    const { data: cfg, error: cfgErr } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [LEMBRETE_HORA_KEY, LEMBRETE_MSG_KEY])
    if (cfgErr) logWaError("lembrete:erro-config", errInfo(cfgErr))

    const valorDe = (chave: string) => cfg?.find((row) => row.chave === chave)?.valor
    const hora = parseHora(valorDe(LEMBRETE_HORA_KEY))
    const rawMsg = valorDe(LEMBRETE_MSG_KEY)
    const template = rawMsg && rawMsg.trim() ? rawMsg : DEFAULT_LEMBRETE_MSG

    // gate de horario: so envia a partir da hora configurada (>= cobre atraso/pedido novo)
    if (!deveEnviarAgora(hora, new Date())) {
      return { skipped: true, reason: "fora_da_hora" }
    }

    const { data: rows, error: rpcErr } = await supabase.rpc("get_orders_needing_reminder")
    if (rpcErr) logWaError("lembrete:erro-pedidos", errInfo(rpcErr))
    const pedidos = (rows ?? []) as PedidoLembrete[]

    let enviados = 0
    let falhas = 0

    for (const pedido of pedidos) {
      if (!pedido.telefone) {
        logWaError("lembrete:pedido-sem-telefone", { pedidoId: pedido.pedido_id })
        falhas += 1
        continue
      }

      const mensagem = renderLembreteTemplate(template, {
        nome: (pedido.nome ?? "Cliente").split(" ")[0],
        pedido: pedido.pedido_id.slice(0, 8),
        data: formatDataBR(pedido.data_evento),
        horario: formatHorario(pedido.horario_evento),
      })

      const result = await sendWhatsAppMessage(pedido.telefone, mensagem)

      const { error: regErr } = await supabase.rpc("register_whatsapp_message", {
        p_pedido_id: pedido.pedido_id,
        p_tipo: "lembrete",
        p_status: result.ok ? "enviada" : "falha",
      })
      if (regErr) logWaError("lembrete:erro-registro", { pedidoId: pedido.pedido_id, ...errInfo(regErr) })

      if (result.ok) enviados += 1
      else falhas += 1
    }

    return { skipped: false, total: pedidos.length, enviados, falhas }
  } catch (err) {
    logWaError("lembrete:erro-inesperado", errInfo(err))
    return { skipped: true, reason: "erro" }
  }
}
