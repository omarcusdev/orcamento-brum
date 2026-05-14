"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { updatePedido, addPedidoItem, removePedidoItem } from "@/lib/admin-actions"
import AddressAutocomplete, { type AddressData } from "@/components/address-autocomplete"
import type { Produto } from "@/lib/types"
import type { UpdatePedidoInput } from "@/lib/schemas"

type EditablePedido = {
  id: string
  status: string
  data_evento: string
  horario_evento: string
  endereco: string
  endereco_completo: {
    rua: string
    numero: string
    bairro: string
    cidade: string
    estado: string
    cep: string
    complemento: string
    lat: number
    lng: number
  } | null
  observacoes: string | null
  rampas_escadas: string | null
  tipo_chopeira: "gelo" | "eletrica"
  frete: number
  metodo_pagamento: "pix" | "cartao" | "dinheiro" | null
  pago: boolean
}

type EditableItem = {
  id: string
  produto_id: string
  quantidade: number
  is_consignado: boolean
  consignado_status: string | null
  subtotal: number
  produtos: { marca: string; volume_litros: number } | null
}

type Props = {
  open: boolean
  onClose: () => void
  pedido: EditablePedido
  items: EditableItem[]
  produtos: Produto[]
}

const inputClass = "w-full bg-brand-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-brand-warm-gray focus:border-brand-yellow/40 focus:outline-none"

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const EditOrderDrawer = ({ open, onClose, pedido, items, produtos }: Props) => {
  const [dataEvento, setDataEvento] = useState(pedido.data_evento)
  const [horarioEvento, setHorarioEvento] = useState(pedido.horario_evento.slice(0, 5))
  const [endereco, setEndereco] = useState(pedido.endereco)
  const [enderecoCompleto, setEnderecoCompleto] = useState(pedido.endereco_completo)
  const [observacoes, setObservacoes] = useState(pedido.observacoes ?? "")
  const [rampasEscadas, setRampasEscadas] = useState(pedido.rampas_escadas ?? "")
  const [tipoChopeira, setTipoChopeira] = useState<"gelo" | "eletrica">(pedido.tipo_chopeira)
  const [frete, setFrete] = useState(pedido.frete)
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao" | "dinheiro" | null>(pedido.metodo_pagamento)
  const [pago, setPago] = useState(pedido.pago)

  const [newItemProdutoId, setNewItemProdutoId] = useState(produtos[0]?.id ?? "")
  const [newItemQty, setNewItemQty] = useState(1)
  const [newItemConsignado, setNewItemConsignado] = useState(false)

  const [saving, setSaving] = useState(false)
  const [itemBusy, setItemBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAddressSelect = (addr: AddressData) => {
    setEndereco(addr.formatted)
    setEnderecoCompleto({
      rua: addr.rua,
      numero: addr.numero,
      bairro: addr.bairro,
      cidade: addr.cidade,
      estado: addr.estado,
      cep: addr.cep,
      complemento: enderecoCompleto?.complemento ?? "",
      lat: addr.lat,
      lng: addr.lng,
    })
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const changes: UpdatePedidoInput = {
        data_evento: dataEvento,
        horario_evento: horarioEvento,
        endereco,
        endereco_completo: enderecoCompleto ?? undefined,
        observacoes: observacoes || null,
        rampas_escadas: rampasEscadas || null,
        tipo_chopeira: tipoChopeira,
        frete,
        metodo_pagamento: metodoPagamento,
        pago,
      }
      await updatePedido(pedido.id, changes)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItemProdutoId) return
    setError(null)
    setItemBusy("add")
    try {
      if (newItemConsignado) {
        await addPedidoItem(pedido.id, newItemProdutoId, 1, true)
      } else {
        await addPedidoItem(pedido.id, newItemProdutoId, newItemQty, false)
      }
      setNewItemQty(1)
      setNewItemConsignado(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar item")
    } finally {
      setItemBusy(null)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm("Remover este item do pedido?")) return
    setError(null)
    setItemBusy(itemId)
    try {
      await removePedidoItem(itemId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover item")
    } finally {
      setItemBusy(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => !saving && onClose()}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-xl bg-brand-surface border-l border-white/10 overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-white tracking-wide">EDITAR PEDIDO</h2>
                <button onClick={onClose} disabled={saving} className="text-brand-warm-gray hover:text-white text-2xl leading-none disabled:opacity-50">×</button>
              </div>

              <section className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-brand-warm-gray block mb-1">Data</label>
                    <input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-brand-warm-gray block mb-1">Horario</label>
                    <input type="time" value={horarioEvento} onChange={(e) => setHorarioEvento(e.target.value)} className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-brand-warm-gray block mb-1">Endereco</label>
                  <p className="text-xs text-brand-warm-gray mb-1">{endereco}</p>
                  <AddressAutocomplete onAddressSelect={handleAddressSelect} inputClassName={inputClass} />
                </div>

                <div className="flex gap-2">
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={tipoChopeira === "gelo"} onChange={() => setTipoChopeira("gelo")} /> Chopeira gelo
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={tipoChopeira === "eletrica"} onChange={() => setTipoChopeira("eletrica")} /> Eletrica
                  </label>
                </div>

                <textarea placeholder="Rampas / escadas (opcional)" value={rampasEscadas} onChange={(e) => setRampasEscadas(e.target.value)} className={`${inputClass} h-16`} />
                <textarea placeholder="Observacoes (opcional)" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={`${inputClass} h-16`} />

                <div>
                  <label className="text-xs text-brand-warm-gray block mb-1">Frete (R$)</label>
                  <input type="number" min={0} step={0.01} value={frete} onChange={(e) => setFrete(Number(e.target.value))} className={inputClass} />
                </div>

                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={metodoPagamento === "pix"} onChange={() => setMetodoPagamento("pix")} /> Pix
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={metodoPagamento === "cartao"} onChange={() => setMetodoPagamento("cartao")} /> Cartao
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={metodoPagamento === "dinheiro"} onChange={() => setMetodoPagamento("dinheiro")} /> Dinheiro
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm text-white">
                  <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} /> Cliente ja pagou
                </label>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-brand-yellow uppercase tracking-wider mb-2">Itens</h3>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between bg-brand-dark border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <span className="text-brand-gray-light">
                        {item.quantidade}x {item.produtos?.marca} {item.produtos?.volume_litros}L
                        {item.is_consignado && (
                          <span className="text-yellow-400 ml-2">· consignado ({item.consignado_status})</span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-white">{formatCurrency(Number(item.subtotal))}</span>
                        <button
                          disabled={itemBusy !== null}
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-400 hover:bg-red-500/10 rounded px-2 disabled:opacity-50"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 bg-brand-dark border border-white/10 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-brand-warm-gray uppercase tracking-wider">Adicionar item</p>
                  <div className="flex gap-2">
                    <select value={newItemProdutoId} onChange={(e) => setNewItemProdutoId(e.target.value)} className={`${inputClass} flex-1`}>
                      {produtos.map((p) => <option key={p.id} value={p.id}>{p.marca} {p.volume_litros}L</option>)}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={newItemConsignado ? 1 : newItemQty}
                      disabled={newItemConsignado}
                      onChange={(e) => setNewItemQty(Number(e.target.value))}
                      className={`${inputClass} w-20`}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white">
                    <input type="checkbox" checked={newItemConsignado} onChange={(e) => setNewItemConsignado(e.target.checked)} />
                    Marcar como consignado
                  </label>
                  <button
                    onClick={handleAddItem}
                    disabled={itemBusy !== null || !newItemProdutoId}
                    className="w-full bg-brand-yellow/20 border border-brand-yellow/40 text-brand-yellow py-2 rounded text-sm hover:bg-brand-yellow/30 disabled:opacity-50"
                  >
                    {itemBusy === "add" ? "Adicionando..." : "+ Adicionar item"}
                  </button>
                </div>
              </section>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button onClick={onClose} disabled={saving} className="flex-1 border border-white/10 text-brand-gray-light py-2.5 rounded-lg text-sm disabled:opacity-50">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-brand-yellow text-brand-black font-bold py-2.5 rounded-lg text-sm disabled:opacity-50">
                  {saving ? "Salvando..." : "Salvar alteracoes"}
                </button>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default EditOrderDrawer
