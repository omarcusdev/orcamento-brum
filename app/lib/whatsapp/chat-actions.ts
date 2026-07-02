"use server"

import { requireAdmin } from "@/lib/auth"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { sanitizeTermoBusca } from "@/lib/whatsapp/pedido-contexto"
import { isTransbordoNotice } from "@/lib/whatsapp/transbordo"

export type ConversaResumo = {
  id: string
  telefone: string
  nome: string | null
  preview: string | null
  naoLidas: number
  ultimaEm: string | null
  clienteId: string | null
  sistema: boolean
}

export type MensagemChat = {
  id: string
  direcao: "entrada" | "saida"
  corpo: string
  ocorridaEm: string
}

// Conversa-level "sistema" flag — STRICT rule (plan `2026-07-02-whatsapp-inbox-media.md`,
// Task A2 / Global Constraints): a conversa is "sistema" only when it has ZERO inbound
// ("entrada") messages AND every message it does have matches the message-level transbordo
// rule (direcao='saida' + both TRANSBORDO_MARKERS present in corpo — see `isTransbordoNotice`
// in ./transbordo, the single source of truth for the marker strings). This keeps mixed
// threads (>=1 real inbound + a notice) classified as normal customer threads.
// SQL-equivalent over mensagens_conversa_whatsapp for this predicate (kept here in prose
// since the TS helper can't run inside Postgres):
//   NOT EXISTS (msg WHERE direcao = 'entrada')
//   AND NOT EXISTS (msg WHERE NOT (corpo LIKE '%AVISO DE TRANSBORDO%' AND corpo LIKE '%Anotei aqui%'))
// A conversa with no messages at all is never "sistema" (empty-array vacuous-truth guard).
const isConversaSistema = (mensagens: { direcao: string; corpo: string }[]): boolean => {
  if (mensagens.length === 0) return false
  if (mensagens.some((m) => m.direcao === "entrada")) return false
  return mensagens.every((m) => m.direcao === "saida" && isTransbordoNotice(m.corpo))
}

export const getConversas = async (): Promise<ConversaResumo[]> => {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("conversas_whatsapp")
    .select(
      "id, telefone, nome_exibicao, ultima_mensagem_preview, nao_lidas, ultima_mensagem_em, cliente_id, mensagens_conversa_whatsapp(direcao, corpo)",
    )
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })

  return (data ?? []).map((r) => ({
    id: r.id,
    telefone: r.telefone,
    nome: r.nome_exibicao,
    preview: r.ultima_mensagem_preview,
    naoLidas: r.nao_lidas,
    ultimaEm: r.ultima_mensagem_em,
    clienteId: r.cliente_id,
    sistema: isConversaSistema(((r.mensagens_conversa_whatsapp as unknown[]) ?? []) as { direcao: string; corpo: string }[]),
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

export type PedidoResumoCliente = {
  id: string
  status: string
  dataEvento: string
  total: number
}

// Últimos pedidos do cliente (mais recentes primeiro). Limite 6: a UI mostra 5 e
// sinaliza "+ mais" se vier um 6º.
export const getPedidosDoCliente = async (clienteId: string): Promise<PedidoResumoCliente[]> => {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("pedidos")
    .select("id, status, data_evento, total")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(6)

  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    dataEvento: r.data_evento,
    total: Number(r.total),
  }))
}

export type ClienteBusca = { id: string; nome: string; telefone: string | null }

// Busca para o picker do vincular: nome OU telefone. Termo é sanitizado (anti-injeção
// no `.or()`) e exige >= 2 chars úteis, senão retorna [] sem ir ao banco.
export const buscarClientes = async (termo: string): Promise<ClienteBusca[]> => {
  const safe = sanitizeTermoBusca(termo)
  if (safe.length < 2) return []

  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("clientes")
    .select("id, nome, telefone")
    .or(`nome.ilike.%${safe}%,telefone.ilike.%${safe}%`)
    .limit(8)

  return (data ?? []).map((r) => ({ id: r.id, nome: r.nome, telefone: r.telefone }))
}

// Vincula (ou troca) o cliente de uma conversa. Reusa a policy de UPDATE admin
// que o markConversaRead já usa — sem migration.
export const vincularConversaCliente = async (
  conversaId: string,
  clienteId: string,
): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from("conversas_whatsapp")
    .update({ cliente_id: clienteId })
    .eq("id", conversaId)

  return { ok: !error }
}
