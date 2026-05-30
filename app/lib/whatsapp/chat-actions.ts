"use server"

import { requireAdmin } from "@/lib/auth"
import { sendWhatsAppMessage } from "@/lib/whatsapp"

export type ConversaResumo = {
  id: string
  telefone: string
  nome: string | null
  preview: string | null
  naoLidas: number
  ultimaEm: string | null
  clienteId: string | null
}

export type MensagemChat = {
  id: string
  direcao: "entrada" | "saida"
  corpo: string
  ocorridaEm: string
}

export const getConversas = async (): Promise<ConversaResumo[]> => {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("conversas_whatsapp")
    .select("id, telefone, nome_exibicao, ultima_mensagem_preview, nao_lidas, ultima_mensagem_em, cliente_id")
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })

  return (data ?? []).map((r) => ({
    id: r.id,
    telefone: r.telefone,
    nome: r.nome_exibicao,
    preview: r.ultima_mensagem_preview,
    naoLidas: r.nao_lidas,
    ultimaEm: r.ultima_mensagem_em,
    clienteId: r.cliente_id,
  }))
}

export const getConversaMensagens = async (conversaId: string): Promise<MensagemChat[]> => {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("mensagens_conversa_whatsapp")
    .select("id, direcao, corpo, ocorrida_em")
    .eq("conversa_id", conversaId)
    .order("ocorrida_em", { ascending: true })

  return (data ?? []).map((r) => ({ id: r.id, direcao: r.direcao, corpo: r.corpo, ocorridaEm: r.ocorrida_em }))
}

export const markConversaRead = async (conversaId: string): Promise<void> => {
  const { supabase } = await requireAdmin()
  await supabase.from("conversas_whatsapp").update({ nao_lidas: 0 }).eq("id", conversaId)
}

export const enviarRespostaChat = async (conversaId: string, texto: string): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()
  const trimmed = texto.trim()
  if (!trimmed) return { ok: false }

  const { data: conversa } = await supabase
    .from("conversas_whatsapp")
    .select("telefone")
    .eq("id", conversaId)
    .single()

  if (!conversa?.telefone) return { ok: false }

  // Não insere a linha aqui — ela chega pelo echo (messages.upsert fromMe). Fonte única.
  const result = await sendWhatsAppMessage(conversa.telefone, trimmed)
  return { ok: result.ok }
}

export const excluirConversa = async (conversaId: string): Promise<void> => {
  const { supabase } = await requireAdmin()
  // Exclusão por titular (LGPD). Cascade apaga as mensagens.
  await supabase.from("conversas_whatsapp").delete().eq("id", conversaId)
}
