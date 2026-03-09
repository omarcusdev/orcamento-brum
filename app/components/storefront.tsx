"use client"

import { useState, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Produto, CartItem } from "@/lib/types"
import Catalog from "@/components/catalog"
import Cart from "@/components/cart"
import CheckoutForm from "@/components/checkout-form"

type StorefrontProps = {
  produtos: Produto[]
  hero?: ReactNode
  children?: ReactNode
}

const Storefront = ({ produtos, hero, children }: StorefrontProps) => {
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutMode, setCheckoutMode] = useState(false)

  const addToCart = (produto: Produto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produto.id === produto.id)
      if (existing) {
        return prev.map((item) =>
          item.produto.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        )
      }
      return [...prev, { produto, quantidade: 1 }]
    })
    setCartOpen(true)
  }

  const increaseItem = (produtoId: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.produto.id === produtoId
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      )
    )
  }

  const decreaseItem = (produtoId: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.produto.id === produtoId
            ? { ...item, quantidade: item.quantidade - 1 }
            : item
        )
        .filter((item) => item.quantidade > 0)
    )
  }

  const removeItem = (produtoId: string) => {
    setCart((prev) => prev.filter((item) => item.produto.id !== produtoId))
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantidade, 0)

  if (checkoutMode) {
    return <CheckoutForm items={cart} onBack={() => setCheckoutMode(false)} />
  }

  return (
    <>
      {hero}
      <Catalog produtos={produtos} onAddToCart={addToCart} />
      {children}
      <Cart
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onIncrease={increaseItem}
        onDecrease={decreaseItem}
        onRemove={removeItem}
        onCheckout={() => {
          setCartOpen(false)
          setCheckoutMode(true)
        }}
      />
      <AnimatePresence>
        {totalItems > 0 && !cartOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed bottom-6 right-6 z-30"
          >
            <motion.button
              onClick={() => setCartOpen(true)}
              whileHover={{ scale: 1.05, opacity: 0.9 }}
              whileTap={{ scale: 0.95 }}
              className="bg-brand-dark text-white font-medium px-6 py-4 rounded-full shadow-lg cursor-pointer flex items-center gap-2 text-sm tracking-wide"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
              </svg>
              <span className="font-display font-bold">{totalItems}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Storefront
