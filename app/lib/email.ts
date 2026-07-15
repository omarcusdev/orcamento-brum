import { Resend } from "resend"
import { createServiceClient } from "@/lib/supabase/service"
import { logWaError, errInfo } from "@/lib/whatsapp/wa-log"
import { formatBRL, formatEventDate } from "@/lib/format"
import { emailShell, ctaButton, infoRow, itensRows } from "@/lib/email-template"

const ADMIN_BASE_URL = "https://app-liart-one-77.vercel.app"
const CUSTOMER_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.alfachopp.com.br"

const formatPhone = (digits: string | null) => {
  if (!digits) return ""
  const d = digits.replace(/\D/g, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return d
}

type OrderEmailItem = { qtd: number; descricao: string; subtotal: number }

type OrderEmailData = {
  pedidoId: string
  clienteNome: string
  dataEvento: string
  horarioEvento: string
  endereco: string
  tipoChopeira: string
  itens: OrderEmailItem[]
  subtotal: number
  frete: number
  desconto?: number
  total: number
  metodoPagamento: string | null
  observacoes: string | null
}

// Linha "Desconto" pro breakdown reconciliar (Subtotal − Desconto + Frete = Total). Só quando > 0.
// Retorna "" sem whitespace extra pra não alterar o e-mail dos pedidos sem desconto.
const descontoRowHtml = (desconto?: number) =>
  (desconto ?? 0) > 0
    ? `
              <tr>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Desconto</td>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">− ${formatBRL(desconto ?? 0)}</td>
              </tr>`
    : ""

const chopeiraLabel = (tipo: string) => (tipo === "eletrica" ? "Elétrica" : "Gelo")

const metodoLabel = (metodo: string | null) =>
  metodo === "pix" ? "Pix" : metodo === "cartao" ? "Cartão" : metodo === "dinheiro" ? "Dinheiro" : "—"

const freteLabel = (frete: number) => (frete > 0 ? formatBRL(frete) : "a definir")

export const renderHtml = (data: OrderEmailData & { clienteTelefone: string }) => {
  const obsBlock = data.observacoes
    ? `<tr><td colspan="2" style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;line-height:1.5;"><strong>Observações:</strong> ${data.observacoes}</td></tr>`
    : ""

  const freteLine = freteLabel(data.frete)
  const pagamentoLabel = metodoLabel(data.metodoPagamento)
  const adminUrl = `${ADMIN_BASE_URL}/admin/pedidos/${data.pedidoId}`

  return emailShell({
    title: "Novo pedido",
    headerEyebrow: "ALFA Chopp Delivery",
    headerTitle: "Novo pedido recebido",
    headerSub: `#${data.pedidoId.slice(0, 8)}`,
    body: `        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;width:120px;">Cliente</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;font-weight:bold;">${data.clienteNome}</td>
              </tr>
              ${infoRow("Telefone", data.clienteTelefone)}
              ${infoRow("Evento", `${formatEventDate(data.dataEvento)} às ${data.horarioEvento.slice(0, 5)}`)}
              ${infoRow("Endereço", data.endereco, { labelAlignTop: true })}
              ${infoRow("Chopeira", chopeiraLabel(data.tipoChopeira), { capitalize: true })}
              ${infoRow("Pagamento", pagamentoLabel)}
              ${obsBlock}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #eeeeee;">
              <tr>
                <td colspan="2" style="padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8278;letter-spacing:1px;text-transform:uppercase;">Itens</td>
              </tr>
              ${itensRows(data.itens)}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid #eeeeee;">
              <tr>
                <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Subtotal</td>
                <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${formatBRL(data.subtotal)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Frete</td>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${freteLine}</td>
              </tr>${descontoRowHtml(data.desconto)}
              <tr>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#1a1a1a;font-weight:bold;">Total</td>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:#d4a017;font-weight:bold;text-align:right;">${formatBRL(data.total)}</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
              <tr>
                <td align="center">
                  ${ctaButton(adminUrl, "Ver pedido no admin →")}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px 32px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a8278;text-align:center;line-height:1.5;">Notificação automática · ALFA Chopp Delivery</p>
          </td>
        </tr>`,
  })
}

const renderText = (data: OrderEmailData & { clienteTelefone: string }) => {
  const adminUrl = `${ADMIN_BASE_URL}/admin/pedidos/${data.pedidoId}`
  const freteLine = freteLabel(data.frete)
  const lines = [
    `Novo pedido #${data.pedidoId.slice(0, 8)}`,
    "",
    `Cliente: ${data.clienteNome}`,
    `Telefone: ${data.clienteTelefone}`,
    `Evento: ${formatEventDate(data.dataEvento)} às ${data.horarioEvento.slice(0, 5)}`,
    `Endereço: ${data.endereco}`,
    `Chopeira: ${chopeiraLabel(data.tipoChopeira)}`,
    `Pagamento: ${metodoLabel(data.metodoPagamento)}`,
    "",
    "Itens:",
    ...data.itens.map((i) => `  ${i.qtd}× ${i.descricao} — ${formatBRL(i.subtotal)}`),
    "",
    `Subtotal: ${formatBRL(data.subtotal)}`,
    `Frete: ${freteLine}`,
    ...((data.desconto ?? 0) > 0 ? [`Desconto: − ${formatBRL(data.desconto ?? 0)}`] : []),
    `Total: ${formatBRL(data.total)}`,
  ]
  if (data.observacoes) lines.push("", `Observações: ${data.observacoes}`)
  lines.push("", `Ver no admin: ${adminUrl}`)
  return lines.join("\n")
}

export const sendNewOrderEmail = async (pedidoId: string) => {
  if (!process.env.RESEND_API_KEY) {
    console.error("[email-notificacao] RESEND_API_KEY ausente — pulando envio")
    return
  }

  try {
    const supabase = createServiceClient()

    const { data: configRows } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ["email_notificacao_destinatario", "email_notificacao_ativo"])

    const cfg: Record<string, string> = {}
    for (const row of configRows ?? []) cfg[row.chave] = row.valor

    if (cfg.email_notificacao_ativo !== "true") return

    const destinatario = cfg.email_notificacao_destinatario?.trim()
    if (!destinatario) {
      console.error("[email-notificacao] destinatário não configurado")
      return
    }

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("*, clientes(nome, telefone)")
      .eq("id", pedidoId)
      .single()

    if (pedidoErr || !pedido) {
      console.error("[email-notificacao] pedido não encontrado:", pedidoId, pedidoErr)
      return
    }

    const { data: rawItems } = await supabase
      .from("pedido_itens")
      .select("quantidade, subtotal, produtos(marca, volume_litros)")
      .eq("pedido_id", pedidoId)

    const itens = (rawItems ?? []).map((row) => {
      const produto = Array.isArray(row.produtos) ? row.produtos[0] : row.produtos
      return {
        qtd: row.quantidade,
        descricao: produto ? `${produto.marca} ${produto.volume_litros}L` : "Item",
        subtotal: row.subtotal,
      }
    })

    const cliente = Array.isArray(pedido.clientes) ? pedido.clientes[0] : pedido.clientes
    const clienteNome = cliente?.nome ?? "—"
    const clienteTelefone = formatPhone(cliente?.telefone)

    const subject = `Novo pedido #${pedidoId.slice(0, 8)} — ${formatBRL(pedido.total)} — ${clienteNome}`

    const payload = {
      pedidoId,
      clienteNome,
      clienteTelefone,
      dataEvento: pedido.data_evento,
      horarioEvento: pedido.horario_evento,
      endereco: pedido.endereco,
      tipoChopeira: pedido.tipo_chopeira,
      itens,
      subtotal: pedido.subtotal,
      frete: pedido.frete,
      desconto: pedido.desconto,
      total: pedido.total,
      metodoPagamento: pedido.metodo_pagamento,
      observacoes: pedido.observacoes,
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "ALFA Chopp <chopp@mail.ozapgpt.com.br>",
      to: [destinatario],
      subject,
      html: renderHtml(payload),
      text: renderText(payload),
    })

    if (result.error) {
      console.error("[email-notificacao] erro Resend:", result.error)
    }
  } catch (err) {
    console.error("[email-notificacao] erro inesperado:", err)
  }
}

