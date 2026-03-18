"use client"

import { type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Produto } from "@/lib/types"
import { useCart } from "@/lib/cart-context"
import Catalog from "@/components/catalog"
import Cart from "@/components/cart"

type StorefrontProps = {
  produtos: Produto[]
  hero?: ReactNode
  children?: ReactNode
}

const Storefront = ({ produtos, hero, children }: StorefrontProps) => {
  const { addToCart, totalItems, cartOpen, openCart } = useCart()

  return (
    <>
      {hero}
      <Catalog produtos={produtos} onAddToCart={addToCart} />
      {children}
      <Cart />
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
              onClick={openCart}
              whileHover={{ scale: 1.05, opacity: 0.9 }}
              whileTap={{ scale: 0.95 }}
              className="bg-brand-yellow text-brand-black font-medium px-6 py-4 rounded-full shadow-lg cursor-pointer flex items-center gap-2 text-sm tracking-wide"
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
