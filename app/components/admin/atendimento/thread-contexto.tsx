"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import type { PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"
import { Button, Input } from "@/components/ui"
import {
  buscarClientes,
  getPedidosDoCliente,
  vincularConversaCliente,
  type ClienteBusca,
  type ConversaResumo,
  type PedidoResumoCliente,
} from "@/lib/whatsapp/chat-actions"
import {
  pedidoRefCurto,
  formatDataEvento,
  formatTotalBR,
  termoBuscaValido,
} from "@/lib/whatsapp/pedido-contexto"

const formatContato = (c: ConversaResumo) => c.nome ?? `+${c.telefone}`

type Props = { conversa: ConversaResumo; onVinculo: () => void }

const ThreadContexto = ({ conversa, onVinculo }: Props) => {
  const [pedidos, setPedidos] = useState<PedidoResumoCliente[]>([])
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [termo, setTermo] = useState("")
  const [resultados, setResultados] = useState<ClienteBusca[]>([])
  const [, startTransition] = useTransition()
  const buscaSeq = useRef(0)

  const clienteId = conversa.clienteId

  // Busca os pedidos quando a conversa tem cliente; limpa quando não tem.
  useEffect(() => {
    if (!clienteId) {
      setPedidos([])
      return
    }
    let ativo = true
    getPedidosDoCliente(clienteId).then((p) => {
      if (ativo) setPedidos(p)
    })
    return () => {
      ativo = false
    }
  }, [clienteId])

  // Fecha/zera o picker ao trocar de conversa.
  useEffect(() => {
    setBuscaAberta(false)
    setTermo("")
    setResultados([])
  }, [conversa.id])

  const onTermo = (v: string) => {
    setTermo(v)
    if (!termoBuscaValido(v)) {
      setResultados([])
      return
    }
    const seq = ++buscaSeq.current
    startTransition(async () => {
      const achados = await buscarClientes(v)
      // ignora respostas fora de ordem: só aplica se for a busca mais recente
      if (seq === buscaSeq.current) setResultados(achados)
    })
  }

  const vincular = (id: string) => {
    startTransition(async () => {
      const { ok } = await vincularConversaCliente(conversa.id, id)
      if (ok) {
        setBuscaAberta(false)
        setTermo("")
        setResultados([])
        onVinculo() // pai refaz getConversas → prop atualiza clienteId → efeito busca pedidos
      }
    })
  }

  const picker = (
    <div className="mt-2 space-y-2">
      <Input
        autoFocus
        value={termo}
        onChange={(e) => onTermo(e.target.value)}
        placeholder="Buscar cliente por nome ou telefone…"
        aria-label="Buscar cliente"
      />
      {resultados.length > 0 && (
        <ul className="max-h-40 overflow-y-auto divide-y divide-white/5 rounded-lg border border-white/10">
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => vincular(c.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition cursor-pointer"
              >
                <span className="text-white">{c.nome}</span>
                {c.telefone && <span className="text-brand-warm-gray"> · {c.telefone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {termoBuscaValido(termo) && resultados.length === 0 && (
        <p className="text-xs text-brand-warm-gray">Nenhum cliente encontrado.</p>
      )}
    </div>
  )

  return (
    <div className="border-b border-white/5 pb-3 mb-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white">{formatContato(conversa)}</span>
        {clienteId ? (
          <button
            type="button"
            onClick={() => setBuscaAberta((v) => !v)}
            className="text-xs text-brand-warm-gray hover:text-white transition cursor-pointer"
          >
            trocar cliente
          </button>
        ) : (
          !buscaAberta && (
            <Button variant="ghost" size="sm" onClick={() => setBuscaAberta(true)}>
              Vincular a um cliente
            </Button>
          )
        )}
      </div>

      {!clienteId && !buscaAberta && (
        <p className="text-xs text-brand-warm-gray mt-1">
          Sem cadastro — vincule a um cliente para ver os pedidos.
        </p>
      )}

      {clienteId && (
        <div className="mt-2 space-y-1">
          {pedidos.length === 0 ? (
            <p className="text-xs text-brand-warm-gray">Nenhum pedido ainda.</p>
          ) : (
            <>
              {pedidos.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/pedidos/${p.id}`}
                  className="flex items-center gap-2 text-sm hover:bg-white/5 rounded px-1 py-0.5 transition"
                >
                  <span className="font-mono text-xs text-brand-warm-gray">{pedidoRefCurto(p.id)}</span>
                  <OrderStatusBadge status={p.status as PedidoStatus} />
                  <span className="text-xs text-brand-warm-gray">{formatDataEvento(p.dataEvento)}</span>
                  <span className="text-white ml-auto">{formatTotalBR(p.total)}</span>
                </Link>
              ))}
              {pedidos.length > 5 && <p className="text-xs text-brand-warm-gray">+ mais pedidos</p>}
            </>
          )}
        </div>
      )}

      {buscaAberta && picker}
    </div>
  )
}

export default ThreadContexto
