"use client"

import { useState, useRef } from "react"

type ImageUploadProps = {
  currentUrl?: string | null
  onFileSelect: (file: File) => void
}

const ImageUpload = ({ currentUrl, onFileSelect }: ImageUploadProps) => {
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return
    setPreview(URL.createObjectURL(file))
    onFileSelect(file)
  }

  const displayUrl = preview ?? currentUrl

  return (
    <div>
      {displayUrl && (
        <img src={displayUrl} alt="Produto" className="w-24 h-24 object-cover rounded-lg border border-white/10 mb-2" />
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="text-brand-yellow text-sm font-medium hover:text-brand-amber transition cursor-pointer"
      >
        {displayUrl ? "Trocar imagem" : "Adicionar imagem"}
      </button>
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
