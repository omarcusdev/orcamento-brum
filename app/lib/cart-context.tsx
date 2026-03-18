"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { Produto, CartItem } from "@/lib/types"

type CartContextType = {
  items: CartItem[]
  cartOpen: boolean
  totalItems: number
  addToCart: (produto: Produto) => void
  increaseItem: (produtoId: string) => void
  decreaseItem: (produtoId: string) => void
  removeItem: (produtoId: string) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
}

const STORAGE_KEY = "alfa-cart"

const CartContext = createContext<CartContextType | null>(null)

const readStorage = (): CartItem[] => {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeStorage = (items: CartItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setItems(readStorage())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) writeStorage(items)
  }, [items, hydrated])

  const addToCart = useCallback((produto: Produto) => {
    setItems((prev) => {
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
  }, [])

  const increaseItem = useCallback((produtoId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.produto.id === produtoId
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      )
    )
  }, [])

  const decreaseItem = useCallback((produtoId: string) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.produto.id === produtoId
            ? { ...item, quantidade: item.quantidade - 1 }
            : item
        )
        .filter((item) => item.quantidade > 0)
    )
  }, [])

  const removeItem = useCallback((produtoId: string) => {
    setItems((prev) => prev.filter((item) => item.produto.id !== produtoId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const openCart = useCallback(() => setCartOpen(true), [])
  const closeCart = useCallback(() => setCartOpen(false), [])

  const totalItems = items.reduce((sum, item) => sum + item.quantidade, 0)

  return (
    <CartContext.Provider
      value={{ items, cartOpen, totalItems, addToCart, increaseItem, decreaseItem, removeItem, clearCart, openCart, closeCart }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart must be used within CartProvider")
  return context
}
