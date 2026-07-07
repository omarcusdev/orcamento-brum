// Mensagem de confirmação enviada ao cliente quando o pedido é criado (checkout ou pedido manual).
// Formato "WhatsApp": linhas curtas + itens em lista (•), *negrito* nos rótulos — em vez de um bloco
// corrido. Função pura/testada; o envio em si fica em notificacoes.ts.

import { formatEventDate, firstName, shortId, formatTime, formatBRL, metodoPagamentoLabel } from "@/lib/format"

export const buildConfirmationMessage = (data: {
  clienteNome: string
  pedidoId: string
  itens: { quantidade: number; marca: string; volume: number }[]
  dataEvento: string
  horarioEvento: string
  total: number
  metodoPagamento: string | null
}): string => {
  const itensList = data.itens
    .map((item) => `• ${item.quantidade}x ${item.marca} ${item.volume}L`)
    .join("\n")
  return [
    `Olá, ${firstName(data.clienteNome)}! 🍻 Recebemos seu pedido!`,
    ``,
    `*Pedido #${shortId(data.pedidoId)}*`,
    itensList,
    ``,
    `💰 *Valor total:* ${formatBRL(data.total)}`,
    `💳 *Pagamento:* ${metodoPagamentoLabel(data.metodoPagamento)}`,
    ``,
    `📅 *Evento:* ${formatEventDate(data.dataEvento)} às ${formatTime(data.horarioEvento)}`,
    ``,
    `Já já confirmamos tudo com você por aqui 😊`,
    `— ALFA Chopp Delivery`,
  ].join("\n")
}
