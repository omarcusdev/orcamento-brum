"use client"

import { useState, useRef } from "react"
import { motion } from "framer-motion"

type DocumentUploadProps = {
  onFileSelect: (file: File) => void
  verified?: boolean
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"]
const MAX_SIZE_MB = 5

const DocumentUpload = ({ onFileSelect, verified }: DocumentUploadProps) => {
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (verified) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-green-500/30 bg-green-900/20">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span className="text-green-400 text-sm font-medium">Documento verificado</span>
      </div>
    )
  }

  const handleFile = (file: File) => {
    setError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato invalido. Use JPG, PNG ou PDF.")
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Arquivo muito grande. Maximo ${MAX_SIZE_MB}MB.`)
      return
    }
    setFileName(file.name)
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
    onFileSelect(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <motion.div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        whileHover={{ borderColor: "rgba(232,185,18,0.5)" }}
        className="border-2 border-dashed border-white/10 rounded-md p-6 text-center cursor-pointer transition-colors"
      >
        {preview ? (
          <img src={preview} alt="Preview" className="max-h-32 mx-auto rounded" />
        ) : fileName ? (
          <p className="text-white text-sm">{fileName}</p>
        ) : (
          <div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 text-brand-warm-gray">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <p className="text-brand-warm-gray text-sm">Arraste ou clique para enviar</p>
            <p className="text-brand-warm-gray/60 text-xs mt-1">JPG, PNG ou PDF (max {MAX_SIZE_MB}MB)</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          className="hidden"
        />
      </motion.div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

export default DocumentUpload
