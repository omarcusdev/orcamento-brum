"use server"

import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { manualOrderInputSchema, updatePedidoSchema, updatePedidoItemSchema, type ManualOrderInput, type UpdatePedidoInput, type UpdatePedidoItemInput } from "@/lib/schemas"
import { calculateStoredTotals, priceManualOrderLines, barrelUnitPrices } from "@/lib/pricing"
import { LOCKED_EDIT_STATUSES, isFreteLocked } from "@/lib/admin-status"
import { after } from "next/server"
import { sendCustomerWhatsAppConfirmation } from "@/lib/whatsapp/notificacoes"
import { sendCustomerOrderConfirmation } from "@/lib/email"
import { revalidatePedido } from "./revalidate"

export const updateFrete = async (pedidoId: string, frete: number) => {
  const { supabase } = await requireAdmin()

  if (frete < 0) throw new Error("Frete nao pode ser negativo")

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("subtotal, desconto, status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")

  if (isFreteLocked(pedido.status)) {
    throw new Error("Frete nao pode ser alterado apos despacho")
  }

  const total = pedido.subtotal - pedido.desconto + frete

  const { error } = await supabase
    .from("pedidos")
    .update({ frete, total })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePedido(pedidoId)
}

export const searchClientes = async (query: string) => {
  const { supabase } = await requireAdmin()
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const sanitized = trimmed.replace(/\D/g, "")
  const filters: string[] = [`nome.ilike.%${trimmed}%`]
  if (sanitized.length >= 2) {
    filters.push(`telefone.ilike.%${sanitized}%`)
    filters.push(`cpf.ilike.%${sanitized}%`)
  }
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome, telefone, cpf, email, documento_verificado")
    .or(filters.join(","))
    .limit(8)
  if (error) throw error
  return data ?? []
}

export const createManualOrder = async (input: ManualOrderInput) => {
  const parsed = manualOrderInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  }
  const data = parsed.data
  const { supabase, user } = await requireAdmin()

  const productIds = data.items.map((i) => i.produto_id)
  const { data: produtos, error: produtosErr } = await supabase
    .from("produtos")
    .select("id, preco_avista, preco_cartao, preco_segundo_barril, ativo")
    .in("id", productIds)
  if (produtosErr || !produtos) throw new Error("Erro ao buscar produtos")

  type ItemRow = {
    produto_id: string
    quantidade: number
    preco_unitario: number
    subtotal: number
    is_consignado: boolean
    consignado_status: "pendente" | null
  }
  for (const inputItem of data.items) {
    const produto = produtos.find((p) => p.id === inputItem.produto_id)
    if (!produto) throw new Error(`Produto nao encontrado: ${inputItem.produto_id}`)
    if (!produto.ativo) throw new Error("Produto indisponivel")
  }

  const itemRows: ItemRow[] = priceManualOrderLines(data.items, produtos, data.metodo_pagamento).flatMap((line): ItemRow[] =>
    line.is_consignado
      ? line.barrelPrices.map((price) => ({
          produto_id: line.produto_id,
          quantidade: 1,
          preco_unitario: price,
          subtotal: price,
          is_consignado: true,
          consignado_status: "pendente" as const,
        }))
      : [{
          produto_id: line.produto_id,
          quantidade: line.quantidade,
          preco_unitario: line.precoUnitario,
          subtotal: line.subtotal,
          is_consignado: false,
          consignado_status: null,
        }],
  )

  // Valor cheio: consignado conta como usado até ser devolvido (não nasce R$ 0). desconto=0 no manual.
  const { subtotal, total } = calculateStoredTotals(
    itemRows.map((r) => ({
      subtotal: r.subtotal,
      is_consignado: r.is_consignado,
      consignado_status: r.consignado_status,
    })),
    data.frete,
    0,
  )

  // Discriminated union is read-only — build explicit payload so CPF is digit-only for new clientes.
  const clientePayload = data.cliente.kind === "existing"
    ? data.cliente
    : { kind: "new" as const, nome: data.cliente.nome, telefone: data.cliente.telefone, cpf: data.cliente.cpf?.replace(/\D/g, "") ?? null, email: data.cliente.email ?? null }

  // Single transactional RPC: cliente (upsert-or-reuse) + pedido + itens + status_log in one shot.
  // A mid-way failure inside the function rolls back everything — no orphaned clientes.
  const { data: pedidoId, error: rpcErr } = await supabase.rpc("create_manual_order", {
    p_cliente: clientePayload,
    p_pedido: {
      endereco: data.endereco,
      endereco_completo: data.endereco_completo,
      data_evento: data.data_evento,
      horario_evento: data.horario_evento,
      tipo_chopeira: data.tipo_chopeira,
      rampas_escadas: data.rampas_escadas,
      observacoes: data.observacoes,
      subtotal,
      desconto: 0,
      frete: data.frete,
      total,
      metodo_pagamento: data.metodo_pagamento,
      pago: data.pago,
    },
    p_itens: itemRows,
    p_user: user.id,
  })
  if (rpcErr || !pedidoId) throw new Error(`Erro ao criar pedido: ${rpcErr?.message ?? "desconhecido"}`)

  revalidatePath("/admin")
  revalidatePath("/admin/pedidos")

  // Confirmação ao cliente (mesma do checkout): e-mail (se houver e-mail) + WhatsApp (gated pela
  // flag whatsapp_confirmacao_ativo). Sem o e-mail interno de "novo pedido" — o admin acabou de criar.
  // Via after(): falha de envio nunca quebra a criação do pedido.
  after(() => sendCustomerOrderConfirmation(pedidoId))
  after(() => sendCustomerWhatsAppConfirmation(pedidoId))

  return { pedidoId }
}

