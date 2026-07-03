"use server"

import { requireAdmin } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { sanitizeTermoBusca } from "@/lib/whatsapp/pedido-contexto"

export type MidiaTipo = "image" | "audio" | "video" | "document" | "sticker"

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
  midiaTipo: MidiaTipo | null
  // URL assinada de curta duração (5 min) pros bytes no bucket privado whatsapp-media.
  // null quando a mensagem não tem mídia OU o EC2 não subiu os bytes (só placeholder).
  midiaUrl: string | null
}

// Storage bucket privado dos bytes de mídia recebida (migration 030).
const MEDIA_BUCKET = "whatsapp-media"
const SIGNED_URL_TTL_SECONDS = 300

// A flag "sistema" (conversa é só eco de avisos de transbordo, sem inbound real) é computada
// no Postgres pela view conversas_whatsapp_lista (migration 030) — antes carregávamos direcao+corpo
// de TODA mensagem via embed PostgREST só pra reduzir esse booleano no cliente, mandando os corpos
// inteiros pro browser a cada render/refresh de realtime. A regra STRICT e os TRANSBORDO_MARKERS
// vivem em ./transbordo (fonte única em prosa); a view espelha os mesmos marcadores.
export const getConversas = async (): Promise<ConversaResumo[]> => {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("conversas_whatsapp_lista")
    .select("id, telefone, nome_exibicao, ultima_mensagem_preview, nao_lidas, ultima_mensagem_em, cliente_id, sistema")
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })

  return (data ?? []).map((r) => ({
    id: r.id,
    telefone: r.telefone,
    nome: r.nome_exibicao,
    preview: r.ultima_mensagem_preview,
    naoLidas: r.nao_lidas,
    ultimaEm: r.ultima_mensagem_em,
    clienteId: r.cliente_id,
    sistema: r.sistema,
  }))
}

export const getConversaMensagens = async (conversaId: string): Promise<MensagemChat[]> => {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("mensagens_conversa_whatsapp")
    .select("id, direcao, corpo, ocorrida_em, midia_tipo, midia_path")
    .eq("conversa_id", conversaId)
    .order("ocorrida_em", { ascending: true })

  const rows = (data ?? []) as {
    id: string
    direcao: "entrada" | "saida"
    corpo: string
    ocorrida_em: string
    midia_tipo: MidiaTipo | null
    midia_path: string | null
  }[]

  // Assina em UMA chamada todas as URLs da página (o refetch do realtime precisa continuar
  // barato — nada de round-trip por linha). Espelha getDocumentSignedUrlByPath, mas em lote.
  const paths = rows.map((r) => r.midia_path).filter((p): p is string => Boolean(p))
  const signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await createServiceClient()
      .storage.from(MEDIA_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl)
    }
  }

  return rows.map((r) => ({
    id: r.id,
    direcao: r.direcao,
    corpo: r.corpo,
    ocorridaEm: r.ocorrida_em,
    midiaTipo: r.midia_tipo,
    midiaUrl: r.midia_path ? (signedByPath.get(r.midia_path) ?? null) : null,
  }))
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
