"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import EditOrderDrawer from "@/components/admin/edit-order-drawer"
import { Button } from "@/components/ui"
import type { Produto } from "@/lib/types"

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
  desconto: number
  metodo_pagamento: "pix" | "cartao" | "dinheiro" | null
  pago: boolean
}

type EditableItem = {
  id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  is_consignado: boolean
  consignado_status: string | null
  subtotal: number
  produtos: { marca: string; volume_litros: number } | null
}

type Props = {
  pedido: EditablePedido
  items: EditableItem[]
  produtos: Produto[]
}

const EditOrderTrigger = ({ pedido, items, produtos }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="ghost-yellow" fullWidth onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
        Editar pedido
      </Button>
      <EditOrderDrawer
        open={open}
        onClose={() => setOpen(false)}
        pedido={pedido}
        items={items}
        produtos={produtos}
      />
    </>
  )
}

export default EditOrderTrigger
