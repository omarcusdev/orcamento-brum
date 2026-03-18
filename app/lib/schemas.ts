import { z } from "zod"
import { validateCpf } from "@/lib/cpf"

const phoneRegex = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/

export const createOrderSchema = z.object({
  nome: z.string().min(2).max(200),
  telefone: z.string().regex(phoneRegex, "Telefone invalido"),
  email: z.string().email().max(254).optional().or(z.literal("")),
  cpf: z.string().refine(validateCpf, "CPF invalido"),
  data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((val) => {
    const event = new Date(val + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return event >= today
  }, "Data do evento nao pode ser no passado"),
  horario_evento: z.string().regex(/^\d{2}:\d{2}$/),
  endereco_rua: z.string().min(2).max(300),
  endereco_numero: z.string().max(20),
  endereco_bairro: z.string().min(1).max(200),
  endereco_cidade: z.string().min(1).max(200),
  endereco_estado: z.string().length(2),
  endereco_cep: z.string().regex(/^\d{5}-?\d{3}$/),
  endereco_complemento: z.string().max(200).optional().or(z.literal("")),
  endereco_lat: z.number().min(-90).max(90),
  endereco_lng: z.number().min(-180).max(180),
  observacoes: z.string().max(1000).optional().or(z.literal("")),
  tipo_chopeira: z.enum(["gelo", "eletrica"]),
  metodo_pagamento: z.enum(["pix", "cartao", "dinheiro"]),
  items: z
    .array(
      z.object({
        produto_id: z.string().uuid(),
        quantidade: z.number().int().min(1).max(100),
      })
    )
    .min(1, "Pedido deve ter pelo menos um item"),
})

export const productSchema = z.object({
  marca: z.string().min(1).max(200),
  descricao: z.string().max(500).optional().or(z.literal("")),
  volume_litros: z.number().refine((v) => v === 30 || v === 50, "Volume deve ser 30 ou 50"),
  preco_avista: z.number().positive().max(99999),
  preco_cartao: z.number().positive().max(99999).optional().nullable(),
  tipo: z.enum(["chopp", "vinho"]),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type ProductInput = z.infer<typeof productSchema>
