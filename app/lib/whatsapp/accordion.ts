// app/lib/whatsapp/accordion.ts
export type SectionId = "recursos" | "status" | "lembrete" | "bot" | "agente"

// Acordeão: abrir uma fecha a anterior; clicar na aberta fecha.
export const toggleSection = (atual: SectionId | null, alvo: SectionId): SectionId | null =>
  atual === alvo ? null : alvo