export const renderCustomerHtml = (data: OrderEmailData) => {
  const obsBlock = data.observacoes
    ? `<tr><td colspan="2" style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;line-height:1.5;"><strong>Observações:</strong> ${data.observacoes}</td></tr>`
    : ""

  const freteLine = freteLabel(data.frete)
  const pagamentoLabel = metodoLabel(data.metodoPagamento)
  const trackingUrl = `${CUSTOMER_BASE_URL}/pedido/${data.pedidoId}`
  const firstName = data.clienteNome.split(" ")[0]

  return emailShell({
    title: "Recebemos seu pedido",
    headerEyebrow: "ALFA Chopp Delivery",
    headerTitle: "Recebemos seu pedido!",
    headerSub: `#${data.pedidoId.slice(0, 8)}`,
    body: `        <tr>
          <td style="padding:24px 32px 8px 32px;">
            <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.5;">Olá, ${firstName}!</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;line-height:1.6;">Recebemos seu pedido e estamos verificando os detalhes. Vamos te confirmar pelo WhatsApp em breve.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fef6e0" style="background-color:#fef6e0;border-radius:8px;border:1px solid #f0d99b;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8a6b00;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Próximo passo</p>
                  <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">Envie seu documento pessoal e comprovante de residência para liberar o pedido.</p>
                  <a href="${trackingUrl}" target="_blank" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8a6b00;font-weight:bold;text-decoration:underline;">Enviar documentos →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td colspan="2" style="padding:12px 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8278;letter-spacing:1px;text-transform:uppercase;">Detalhes do pedido</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;width:120px;">Evento</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">${formatEventDate(data.dataEvento)} às ${data.horarioEvento.slice(0, 5)}</td>
              </tr>
              ${infoRow("Endereço", data.endereco, { labelAlignTop: true })}
              ${infoRow("Chopeira", chopeiraLabel(data.tipoChopeira), { capitalize: true })}
              ${infoRow("Pagamento", pagamentoLabel)}
              ${obsBlock}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid #eeeeee;">
              <tr>
                <td colspan="2" style="padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8278;letter-spacing:1px;text-transform:uppercase;">Itens</td>
              </tr>
              ${itensRows(data.itens)}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid #eeeeee;">
              <tr>
                <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Subtotal</td>
                <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${formatBRL(data.subtotal)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Frete</td>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${freteLine}</td>
              </tr>${descontoRowHtml(data.desconto)}
              <tr>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#1a1a1a;font-weight:bold;">Total</td>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:#d4a017;font-weight:bold;text-align:right;">${formatBRL(data.total)}</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
              <tr>
                <td align="center">
                  ${ctaButton(trackingUrl, "Acompanhar pedido →")}
                  <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8278;line-height:1.5;">Salve esse link — é o seu comprovante.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px 32px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a8278;text-align:center;line-height:1.5;">Em caso de dúvidas, responda esse email ou aguarde nosso contato pelo WhatsApp.</p>
          </td>
        </tr>`,
  })
}

