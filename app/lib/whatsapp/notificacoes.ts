import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { isWhatsappFeatureEnabled, parseFlag } from "./features"
import { logWaError, errInfo } from "./wa-log"
import {
  isNotifyStatus,
  resolveStatusMessage,
  statusFlagKey,
  statusMsgKey,
} from "./status-messages"
import { buildConfirmationMessage } from "./confirmacao-message"

export const sendCustomerWhatsAppConfirmation = async (pedidoId: string) => {
  if (!(await isWhatsappFeatureEnabled("whatsapp_confirmacao_ativo"))) return
  try {
    const supabase = createServiceClient()

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("data_evento, horario_evento, clientes(nome, telefone)")
      .eq("id", pedidoId)
      .single()

    if (pedidoErr || !pedido) {
      logWaError("confirmacao:pedido-nao-encontrado", { pedidoId, ...errInfo(pedidoErr) })
      return
    }

    const cliente = Array.isArray(pedido.clientes) ? pedido.clientes[0] : pedido.clientes
    const telefone = cliente?.telefone
    if (!telefone) {
      logWaError("confirmacao:cliente-sem-telefone", { pedidoId })
      return
    }

    const { data: rawItems } = await supabase
      .from("pedido_itens")
      .select("quantidade, produtos(marca, volume_litros)")
      .eq("pedido_id", pedidoId)

    const itens = (rawItems ?? []).map((row) => {
      const produto = Array.isArray(row.produtos) ? row.produtos[0] : row.produtos
      return {
        quantidade: row.quantidade,
        marca: produto?.marca ?? "Item",
        volume: produto?.volume_litros ?? 0,
      }
    })

    const mensagem = buildConfirmationMessage({
      clienteNome: cliente?.nome ?? "Cliente",
      pedidoId,
      itens,
      dataEvento: pedido.data_evento,
      horarioEvento: pedido.horario_evento,
    })

    const result = await sendWhatsAppMessage(telefone, mensagem)

    await supabase.rpc("register_whatsapp_message", {
      p_pedido_id: pedidoId,
      p_tipo: "confirmacao",
      p_status: result.ok ? "enviada" : "falha",
    })
  } catch (err) {
    logWaError("confirmacao:erro-inesperado", errInfo(err))
  }
}

// Mensagem automatica quando o pedido entra em em_rota/entregue/cancelado/recolhido.
// Roda via after() nas server actions de status — nunca bloqueia a mudanca de status.
export const sendCustomerWhatsAppStatusUpdate = async (pedidoId: string, novoStatus: string) => {
  if (!isNotifyStatus(novoStatus)) return
  if (!(await isWhatsappFeatureEnabled("whatsapp_status_entrega_ativo"))) return
  try {
    const supabase = createServiceClient()

    const { data: cfgRows } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [statusFlagKey(novoStatus), statusMsgKey(novoStatus)])

    const statusOn = parseFlag(cfgRows?.find((r) => r.chave === statusFlagKey(novoStatus))?.valor)
    const template = cfgRows?.find((r) => r.chave === statusMsgKey(novoStatus))?.valor ?? null

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("clientes(nome, telefone)")
      .eq("id", pedidoId)
      .single()

    if (pedidoErr || !pedido) {
      logWaError("status:pedido-nao-encontrado", { pedidoId, ...errInfo(pedidoErr) })
      return
    }

    const cliente = Array.isArray(pedido.clientes) ? pedido.clientes[0] : pedido.clientes
    const telefone = cliente?.telefone
    if (!telefone) {
      logWaError("status:cliente-sem-telefone", { pedidoId })
      return
    }

    const decision = resolveStatusMessage(novoStatus, {
      statusOn,
      template,
      nome: (cliente?.nome ?? "Cliente").split(" ")[0],
      pedido: pedidoId.slice(0, 8),
    })
    if (decision.skip) return

    const tipo = `status_${novoStatus}`

    // Dedupe: nao reenvia o mesmo status pro mesmo pedido (ex.: admin volta e avanca de novo).
    const { data: existing } = await supabase
      .from("mensagens_whatsapp")
      .select("id")
      .eq("pedido_id", pedidoId)
      .eq("tipo", tipo)
      .eq("status", "enviada")
      .limit(1)

    if (existing && existing.length > 0) return

    const result = await sendWhatsAppMessage(telefone, decision.mensagem)

    await supabase.rpc("register_whatsapp_message", {
      p_pedido_id: pedidoId,
      p_tipo: tipo,
      p_status: result.ok ? "enviada" : "falha",
    })
  } catch (err) {
    logWaError("status:erro-inesperado", errInfo(err))
  }
}
