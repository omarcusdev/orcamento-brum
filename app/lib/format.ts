// Canonical pt-BR formatters. Before this module the BRL formatter was hand-rolled in ~17
// files (two interchangeable Intl/toLocaleString idioms) and the event-date formatter in 8.

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

// +T00:00:00 forces LOCAL midnight: a date-only ISO ("2026-07-15") would otherwise parse as UTC
// and render the previous day in UTC-3. Load-bearing — do not drop the suffix.
export const formatEventDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", opts)
