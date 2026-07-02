// Single source of truth for the transbordo/system-notice corpo markers.
// The SQL mirror in chat-actions (conversa-level `sistema` flag, Task A2)
// must stay in sync with these two strings — see the comment there.
export const TRANSBORDO_MARKERS = ["AVISO DE TRANSBORDO", "Anotei aqui"] as const

export const isTransbordoNotice = (corpo: string | null | undefined): boolean => {
  if (!corpo) return false
  const trimmed = corpo.trim()
  if (!trimmed) return false
  return TRANSBORDO_MARKERS.every((marker) => trimmed.includes(marker))
}
