import { Resend } from "resend"
import { createServiceClient } from "@/lib/supabase/service"
import { logWaError, errInfo } from "@/lib/whatsapp/wa-log"
import { formatBRL, formatEventDate } from "@/lib/format"

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
  total: number
  metodoPagamento: string | null
  observacoes: string | null
}

const chopeiraLabel = (tipo: string) => (tipo === "eletrica" ? "Elétrica" : "Gelo")

const metodoLabel = (metodo: string | null) =>
  metodo === "pix" ? "Pix" : metodo === "cartao" ? "Cartão" : metodo === "dinheiro" ? "Dinheiro" : "—"

const freteLabel = (frete: number) => (frete > 0 ? formatBRL(frete) : "a definir")

const renderHtml = (data: OrderEmailData & { clienteTelefone: string }) => {
  const itensRows = data.itens
    .map(
      (i) => `
        <tr>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.4;">${i.qtd}× ${i.descricao}</td>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.4;text-align:right;">${formatBRL(i.subtotal)}</td>
        </tr>`
    )
    .join("")

  const obsBlock = data.observacoes
    ? `<tr><td colspan="2" style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;line-height:1.5;"><strong>Observações:</strong> ${data.observacoes}</td></tr>`
    : ""

  const freteLine = freteLabel(data.frete)
  const pagamentoLabel = metodoLabel(data.metodoPagamento)
  const adminUrl = `${ADMIN_BASE_URL}/admin/pedidos/${data.pedidoId}`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Novo pedido</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f0e8" style="background-color:#f5f0e8;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;">
        <tr>
          <td bgcolor="#1a1a1a" style="background-color:#1a1a1a;padding:24px 32px;border-top-left-radius:8px;border-top-right-radius:8px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#e8b912;letter-spacing:2px;text-transform:uppercase;">ALFA Chopp Delivery</p>
            <h1 style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;color:#ffffff;line-height:1.2;">Novo pedido recebido</h1>
            <p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#b5afa6;">#${data.pedidoId.slice(0, 8)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;width:120px;">Cliente</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;font-weight:bold;">${data.clienteNome}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Telefone</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">${data.clienteTelefone}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Evento</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">${formatEventDate(data.dataEvento)} às ${data.horarioEvento.slice(0, 5)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;vertical-align:top;">Endereço</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">${data.endereco}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Chopeira</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;text-transform:capitalize;">${chopeiraLabel(data.tipoChopeira)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Pagamento</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">${pagamentoLabel}</td>
              </tr>
              ${obsBlock}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #eeeeee;">
              <tr>
                <td colspan="2" style="padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8278;letter-spacing:1px;text-transform:uppercase;">Itens</td>
              </tr>
              ${itensRows}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid #eeeeee;">
              <tr>
                <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Subtotal</td>
                <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${formatBRL(data.subtotal)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Frete</td>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${freteLine}</td>
              </tr>
              <tr>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#1a1a1a;font-weight:bold;">Total</td>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:#d4a017;font-weight:bold;text-align:right;">${formatBRL(data.total)}</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#e8b912" style="background-color:#e8b912;border-radius:6px;">
                        <a href="${adminUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;font-weight:bold;text-decoration:none;letter-spacing:0.5px;">Ver pedido no admin →</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px 32px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a8278;text-align:center;line-height:1.5;">Notificação automática · ALFA Chopp Delivery</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
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
    `Pagamento: ${data.metodoPagamento ?? "—"}`,
    "",
    "Itens:",
    ...data.itens.map((i) => `  ${i.qtd}× ${i.descricao} — ${formatBRL(i.subtotal)}`),
    "",
    `Subtotal: ${formatBRL(data.subtotal)}`,
    `Frete: ${freteLine}`,
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

const renderCustomerHtml = (data: OrderEmailData) => {
  const itensRows = data.itens
    .map(
      (i) => `
        <tr>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.4;">${i.qtd}× ${i.descricao}</td>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.4;text-align:right;">${formatBRL(i.subtotal)}</td>
        </tr>`
    )
    .join("")

  const obsBlock = data.observacoes
    ? `<tr><td colspan="2" style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;line-height:1.5;"><strong>Observações:</strong> ${data.observacoes}</td></tr>`
    : ""

  const freteLine = freteLabel(data.frete)
  const pagamentoLabel = metodoLabel(data.metodoPagamento)
  const trackingUrl = `${CUSTOMER_BASE_URL}/pedido/${data.pedidoId}`
  const firstName = data.clienteNome.split(" ")[0]

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Recebemos seu pedido</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f0e8" style="background-color:#f5f0e8;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;">
        <tr>
          <td bgcolor="#1a1a1a" style="background-color:#1a1a1a;padding:24px 32px;border-top-left-radius:8px;border-top-right-radius:8px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#e8b912;letter-spacing:2px;text-transform:uppercase;">ALFA Chopp Delivery</p>
            <h1 style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;color:#ffffff;line-height:1.2;">Recebemos seu pedido!</h1>
            <p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#b5afa6;">#${data.pedidoId.slice(0, 8)}</p>
          </td>
        </tr>
        <tr>
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
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;vertical-align:top;">Endereço</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">${data.endereco}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Chopeira</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;text-transform:capitalize;">${chopeiraLabel(data.tipoChopeira)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Pagamento</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">${pagamentoLabel}</td>
              </tr>
              ${obsBlock}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid #eeeeee;">
              <tr>
                <td colspan="2" style="padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8278;letter-spacing:1px;text-transform:uppercase;">Itens</td>
              </tr>
              ${itensRows}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid #eeeeee;">
              <tr>
                <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Subtotal</td>
                <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${formatBRL(data.subtotal)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Frete</td>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${freteLine}</td>
              </tr>
              <tr>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#1a1a1a;font-weight:bold;">Total</td>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:#d4a017;font-weight:bold;text-align:right;">${formatBRL(data.total)}</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#e8b912" style="background-color:#e8b912;border-radius:6px;">
                        <a href="${trackingUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;font-weight:bold;text-decoration:none;letter-spacing:0.5px;">Acompanhar pedido →</a>
                      </td>
                    </tr>
                  </table>
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
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
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
    `Total: ${formatBRL(data.total)}`,
  ]
  if (data.observacoes) lines.push("", `Observações: ${data.observacoes}`)
  lines.push("", `Acompanhar pedido: ${trackingUrl}`, "Salve esse link — é o seu comprovante.")
  return lines.join("\n")
}

const WHATSAPP_ADMIN_URL = `${ADMIN_BASE_URL}/admin/whatsapp`

const renderWhatsAppDownHtml = (reasonLabel: string) => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>WhatsApp desconectado</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f0e8" style="background-color:#f5f0e8;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;">
        <tr>
          <td bgcolor="#1a1a1a" style="background-color:#1a1a1a;padding:24px 32px;border-top-left-radius:8px;border-top-right-radius:8px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#e8b912;letter-spacing:2px;text-transform:uppercase;">ALFA Chopp Delivery</p>
            <h1 style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;color:#ffffff;line-height:1.2;">WhatsApp desconectado</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.5;">A conexão do WhatsApp caiu (${reasonLabel}). Os pedidos não estão sendo confirmados automaticamente pelo WhatsApp até a reconexão.</p>
            <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;line-height:1.6;">Acesse o painel, leia o QR code com o celular e o envio volta ao normal.</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#e8b912" style="background-color:#e8b912;border-radius:6px;">
                        <a href="${WHATSAPP_ADMIN_URL}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;font-weight:bold;text-decoration:none;letter-spacing:0.5px;">Reconectar o WhatsApp →</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px 32px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a8278;text-align:center;line-height:1.5;">Alerta automático · ALFA Chopp Delivery</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

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
