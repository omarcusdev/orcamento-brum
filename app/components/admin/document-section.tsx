"use client"

import { useState } from "react"
import { verifyDocument, getDocumentSignedUrl } from "@/lib/admin-actions"

type DocumentSectionProps = {
  clienteId: string
  pedidoId: string
  documentoUrl: string | null
  documentoVerificado: boolean
  documentoVerificadoEm: string | null
}

const DocumentSection = ({ clienteId, pedidoId, documentoUrl, documentoVerificado, documentoVerificadoEm }: DocumentSectionProps) => {
  const [verified, setVerified] = useState(documentoVerificado)
  const [verifiedAt, setVerifiedAt] = useState(documentoVerificadoEm)
  const [verifying, setVerifying] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)

  const handleViewDocument = async () => {
    setLoadingImage(true)
    try {
      const url = await getDocumentSignedUrl(clienteId, "pessoal")
      setImageUrl(url)
    } catch {
      setImageUrl(null)
    }
    setLoadingImage(false)
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      await verifyDocument(clienteId, pedidoId)
      setVerified(true)
      setVerifiedAt(new Date().toISOString())
    } catch { /* ignore */ }
    setVerifying(false)
  }

  if (!documentoUrl && !verified) {
    return (
      <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
        <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">DOCUMENTO</h2>
        <p className="text-sm text-brand-warm-gray">Nenhum documento enviado</p>
      </div>
    )
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
      <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">DOCUMENTO</h2>

      {verified ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-green-500/30 bg-green-900/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-green-400 text-sm font-medium">
            Verificado {verifiedAt ? `em ${new Date(verifiedAt).toLocaleDateString("pt-BR")}` : ""}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {imageUrl ? (
            <div className="relative">
              <img
                src={imageUrl}
                alt="Documento"
                className="max-h-64 rounded-lg border border-white/10"
              />
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-yellow text-sm hover:underline mt-2 inline-block"
              >
                Abrir em nova aba
              </a>
            </div>
          ) : (
            <button
              onClick={handleViewDocument}
              disabled={loadingImage}
              className="px-4 py-2 bg-brand-dark border border-white/10 rounded-lg text-sm text-brand-gray-light hover:border-brand-yellow/30 transition cursor-pointer disabled:opacity-50"
            >
              {loadingImage ? "Carregando..." : "Ver documento"}
            </button>
          )}
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="w-full px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg text-sm hover:bg-green-700 transition cursor-pointer disabled:opacity-50"
          >
            {verifying ? "Verificando..." : "Verificar documento"}
          </button>
        </div>
      )}
    </div>
  )
}

export default DocumentSection
