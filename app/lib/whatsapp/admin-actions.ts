"use server"

import { revalidatePath } from "next/cache"
import QRCode from "qrcode"
import { requireAdmin } from "@/lib/auth"
import {
  fetchConnection,
  postLogout,
  startPairing,
  type PairingMethod,
  type WhatsappConnectionStatus,
} from "./control"
import {
  WHATSAPP_FEATURE_KEYS,
  parseFlag,
  type WhatsappFeatureKey,
} from "./features"
import {
  STATUS_NOTIFY_STATUSES,
  DEFAULT_STATUS_MESSAGES,
  isNotifyStatus,
  statusFlagKey,
  statusMsgKey,
  type NotifyStatus,
} from "./status-messages"
import {
  LEMBRETE_FLAG_KEY,
  LEMBRETE_HORA_KEY,
  LEMBRETE_MSG_KEY,
  DEFAULT_LEMBRETE_MSG,
  parseHora,
} from "./lembrete-message"
import {
  BOT_SAUDACAO_FLAG_KEY,
  BOT_SAUDACAO_MSG_KEY,
  BOT_SAUDACAO_JANELA_KEY,
  DEFAULT_BOT_SAUDACAO_MSG,
  botSaudacaoAtivo,
  parseJanelaHoras,
} from "./bot-saudacao-message"

export type WhatsappConnection = {
  status: WhatsappConnectionStatus
  paired: boolean
  qrDataUrl: string | null
  code: string | null
  me: string | null
}

export const getWhatsappConnection = async (): Promise<WhatsappConnection> => {
  await requireAdmin()

  const { status, paired, qr, code, me } = await fetchConnection()

  const qrDataUrl = qr ? await QRCode.toDataURL(qr, { width: 280, margin: 2 }) : null

  return { status, paired, qrDataUrl, code, me }
}

export const connectWhatsapp = async (
  method: PairingMethod,
  phone?: string,
): Promise<{ ok: boolean }> => {
  await requireAdmin()

  if (method === "code" && !phone?.trim()) {
    return { ok: false }
  }

  return startPairing(method, phone?.trim())
}

export const disconnectWhatsapp = async (): Promise<{ ok: boolean }> => {
  await requireAdmin()
  return postLogout()
}

// Down-alert recipient: same configuracoes key sendWhatsAppDownAlert reads in lib/email.ts.
const ALERT_EMAIL_KEY = "email_notificacao_destinatario"

export const getWhatsappAlertEmail = async (): Promise<string> => {
  const { supabase } = await requireAdmin()

  const { data } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", ALERT_EMAIL_KEY)
    .single()

  return data?.valor?.trim() ?? ""
}

export const setWhatsappAlertEmail = async (email: string): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("configuracoes")
    .update({ valor: email.trim(), updated_at: new Date().toISOString() })
    .eq("chave", ALERT_EMAIL_KEY)

  if (error) return { ok: false }

  revalidatePath("/admin/whatsapp")
  revalidatePath("/admin/configuracoes")
  return { ok: true }
}

export type WhatsappFeatures = {
  confirmacao: boolean
  atendimento: boolean
  alerta: boolean
}

export const getWhatsappFeatures = async (): Promise<WhatsappFeatures> => {
  const { supabase } = await requireAdmin()

  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [...WHATSAPP_FEATURE_KEYS])

  const valorDe = (chave: WhatsappFeatureKey) =>
    parseFlag(data?.find((row) => row.chave === chave)?.valor)

  return {
    confirmacao: valorDe("whatsapp_confirmacao_ativo"),
    atendimento: valorDe("whatsapp_atendimento_ativo"),
    alerta: valorDe("whatsapp_alerta_ativo"),
  }
}

export const setWhatsappFeature = async (
  chave: WhatsappFeatureKey,
  ativo: boolean,
): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  if (!WHATSAPP_FEATURE_KEYS.includes(chave)) return { ok: false }

  // upsert + select (não update): um update sem linha correspondente não dá erro e
  // retornaria ok:true falsamente; o upsert cria a linha se faltar e o select confirma a escrita.
  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave, valor: String(ativo), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export type StatusEntregaItem = { ativo: boolean; mensagem: string }
export type StatusEntregaConfig = {
  master: boolean
  porStatus: Record<NotifyStatus, StatusEntregaItem>
}

// Tipado como WhatsappFeatureKey: garante (em compile-time) que esta chave continua
// igual à lida pelo gate em notificacoes.ts — um rename em WHATSAPP_FEATURE_KEYS quebra aqui.
const STATUS_MASTER_KEY: WhatsappFeatureKey = "whatsapp_status_entrega_ativo"

