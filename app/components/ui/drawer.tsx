"use client"

import { useEffect, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

type DrawerProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  headerExtra?: ReactNode
  footer?: ReactNode
  bg?: "surface" | "dark"
  closeDisabled?: boolean
  children: ReactNode
}

export const Drawer = ({
  open,
  onClose,
  title,
  headerExtra,
  footer,
  bg = "surface",
  closeDisabled = false,
  children,
}: DrawerProps) => {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, closeDisabled])

  const requestClose = () => {
    if (!closeDisabled) onClose()
  }

  const surface = bg === "dark" ? "bg-brand-dark" : "bg-brand-surface"

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={requestClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-0 top-0 h-full w-full max-w-xl ${surface} border-l border-white/10 flex flex-col`}
          >
            <header className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {title && <h2 className="font-display text-xl font-bold text-white tracking-wide">{title}</h2>}
                {headerExtra}
              </div>
              <button
                type="button"
                onClick={requestClose}
                disabled={closeDisabled}
                aria-label="Fechar"
                className="text-brand-warm-gray hover:text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer p-1 rounded hover:bg-white/5 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

            {footer && (
              <footer className={`px-6 py-4 border-t border-white/10 flex gap-2 ${surface}`}>{footer}</footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
