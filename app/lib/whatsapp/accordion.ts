// app/lib/whatsapp/accordion.ts
export type SectionId = "recursos" | "conexao" | "status" | "lembrete" | "bot" | "agente" | "alerta"

// Acordeão: abrir uma fecha a anterior; clicar na aberta fecha.
export const toggleSection = (atual: SectionId | null, alvo: SectionId): SectionId | null =>
  atual === alvo ? null : alvo
