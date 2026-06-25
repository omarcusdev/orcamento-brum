"use client"

import { motion } from "framer-motion"
import type { CartItem } from "@/lib/types"
import { calculateLine } from "@/lib/pricing"
import { formatBRL } from "@/lib/format"

type CartItemRowProps = {
  item: CartItem
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
}

const CartItemRow = ({ item, onIncrease, onDecrease, onRemove }: CartItemRowProps) => {
  const line = calculateLine(item.produto, item.quantidade)
  return (
  <motion.div
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2 }}
    className="flex items-center gap-3 py-4 border-b border-white/10 last:border-0"
  >
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-white truncate">{item.produto.marca}</p>
      <p className="text-xs text-brand-warm-gray">{item.produto.volume_litros}L</p>
      {line.hasPromo && (
        <p className="text-[10px] text-green-400 mt-0.5">
          1º {formatBRL(line.firstUnitPrice)} · 2º+ {formatBRL(line.extraUnitPrice)}
        </p>
      )}
    </div>
    <div className="flex items-center gap-2">
      <motion.button
        onClick={onDecrease}
        whileHover={{ opacity: 0.7 }}
        whileTap={{ scale: 0.9 }}
        className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-sm text-brand-warm-gray hover:border-brand-yellow/40 cursor-pointer transition-colors duration-200"
      >
        −
      </motion.button>
      <span className="text-sm font-medium w-5 text-center text-white">{item.quantidade}</span>
      <motion.button
        onClick={onIncrease}
        whileHover={{ opacity: 0.7 }}
        whileTap={{ scale: 0.9 }}
        className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-sm text-brand-warm-gray hover:border-brand-yellow/40 cursor-pointer transition-colors duration-200"
      >
        +
      </motion.button>
    </div>
    <p className="font-display font-semibold text-sm w-20 text-right text-brand-yellow">
      {formatBRL(line.total)}
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
}

export default CartItemRow
