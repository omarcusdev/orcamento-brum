import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."

const formatEventDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR")

const buildConfirmationMessage = (data: {
  clienteNome: string
  pedidoId: string
  itens: { quantidade: number; marca: string; volume: number }[]
  dataEvento: string
  horarioEvento: string
}) => {
  const itensText = data.itens
    .map((item) => `${item.quantidade}x ${item.marca} ${item.volume}L`)
    .join(", ")
  const firstName = data.clienteNome.split(" ")[0]
  return `Olá ${firstName}! Seu pedido #${data.pedidoId.slice(0, 8)} foi recebido. ${itensText}. Evento em ${formatEventDate(data.dataEvento)} às ${data.horarioEvento.slice(0, 5)}. Em breve confirmamos os detalhes por aqui. — ALFA Chopp Delivery`
}

export const sendCustomerWhatsAppConfirmation = async (pedidoId: string) => {
  try {
    const supabase = createServiceClient()

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("data_evento, horario_evento, clientes(nome, telefone)")
      .eq("id", pedidoId)
      .single()

    if (pedidoErr || !pedido) {
      console.error("[whatsapp] pedido não encontrado:", pedidoId, pedidoErr)
      return
    }

    const cliente = Array.isArray(pedido.clientes) ? pedido.clientes[0] : pedido.clientes
    const telefone = cliente?.telefone
    if (!telefone) {
      console.error("[whatsapp] cliente sem telefone:", pedidoId)
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
    console.error("[whatsapp] erro inesperado na confirmação:", err)
  }
}
