"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Button, Input, fieldLabelClass } from "@/components/ui"

const LoginForm = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError("Email ou senha incorretos")
      setLoading(false)
      return
    }

    router.push("/admin/pedidos")
    router.refresh()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          className="font-display text-4xl font-bold text-white tracking-wide mb-2"
        >
          PAINEL ALFA CHOPP
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-brand-gray-light text-sm"
        >
          Acesse sua conta para gerenciar pedidos
        </motion.p>
      </div>
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
        className="bg-brand-surface rounded-2xl p-6 border border-white/10 space-y-4"
      >
        <div>
          <label htmlFor="email" className={fieldLabelClass}>Email</label>
          <Input id="email" name="email" type="email" required placeholder="seu@email.com" />
        </div>
        <div>
          <label htmlFor="password" className={fieldLabelClass}>Senha</label>
          <Input id="password" name="password" type="password" required placeholder="••••••••" />
        </div>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-900/30 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm overflow-hidden"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
        <Button type="submit" disabled={loading} fullWidth size="lg">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </motion.form>
    </motion.div>
  )
}

export default LoginForm
