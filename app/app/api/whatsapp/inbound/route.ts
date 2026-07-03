import { NextResponse, after } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { parseInboundPayload } from "@/lib/whatsapp/inbound"
import { toBrazilE164, last8, matchClienteByPhone } from "@/lib/whatsapp/phone"
import { isWhatsappFeatureEnabled } from "@/lib/whatsapp/features"
import { maybeSendBotSaudacao } from "@/lib/whatsapp/bot-saudacao"
import { maybeReplyWithAgent } from "@/lib/whatsapp/bot-agente"
import { MEDIA_PLACEHOLDER } from "@/lib/whatsapp/bot-agente-kb"
import { logWa, logWaError, errInfo } from "@/lib/whatsapp/wa-log"

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
    logWa("inbound:suprimido-flag", {
      tel4: payload.telefone.slice(-4),
      waMessageId: payload.waMessageId,
      flag: "whatsapp_atendimento_ativo",
    })
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

  logWa("inbound:recebido", {
    tel4: telefoneE164.slice(-4),
    waMessageId: payload.waMessageId,
    direcao: payload.direcao,
    corpoLen: payload.corpo.length,
    ehPlaceholderMidia: payload.corpo === MEDIA_PLACEHOLDER,
    clienteMatch: Boolean(match),
  })

  // Inbound media (Task B2): when the EC2 (Task B3) inlined the bytes, persist them to the private
  // whatsapp-media bucket and hand the RPC the object path. Path is keyed by the E164 digits +
  // wa_message_id, so it is deterministic and idempotent (upsert absorbs echo/reentrega). An upload
  // failure must NOT drop the message — we log it and still register the row with the media type +
  // mime, so the UI shows a labeled placeholder instead of nothing.
  let midiaPath: string | null = null
  if (payload.midiaBase64) {
    const path = `${telefoneE164}/${payload.waMessageId}`
    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(path, Buffer.from(payload.midiaBase64, "base64"), {
        contentType: payload.mimeType,
        upsert: true,
      })
    if (uploadError) {
      logWaError("inbound:midia-upload-falhou", {
        waMessageId: payload.waMessageId,
        midiaTipo: payload.midiaTipo,
        ...errInfo(uploadError),
      })
    } else {
      midiaPath = path
    }
  }

  const { error } = await supabase.rpc("register_inbound_whatsapp", {
    p_telefone: telefoneE164,
    p_cliente_id: match?.id ?? null,
    p_nome: match?.nome ?? null,
    p_wa_message_id: payload.waMessageId,
    p_direcao: payload.direcao,
    p_corpo: payload.corpo,
    p_ocorrida_em: payload.ocorridaEm,
    p_midia_tipo: payload.midiaTipo ?? null,
    p_midia_path: midiaPath,
    p_mime_type: payload.mimeType ?? null,
  })

  if (error) {
    logWaError("inbound:rpc-falhou", { waMessageId: payload.waMessageId, ...errInfo(error) })
    return NextResponse.json({ error: "persist failed" }, { status: 500 })
  }

  // Auto-resposta: só para ENTRADA (nossos envios voltam como "saida" e são ignorados — anti-loop).
  // Coordenador agente-primeiro: se o agente IA está ligado, ele assume (e suprime a saudação);
  // senão, cai na saudação rule-based. Tudo via after(), pós-resposta; flags checadas lá dentro.
  if (payload.direcao === "entrada") {
    after(async () => {
      const { handled } = await maybeReplyWithAgent(telefoneE164, payload.waMessageId, payload.corpo)
      logWa("inbound:coordenador", {
        tel4: telefoneE164.slice(-4),
        waMessageId: payload.waMessageId,
        agenteHandled: handled,
        fallbackSaudacao: !handled,
      })
      if (!handled) await maybeSendBotSaudacao(telefoneE164, payload.waMessageId)
    })
  }

  return NextResponse.json({ ok: true })
}
