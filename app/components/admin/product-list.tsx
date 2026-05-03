"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import type { Produto } from "@/lib/types"
import { reorderProducts, toggleProductActive } from "@/lib/admin-actions"
import { recomputeOrdens } from "@/lib/admin-ordem"
import ProductForm from "@/components/admin/product-form"
import ProductCardRow from "@/components/admin/product-card-row"
import DeleteProductModal from "@/components/admin/delete-product-modal"

type ProductListProps = {
  produtos: Produto[]
}

type SectionVolume = 50 | 30

const sortByOrdem = (a: Produto, b: Produto) => a.ordem - b.ordem

const ProductList = ({ produtos: initialProdutos }: ProductListProps) => {
  const [produtos, setProdutos] = useState<Produto[]>(() => [...initialProdutos].sort(sortByOrdem))
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Produto | undefined>()
  const [deletingProduct, setDeletingProduct] = useState<Produto | undefined>()
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    setProdutos([...initialProdutos].sort(sortByOrdem))
  }, [initialProdutos])

  const sectionsByVolume = (volume: SectionVolume) =>
    produtos.filter((p) => p.volume_litros === volume).sort(sortByOrdem)

  const produtos50 = sectionsByVolume(50)
  const produtos30 = sectionsByVolume(30)

  const handleToggle = async (id: string, currentActive: boolean) => {
    setToggleError(null)
    setTogglingIds((prev) => new Set(prev).add(id))
    try {
      await toggleProductActive(id, !currentActive)
      setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, ativo: !currentActive } : p)))
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Erro ao alterar status")
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleDeleted = (id: string) => {
    setProdutos((prev) => prev.filter((p) => p.id !== id))
  }

  const handleDragEnd = async (event: DragEndEvent, volume: SectionVolume) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (reordering) return

    const sectionItems = sectionsByVolume(volume)
    const oldIndex = sectionItems.findIndex((p) => p.id === active.id)
    const newIndex = sectionItems.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const previousProdutos = produtos
    const reorderedSection = arrayMove(sectionItems, oldIndex, newIndex)
    const updates = recomputeOrdens(reorderedSection.map((p) => p.id))
    const ordemById = new Map(updates.map((u) => [u.id, u.ordem]))
    const optimistic = produtos.map((p) =>
      ordemById.has(p.id) ? { ...p, ordem: ordemById.get(p.id)! } : p
    )
    setProdutos(optimistic)
    setReorderError(null)
    setReordering(true)

    try {
      await reorderProducts(updates)
    } catch (err) {
      setProdutos(previousProdutos)
      setReorderError(err instanceof Error ? err.message : "Erro ao reordenar")
    } finally {
      setReordering(false)
    }
  }

  const renderSection = (volume: SectionVolume, items: Produto[]) => {
    if (items.length === 0) return null
    return (
      <section className="mb-8">
        <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">BARRIS DE {volume}L</h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, volume)}
        >
          <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((produto) => (
                <ProductCardRow
                  key={produto.id}
                  produto={produto}
                  isToggling={togglingIds.has(produto.id)}
                  onToggle={() => handleToggle(produto.id, produto.ativo)}
                  onEdit={() => { setEditingProduct(produto); setShowForm(true) }}
                  onDelete={() => setDeletingProduct(produto)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    )
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex justify-between items-center mb-6"
      >
        <h1 className="font-display text-3xl font-bold text-white tracking-wide">CATALOGO</h1>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { setEditingProduct(undefined); setShowForm(true) }}
          className="bg-brand-yellow text-brand-black font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition cursor-pointer"
        >
          + Novo Produto
        </motion.button>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-brand-yellow/5 border border-brand-yellow/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-brand-yellow shrink-0">
          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-brand-yellow/80">Desativar um produto remove ele do catalogo visivel para os clientes. Arraste pelo icone <span aria-hidden="true">⋮⋮</span> para reordenar.</p>
      </motion.div>
      {reorderError && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{reorderError}</p>
      )}
      {toggleError && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{toggleError}</p>
      )}
      {renderSection(50, produtos50)}
      {renderSection(30, produtos30)}
      <AnimatePresence>
        {showForm && (
          <ProductForm produto={editingProduct} onClose={() => setShowForm(false)} />
        )}
        {deletingProduct && (
          <DeleteProductModal
            produto={deletingProduct}
            onClose={() => setDeletingProduct(undefined)}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ProductList
