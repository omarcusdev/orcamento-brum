// Server-only: importa createServiceClient (service role key). NÃO importe este módulo de um
// Client Component — para o tipo WhatsappFeatureKey use `import type` (é elidido no bundle).
import { createServiceClient } from "@/lib/supabase/service"

export const WHATSAPP_FEATURE_KEYS = [
  "whatsapp_confirmacao_ativo",
  "whatsapp_atendimento_ativo",
  "whatsapp_alerta_ativo",
  "whatsapp_status_entrega_ativo",
  "whatsapp_lembrete_vespera_ativo",
] as const

export type WhatsappFeatureKey = (typeof WHATSAPP_FEATURE_KEYS)[number]

// Fail-open: só o literal "false" desliga; null/ausente/qualquer outra coisa = LIGADO.
export const parseFlag = (valor: string | null | undefined): boolean =>
  valor?.trim().toLowerCase() !== "false"

// Leitura para gates que rodam sem sessão de admin (webhook/notificações/alerta).
export const isWhatsappFeatureEnabled = async (chave: WhatsappFeatureKey): Promise<boolean> => {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", chave)
      .single()
    return parseFlag(data?.valor)
  } catch {
    return true // fail-open: nunca quebra o comportamento por causa de leitura de flag
  }
}
