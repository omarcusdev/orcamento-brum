// Mensagem de confirmação enviada ao cliente quando o pedido é criado (checkout ou pedido manual).
// Formato "WhatsApp": linhas curtas + itens em lista (•), *negrito* nos rótulos — em vez de um bloco
// corrido. Função pura/testada; o envio em si fica em notificacoes.ts.

import { formatEventDate } from "@/lib/format"

export const buildConfirmationMessage = (data: {
  clienteNome: string
  pedidoId: string
  itens: { quantidade: number; marca: string; volume: number }[]
  dataEvento: string
  horarioEvento: string
}): string => {
  const firstName = data.clienteNome.split(" ")[0]
  const itensList = data.itens
    .map((item) => `• ${item.quantidade}x ${item.marca} ${item.volume}L`)
    .join("\n")
  return [
    `Olá, ${firstName}! 🍻 Recebemos seu pedido!`,
    ``,
    `*Pedido #${data.pedidoId.slice(0, 8)}*`,
    itensList,
    ``,
    `📅 *Evento:* ${formatEventDate(data.dataEvento)} às ${data.horarioEvento.slice(0, 5)}`,
    ``,
    `Já já confirmamos tudo com você por aqui 😊`,
    `— ALFA Chopp Delivery`,
  ].join("\n")
}