export const settleConsignado = async (pedidoItemId: string, status: "usado" | "devolvido") => {
  const { supabase, user } = await requireAdmin()

  const { data: item } = await supabase
    .from("pedido_itens")
    .select("id, pedido_id, is_consignado, consignado_status")
    .eq("id", pedidoItemId)
    .single()
  if (!item) throw new Error("Item nao encontrado")
  if (!item.is_consignado) throw new Error("Item nao eh consignado")
  if (item.consignado_status !== "pendente") throw new Error("Consignado ja foi settled")

  const { error: updateErr } = await supabase
    .from("pedido_itens")
    .update({ consignado_status: status })
    .eq("id", pedidoItemId)
  if (updateErr) throw updateErr

  // Recalcula o total armazenado (valor cheio: abate só os barris DEVOLVIDOS) — mesma regra
  // da criação e da edição de itens.
  await recalcPedidoTotals(item.pedido_id)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: item.pedido_id,
    field: "consignado_status",
    old_value: "pendente",
    new_value: status,
    changed_by: user.id,
  })

  revalidatePedido(item.pedido_id)
}

export const updatePedido = async (pedidoId: string, input: UpdatePedidoInput) => {
  const parsed = updatePedidoSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  }
  const changes = parsed.data
  const { supabase, user } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", pedidoId)
    .single()
  if (!pedido) throw new Error("Pedido nao encontrado")
  if (LOCKED_EDIT_STATUSES.includes(pedido.status)) {
    throw new Error(`Pedido em status ${pedido.status} nao pode ser editado`)
  }
  if (isFreteLocked(pedido.status) && changes.frete !== undefined && changes.frete !== pedido.frete) {
    throw new Error("Frete nao pode ser alterado apos despacho")
  }

  const diffs: { field: string; old_value: unknown; new_value: unknown }[] = []
  const updates: Record<string, unknown> = {}

  for (const [key, newValue] of Object.entries(changes)) {
    if (newValue === undefined) continue
    const oldValue = (pedido as Record<string, unknown>)[key]
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue
    updates[key] = newValue
    diffs.push({ field: key, old_value: oldValue, new_value: newValue })
  }

  if (Object.keys(updates).length === 0) return

  if ("frete" in updates || "desconto" in updates) {
    const subtotal = Number(pedido.subtotal ?? 0)
    const nextFrete = "frete" in updates ? Number(updates.frete) : Number(pedido.frete ?? 0)
    const nextDesconto = "desconto" in updates ? Number(updates.desconto) : Number(pedido.desconto ?? 0)
    updates.total = Number((subtotal - nextDesconto + nextFrete).toFixed(2))
  }

  updates.updated_at = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from("pedidos")
    .update(updates)
    .eq("id", pedidoId)
  if (updateErr) throw updateErr

  await supabase.from("pedido_edit_log").insert(
    diffs.map((d) => ({ ...d, pedido_id: pedidoId, changed_by: user.id })),
  )

  revalidatePedido(pedidoId)
}

const recalcPedidoTotals = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()
  const { data: items } = await supabase
    .from("pedido_itens")
    .select("subtotal, is_consignado, consignado_status")
    .eq("pedido_id", pedidoId)
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("frete, desconto")
    .eq("id", pedidoId)
    .single()
  // Valor cheio (mesma regra da criação/acerto): consignado conta como usado até ser devolvido.
  const { subtotal: newSubtotal, total: newTotal } = calculateStoredTotals(
    (items ?? []).map((i) => ({
      subtotal: Number(i.subtotal),
      is_consignado: i.is_consignado,
      consignado_status: i.consignado_status,
    })),
    Number(pedido?.frete ?? 0),
    Number(pedido?.desconto ?? 0),
  )
  await supabase
    .from("pedidos")
    .update({ subtotal: newSubtotal, total: newTotal, updated_at: new Date().toISOString() })
    .eq("id", pedidoId)
}

