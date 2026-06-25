// "Ordem de entrega" enviada/copiada para o entregador no despacho. Mantém o formato que o Jean
// já usa (rótulos sem acento de propósito) e ADICIONA o código do pedido no topo. Função pura/testada;
// é a mesma string mostrada no modal de despacho E enviada pelo WhatsApp quando o número está conectado.

export type DispatchItem = { quantidade: number; marca: string; volume: number }

export const buildDispatchText = (data: {
  pedidoId: string
  clienteNome: string
  clienteTelefone: string
  dataEvento: string
  horarioEvento: string
  tipoChopeira: string
  rampasEscadas: string | null
  subtotal: number
  frete: number
  metodoPagamento: string | null
  observacoes: string | null
  endereco: string
  enderecoCompleto: { rua: string; numero: string; complemento?: string | null; bairro: string; cidade: string } | null
  itens: DispatchItem[]
}): string => {
  const itemLines = data.itens.map((i) => `${i.quantidade}x ${i.marca} ${i.volume}L`).join(", ")
  const dataFormatted = new Date(data.dataEvento + "T00:00:00").toLocaleDateString("pt-BR")
  const ec = data.enderecoCompleto
  const enderecoLine = ec
    ? `${ec.rua}, ${ec.numero}${ec.complemento ? ` (${ec.complemento})` : ""}`
    : data.endereco

  return [
    `🔖 Pedido #${data.pedidoId.slice(0, 8)}`,
    `📍 Data do evento: ${dataFormatted} às ${data.horarioEvento.slice(0, 5)}`,
    `◼ Quantidade de Barris: ${itemLines}`,
    `◼ Preferencia de Chopeira: ${data.tipoChopeira}`,
    `◼ Responsavel: ${data.clienteNome}`,
    `◼ Contato: ${data.clienteTelefone}`,
    `◼ Municipio: ${ec?.cidade ?? "—"}`,
    `◼ Bairro: ${ec?.bairro ?? "—"}`,
    `◼ Endereco: ${enderecoLine}`,
    `◼ Rampas/Escadas: ${data.rampasEscadas || "Nao"}`,
    `◼ Valor: R$ ${data.subtotal.toFixed(2).replace(".", ",")}`,
    `◼ Frete: R$ ${(data.frete || 0).toFixed(2).replace(".", ",")}`,
    `◼ Forma de pagamento: ${data.metodoPagamento ?? "—"}`,
    `◼ Observacoes: ${data.observacoes || "—"}`,
  ].join("\n")
}
