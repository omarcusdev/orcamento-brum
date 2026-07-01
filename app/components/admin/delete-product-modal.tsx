"use client"

import { useState } from "react"
import type { Produto } from "@/lib/types"
import { deleteProduct } from "@/lib/admin-actions"
import { Button, Modal } from "@/components/ui"

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
    <Modal
      onClose={onClose}
      maxWidth="sm"
      closeDisabled={loading}
      title={`EXCLUIR ${produto.marca.toUpperCase()} ${produto.volume_litros}L?`}
    >
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
    </Modal>
  )
}

export default DeleteProductModal