export const getWhatsappStatusEntregaConfig = async (): Promise<StatusEntregaConfig> => {
  const { supabase } = await requireAdmin()

  const chaves = [
    STATUS_MASTER_KEY,
    ...STATUS_NOTIFY_STATUSES.flatMap((s) => [statusFlagKey(s), statusMsgKey(s)]),
  ]

  const { data } = await supabase.from("configuracoes").select("chave, valor").in("chave", chaves)
  const valorDe = (chave: string) => data?.find((row) => row.chave === chave)?.valor

  const porStatus = Object.fromEntries(
    STATUS_NOTIFY_STATUSES.map((s) => {
      const raw = valorDe(statusMsgKey(s))
      return [
        s,
        {
          ativo: parseFlag(valorDe(statusFlagKey(s))),
          // texto vazio na DB = cair no padrao; o operador pode restaurar ao deixar o campo vazio
          mensagem: raw && raw.trim() ? raw : DEFAULT_STATUS_MESSAGES[s],
        },
      ]
    }),
  ) as Record<NotifyStatus, StatusEntregaItem>

  return { master: parseFlag(valorDe(STATUS_MASTER_KEY)), porStatus }
}

export const setWhatsappStatusFlag = async (
  alvo: "master" | NotifyStatus,
  ativo: boolean,
): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  if (alvo !== "master" && !isNotifyStatus(alvo)) return { ok: false }
  const chave = alvo === "master" ? STATUS_MASTER_KEY : statusFlagKey(alvo)

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave, valor: String(ativo), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappStatusMessage = async (
  status: NotifyStatus,
  texto: string,
): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  if (!isNotifyStatus(status)) return { ok: false }
  // texto vazio = restaurar padrao; assim o operador pode resetar sem saber o texto original
  const valor = texto.trim() ? texto : DEFAULT_STATUS_MESSAGES[status]

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: statusMsgKey(status), valor, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export type LembreteConfig = { ativo: boolean; hora: number; mensagem: string }

export const getWhatsappLembreteConfig = async (): Promise<LembreteConfig> => {
  const { supabase } = await requireAdmin()

  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [LEMBRETE_FLAG_KEY, LEMBRETE_HORA_KEY, LEMBRETE_MSG_KEY])

  const valorDe = (chave: string) => data?.find((row) => row.chave === chave)?.valor
  const rawMsg = valorDe(LEMBRETE_MSG_KEY)

  return {
    ativo: parseFlag(valorDe(LEMBRETE_FLAG_KEY)),
    hora: parseHora(valorDe(LEMBRETE_HORA_KEY)),
    // texto vazio na DB = cair no padrao; o operador pode restaurar deixando o campo vazio
    mensagem: rawMsg && rawMsg.trim() ? rawMsg : DEFAULT_LEMBRETE_MSG,
  }
}

export const setWhatsappLembreteFlag = async (ativo: boolean): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: LEMBRETE_FLAG_KEY, valor: String(ativo), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappLembreteHora = async (hora: number): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  if (!Number.isInteger(hora) || hora < 0 || hora > 23) return { ok: false }

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: LEMBRETE_HORA_KEY, valor: String(hora), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappLembreteMessage = async (texto: string): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  // texto vazio = restaurar padrao; assim o operador reseta sem saber o texto original
  const valor = texto.trim() ? texto : DEFAULT_LEMBRETE_MSG

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: LEMBRETE_MSG_KEY, valor, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export type BotSaudacaoConfig = { ativo: boolean; janelaHoras: number; mensagem: string }

export const getWhatsappBotSaudacaoConfig = async (): Promise<BotSaudacaoConfig> => {
  const { supabase } = await requireAdmin()

  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [BOT_SAUDACAO_FLAG_KEY, BOT_SAUDACAO_JANELA_KEY, BOT_SAUDACAO_MSG_KEY])

  const valorDe = (chave: string) => data?.find((row) => row.chave === chave)?.valor
  const rawMsg = valorDe(BOT_SAUDACAO_MSG_KEY)

  return {
    // fail-closed (igual ao gate do orquestrador): o painel reflete o que o bot faz de verdade
    ativo: botSaudacaoAtivo(valorDe(BOT_SAUDACAO_FLAG_KEY)),
    janelaHoras: parseJanelaHoras(valorDe(BOT_SAUDACAO_JANELA_KEY)),
    mensagem: rawMsg && rawMsg.trim() ? rawMsg : DEFAULT_BOT_SAUDACAO_MSG,
  }
}

export const setWhatsappBotSaudacaoFlag = async (ativo: boolean): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: BOT_SAUDACAO_FLAG_KEY, valor: String(ativo), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappBotSaudacaoJanela = async (horas: number): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  if (!Number.isInteger(horas) || horas < 1 || horas > 168) return { ok: false }

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: BOT_SAUDACAO_JANELA_KEY, valor: String(horas), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappBotSaudacaoMessage = async (texto: string): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  // texto vazio = restaurar padrão (operador reseta sem saber o texto original)
  const valor = texto.trim() ? texto : DEFAULT_BOT_SAUDACAO_MSG

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: BOT_SAUDACAO_MSG_KEY, valor, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}
