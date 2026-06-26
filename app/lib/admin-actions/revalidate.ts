import { revalidatePath } from "next/cache"

// O par "revalida o detalhe do pedido + a esteira" aparece em ~9 actions de pedido.
export const revalidatePedido = (pedidoId: string) => {
  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}
