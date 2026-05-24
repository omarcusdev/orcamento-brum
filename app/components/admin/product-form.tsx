"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { Produto } from "@/lib/types"
import { createProduct, updateProduct, uploadProductImage } from "@/lib/admin-actions"
import ImageUpload from "@/components/admin/image-upload"
import { Button, Input, MoneyInput, Select, fieldLabelClass } from "@/components/ui"

type ProductFormProps = {
  produto?: Produto
  onClose: () => void
}

const ProductForm = ({ produto, onClose }: ProductFormProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)

  const [marca, setMarca] = useState(produto?.marca ?? "")
  const [descricao, setDescricao] = useState(produto?.descricao ?? "")
  const [volumeLitros, setVolumeLitros] = useState<string>(String(produto?.volume_litros ?? 50))
  const [tipo, setTipo] = useState<string>(produto?.tipo ?? "chopp")
  const [precoAvista, setPrecoAvista] = useState<number>(Number(produto?.preco_avista ?? 0))
  const [precoCartao, setPrecoCartao] = useState<number>(Number(produto?.preco_cartao ?? 0))
  const [precoSegundoBarril, setPrecoSegundoBarril] = useState<number>(Number(produto?.preco_segundo_barril ?? 0))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData()
    formData.set("marca", marca)
    formData.set("descricao", descricao)
    formData.set("volume_litros", volumeLitros)
    formData.set("tipo", tipo)
    formData.set("preco_avista", String(precoAvista))
    if (precoCartao > 0) formData.set("preco_cartao", String(precoCartao))
    if (precoSegundoBarril > 0) formData.set("preco_segundo_barril", String(precoSegundoBarril))
    try {
      if (produto) {
        await updateProduct(produto.id, formData)
        if (imageFile) {
          const imgFormData = new FormData()
          imgFormData.set("foto", imageFile)
          await uploadProductImage(produto.id, imgFormData)
        }
      } else {
        const result = await createProduct(formData)
        if (imageFile && result?.id) {
          const imgFormData = new FormData()
          imgFormData.set("foto", imageFile)
          await uploadProductImage(result.id, imgFormData)
        }
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="bg-brand-surface rounded-2xl max-w-md w-full p-6 border border-white/10 max-h-[calc(100vh-3rem)] overflow-y-auto"
      >
        <h3 className="font-display text-xl font-bold text-white tracking-wide mb-4">
          {produto ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="marca" className={fieldLabelClass}>Marca *</label>
            <Input id="marca" type="text" required value={marca} onChange={(e) => setMarca(e.target.value)} />
          </div>
          <div>
            <label htmlFor="descricao" className={fieldLabelClass}>Descrição</label>
            <Input id="descricao" type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="volume_litros" className={fieldLabelClass}>Volume (L) *</label>
              <Select id="volume_litros" value={volumeLitros} onChange={(e) => setVolumeLitros(e.target.value)} required>
                <option value="30">30L</option>
                <option value="50">50L</option>
              </Select>
            </div>
            <div>
              <label htmlFor="tipo" className={fieldLabelClass}>Tipo *</label>
              <Select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} required>
                <option value="chopp">Chopp</option>
                <option value="vinho">Vinho</option>
              </Select>
            </div>
          </div>
          <div>
            <label className={fieldLabelClass}>Foto do produto</label>
            <ImageUpload currentUrl={produto?.foto_url} onFileSelect={setImageFile} />
            <p className="text-xs text-brand-warm-gray mt-2">
              Recomendado: imagem quadrada (1:1), mínimo 500x500px. JPG, PNG ou WebP, até 5MB.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabelClass}>Preço à vista *</label>
              <MoneyInput value={precoAvista} onChange={setPrecoAvista} min={0} aria-label="Preço à vista" />
            </div>
            <div>
              <label className={fieldLabelClass}>Preço cartão</label>
              <MoneyInput value={precoCartao} onChange={setPrecoCartao} min={0} aria-label="Preço cartão" />
            </div>
          </div>
          <div>
            <label className={fieldLabelClass}>
              Preço do 2º barril <span className="text-brand-warm-gray normal-case">(promo, opcional)</span>
            </label>
            <MoneyInput value={precoSegundoBarril} onChange={setPrecoSegundoBarril} min={0} aria-label="Preço do 2º barril" />
            <p className="text-xs text-brand-warm-gray mt-1">A partir do 2º barril deste produto, esse preço substitui o preço à vista.</p>
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={loading} className="flex-1">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default ProductForm
