"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { Entregador } from "@/lib/types"
import { toggleEntregadorAtivo } from "@/lib/admin-actions"
import EntregadorModal from "@/components/admin/entregador-modal"

const EntregadoresList = ({ initialEntregadores }: { initialEntregadores: Entregador[] }) => {
  const [showModal, setShowModal] = useState(false)
  const [editingEntregador, setEditingEntregador] = useState<Entregador | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const handleEdit = (entregador: Entregador) => {
    setEditingEntregador(entregador)
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingEntregador(null)
    setShowModal(true)
  }

  const handleToggle = async (entregador: Entregador) => {
    setToggling(entregador.id)
    await toggleEntregadorAtivo(entregador.id, !entregador.ativo)
    setToggling(null)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAdd}
          className="bg-brand-yellow text-brand-black font-bold px-4 py-2 rounded-lg text-sm hover:brightness-110 transition cursor-pointer"
        >
          + Adicionar
        </motion.button>
      </div>

      {initialEntregadores.length === 0 ? (
        <div className="text-center py-12 text-brand-warm-gray">
          Nenhum entregador cadastrado
        </div>
      ) : (
        <div className="bg-brand-surface rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-medium text-brand-warm-gray uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-brand-warm-gray uppercase tracking-wider">WhatsApp</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-brand-warm-gray uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-brand-warm-gray uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {initialEntregadores.map((entregador) => (
                <tr key={entregador.id} className="border-b border-white/5 last:border-0">
                  <td className={`px-5 py-4 text-sm font-medium ${entregador.ativo ? "text-white" : "text-brand-warm-gray"}`}>
                    {entregador.nome}
                  </td>
                  <td className={`px-5 py-4 text-sm ${entregador.ativo ? "text-brand-gray-light" : "text-brand-warm-gray/60"}`}>
                    {entregador.telefone}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleToggle(entregador)}
                      disabled={toggling === entregador.id}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
                        entregador.ativo
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                          : "bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30"
                      } disabled:opacity-50`}
                    >
                      {entregador.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleEdit(entregador)}
                      className="text-brand-warm-gray hover:text-brand-yellow text-sm transition cursor-pointer"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <EntregadorModal
          entregador={editingEntregador}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

export default EntregadoresList
