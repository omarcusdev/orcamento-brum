import { createServiceClient } from "@/lib/supabase/service"
import { sendCustomerWhatsAppStatusUpdate } from "./notificacoes"
import { STATUS_NOTIFY_STATUSES } from "./status-messages"
import { logWaError, errInfo } from "./wa-log"

export type StatusRetryResult = { total: number }

type PedidoCandidato = { id: string; status: string }

// Retenta notificacoes de status que falharam (ex.: conexao Baileys caida no momento do
// envio). So retenta pedidos cujo status ATUAL ainda bate com o tipo notificavel — evita
// mandar aviso de um status que o pedido ja passou. sendCustomerWhatsAppStatusUpdate ja
// tem todos os gates/flags/dedupe; aqui so descobre quem precisa de nova tentativa.
// Acordado pelo mesmo cron horario do lembrete (ver /api/whatsapp/lembrete).
export const runStatusRetry = async (): Promise<StatusRetryResult> => {
  const supabase = createServiceClient()

  const { data: pedidos, error: pedidosErr } = await supabase
    .from("pedidos")
    .select("id, status")
    .in("status", STATUS_NOTIFY_STATUSES as unknown as string[])

  if (pedidosErr) {
    logWaError("status-retry:erro-pedidos", errInfo(pedidosErr))
    return { total: 0 }
  }

  const candidatos = (pedidos ?? []) as PedidoCandidato[]
  if (candidatos.length === 0) return { total: 0 }

  const { data: enviadas, error: enviadasErr } = await supabase
    .from("mensagens_whatsapp")
    .select("pedido_id, tipo")
    .eq("status", "enviada")
    .in("pedido_id", candidatos.map((p) => p.id))

  if (enviadasErr) {
    logWaError("status-retry:erro-enviadas", errInfo(enviadasErr))
    return { total: 0 }
  }

  const jaEnviado = new Set((enviadas ?? []).map((m) => `${m.pedido_id}:${m.tipo}`))
  const pendentes = candidatos.filter((p) => !jaEnviado.has(`${p.id}:status_${p.status}`))

  for (const pedido of pendentes) {
    await sendCustomerWhatsAppStatusUpdate(pedido.id, pedido.status)
  }

  return { total: pendentes.length }
}
