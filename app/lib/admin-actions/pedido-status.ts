"use server"

import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { STATUS_FLOW_ORDER, canRevertToStatus, isAutoArchiveStatus } from "@/lib/admin-status"
import { after } from "next/server"
import { sendCustomerWhatsAppStatusUpdate } from "@/lib/whatsapp/notificacoes"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { fetchConnection } from "@/lib/whatsapp/control"
import { revalidatePedido } from "./revalidate"

const statusOrder = STATUS_FLOW_ORDER

export const advanceOrderStatus = async (pedidoId: string, currentStatus: string) => {
  const { supabase } = await requireAdmin()
  const currentIndex = statusOrder.indexOf(currentStatus as typeof statusOrder[number])

  if (currentIndex === -1 || currentIndex >= statusOrder.length - 1) {
    throw new Error("Status invalido para avanco")
  }

  const nextStatus = statusOrder[currentIndex + 1]

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("documento_status, status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")

  if (pedido.status !== currentStatus) {
    throw new Error("Status do pedido foi alterado por outro usuario")
  }

  if (currentStatus === "confirmado") {
    throw new Error("Use despacho para entregador para avancar pedidos confirmados")
  }

  // Ao chegar em "recolhido" (status final), arquiva junto pra sair da esteira na hora.
  const statusUpdate = isAutoArchiveStatus(nextStatus)
    ? { status: nextStatus, arquivado_em: new Date().toISOString() }
    : { status: nextStatus }

  const { error, count } = await supabase
    .from("pedidos")
    .update(statusUpdate)
    .eq("id", pedidoId)
    .eq("status", currentStatus)

  if (error) throw error
  if (count === 0) throw new Error("Status do pedido foi alterado por outro usuario")

  revalidatePedido(pedidoId)

  after(() => sendCustomerWhatsAppStatusUpdate(pedidoId, nextStatus))

  return { status: nextStatus }
}

export const cancelOrder = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ status: "cancelado" })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePedido(pedidoId)

  after(() => sendCustomerWhatsAppStatusUpdate(pedidoId, "cancelado"))
}

export const archiveOrder = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", pedidoId)
    .is("arquivado_em", null)

  if (error) throw new Error(`Falha ao arquivar pedido: ${error.message}`)

  revalidatePedido(pedidoId)
}

export const unarchiveOrder = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ arquivado_em: null })
    .eq("id", pedidoId)

  if (error) throw new Error(`Falha ao desarquivar pedido: ${error.message}`)

  revalidatePedido(pedidoId)
}

// Rede de seguranca: arquiva qualquer pedido "recolhido" que ainda esteja na esteira
// (ex.: pedidos antigos, anteriores ao arquivamento automatico em advanceOrderStatus).
// Roda a cada carga de /admin/pedidos; idempotente (so toca linhas nao-arquivadas).
export const archiveRecolhidoOrders = async () => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ arquivado_em: new Date().toISOString() })
    .is("arquivado_em", null)
    .eq("status", "recolhido")

  if (error) {
    console.error("archiveRecolhidoOrders failed", error)
  }
}

export const dispatchToEntregador = async (
  pedidoId: string,
  entregadorId: string,
  dispatchText: string,
): Promise<{ notified: boolean }> => {
  const { supabase } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")
  if (pedido.status !== "confirmado") throw new Error("Pedido precisa estar confirmado para despachar")

  const { data: entregador } = await supabase
    .from("entregadores")
    .select("id, ativo, telefone")
    .eq("id", entregadorId)
    .single()

  if (!entregador || !entregador.ativo) throw new Error("Entregador invalido ou inativo")

  const { error } = await supabase
    .from("pedidos")
    .update({ entregador_id: entregadorId, status: "enviar_para_entregador" })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePedido(pedidoId)

  // Se o WhatsApp estiver conectado, notifica o entregador direto (substitui o copiar-e-colar
  // manual). Best-effort: o despacho já foi efetivado — falha de conexão/envio só volta
  // notified:false e a UI cai no comportamento de copiar. Nunca lança aqui.
  let notified = false
  try {
    const conn = await fetchConnection()
    if (conn.paired && entregador.telefone) {
      const result = await sendWhatsAppMessage(entregador.telefone, dispatchText)
      notified = result.ok
    }
  } catch {
    // ignora: despacho já efetivado; a UI orienta a copiar e enviar manualmente
  }

  return { notified }
}

export const revertOrderStatus = async (pedidoId: string, newStatus: string) => {
  const { supabase } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")
  if (!canRevertToStatus(pedido.status, newStatus)) {
    throw new Error(`Nao pode voltar de ${pedido.status} para ${newStatus}`)
  }

  // Voltar status a partir de "recolhido" traz o pedido de volta pra esteira
  // (desfaz o arquivamento automatico); senao ficaria escondido nos Arquivados.
  const revertUpdate = isAutoArchiveStatus(pedido.status)
    ? { status: newStatus, updated_at: new Date().toISOString(), arquivado_em: null }
    : { status: newStatus, updated_at: new Date().toISOString() }

  const { error: updateError } = await supabase
    .from("pedidos")
    .update(revertUpdate)
    .eq("id", pedidoId)

  if (updateError) throw updateError

  // Status log is written once by the pedidos_status_log trigger (migration 029), which captures
  // changed_by via auth.uid() — no explicit insert here (that used to double-log every revert).

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin")
}
