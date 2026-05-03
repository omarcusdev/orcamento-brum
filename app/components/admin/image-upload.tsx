"use client"

import { useState, useRef } from "react"
import imageCompression from "browser-image-compression"

type ImageUploadProps = {
  currentUrl?: string | null
  onFileSelect: (file: File) => void
}

const MAX_BYTES = 5 * 1024 * 1024

const ImageUpload = ({ currentUrl, onFileSelect }: ImageUploadProps) => {
  const [preview, setPreview] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    if (!file.type.startsWith("image/")) {
      setError("Arquivo precisa ser uma imagem")
      return
    }
    if (file.size > MAX_BYTES) {
      setError("Imagem muito grande, maximo 5MB")
      return
    }
    setCompressing(true)
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: "image/webp",
      })
      setPreview(URL.createObjectURL(compressed))
      onFileSelect(compressed)
    } catch {
      setError("Nao consegui processar essa imagem. Tente outra.")
    } finally {
      setCompressing(false)
    }
  }

  const displayUrl = preview ?? currentUrl
  const buttonLabel = compressing ? "Otimizando..." : displayUrl ? "Trocar imagem" : "Adicionar imagem"

  return (
    <div>
      {displayUrl && (
        <img src={displayUrl} alt="Produto" className="w-24 h-24 object-cover rounded-lg border border-white/10 mb-2" />
      )}
      <button
        type="button"
        disabled={compressing}
        onClick={() => inputRef.current?.click()}
        className="text-brand-yellow text-sm font-medium hover:text-brand-amber transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
      >
        {buttonLabel}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
        className="hidden"
      />
    </div>
  )
}

export default ImageUpload
