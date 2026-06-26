"use server"

import { requireAdmin } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

export const verifyDocument = async (clienteId: string, pedidoId: string) => {
  const { supabase, user } = await requireAdmin()

  const { error: clienteError } = await supabase
    .from("clientes")
    .update({
      documento_verificado: true,
      documento_verificado_em: new Date().toISOString(),
      documento_verificado_por: user.id,
    })
    .eq("id", clienteId)
  if (clienteError) throw clienteError

  const { error: pedidoError } = await supabase
    .from("pedidos")
    .update({ documento_status: "verificado" })
    .eq("id", pedidoId)
  if (pedidoError) throw pedidoError

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

export const getDocumentSignedUrl = async (clienteId: string, tipo: "pessoal" | "residencia") => {
  await requireAdmin()
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage
    .from("documentos")
    .createSignedUrl(`${clienteId}/${tipo}`, 300)
  if (error) throw error
  return data.signedUrl
}

export const getDocumentSignedUrlByPath = async (storagePath: string) => {
  await requireAdmin()
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage
    .from("documentos")
    .createSignedUrl(storagePath, 300)
  if (error) throw error
  return data.signedUrl
}

export const revertDocumentoVerificacao = async (clienteId: string) => {
  const { supabase, user } = await requireAdmin()

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("documento_status", "verificado")

  const { error: clienteError } = await supabase
    .from("clientes")
    .update({
      documento_verificado: false,
      documento_verificado_em: null,
      documento_verificado_por: null,
    })
    .eq("id", clienteId)
  if (clienteError) throw clienteError

  if (pedidos && pedidos.length > 0) {
    const pedidoIds = pedidos.map((p) => p.id)
    await supabase
      .from("pedidos")
      .update({ documento_status: "enviado" })
      .in("id", pedidoIds)

    await supabase.from("pedido_edit_log").insert(
      pedidoIds.map((pedido_id) => ({
        pedido_id,
        field: "documento_status",
        old_value: "verificado",
        new_value: "enviado",
        changed_by: user.id,
      })),
    )

    for (const pedidoId of pedidoIds) {
      revalidatePath(`/admin/pedidos/${pedidoId}`)
    }
  }

  revalidatePath("/admin")
}
