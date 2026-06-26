export const STATUS_FLOW_ORDER = [
  "confirmado",
  "enviar_para_entregador",
  "em_rota",
  "entregue",
  "pago",
  "recolhido",
] as const

export type FlowStatus = typeof STATUS_FLOW_ORDER[number]

export const canRevertToStatus = (current: string, target: string): boolean => {
  if (target === "cancelado") return current !== "recolhido" && current !== "cancelado"
  const currentIndex = STATUS_FLOW_ORDER.indexOf(current as FlowStatus)
  const targetIndex = STATUS_FLOW_ORDER.indexOf(target as FlowStatus)
  if (currentIndex === -1 || targetIndex === -1) return false
  return targetIndex < currentIndex
}

export const LOCKED_EDIT_STATUSES = ["entregue", "pago", "recolhido", "cancelado"] as const

// Frete trava do despacho em diante (o FreteInput vira read-only). NB: o EditOrderDrawer ainda
// permite editar frete em enviar_para_entregador/em_rota — divergência conhecida, decisão de produto.
const FRETE_LOCKED_STATUSES = ["enviar_para_entregador", "em_rota", "entregue", "pago", "recolhido", "cancelado"]
export const isFreteLocked = (status: string): boolean => FRETE_LOCKED_STATUSES.includes(status)

// "recolhido" e o status final: ao chegar nele o pedido sai da esteira
// (arquiva automaticamente) e vai pra aba "Arquivados", de onde pode ser restaurado.
export const AUTO_ARCHIVE_STATUS = "recolhido"

export const isAutoArchiveStatus = (status: string): boolean => status === AUTO_ARCHIVE_STATUS
