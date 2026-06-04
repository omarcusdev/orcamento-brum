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

const STATUS_MASTER_KEY = "whatsapp_status_entrega_ativo"

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
