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
