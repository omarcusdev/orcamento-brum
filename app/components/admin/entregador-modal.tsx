"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createEntregador, updateEntregador } from "@/lib/admin-actions"
import { Button, Input, fieldLabelClass } from "@/components/ui"
import type { Entregador } from "@/lib/types"

type EntregadorModalProps = {
  entregador: Entregador | null
  onClose: () => void
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ""
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const EntregadorModal = ({ entregador, onClose }: EntregadorModalProps) => {
  const [nome, setNome] = useState(entregador?.nome ?? "")
  const [telefone, setTelefone] = useState(entregador?.telefone ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNome(entregador?.nome ?? "")
    setTelefone(entregador?.telefone ?? "")
    setError(null)
  }, [entregador])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (entregador) {
        await updateEntregador(entregador.id, nome, telefone)
      } else {
        await createEntregador(nome, telefone)
      }
      onClose()
    } catch (err: any) {
      setError(err.message ?? "Erro ao salvar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-brand-surface border border-white/10 rounded-xl p-6 w-full max-w-md mx-4"
        >
          <h3 className="font-display text-lg font-bold text-white tracking-wide mb-4">
            {entregador ? "EDITAR ENTREGADOR" : "NOVO ENTREGADOR"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={fieldLabelClass}>Nome *</label>
              <Input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do entregador"
              />
            </div>
            <div>
              <label className={fieldLabelClass}>WhatsApp *</label>
              <Input
                type="tel"
                required
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                maxLength={15}
                placeholder="(21) 99999-9999"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={loading} className="flex-1">
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default EntregadorModal
