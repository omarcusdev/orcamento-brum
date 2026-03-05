import type { CartItem } from "@/lib/types"
import CartItemRow from "@/components/cart-item"

type CartProps = {
  items: CartItem[]
  open: boolean
  onClose: () => void
  onIncrease: (produtoId: string) => void
  onDecrease: (produtoId: string) => void
  onRemove: (produtoId: string) => void
  onCheckout: () => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const Cart = ({ items, open, onClose, onIncrease, onDecrease, onRemove, onCheckout }: CartProps) => {
  const total = items.reduce((sum, item) => sum + item.produto.preco_avista * item.quantidade, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantidade, 0)

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 md:right-0 md:left-auto md:top-0 md:w-96 bg-white z-50 rounded-t-2xl md:rounded-none shadow-2xl flex flex-col max-h-[85vh] md:max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-brand-black">
            Carrinho ({totalItems})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-brand-black text-2xl cursor-pointer">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Carrinho vazio</p>
          ) : (
            items.map((item) => (
              <CartItemRow
                key={item.produto.id}
                item={item}
                onIncrease={() => onIncrease(item.produto.id)}
                onDecrease={() => onDecrease(item.produto.id)}
                onRemove={() => onRemove(item.produto.id)}
              />
            ))
          )}
        </div>
        {items.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <div className="flex justify-between mb-4">
              <span className="font-medium text-gray-600">Total</span>
              <span className="font-bold text-xl text-brand-black">{formatPrice(total)}</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Chopeira inclusa. Gelo nao incluso.</p>
            <button
              onClick={onCheckout}
              className="w-full bg-brand-yellow text-brand-black font-bold py-4 rounded-lg text-lg hover:brightness-110 transition cursor-pointer"
            >
              Finalizar Pedido
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default Cart
