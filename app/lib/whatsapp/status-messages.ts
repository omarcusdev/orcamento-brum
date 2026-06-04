// Modulo PURO (sem I/O): fonte da verdade dos status notificaveis, textos-padrao e
// da decisao "enviar ou nao + qual texto". Seguro pra importar em client component.

export const STATUS_NOTIFY_STATUSES = ["em_rota", "entregue", "cancelado", "recolhido"] as const
export type NotifyStatus = (typeof STATUS_NOTIFY_STATUSES)[number]

export const STATUS_LABELS: Record<NotifyStatus, string> = {
  em_rota: "A caminho (em rota)",
  entregue: "Entregue",
  cancelado: "Cancelado",
  recolhido: "Recolhido",
}

// Tokens suportados nas mensagens: {nome} (primeiro nome) e {pedido} (id curto).
export const DEFAULT_STATUS_MESSAGES: Record<NotifyStatus, string> = {
  em_rota:
    "Eba, {nome}! 🍻 Seu chopp tá a caminho! O pedido #{pedido} saiu pra entrega e logo chega aí. 🚚 — ALFA Chopp Delivery",
  entregue:
    "Seu chopp chegou! 🎉 Pedido #{pedido} entregue. Caprichem na espuma e curtam o evento! — ALFA Chopp Delivery",
  cancelado:
    "Olá {nome}, seu pedido #{pedido} foi cancelado. Se precisar, a gente refaz num instante. — ALFA Chopp Delivery",
  recolhido:
    "Recolhemos tudo certinho do pedido #{pedido}! 🍺 Valeu demais pela parceria, {nome}. Bora repetir! — ALFA Chopp Delivery",
}

export const isNotifyStatus = (s: string): s is NotifyStatus =>
  (STATUS_NOTIFY_STATUSES as readonly string[]).includes(s)

export const statusFlagKey = (s: NotifyStatus) => `whatsapp_status_${s}_ativo`
export const statusMsgKey = (s: NotifyStatus) => `whatsapp_status_${s}_msg`

export const renderStatusTemplate = (
  template: string,
  vars: { nome: string; pedido: string },
): string => template.replaceAll("{nome}", vars.nome).replaceAll("{pedido}", vars.pedido)

// Decisao pura: dado o status, se o sub-flag esta ligado e o template (config ou null),
// devolve skip ou a mensagem pronta. O gate master e o dedupe ficam no wrapper de I/O.
export const resolveStatusMessage = (
  status: string,
  opts: { statusOn: boolean; template: string | null; nome: string; pedido: string },
): { skip: true } | { skip: false; mensagem: string } => {
  if (!isNotifyStatus(status)) return { skip: true }
  if (!opts.statusOn) return { skip: true }
  const tpl = opts.template && opts.template.trim() ? opts.template : DEFAULT_STATUS_MESSAGES[status]
  return { skip: false, mensagem: renderStatusTemplate(tpl, { nome: opts.nome, pedido: opts.pedido }) }
}
