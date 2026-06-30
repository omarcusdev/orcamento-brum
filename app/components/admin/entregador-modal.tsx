"use client"

import { useState, useEffect } from "react"
import { createEntregador, updateEntregador } from "@/lib/admin-actions"
import { Button, Input, Modal, fieldLabelClass } from "@/components/ui"
import { formatPhone } from "@/lib/format"
import type { Entregador } from "@/lib/types"

type EntregadorModalProps = {
  entregador: Entregador | null
  onClose: () => void
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
    <Modal onClose={onClose} title={entregador ? "EDITAR ENTREGADOR" : "NOVO ENTREGADOR"}>
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
    </Modal>
  )
}

export default EntregadorModal
