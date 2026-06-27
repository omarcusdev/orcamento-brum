import { useState, useTransition } from "react"

// The optimistic master-toggle the 4 WhatsApp config panels each hand-rolled: flip immediately,
// persist in a transition, roll back + surface a generic error if the server rejects it.
export const useOptimisticFlag = (
  initial: boolean,
  persist: (next: boolean) => Promise<{ ok: boolean }>,
) => {
  const [on, setOn] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const toggle = (next: boolean) => {
    setError(null)
    setOn(next)
    startTransition(async () => {
      const { ok } = await persist(next)
      if (!ok) {
        setOn(!next)
        setError("Não consegui salvar. Tente de novo.")
      }
    })
  }

  return { on, toggle, error, setError }
}
