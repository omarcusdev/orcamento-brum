import { NextResponse, after } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { parseInboundPayload } from "@/lib/whatsapp/inbound"
import { toBrazilE164, last8, matchClienteByPhone } from "@/lib/whatsapp/phone"
import { isWhatsappFeatureEnabled } from "@/lib/whatsapp/features"
import { maybeSendBotSaudacao } from "@/lib/whatsapp/bot-saudacao"
import { maybeReplyWithAgent } from "@/lib/whatsapp/bot-agente"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = request.headers.get("x-inbound-secret")
  if (!secret || secret !== process.env.INBOUND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = parseInboundPayload(await request.json().catch(() => null))
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  if (!(await isWhatsappFeatureEnabled("whatsapp_atendimento_ativo"))) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = createServiceClient()
  const telefoneE164 = toBrazilE164(payload.telefone)

  // clientes.telefone é salvo mascarado; casa contra os dígitos normalizados (telefone_digits).
  const { data: candidatos } = await supabase
    .from("clientes")
    .select("id, nome, telefone")
    .like("telefone_digits", `%${last8(payload.telefone)}%`)

  const match = matchClienteByPhone(payload.telefone, candidatos ?? [])

  const { error } = await supabase.rpc("register_inbound_whatsapp", {
    p_telefone: telefoneE164,
    p_cliente_id: match?.id ?? null,
    p_nome: match?.nome ?? null,
    p_wa_message_id: payload.waMessageId,
    p_direcao: payload.direcao,
    p_corpo: payload.corpo,
    p_ocorrida_em: payload.ocorridaEm,
  })

  if (error) {
    console.error("[whatsapp/inbound] RPC falhou:", error)
    return NextResponse.json({ error: "persist failed" }, { status: 500 })
  }

  // Auto-resposta: só para ENTRADA (nossos envios voltam como "saida" e são ignorados — anti-loop).
  // Coordenador agente-primeiro: se o agente IA está ligado, ele assume (e suprime a saudação);
  // senão, cai na saudação rule-based. Tudo via after(), pós-resposta; flags checadas lá dentro.
  if (payload.direcao === "entrada") {
    after(async () => {
      const { handled } = await maybeReplyWithAgent(telefoneE164, payload.waMessageId, payload.corpo)
      if (!handled) await maybeSendBotSaudacao(telefoneE164, payload.waMessageId)
    })
  }

  return NextResponse.json({ ok: true })
}
