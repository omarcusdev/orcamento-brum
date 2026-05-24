"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { Produto } from "@/lib/types"
import { deleteProduct } from "@/lib/admin-actions"
import { Button } from "@/components/ui"

type DeleteProductModalProps = {
  produto: Produto
  onClose: () => void
  onDeleted: (id: string) => void
}

const DeleteProductModal = ({ produto, onClose, onDeleted }: DeleteProductModalProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    setLoading(true)
    try {
      await deleteProduct(produto.id)
      onDeleted(produto.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="bg-brand-surface rounded-2xl max-w-sm w-full p-6 border border-white/10"
      >
        <h3 className="font-display text-lg font-bold text-white tracking-wide mb-2">
          EXCLUIR {produto.marca.toUpperCase()} {produto.volume_litros}L?
        </h3>
        <p className="text-sm text-brand-gray-light mb-4">Esta acao nao pode ser desfeita.</p>
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirm} disabled={loading} className="flex-1">
            {loading ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default DeleteProductModal
