export type Produto = {
  id: string
  marca: string
  descricao: string | null
  volume_litros: number
  preco_avista: number
  preco_cartao: number | null
  tipo: "chopp" | "vinho"
  foto_url: string | null
  ativo: boolean
  created_at: string
}

export type Cliente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  created_at: string
}

export type PedidoStatus =
  | "novo"
  | "aguardando_pagamento"
  | "confirmado"
  | "em_rota"
  | "entregue"
  | "recolhido"
  | "finalizado"
  | "cancelado"

export type Pedido = {
  id: string
  cliente_id: string
  status: PedidoStatus
  endereco: string
  data_evento: string
  horario_evento: string
  observacoes: string | null
  tipo_chopeira: "gelo" | "eletrica"
  subtotal: number
  desconto: number
  total: number
  metodo_pagamento: "pix" | "cartao" | "dinheiro" | null
  pago: boolean
  created_at: string
  updated_at: string
}

export type PedidoItem = {
  id: string
  pedido_id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export type PedidoStatusLog = {
  id: string
  pedido_id: string
  status_anterior: string | null
  status_novo: string
  changed_at: string
  changed_by: string | null
}

export type CartItem = {
  produto: Produto
  quantidade: number
}
