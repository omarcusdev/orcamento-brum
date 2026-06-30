import { formatBRL } from "@/lib/format"

const FONT = "Arial,Helvetica,sans-serif"

export const emailShell = (parts: {
  title: string
  headerEyebrow: string
  headerTitle: string
  headerSub?: string
  body: string
}): string => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${parts.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f0e8" style="background-color:#f5f0e8;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;">
        <tr>
          <td bgcolor="#1a1a1a" style="background-color:#1a1a1a;padding:24px 32px;border-top-left-radius:8px;border-top-right-radius:8px;">
            <p style="margin:0;font-family:${FONT};font-size:12px;color:#e8b912;letter-spacing:2px;text-transform:uppercase;">${parts.headerEyebrow}</p>
            <h1 style="margin:8px 0 0 0;font-family:${FONT};font-size:24px;color:#ffffff;line-height:1.2;">${parts.headerTitle}</h1>${parts.headerSub ? `
            <p style="margin:6px 0 0 0;font-family:${FONT};font-size:13px;color:#b5afa6;">${parts.headerSub}</p>` : ""}
          </td>
        </tr>
${parts.body}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

// inner button table only — callers inline the outer <table width="100%"> wrapper
// (the outer wrapper differs: margin-top:32px for order emails; none for the WA-down alert)
export const ctaButton = (href: string, label: string): string =>
  `<table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#e8b912" style="background-color:#e8b912;border-radius:6px;">
                        <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:14px;color:#1a1a1a;font-weight:bold;text-decoration:none;letter-spacing:0.5px;">${label}</a>
                      </td>
                    </tr>
                  </table>`

// label-value row for the info tables in order emails.
// `valueAlignTop` adds vertical-align:top to the label cell (keeps it pinned when value wraps).
// `capitalize` adds text-transform:capitalize to the value cell.
export const infoRow = (
  label: string,
  value: string,
  opts?: { valueAlignTop?: boolean; capitalize?: boolean }
): string => {
  const labelExtra = opts?.valueAlignTop ? "vertical-align:top;" : ""
  const valueExtra = opts?.capitalize ? "text-transform:capitalize;" : ""
  return `<tr>
                <td style="padding:8px 0;font-family:${FONT};font-size:14px;color:#555555;${labelExtra}">${label}</td>
                <td style="padding:8px 0;font-family:${FONT};font-size:14px;color:#1a1a1a;${valueExtra}">${value}</td>
              </tr>`
}

export const itensRows = (itens: { qtd: number; descricao: string; subtotal: number }[]): string =>
  itens
    .map(
      (i) => `
        <tr>
          <td style="padding:6px 0;font-family:${FONT};font-size:14px;color:#1a1a1a;line-height:1.4;">${i.qtd}× ${i.descricao}</td>
          <td style="padding:6px 0;font-family:${FONT};font-size:14px;color:#1a1a1a;line-height:1.4;text-align:right;">${formatBRL(i.subtotal)}</td>
        </tr>`
    )
    .join("")
