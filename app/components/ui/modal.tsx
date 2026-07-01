"use client"

import { useEffect, type ReactNode } from "react"
import { motion } from "framer-motion"

type MaxWidth = "sm" | "md" | "lg"

type ModalProps = {
  onClose: () => void
  title?: ReactNode
  maxWidth?: MaxWidth
  closeDisabled?: boolean
  className?: string
  children: ReactNode
}

const maxWidths: Record<MaxWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
}

export const Modal = ({
  onClose,
  title,
  maxWidth = "md",
  closeDisabled = false,
  className,
  children,
}: ModalProps) => {
  useEffect(() => {
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
  }, [onClose, closeDisabled])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !closeDisabled) onClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-brand-surface border border-white/10 rounded-xl p-6 w-full ${maxWidths[maxWidth]} max-h-[90vh] overflow-y-auto ${className ?? ""}`}
      >
        {title && (
          <h3 id="modal-title" className="font-display text-lg font-bold text-white tracking-wide mb-4">{title}</h3>
        )}
        {children}
      </motion.div>
    </motion.div>
  )
}
