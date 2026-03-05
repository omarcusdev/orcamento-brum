"use client"

import { useState } from "react"
import type { Produto, CartItem } from "@/lib/types"
import Catalog from "@/components/catalog"
import Cart from "@/components/cart"
import CheckoutForm from "@/components/checkout-form"

type StorefrontProps = {
  produtos: Produto[]
}

const Storefront = ({ produtos }: StorefrontProps) => {
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
      <Catalog produtos={produtos} onAddToCart={addToCart} />
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
      {totalItems > 0 && !cartOpen && (
        <div className="fixed bottom-6 right-6 z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="bg-brand-yellow text-brand-black font-bold px-6 py-4 rounded-full shadow-lg hover:brightness-110 transition cursor-pointer flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            {totalItems}
          </button>
        </div>
      )}
    </>
  )
}

export default Storefront
