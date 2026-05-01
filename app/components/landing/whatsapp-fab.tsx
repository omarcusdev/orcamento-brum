"use client"

import { motion } from "framer-motion"

type WhatsappFabProps = {
  whatsappNumber?: string
}

const WhatsappFab = ({ whatsappNumber = "5521999999999" }: WhatsappFabProps) => (
  <motion.a
    href={`https://wa.me/${whatsappNumber}`}
    target="_blank"
    rel="noopener noreferrer"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ delay: 0.5, duration: 0.3 }}
    whileHover={{ scale: 1.06 }}
    whileTap={{ scale: 0.95 }}
    aria-label="Falar no WhatsApp"
    className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-2xl"
  >
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <path d="M20.52 3.48A11.86 11.86 0 0012.04 0C5.46 0 .12 5.34.12 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.66a11.93 11.93 0 005.74 1.46h.01c6.58 0 11.92-5.34 11.92-11.92 0-3.18-1.24-6.18-3.45-8.4zM12.05 21.6a9.66 9.66 0 01-4.93-1.35l-.36-.21-3.74.98 1-3.65-.23-.37a9.6 9.6 0 01-1.5-5.08c0-5.32 4.34-9.65 9.66-9.65 2.58 0 5.01 1.01 6.84 2.83a9.62 9.62 0 012.83 6.83c0 5.32-4.33 9.66-9.66 9.66zm5.3-7.23c-.29-.15-1.72-.85-1.99-.94-.27-.1-.46-.15-.66.15-.2.29-.76.94-.94 1.14-.17.2-.35.22-.64.07-.29-.15-1.22-.45-2.32-1.43-.86-.77-1.43-1.71-1.6-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.6-.91-2.18-.24-.57-.48-.49-.66-.5l-.56-.01a1.07 1.07 0 00-.78.37c-.27.29-1.02 1-1.02 2.43 0 1.43 1.05 2.82 1.2 3.01.15.2 2.07 3.16 5.02 4.43.7.3 1.25.48 1.67.62.7.22 1.34.19 1.84.12.56-.08 1.72-.7 1.97-1.38.24-.68.24-1.27.17-1.38-.07-.12-.27-.2-.56-.34z"/>
    </svg>
  </motion.a>
)

export default WhatsappFab
