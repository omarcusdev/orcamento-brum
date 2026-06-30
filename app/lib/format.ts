// Canonical pt-BR formatters. Before this module the BRL formatter was hand-rolled in ~17
// files (two interchangeable Intl/toLocaleString idioms) and the event-date formatter in 8.

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

// +T00:00:00 forces LOCAL midnight: a date-only ISO ("2026-07-15") would otherwise parse as UTC
// and render the previous day in UTC-3. Load-bearing — do not drop the suffix.
export const formatEventDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", opts)

// As-you-type BR phone mask, e.g. "21999991234" -> "(21) 99999-1234". Display only — distinct
// from the E.164 normalization in lib/whatsapp/phone.ts. Was duplicated in 2 client forms.
export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ""
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

// Message/email micro-formatters that were re-implemented inline across the WhatsApp builders.
export const firstName = (fullName: string) => fullName.trim().split(" ")[0]
export const shortId = (id: string) => id.slice(0, 8)
export const formatTime = (hms: string) => hms.slice(0, 5)