const renderCustomerText = (data: OrderEmailData) => {
  const trackingUrl = `${CUSTOMER_BASE_URL}/pedido/${data.pedidoId}`
  const freteLine = freteLabel(data.frete)
  const pagamentoLabel = metodoLabel(data.metodoPagamento)
  const firstName = data.clienteNome.split(" ")[0]
  const lines = [
    `Olá, ${firstName}!`,
    "",
    `Recebemos seu pedido #${data.pedidoId.slice(0, 8)}. Vamos confirmar os detalhes pelo WhatsApp em breve.`,
    "",
    "Próximo passo: envie seu documento pessoal e comprovante de residência na página do pedido.",
    "",
    `Evento: ${formatEventDate(data.dataEvento)} às ${data.horarioEvento.slice(0, 5)}`,
    `Endereço: ${data.endereco}`,
    `Chopeira: ${chopeiraLabel(data.tipoChopeira)}`,
    `Pagamento: ${pagamentoLabel}`,
    "",
    "Itens:",
    ...data.itens.map((i) => `  ${i.qtd}× ${i.descricao} — ${formatBRL(i.subtotal)}`),
    "",
    `Subtotal: ${formatBRL(data.subtotal)}`,
    `Frete: ${freteLine}`,
    ...((data.desconto ?? 0) > 0 ? [`Desconto: − ${formatBRL(data.desconto ?? 0)}`] : []),
    `Total: ${formatBRL(data.total)}`,
  ]
  if (data.observacoes) lines.push("", `Observações: ${data.observacoes}`)
  lines.push("", `Acompanhar pedido: ${trackingUrl}`, "Salve esse link — é o seu comprovante.")
  return lines.join("\n")
}

const WHATSAPP_ADMIN_URL = `${ADMIN_BASE_URL}/admin/whatsapp`

