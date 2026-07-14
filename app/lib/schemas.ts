import { z } from "zod"
import { validateCpf } from "@/lib/cpf"
import { isBeforeMinLeadTime, minLeadTimeMessage } from "@/lib/checkout-validation"
import { hasFirmeItem, REQUIRE_FIRME_MESSAGE } from "@/lib/pricing"

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
  horario_evento: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endereco_rua: z.string().max(300).optional().or(z.literal("")),
  endereco_numero: z.string().max(20).optional().or(z.literal("")),
  endereco_bairro: z.string().min(1).max(200),
  endereco_cidade: z.string().min(1).max(200),
  endereco_estado: z.string().length(2),
  endereco_cep: z.string().regex(/^\d{5}-?\d{3}$/).optional().or(z.literal("")),
  endereco_complemento: z.string().max(200).optional().or(z.literal("")),
  endereco_lat: z.number().min(-90).max(90),
  endereco_lng: z.number().min(-180).max(180),
  observacoes: z.string().max(1000).optional().or(z.literal("")),
  rampas_escadas: z.string().max(500).optional().or(z.literal("")),
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
}).superRefine((val, ctx) => {
  if (isBeforeMinLeadTime(val.data_evento, val.horario_evento)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["horario_evento"],
      message: minLeadTimeMessage,
    })
  }
})

export const productSchema = z.object({
  marca: z.string().min(1).max(200),
  descricao: z.string().max(500).optional().or(z.literal("")),
  volume_litros: z.number().refine((v) => v === 30 || v === 50, "Volume deve ser 30 ou 50"),
  preco_avista: z.number().positive().max(99999),
  preco_cartao: z.number().positive().max(99999).optional().nullable(),
  preco_segundo_barril: z.number().positive().max(99999).optional().nullable(),
  tipo: z.enum(["chopp", "vinho"]),
})

export const entregadorSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
  telefone: z.string().regex(phoneRegex, "Telefone invalido"),
})

const enderecoCompletoSchema = z.object({
  rua: z.string(),
  numero: z.string(),
  bairro: z.string(),
  cidade: z.string(),
  estado: z.string().length(2),
  cep: z.string(),
  complemento: z.string(),
  lat: z.number(),
  lng: z.number(),
})

const manualOrderItemSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().int().min(1).max(100),
  is_consignado: z.boolean(),
})

const manualOrderClienteExistingSchema = z.object({
  kind: z.literal("existing"),
  id: z.string().uuid(),
})

const manualOrderClienteNewSchema = z.object({
  kind: z.literal("new"),
  nome: z.string().min(2).max(200),
  telefone: z.string().regex(phoneRegex, "Telefone invalido"),
  cpf: z.string().nullable().optional(),
  email: z.string().email().max(254).nullable().optional(),
})

export const manualOrderInputSchema = z.object({
  cliente: z.discriminatedUnion("kind", [manualOrderClienteExistingSchema, manualOrderClienteNewSchema]),
  endereco: z.string().min(1).max(500),
  endereco_completo: enderecoCompletoSchema.nullable(),
  data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horario_evento: z.string().regex(/^\d{2}:\d{2}$/),
  tipo_chopeira: z.enum(["gelo", "eletrica"]),
  rampas_escadas: z.string().max(500).nullable(),
  observacoes: z.string().max(1000).nullable(),
  items: z.array(manualOrderItemSchema).min(1),
  metodo_pagamento: z.enum(["pix", "cartao", "dinheiro"]),
  pago: z.boolean(),
  frete: z.number().nonnegative(),
}).superRefine((val, ctx) => {
  // Trava: pedido 100% consignado é inválido — exige ao menos 1 barril firme.
  if (!hasFirmeItem(val.items)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items"],
      message: REQUIRE_FIRME_MESSAGE,
    })
  }
})

export type ManualOrderInput = z.infer<typeof manualOrderInputSchema>

export const updatePedidoSchema = z.object({
  data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  horario_evento: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endereco: z.string().min(1).max(500).optional(),
  endereco_completo: enderecoCompletoSchema.optional(),
  observacoes: z.string().max(1000).nullable().optional(),
  rampas_escadas: z.string().max(500).nullable().optional(),
  tipo_chopeira: z.enum(["gelo", "eletrica"]).optional(),
  frete: z.number().nonnegative().optional(),
  desconto: z.number().nonnegative().optional(),
  metodo_pagamento: z.enum(["pix", "cartao", "dinheiro"]).nullable().optional(),
  pago: z.boolean().optional(),
})

export type UpdatePedidoInput = z.infer<typeof updatePedidoSchema>

export const updatePedidoItemSchema = z.object({
  quantidade: z.number().int().positive().optional(),
  preco_unitario: z.number().nonnegative().optional(),
})

export type UpdatePedidoItemInput = z.infer<typeof updatePedidoItemSchema>