export const addPedidoItem = async (
  pedidoId: string,
  produtoId: string,
  quantidade: number,
  isConsignado: boolean,
) => {
  const { supabase, user } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status, metodo_pagamento")
    .eq("id", pedidoId)
    .single()
  if (!pedido) throw new Error("Pedido nao encontrado")
  if (LOCKED_EDIT_STATUSES.includes(pedido.status)) throw new Error("Pedido travado")

  const { data: produto } = await supabase
    .from("produtos")
    .select("preco_avista, preco_cartao, preco_segundo_barril")
    .eq("id", produtoId)
    .single()
  if (!produto) throw new Error("Produto nao encontrado")

  const { firstUnitPrice, secondUnitPrice } = barrelUnitPrices(
    { id: produtoId, preco_avista: Number(produto.preco_avista), preco_cartao: produto.preco_cartao != null ? Number(produto.preco_cartao) : null, preco_segundo_barril: produto.preco_segundo_barril != null ? Number(produto.preco_segundo_barril) : null },
    pedido.metodo_pagamento === "cartao" ? "cartao" : "pix",
  )

  if (isConsignado) {
    const consignadoQty = Math.max(1, Math.floor(quantidade))
    const rows = Array.from({ length: consignadoQty }, (_, i) => {
      const unitPrice = i === 0 ? firstUnitPrice : secondUnitPrice
      return {
        pedido_id: pedidoId,
        produto_id: produtoId,
        quantidade: 1,
        preco_unitario: unitPrice,
        subtotal: unitPrice,
        is_consignado: true,
        consignado_status: "pendente" as const,
      }
    })
    const { error } = await supabase.from("pedido_itens").insert(rows)
    if (error) throw error
  } else {
    const subtotal = quantidade === 1 ? firstUnitPrice : firstUnitPrice + secondUnitPrice * (quantidade - 1)
    const unitAverage = quantidade > 0 ? subtotal / quantidade : firstUnitPrice
    const { error } = await supabase.from("pedido_itens").insert({
      pedido_id: pedidoId,
      produto_id: produtoId,
      quantidade,
      preco_unitario: Number(unitAverage.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      is_consignado: false,
      consignado_status: null,
    })
    if (error) throw error
  }

  await recalcPedidoTotals(pedidoId)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: pedidoId,
    field: "items.added",
    old_value: null,
    new_value: { produto_id: produtoId, quantidade, is_consignado: isConsignado },
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${pedidoId}`)
}

export const updatePedidoItem = async (itemId: string, input: UpdatePedidoItemInput) => {
  const parsed = updatePedidoItemSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  const changes = parsed.data
  if (changes.quantidade === undefined && changes.preco_unitario === undefined) return

  const { supabase, user } = await requireAdmin()

  const { data: item } = await supabase
    .from("pedido_itens")
    .select("id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, is_consignado, consignado_status, pedidos:pedido_id(status)")
    .eq("id", itemId)
    .single()
  if (!item) throw new Error("Item nao encontrado")
  const pedidoStatus = Array.isArray(item.pedidos) ? item.pedidos[0]?.status : (item.pedidos as { status?: string } | null)?.status
  if (pedidoStatus && LOCKED_EDIT_STATUSES.includes(pedidoStatus)) throw new Error("Pedido travado")
  if (item.is_consignado && changes.quantidade !== undefined && changes.quantidade !== 1) {
    throw new Error("Itens consignado tem quantidade fixa de 1 por linha")
  }

  const nextQuantidade = changes.quantidade ?? item.quantidade
  const nextPrecoUnitario = changes.preco_unitario ?? Number(item.preco_unitario)
  const nextSubtotal = Number((nextPrecoUnitario * nextQuantidade).toFixed(2))

  const updates: Record<string, unknown> = {
    quantidade: nextQuantidade,
    preco_unitario: nextPrecoUnitario,
    subtotal: nextSubtotal,
  }

  const { error: updateErr } = await supabase.from("pedido_itens").update(updates).eq("id", itemId)
  if (updateErr) throw updateErr

  await recalcPedidoTotals(item.pedido_id)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: item.pedido_id,
    field: "items.updated",
    old_value: {
      id: itemId,
      quantidade: item.quantidade,
      preco_unitario: Number(item.preco_unitario),
      subtotal: Number(item.subtotal),
    },
    new_value: { id: itemId, ...updates },
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${item.pedido_id}`)
}

export const removePedidoItem = async (itemId: string) => {
  const { supabase, user } = await requireAdmin()

  const { data: item } = await supabase
    .from("pedido_itens")
    .select("id, pedido_id, produto_id, quantidade, is_consignado, consignado_status, pedidos:pedido_id(status)")
    .eq("id", itemId)
    .single()
  if (!item) throw new Error("Item nao encontrado")
  const pedidoStatus = Array.isArray(item.pedidos) ? item.pedidos[0]?.status : (item.pedidos as { status?: string } | null)?.status
  if (pedidoStatus && LOCKED_EDIT_STATUSES.includes(pedidoStatus)) throw new Error("Pedido travado")

  const { error: delErr } = await supabase.from("pedido_itens").delete().eq("id", itemId)
  if (delErr) throw delErr

  await recalcPedidoTotals(item.pedido_id)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: item.pedido_id,
    field: "items.removed",
    old_value: {
      id: itemId,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      is_consignado: item.is_consignado,
    },
    new_value: null,
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${item.pedido_id}`)
}
