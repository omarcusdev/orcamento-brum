// app/components/admin/whatsapp/collapsible.tsx
"use client"

import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"

type Props = { open: boolean; children: ReactNode }

// Reveal animado (altura + opacidade). overflow-hidden evita vazar conteúdo durante a animação.
const Collapsible = ({ open, children }: Props) => (
  <AnimatePresence initial={false}>
    {open && (
      <motion.div
        key="content"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        style={{ overflow: "hidden" }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
)

export default Collapsible
