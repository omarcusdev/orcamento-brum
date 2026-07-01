// Shared contract for the admin order "esteira". The select string, row type, and
// clientes-unwrap were duplicated between the server page (initial render) and the
// client realtime component (refetch/poll), which must stay in lock-step.

export const PEDIDO_LIST_SELECT =
  "id, status, documento_status, total, data_evento, horario_evento, endereco, metodo_pagamento, created_at, arquivado_em, clientes(nome, telefone)"

export type OrderListItem = {
  id: string
  status: string
  documento_status: string
  total: number
  data_evento: string
  horario_evento: string
  endereco: string
  metodo_pagamento: string | null
  created_at: string
  arquivado_em: string | null
  clientes: { nome: string; telefone: string }
}

// Supabase returns a to-one relation as either an object or a single-element array
// depending on the query shape; flatten it so consumers always get an object.
export const normalizeOrders = (raw: unknown[]): OrderListItem[] =>
  raw.map((row) => {
    const record = row as Record<string, unknown>
    return {
      ...record,
      clientes: Array.isArray(record.clientes) ? record.clientes[0] : record.clientes,
    }
  }) as OrderListItem[]
