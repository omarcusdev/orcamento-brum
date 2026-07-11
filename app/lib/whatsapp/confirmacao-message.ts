// Mensagem de confirmação enviada ao cliente quando o pedido é criado (checkout ou pedido manual).
// Formato "WhatsApp": linhas curtas + itens em lista (•), *negrito* nos rótulos. Função pura/testada;
// o envio em si fica em notificacoes.ts.

import { formatEventDate, firstName, shortId, formatTime, formatBRL, metodoPagamentoLabel } from "@/lib/format"

export type ConfirmationItemRow = {
  produto_id: string
  quantidade: number
  subtotal: number
  is_consignado: boolean
  marca: string
  volume: number
}

export type ConfirmationItem = {
  quantidade: number
  marca: string
  volume: number
  is_consignado: boolean
}

const round2 = (value: number) => Number(value.toFixed(2))

// Consignado é gravado 1 linha por barril; agrupa por (produto, consignado) somando a quantidade
// para uma lista limpa ("2x Donzela (consignado)" em vez de "1x" três vezes), e soma o valor
// consignado a partir das linhas CRUAS (antes do agrupamento).
export const summarizeConfirmationItens = (
  rows: ConfirmationItemRow[],
): { itens: ConfirmationItem[]; consignadoTotal: number } => {
  const grouped = new Map<string, ConfirmationItem>()
  for (const row of rows) {
    const key = `${row.produto_id}|${row.is_consignado}`
    const existing = grouped.get(key)
    if (existing) {
      existing.quantidade += row.quantidade
    } else {
      grouped.set(key, {
        quantidade: row.quantidade,
        marca: row.marca,
        volume: row.volume,
        is_consignado: row.is_consignado,
      })
    }
  }
  const consignadoTotal = round2(
    rows.filter((row) => row.is_consignado).reduce((sum, row) => sum + row.subtotal, 0),
  )
  return { itens: [...grouped.values()], consignadoTotal }
}

export const buildConfirmationMessage = (data: {
  clienteNome: string
  pedidoId: string
  itens: { quantidade: number; marca: string; volume: number; is_consignado?: boolean }[]
  dataEvento: string
  horarioEvento: string
  total: number
  metodoPagamento: string | null
  consignadoTotal?: number
}): string => {
  const consignado = data.consignadoTotal ?? 0
  const hasConsignado = consignado > 0
  const aPagar = round2(data.total - consignado)

  const itensList = data.itens
    .map((item) => `• ${item.quantidade}x ${item.marca} ${item.volume}L${item.is_consignado ? " (consignado)" : ""}`)
    .join("\n")

  const valorLinhas = hasConsignado
    ? [
        `💰 *A pagar:* ${formatBRL(aPagar)}`,
        `📦 *Consignado (paga só se usar):* ${formatBRL(consignado)}`,
      ]
    : [`💰 *Valor total:* ${formatBRL(data.total)}`]

  const rodapeConsignado = hasConsignado ? [``, `_Total se usar tudo: ${formatBRL(data.total)}_`] : []

  return [
    `Olá, ${firstName(data.clienteNome)}! 🍻 Recebemos seu pedido!`,
    ``,
    `*Pedido #${shortId(data.pedidoId)}*`,
    itensList,
    ``,
    ...valorLinhas,
    `💳 *Pagamento:* ${metodoPagamentoLabel(data.metodoPagamento)}`,
    ``,
    `📅 *Evento:* ${formatEventDate(data.dataEvento)} às ${formatTime(data.horarioEvento)}`,
    ...rodapeConsignado,
    ``,
    `Já já confirmamos tudo com você por aqui 😊`,
    `— ALFA Chopp Delivery`,
  ].join("\n")
}