export const renderWhatsAppDownHtml = (reasonLabel: string) =>
  emailShell({
    title: "WhatsApp desconectado",
    headerEyebrow: "ALFA Chopp Delivery",
    headerTitle: "WhatsApp desconectado",
    body: `        <tr>
          <td style="padding:24px 32px;">
            <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.5;">A conexão do WhatsApp caiu (${reasonLabel}). Os pedidos não estão sendo confirmados automaticamente pelo WhatsApp até a reconexão.</p>
            <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;line-height:1.6;">Acesse o painel, leia o QR code com o celular e o envio volta ao normal.</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center">
                  ${ctaButton(WHATSAPP_ADMIN_URL, "Reconectar o WhatsApp →")}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px 32px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a8278;text-align:center;line-height:1.5;">Alerta automático · ALFA Chopp Delivery</p>
          </td>
        </tr>`,
  })

const reasonLabels: Record<"logged_out" | "offline", string> = {
  logged_out: "a sessão foi desconectada pelo WhatsApp",
  offline: "o aparelho ficou offline por tempo demais",
}

export const sendWhatsAppDownAlert = async (reason: "logged_out" | "offline") => {
  if (!process.env.RESEND_API_KEY) {
    logWaError("alerta:resend-key-ausente", {})
    return
  }

  try {
    const supabase = createServiceClient()

    const { data: configRow } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "email_notificacao_destinatario")
      .single()

    const destinatario = configRow?.valor?.trim()
    if (!destinatario) {
      logWaError("alerta:sem-destinatario", {})
      return
    }

    const reasonLabel = reasonLabels[reason]

    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "ALFA Chopp <chopp@mail.ozapgpt.com.br>",
      to: [destinatario],
      subject: "WhatsApp desconectado — reconecte no painel",
      html: renderWhatsAppDownHtml(reasonLabel),
      text: [
        "WhatsApp desconectado",
        "",
        `A conexão do WhatsApp caiu (${reasonLabel}). Os pedidos não estão sendo confirmados automaticamente até a reconexão.`,
        "",
        `Reconecte em: ${WHATSAPP_ADMIN_URL}`,
      ].join("\n"),
    })

    if (result.error) {
      logWaError("alerta:resend-erro", errInfo(result.error))
    }
  } catch (err) {
    logWaError("alerta:erro-inesperado", errInfo(err))
  }
}

export const sendCustomerOrderConfirmation = async (pedidoId: string) => {
  if (!process.env.RESEND_API_KEY) {
    console.error("[email-cliente] RESEND_API_KEY ausente — pulando envio")
    return
  }

  try {
    const supabase = createServiceClient()

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("*, clientes(nome, telefone, email)")
      .eq("id", pedidoId)
      .single()

    if (pedidoErr || !pedido) {
      console.error("[email-cliente] pedido não encontrado:", pedidoId, pedidoErr)
      return
    }

    const cliente = Array.isArray(pedido.clientes) ? pedido.clientes[0] : pedido.clientes
    const clienteEmail = cliente?.email?.trim()
    if (!clienteEmail) return

    const { data: rawItems } = await supabase
      .from("pedido_itens")
      .select("quantidade, subtotal, produtos(marca, volume_litros)")
      .eq("pedido_id", pedidoId)

    const itens = (rawItems ?? []).map((row) => {
      const produto = Array.isArray(row.produtos) ? row.produtos[0] : row.produtos
      return {
        qtd: row.quantidade,
        descricao: produto ? `${produto.marca} ${produto.volume_litros}L` : "Item",
        subtotal: row.subtotal,
      }
    })

    const clienteNome = cliente?.nome ?? "Cliente"

    const payload = {
      pedidoId,
      clienteNome,
      dataEvento: pedido.data_evento,
      horarioEvento: pedido.horario_evento,
      endereco: pedido.endereco,
      tipoChopeira: pedido.tipo_chopeira,
      itens,
      subtotal: pedido.subtotal,
      frete: pedido.frete,
      desconto: pedido.desconto,
      total: pedido.total,
      metodoPagamento: pedido.metodo_pagamento,
      observacoes: pedido.observacoes,
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "ALFA Chopp <chopp@mail.ozapgpt.com.br>",
      to: [clienteEmail],
      subject: `Recebemos seu pedido — ALFA Chopp Delivery`,
      html: renderCustomerHtml(payload),
      text: renderCustomerText(payload),
    })

    if (result.error) {
      console.error("[email-cliente] erro Resend:", result.error)
    }
  } catch (err) {
    console.error("[email-cliente] erro inesperado:", err)
  }
}
