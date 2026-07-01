"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { Modal, Button } from "@/components/ui"

type ConfirmOptions = {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "primary"
}
type AlertOptions = { title: string; message?: ReactNode; okLabel?: string }

type Request =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "alert"; opts: AlertOptions; resolve: () => void }

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  alert: (opts: AlertOptions) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export const useConfirm = (): ConfirmContextValue => {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>")
  return ctx
}

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [request, setRequest] = useState<Request | null>(null)

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ kind: "confirm", opts, resolve })),
    [],
  )
  const alert = useCallback(
    (opts: AlertOptions) => new Promise<void>((resolve) => setRequest({ kind: "alert", opts, resolve })),
    [],
  )

  // Resolve the pending promise and unmount the modal. Backdrop/Esc route here with `false`.
  const settle = (result: boolean) => {
    if (!request) return
    if (request.kind === "confirm") request.resolve(result)
    else request.resolve()
    setRequest(null)
  }

  // confirm/alert are useCallback-stable, so this value only changes if they do (never in practice) —
  // keeps consumers from re-rendering on every dialog open/close.
  const value = useMemo(() => ({ confirm, alert }), [confirm, alert])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request && (
        <Modal onClose={() => settle(false)} maxWidth="sm" title={request.opts.title}>
          {request.opts.message && <p className="text-sm text-brand-warm-gray mb-5">{request.opts.message}</p>}
          <div className="flex gap-3">
            {request.kind === "confirm" && (
              <Button variant="secondary" onClick={() => settle(false)} className="flex-1">
                {request.opts.cancelLabel ?? "Cancelar"}
              </Button>
            )}
            <Button
              variant={request.kind === "confirm" ? (request.opts.variant ?? "primary") : "primary"}
              onClick={() => settle(true)}
              className="flex-1"
            >
              {request.kind === "confirm" ? (request.opts.confirmLabel ?? "Confirmar") : (request.opts.okLabel ?? "OK")}
            </Button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
