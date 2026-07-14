import { describe, it, expect } from "vitest"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { renderHtml, renderCustomerHtml, renderWhatsAppDownHtml } from "./email"

const GOLDEN_DIR = join(__dirname, "__golden__")
const CAPTURE = process.env.CAPTURE_GOLDEN === "1"

const orderPayload = {
  pedidoId: "abcdef12-3456-7890-abcd-ef1234567890",
  clienteNome: "Maria Silva Santos",
  clienteTelefone: "(21) 99999-1234",
  dataEvento: "2026-07-15",
  horarioEvento: "18:30:00",
  endereco: "Rua das Flores, 123 — Centro, Rio de Janeiro",
  tipoChopeira: "eletrica",
  itens: [
    { qtd: 2, descricao: "Heineken 30L", subtotal: 900 },
    { qtd: 1, descricao: "Brahma 50L", subtotal: 500 },
  ],
  subtotal: 1400,
  frete: 80,
  total: 1480,
  metodoPagamento: "pix",
  observacoes: "Portão azul, tocar o interfone 12.",
}

const cases: [string, string][] = [
  ["email-admin.html", renderHtml(orderPayload)],
  ["email-customer.html", renderCustomerHtml(orderPayload)],
  ["email-whatsapp-down.html", renderWhatsAppDownHtml("a sessão foi desconectada pelo WhatsApp")],
]

describe("email renderers (golden)", () => {
  for (const [file, output] of cases) {
    it(`matches golden ${file}`, () => {
      const path = join(GOLDEN_DIR, file)
      if (CAPTURE || !existsSync(path)) {
        writeFileSync(path, output)
      }
      expect(output).toBe(readFileSync(path, "utf8"))
    })
  }
})

describe("renderCustomerHtml — desconto", () => {
  it("mostra a linha de Desconto quando desconto > 0 (breakdown reconcilia)", () => {
    const html = renderCustomerHtml({ ...orderPayload, desconto: 50, total: 1430 })
    expect(html).toContain("Desconto")
    expect(html).toContain("50,00")
  })
  it("nao mostra linha de Desconto quando desconto e 0/ausente", () => {
    expect(renderCustomerHtml(orderPayload)).not.toContain("Desconto")
  })
})
