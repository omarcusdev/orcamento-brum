"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { dispatchToEntregador, fetchActiveEntregadores } from "@/lib/admin-actions"

type DispatchModalProps = {
  pedidoId: string
  dispatchText: string
  onClose: () => void
}

type EntregadorOption = {
  id: string
  nome: string
  telefone: string
}

const DispatchModal = ({ pedidoId, dispatchText, onClose }: DispatchModalProps) => {
  const [entregadores, setEntregadores] = useState<EntregadorOption[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchActiveEntregadores()
      .then((data) => {
        setEntregadores(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .catch(() => setError("Erro ao carregar entregadores"))
      .finally(() => setLoadingList(false))
  }, [])

  const handleConfirm = async () => {
    if (!selectedId) return
    setLoading(true)
    setError(null)

    try {
      await navigator.clipboard.writeText(dispatchText)
      setCopied(true)
      await dispatchToEntregador(pedidoId, selectedId)
      onClose()
    } catch (err: any) {
      setError(err.message ?? "Erro ao despachar")
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-brand-surface border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <h3 className="font-display text-lg font-bold text-white tracking-wide mb-4">
            ENVIAR PARA ENTREGADOR
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-brand-warm-gray uppercase tracking-wider mb-1.5">
                Selecionar Entregador
              </label>
              {loadingList ? (
                <div className="px-4 py-3 rounded-md border border-white/10 bg-brand-dark text-brand-warm-gray text-sm">
                  Carregando...
                </div>
              ) : entregadores.length === 0 ? (
                <div className="px-4 py-3 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                  Nenhum entregador ativo. Cadastre um em Entregadores.
                </div>
              ) : (
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full px-4 py-3 rounded-md border border-white/10 bg-brand-dark text-white text-sm focus:border-brand-yellow outline-none cursor-pointer appearance-none"
                >
                  {entregadores.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome} — {e.telefone}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-warm-gray uppercase tracking-wider mb-1.5">
                Resumo do Pedido
              </label>
              <pre className="px-4 py-3 rounded-md border border-white/10 bg-brand-dark text-brand-gray-light text-xs leading-relaxed whitespace-pre-wrap font-mono">
                {dispatchText}
              </pre>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-brand-gray-light text-sm font-medium hover:bg-white/5 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || !selectedId || loadingList}
                className="flex-[2] px-4 py-3 rounded-lg bg-brand-yellow text-brand-black text-sm font-bold hover:brightness-110 transition cursor-pointer disabled:opacity-50"
              >
                {copied ? "Copiado! Despachando..." : loading ? "Despachando..." : "📋 Copiar e Confirmar"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default DispatchModal
