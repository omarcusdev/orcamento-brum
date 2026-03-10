"use client"

import { motion, AnimatePresence } from "framer-motion"
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed bottom-0 left-0 right-0 md:right-0 md:left-auto md:top-0 md:w-96 bg-brand-dark z-50 rounded-t-2xl md:rounded-none shadow-2xl flex flex-col max-h-[85vh] md:max-h-full"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="font-display font-bold text-xl tracking-wide text-white">
                Carrinho ({totalItems})
              </h3>
              <motion.button
                onClick={onClose}
                whileHover={{ opacity: 0.6 }}
                whileTap={{ scale: 0.9 }}
                className="text-brand-warm-gray hover:text-white text-2xl cursor-pointer"
              >
                ×
              </motion.button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <p className="text-brand-warm-gray text-center py-8 text-sm">Carrinho vazio</p>
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
              <div className="p-5 border-t border-white/10">
                <div className="flex justify-between mb-4">
                  <span className="font-medium text-brand-warm-gray text-sm">Total</span>
                  <span className="font-display font-bold text-xl text-brand-yellow">{formatPrice(total)}</span>
                </div>
                <p className="text-xs text-brand-warm-gray mb-4">Chopeira inclusa. Gelo nao incluso.</p>
                <motion.button
                  onClick={onCheckout}
                  whileHover={{ opacity: 0.85 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-brand-yellow text-brand-black font-medium py-4 rounded-md text-sm tracking-wide uppercase cursor-pointer transition-colors duration-200 hover:bg-brand-amber"
                >
                  Finalizar Pedido
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default Cart
