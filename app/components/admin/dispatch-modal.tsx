"use client"

import { useState, useEffect } from "react"
import { dispatchToEntregador, fetchActiveEntregadores } from "@/lib/admin-actions"
import { getWhatsappConnection } from "@/lib/whatsapp/admin-actions"
import { Button, Modal, Select, fieldLabelClass } from "@/components/ui"

type DispatchModalProps = {
  pedidoId: string
  dispatchText: string
  frete: number
  documentoStatus: string
  onClose: () => void
}

type EntregadorOption = {
  id: string
  nome: string
  telefone: string
}

const DispatchModal = ({ pedidoId, dispatchText, frete, documentoStatus, onClose }: DispatchModalProps) => {
  const [entregadores, setEntregadores] = useState<EntregadorOption[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // null = ainda verificando a conexão; controla se o botão envia (conectado) ou copia (hoje).
  const [paired, setPaired] = useState<boolean | null>(null)
  const [result, setResult] = useState<"notified" | "copied" | "send-failed" | null>(null)

  useEffect(() => {
    fetchActiveEntregadores()
      .then((data) => {
        setEntregadores(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .catch(() => setError("Erro ao carregar entregadores"))
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => {
    getWhatsappConnection()
      .then((c) => setPaired(c.paired))
      .catch(() => setPaired(false)) // na dúvida, trata como desconectado (cai no copiar)
  }, [])

  const handleConfirm = async () => {
    if (!selectedId) return
    if (documentoStatus !== "verificado" && !confirm("Documentacao ainda nao verificada. Deseja despachar mesmo assim?")) return
    if (frete === 0 && !confirm("Frete nao definido. Apos o despacho, o valor do frete nao podera mais ser alterado. Deseja continuar sem frete?")) return
    setLoading(true)
    setError(null)

    // Desconectado: copia já (preserva o gesto do clique p/ a clipboard). Conectado: envia pelo WhatsApp.
    if (!paired) {
      try { await navigator.clipboard.writeText(dispatchText) } catch {}
    }

    try {
      const { notified } = await dispatchToEntregador(pedidoId, selectedId, dispatchText)
      if (notified) {
        setResult("notified")
      } else {
        // estava conectado mas o envio falhou -> copia como plano B
        if (paired) { try { await navigator.clipboard.writeText(dispatchText) } catch {} }
        setResult(paired ? "send-failed" : "copied")
      }
    } catch (err: any) {
      setError(err.message ?? "Erro ao despachar")
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="lg" closeDisabled={loading} title="ENVIAR PARA ENTREGADOR">
      <div className="space-y-4">
        <div>
          <label className={fieldLabelClass}>Selecionar Entregador</label>
          {loadingList ? (
            <div className="px-4 py-3 rounded-lg border border-white/10 bg-brand-dark text-brand-warm-gray text-sm">
              Carregando...
            </div>
          ) : entregadores.length === 0 ? (
            <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              Nenhum entregador ativo. Cadastre um em Entregadores.
            </div>
          ) : (
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {entregadores.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} — {e.telefone}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <label className={fieldLabelClass}>Resumo do Pedido</label>
          <pre className="px-4 py-3 rounded-lg border border-white/10 bg-brand-dark text-brand-gray-light text-xs leading-relaxed whitespace-pre-wrap font-mono">
            {dispatchText}
          </pre>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {result ? (
          <div className="space-y-3 pt-2">
            {result === "notified" && (
              <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                ✅ Entregador notificado no WhatsApp!
              </p>
            )}
            {result === "copied" && (
              <p className="text-sm text-brand-yellow bg-brand-yellow/10 border border-brand-yellow/30 rounded-lg px-3 py-2">
                📋 Mensagem copiada! Cole no WhatsApp do entregador. (WhatsApp não conectado)
              </p>
            )}
            {result === "send-failed" && (
              <p className="text-sm text-brand-yellow bg-brand-yellow/10 border border-brand-yellow/30 rounded-lg px-3 py-2">
                ⚠️ Não consegui enviar pelo WhatsApp — mensagem copiada, cole no WhatsApp do entregador.
              </p>
            )}
            <Button onClick={onClose} fullWidth>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={loading || !selectedId || loadingList} className="flex-[2]">
              {loading ? "Despachando..." : paired ? "📲 Enviar e Confirmar" : "📋 Copiar e Confirmar"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default DispatchModal
