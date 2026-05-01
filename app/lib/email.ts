import { Resend } from "resend"
import { createServiceClient } from "@/lib/supabase/service"

const ADMIN_BASE_URL = "https://app-liart-one-77.vercel.app"

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const formatDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR")

const formatPhone = (digits: string | null) => {
  if (!digits) return ""
  const d = digits.replace(/\D/g, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return d
}

const renderHtml = (data: {
  pedidoId: string
  clienteNome: string
  clienteTelefone: string
  dataEvento: string
  horarioEvento: string
  endereco: string
  tipoChopeira: string
  itens: { qtd: number; descricao: string; subtotal: number }[]
  subtotal: number
  frete: number
  total: number
  metodoPagamento: string | null
  observacoes: string | null
}) => {
  const itensRows = data.itens
    .map(
      (i) => `
        <tr>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.4;">${i.qtd}× ${i.descricao}</td>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.4;text-align:right;">${formatPrice(i.subtotal)}</td>
        </tr>`
    )
    .join("")

  const obsBlock = data.observacoes
    ? `<tr><td colspan="2" style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;line-height:1.5;"><strong>Observações:</strong> ${data.observacoes}</td></tr>`
    : ""

  const freteLine = data.frete > 0 ? formatPrice(data.frete) : "a definir"
  const pagamentoLabel = data.metodoPagamento === "pix" ? "Pix" : data.metodoPagamento === "cartao" ? "Cartão" : data.metodoPagamento === "dinheiro" ? "Dinheiro" : "—"
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
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">${formatDate(data.dataEvento)} às ${data.horarioEvento.slice(0, 5)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;vertical-align:top;">Endereço</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">${data.endereco}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Chopeira</td>
                <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;text-transform:capitalize;">${data.tipoChopeira === "eletrica" ? "Elétrica" : "Gelo"}</td>
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
                <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${formatPrice(data.subtotal)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">Frete</td>
                <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;text-align:right;">${freteLine}</td>
              </tr>
              <tr>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#1a1a1a;font-weight:bold;">Total</td>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:#d4a017;font-weight:bold;text-align:right;">${formatPrice(data.total)}</td>
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

const renderText = (data: {
  pedidoId: string
  clienteNome: string
  clienteTelefone: string
  dataEvento: string
  horarioEvento: string
  endereco: string
  tipoChopeira: string
  itens: { qtd: number; descricao: string; subtotal: number }[]
  subtotal: number
  frete: number
  total: number
  metodoPagamento: string | null
  observacoes: string | null
}) => {
  const adminUrl = `${ADMIN_BASE_URL}/admin/pedidos/${data.pedidoId}`
  const freteLine = data.frete > 0 ? formatPrice(data.frete) : "a definir"
  const lines = [
    `Novo pedido #${data.pedidoId.slice(0, 8)}`,
    "",
    `Cliente: ${data.clienteNome}`,
    `Telefone: ${data.clienteTelefone}`,
    `Evento: ${formatDate(data.dataEvento)} às ${data.horarioEvento.slice(0, 5)}`,
    `Endereço: ${data.endereco}`,
    `Chopeira: ${data.tipoChopeira === "eletrica" ? "Elétrica" : "Gelo"}`,
    `Pagamento: ${data.metodoPagamento ?? "—"}`,
    "",
    "Itens:",
    ...data.itens.map((i) => `  ${i.qtd}× ${i.descricao} — ${formatPrice(i.subtotal)}`),
    "",
    `Subtotal: ${formatPrice(data.subtotal)}`,
    `Frete: ${freteLine}`,
    `Total: ${formatPrice(data.total)}`,
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

    const subject = `Novo pedido #${pedidoId.slice(0, 8)} — ${formatPrice(pedido.total)} — ${clienteNome}`

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
