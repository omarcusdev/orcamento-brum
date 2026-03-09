"use client"

import { motion } from "framer-motion"
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
  <motion.div
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2 }}
    className="flex items-center gap-3 py-4 border-b border-gray-100 last:border-0"
  >
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-brand-black truncate">{item.produto.marca}</p>
      <p className="text-xs text-brand-warm-gray">{item.produto.volume_litros}L</p>
    </div>
    <div className="flex items-center gap-2">
      <motion.button
        onClick={onDecrease}
        whileHover={{ opacity: 0.7 }}
        whileTap={{ scale: 0.9 }}
        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-sm text-brand-warm-gray hover:border-brand-dark/30 cursor-pointer transition-colors duration-200"
      >
        −
      </motion.button>
      <span className="text-sm font-medium w-5 text-center text-brand-black">{item.quantidade}</span>
      <motion.button
        onClick={onIncrease}
        whileHover={{ opacity: 0.7 }}
        whileTap={{ scale: 0.9 }}
        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-sm text-brand-warm-gray hover:border-brand-dark/30 cursor-pointer transition-colors duration-200"
      >
        +
      </motion.button>
    </div>
    <p className="font-display font-semibold text-sm w-20 text-right text-brand-black">
      {formatPrice(item.produto.preco_avista * item.quantidade)}
    </p>
    <motion.button
      onClick={onRemove}
      whileHover={{ opacity: 0.6 }}
      whileTap={{ scale: 0.9 }}
      className="text-brand-warm-gray/40 hover:text-red-500 text-lg cursor-pointer transition-colors duration-200"
    >
      ×
    </motion.button>
  </motion.div>
)

export default CartItemRow
