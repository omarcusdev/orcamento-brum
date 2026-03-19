"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { uploadDocuments } from "@/lib/actions"
import DocumentUpload from "@/components/document-upload"

type DocumentUploadSectionProps = {
  pedidoId: string
  documentoStatus: "pendente" | "enviado" | "verificado"
}

const DocumentUploadSection = ({ pedidoId, documentoStatus }: DocumentUploadSectionProps) => {
  const [status, setStatus] = useState(documentoStatus)

  useEffect(() => { setStatus(documentoStatus) }, [documentoStatus])

  const [pessoalFile, setPessoalFile] = useState<File | null>(null)
  const [residenciaFile, setResidenciaFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!pessoalFile || !residenciaFile) return
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set("documento_pessoal", pessoalFile)
      formData.set("comprovante_residencia", residenciaFile)
      await uploadDocuments(pedidoId, formData)
      setStatus("enviado")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar documentos")
    }
    setLoading(false)
  }

  if (status === "verificado") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-surface rounded-xl border border-green-500/30 p-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-green-400 font-medium text-sm">Documentos verificados</p>
            <p className="text-brand-warm-gray text-xs">Seus documentos foram aprovados</p>
          </div>
        </div>
      </motion.div>
    )
  }

  if (status === "enviado") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-surface rounded-xl border border-blue-500/30 p-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-blue-400 font-medium text-sm">Documentos enviados</p>
            <p className="text-brand-warm-gray text-xs">Aguardando verificacao da equipe</p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-brand-surface rounded-xl border border-brand-yellow/30 p-6 space-y-4"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-brand-yellow/20 rounded-full flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-yellow">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div>
          <p className="text-brand-yellow font-medium text-sm">Envie seus documentos</p>
          <p className="text-brand-warm-gray text-xs">Para confirmarmos seu pedido</p>
        </div>
      </div>

      <div>
        <p className="text-sm text-brand-gray-light mb-1.5">Documento pessoal (RG ou CNH) *</p>
        <DocumentUpload onFileSelect={setPessoalFile} />
      </div>

      <div>
        <p className="text-sm text-brand-gray-light mb-1.5">Comprovante de residencia *</p>
        <DocumentUpload onFileSelect={setResidenciaFile} />
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <motion.button
        onClick={handleSubmit}
        disabled={loading || !pessoalFile || !residenciaFile}
        whileHover={{ opacity: 0.85 }}
        whileTap={{ scale: 0.97 }}
        className="w-full bg-brand-yellow text-brand-black font-medium py-3 rounded-md text-sm tracking-wide uppercase cursor-pointer transition-colors duration-200 hover:bg-brand-amber disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Enviando..." : "Enviar documentos"}
      </motion.button>
    </motion.div>
  )
}

export default DocumentUploadSection
