import type { CartItem } from "@/lib/types"

type CartItemRowProps = {
  item: CartItem
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const CartItemRow = ({ item, onIncrease, onDecrease, onRemove }: CartItemRowProps) => (
  <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-brand-black truncate">{item.produto.marca}</p>
      <p className="text-xs text-gray-400">{item.produto.volume_litros}L</p>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrease}
        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-50 cursor-pointer"
      >
        −
      </button>
      <span className="text-sm font-medium w-5 text-center">{item.quantidade}</span>
      <button
        onClick={onIncrease}
        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-50 cursor-pointer"
      >
        +
      </button>
    </div>
    <p className="font-semibold text-sm w-20 text-right">
      {formatPrice(item.produto.preco_avista * item.quantidade)}
    </p>
    <button onClick={onRemove} className="text-gray-300 hover:text-red-500 text-lg cursor-pointer">
      ×
    </button>
  </div>
)

export default CartItemRow
