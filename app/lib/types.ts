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
  cpf: string | null
  documento_pessoal_url: string | null
  comprovante_residencia_url: string | null
  documento_verificado: boolean
  documento_verificado_em: string | null
  documento_verificado_por: string | null
  created_at: string
}

export type DocumentoStatus = "pendente" | "enviado" | "verificado"

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
  documento_status: DocumentoStatus
  endereco: string
  endereco_completo: EnderecoCompleto | null
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

export type EnderecoCompleto = {
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  complemento: string
  lat: number
  lng: number
}

export type ZonaExclusao = {
  id: string
  nome: string | null
  poligono: { lat: number; lng: number }[]
  created_at: string
}

export type HeroContent = {
  titulo: string
  subtitulo: string
  cta_texto: string
  cta_whatsapp_texto: string
}

export type FeatureItem = {
  titulo: string
  descricao: string
  icone: string
}

export type FeaturesContent = {
  titulo: string
  subtitulo: string
  items: FeatureItem[]
}

export type FaqItem = {
  pergunta: string
  resposta: string
}

export type FaqContent = {
  titulo: string
  subtitulo: string
  items: FaqItem[]
}

export type FooterContent = {
  texto: string
  links: { label: string; url: string }[]
}

export type CartItem = {
  produto: Produto
  quantidade: number
}
