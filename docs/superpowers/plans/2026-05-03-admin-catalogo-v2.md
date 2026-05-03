# Admin Catálogo v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar 5 ajustes pedidos pelo Brum no admin do catálogo: excluir produto, drag-and-drop pra reordenar (com efeito no storefront), split visual 50L/30L, texto guia da dimensão da imagem, e fix do bug de upload travando.

**Architecture:** Adiciona coluna `ordem` em `produtos` + 2 server actions (`deleteProduct`, `reorderProducts`). Reescreve `product-list.tsx` para 2 seções com drag-and-drop via `@dnd-kit`. Corrige upload via `next.config` bodySizeLimit + try/catch + compressão client-side via `browser-image-compression`. Storefront passa a ordenar por `(volume_litros desc, ordem asc)`.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase Postgres + Storage, `@dnd-kit/core` + `@dnd-kit/sortable`, `browser-image-compression`, framer-motion (já em uso), Tailwind v4.

**Spec source:** `docs/superpowers/specs/2026-05-03-admin-catalogo-v2-design.md`

**Convenções do projeto** (de `~/.claude/CLAUDE.md`):
- Sem comentários — código auto-explicativo
- Apenas `const`, jamais `let`/`var`
- Funções e composição, nada de classes
- Imutabilidade — usar `[...arr]`, `{...obj}`, `arr.map`, etc.

---

## File Structure

| Arquivo | Responsabilidade | Tipo |
|---|---|---|
| `supabase/migrations/016_produtos_ordem.sql` | Coluna `ordem` + backfill + index | Create |
| `app/next.config.ts` | + `experimental.serverActions.bodySizeLimit` | Modify |
| `app/lib/types.ts` | + `ordem: number` em `Produto` | Modify |
| `app/lib/queries.ts` | Storefront sort por (volume_litros, ordem) | Modify |
| `app/lib/admin-actions.ts` | + `deleteProduct`, + `reorderProducts` | Modify |
| `app/lib/admin-ordem.ts` | Helper puro de cálculo de ordem | Create |
| `app/lib/admin-ordem.test.ts` | Testes unitários do helper | Create |
| `app/components/admin/image-upload.tsx` | Compressão client-side + validação | Modify |
| `app/components/admin/product-form.tsx` | try/catch + erro inline + texto guia | Modify |
| `app/components/admin/product-card-row.tsx` | Card de produto (drag handle, ações) | Create |
| `app/components/admin/delete-product-modal.tsx` | Modal de confirmação de delete | Create |
| `app/components/admin/product-list.tsx` | Reescrita: split + dnd + delete | Modify |
| `app/package.json` | + 4 deps | Modify |

Decompondo o card de produto em arquivo próprio (`product-card-row.tsx`) e o modal em outro (`delete-product-modal.tsx`) deixa cada arquivo com uma responsabilidade clara, mantém `product-list.tsx` legível, e isola a lógica de drag handle do `useSortable` da listagem.

---

## Task 1: Database — coluna `ordem`

**Files:**
- Create: `supabase/migrations/016_produtos_ordem.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
alter table produtos add column ordem int not null default 0;

with ordered as (
  select id,
    row_number() over (partition by volume_litros order by created_at) * 10 as new_ordem
  from produtos
)
update produtos p set ordem = o.new_ordem
from ordered o
where p.id = o.id;

create index produtos_display_idx on produtos (volume_litros desc, ordem asc, created_at);
```

- [ ] **Step 2: Aplicar migration no Supabase remoto**

Da raiz do projeto (não de `supabase/`):

```bash
supabase db push
```

Esperado: output indica `016_produtos_ordem.sql` aplicado, sem erros.

- [ ] **Step 3: Validar no SQL editor do Supabase**

Executar via dashboard:

```sql
select id, marca, volume_litros, ordem from produtos order by volume_litros desc, ordem;
```

Esperado: cada produto tem `ordem` distinta, espaçada de 10 (10, 20, 30…), agrupada por volume.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/016_produtos_ordem.sql
git commit -m "feat(db): adicionar coluna ordem em produtos para drag-and-drop"
```

---

## Task 2: Type — adicionar `ordem` em `Produto`

**Files:**
- Modify: `app/lib/types.ts:1-12`

- [ ] **Step 1: Adicionar campo ordem ao tipo**

Atualizar bloco do tipo `Produto`:

```ts
export type Produto = {
  id: string
  marca: string
  descricao: string | null
  volume_litros: number
  preco_avista: number
  preco_cartao: number | null
  tipo: "chopp" | "vinho"
  foto_url: string | null
  ativo: boolean
  ordem: number
  created_at: string
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd app && npm run typecheck
```

Esperado: PASS. Se algum lugar quebrar por falta de `ordem`, é porque está construindo um `Produto` no client — corrigir incluindo `ordem` ali.

- [ ] **Step 3: Commit**

```bash
git add app/lib/types.ts
git commit -m "feat(types): adicionar ordem em Produto"
```

---

## Task 3: Storefront — ordenação por (volume_litros desc, ordem asc)

**Files:**
- Modify: `app/lib/queries.ts:3-13`

- [ ] **Step 1: Substituir order de getActiveProducts**

Substituir o bloco atual:

```ts
export const getActiveProducts = async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("ativo", true)
    .order("volume_litros", { ascending: false })
    .order("ordem", { ascending: true })

  if (error) throw error
  return data
}
```

- [ ] **Step 2: Validar typecheck e build**

```bash
cd app && npm run typecheck && npm run build
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/lib/queries.ts
git commit -m "feat(storefront): ordenar produtos por volume_litros desc, ordem asc"
```

---

## Task 4: Helper puro de cálculo de ordem (com testes)

**Files:**
- Create: `app/lib/admin-ordem.ts`
- Create: `app/lib/admin-ordem.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Criar `app/lib/admin-ordem.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { recomputeOrdens } from "./admin-ordem"

describe("recomputeOrdens", () => {
  it("retorna ordens sequenciais com gap de 10 baseado na ordem do array", () => {
    const result = recomputeOrdens(["a", "b", "c"])
    expect(result).toEqual([
      { id: "a", ordem: 10 },
      { id: "b", ordem: 20 },
      { id: "c", ordem: 30 },
    ])
  })

  it("retorna array vazio quando recebe array vazio", () => {
    expect(recomputeOrdens([])).toEqual([])
  })

  it("preserva a ordem do array de entrada", () => {
    const result = recomputeOrdens(["x", "y", "z", "w"])
    expect(result.map((r) => r.id)).toEqual(["x", "y", "z", "w"])
  })
})
```

- [ ] **Step 2: Rodar teste e ver falhar**

```bash
cd app && npx vitest run lib/admin-ordem.test.ts
```

Esperado: FAIL com erro de import (módulo não existe).

- [ ] **Step 3: Implementar helper**

Criar `app/lib/admin-ordem.ts`:

```ts
export type OrdemUpdate = { id: string; ordem: number }

export const recomputeOrdens = (ids: string[]): OrdemUpdate[] =>
  ids.map((id, index) => ({ id, ordem: (index + 1) * 10 }))
```

- [ ] **Step 4: Rodar testes e ver passar**

```bash
cd app && npx vitest run lib/admin-ordem.test.ts
```

Esperado: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin-ordem.ts app/lib/admin-ordem.test.ts
git commit -m "feat(admin): helper puro de calculo de ordem com gap 10"
```

---

## Task 5: Server actions — `deleteProduct` e `reorderProducts`

**Files:**
- Modify: `app/lib/admin-actions.ts` (final do arquivo, depois de `getDocumentSignedUrl`)

- [ ] **Step 1: Adicionar import do helper no topo do arquivo**

No topo de `app/lib/admin-actions.ts`, junto aos outros imports:

```ts
import type { OrdemUpdate } from "@/lib/admin-ordem"
```

- [ ] **Step 2: Adicionar `deleteProduct` no fim do arquivo**

```ts
export const deleteProduct = async (id: string) => {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from("produtos").delete().eq("id", id)
  if (error) {
    if (error.code === "23503") {
      throw new Error("Este produto tem pedidos vinculados. Desative ele em vez de excluir.")
    }
    throw error
  }
  await supabase.storage.from("produtos").remove([id])
  revalidatePath("/admin/catalogo")
  revalidatePath("/")
}
```

- [ ] **Step 3: Adicionar `reorderProducts` no fim do arquivo**

```ts
export const reorderProducts = async (updates: OrdemUpdate[]) => {
  const { supabase } = await requireAdmin()
  if (updates.length === 0) return
  for (const { id, ordem } of updates) {
    if (!Number.isInteger(ordem) || ordem < 0) throw new Error("Ordem invalida")
    const { error } = await supabase.from("produtos").update({ ordem }).eq("id", id)
    if (error) throw error
  }
  revalidatePath("/admin/catalogo")
  revalidatePath("/")
}
```

- [ ] **Step 4: Validar typecheck**

```bash
cd app && npm run typecheck
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin-actions.ts
git commit -m "feat(admin): server actions deleteProduct e reorderProducts"
```

---

## Task 6: Next config — `bodySizeLimit` 5MB

**Files:**
- Modify: `app/next.config.ts:18-33`

- [ ] **Step 1: Adicionar `experimental.serverActions`**

Substituir o bloco `nextConfig`:

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};
```

- [ ] **Step 2: Validar build**

```bash
cd app && npm run build
```

Esperado: PASS, sem warning sobre experimental config.

- [ ] **Step 3: Commit**

```bash
git add app/next.config.ts
git commit -m "fix(next): aumentar bodySizeLimit de server actions para 5MB"
```

---

## Task 7: Instalar dependências

**Files:**
- Modify: `app/package.json`, `app/package-lock.json`

- [ ] **Step 1: Instalar @dnd-kit e browser-image-compression**

```bash
cd app && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities browser-image-compression
```

Esperado: 4 packages adicionados às dependencies, sem erro.

- [ ] **Step 2: Validar build não quebra**

```bash
cd app && npm run build
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: instalar @dnd-kit e browser-image-compression"
```

---

## Task 8: ImageUpload — compressão + validação client-side

**Files:**
- Modify: `app/components/admin/image-upload.tsx`

- [ ] **Step 1: Reescrever o componente inteiro**

Substituir o conteúdo de `app/components/admin/image-upload.tsx`:

```tsx
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
```

- [ ] **Step 2: Validar typecheck e build**

```bash
cd app && npm run typecheck && npm run build
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/image-upload.tsx
git commit -m "fix(admin): comprimir imagem client-side antes do upload"
```

---

## Task 9: ProductForm — try/catch + erro inline + texto guia

**Files:**
- Modify: `app/components/admin/product-form.tsx`

- [ ] **Step 1: Adicionar state de erro + try/catch + texto guia**

Reescrever o arquivo inteiro `app/components/admin/product-form.tsx`:

```tsx
"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { Produto } from "@/lib/types"
import { createProduct, updateProduct, uploadProductImage } from "@/lib/admin-actions"
import ImageUpload from "@/components/admin/image-upload"

type ProductFormProps = {
  produto?: Produto
  onClose: () => void
}

const ProductForm = ({ produto, onClose }: ProductFormProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
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
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="bg-brand-surface rounded-2xl max-w-md w-full p-6 border border-white/10"
      >
        <h3 className="font-display text-xl font-bold text-white tracking-wide mb-4">
          {produto ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="marca" className="block text-sm font-medium text-brand-gray-light mb-1">Marca *</label>
            <input
              id="marca"
              name="marca"
              type="text"
              required
              defaultValue={produto?.marca}
              className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
            />
          </div>
          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-brand-gray-light mb-1">Descricao</label>
            <input
              id="descricao"
              name="descricao"
              type="text"
              defaultValue={produto?.descricao ?? ""}
              className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="volume_litros" className="block text-sm font-medium text-brand-gray-light mb-1">Volume (L) *</label>
              <select
                id="volume_litros"
                name="volume_litros"
                required
                defaultValue={produto?.volume_litros ?? 50}
                className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow outline-none text-sm text-white"
              >
                <option value={30}>30L</option>
                <option value={50}>50L</option>
              </select>
            </div>
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-brand-gray-light mb-1">Tipo *</label>
              <select
                id="tipo"
                name="tipo"
                required
                defaultValue={produto?.tipo ?? "chopp"}
                className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow outline-none text-sm text-white"
              >
                <option value="chopp">Chopp</option>
                <option value="vinho">Vinho</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-gray-light mb-1">Foto do produto</label>
            <ImageUpload currentUrl={produto?.foto_url} onFileSelect={setImageFile} />
            <p className="text-xs text-brand-warm-gray mt-2">
              Recomendado: imagem quadrada (1:1), minimo 500x500px. JPG, PNG ou WebP, ate 5MB.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="preco_avista" className="block text-sm font-medium text-brand-gray-light mb-1">Preco a vista *</label>
              <input
                id="preco_avista"
                name="preco_avista"
                type="number"
                step="0.01"
                required
                defaultValue={produto?.preco_avista}
                className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
              />
            </div>
            <div>
              <label htmlFor="preco_cartao" className="block text-sm font-medium text-brand-gray-light mb-1">Preco cartao</label>
              <input
                id="preco_cartao"
                name="preco_cartao"
                type="number"
                step="0.01"
                defaultValue={produto?.preco_cartao ?? ""}
                className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={{ scale: 0.97 }}
              className="flex-1 border border-white/10 text-brand-gray-light font-medium py-2.5 rounded-lg hover:bg-white/5 transition cursor-pointer"
            >
              Cancelar
            </motion.button>
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              className="flex-1 bg-brand-yellow text-brand-black font-bold py-2.5 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default ProductForm
```

- [ ] **Step 2: Validar typecheck e build**

```bash
cd app && npm run typecheck && npm run build
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/product-form.tsx
git commit -m "fix(admin): try/catch no form do produto + texto guia da imagem"
```

---

## Task 10: Modal de confirmação de delete

**Files:**
- Create: `app/components/admin/delete-product-modal.tsx`

- [ ] **Step 1: Criar componente do modal**

Criar `app/components/admin/delete-product-modal.tsx`:

```tsx
"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { Produto } from "@/lib/types"
import { deleteProduct } from "@/lib/admin-actions"

type DeleteProductModalProps = {
  produto: Produto
  onClose: () => void
  onDeleted: (id: string) => void
}

const DeleteProductModal = ({ produto, onClose, onDeleted }: DeleteProductModalProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    setLoading(true)
    try {
      await deleteProduct(produto.id)
      onDeleted(produto.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir")
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
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="bg-brand-surface rounded-2xl max-w-sm w-full p-6 border border-white/10"
      >
        <h3 className="font-display text-lg font-bold text-white tracking-wide mb-2">
          EXCLUIR {produto.marca.toUpperCase()} {produto.volume_litros}L?
        </h3>
        <p className="text-sm text-brand-gray-light mb-4">Esta acao nao pode ser desfeita.</p>
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}
        <div className="flex gap-3">
          <motion.button
            type="button"
            onClick={onClose}
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="flex-1 border border-white/10 text-brand-gray-light font-medium py-2.5 rounded-lg hover:bg-white/5 transition cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </motion.button>
          <motion.button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-lg hover:bg-red-600 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "Excluindo..." : "Excluir"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default DeleteProductModal
```

- [ ] **Step 2: Validar typecheck**

```bash
cd app && npm run typecheck
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/delete-product-modal.tsx
git commit -m "feat(admin): modal de confirmacao de exclusao de produto"
```

---

## Task 11: Card de produto com drag handle (componente isolado)

**Files:**
- Create: `app/components/admin/product-card-row.tsx`

- [ ] **Step 1: Criar componente**

Criar `app/components/admin/product-card-row.tsx`:

```tsx
"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { motion } from "framer-motion"
import type { Produto } from "@/lib/types"

type ProductCardRowProps = {
  produto: Produto
  isToggling: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const ProductCardRow = ({ produto, isToggling, onToggle, onEdit, onDelete }: ProductCardRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: produto.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-brand-surface rounded-xl border border-white/10 p-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-3 flex-1">
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar"
          className="text-brand-warm-gray hover:text-white cursor-grab active:cursor-grabbing touch-none px-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9-13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{produto.marca}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              produto.volume_litros === 30
                ? "bg-cyan-500/15 text-cyan-400"
                : "bg-blue-500/15 text-blue-400"
            }`}>{produto.volume_litros}L</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              produto.tipo === "chopp"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-violet-500/15 text-violet-400"
            }`}>
              {produto.tipo}
            </span>
          </div>
          <p className="text-sm text-brand-warm-gray mt-1">
            {formatPrice(produto.preco_avista)}
            {produto.preco_cartao && ` / ${formatPrice(produto.preco_cartao)} cartao`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          disabled={isToggling}
          className={`relative w-10 h-5 rounded-full transition-colors ${isToggling ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
          style={{ backgroundColor: produto.ativo ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)" }}
          aria-label={produto.ativo ? "Desativar produto" : "Ativar produto"}
        >
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`absolute top-0.5 w-4 h-4 rounded-full ${isToggling ? "animate-pulse" : ""}`}
            style={{
              left: produto.ativo ? "calc(100% - 18px)" : "2px",
              backgroundColor: produto.ativo ? "#22c55e" : "#8A8278",
            }}
          />
        </button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onEdit}
          className="px-3 py-1.5 rounded-lg border border-white/10 text-brand-gray-light hover:border-brand-yellow/40 hover:text-white text-xs font-medium cursor-pointer transition"
        >
          Editar
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onDelete}
          aria-label="Excluir produto"
          className="p-1.5 rounded-lg border border-white/10 text-red-400/70 hover:text-red-300 hover:border-red-500/30 cursor-pointer transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}

export default ProductCardRow
```

- [ ] **Step 2: Validar typecheck**

```bash
cd app && npm run typecheck
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/product-card-row.tsx
git commit -m "feat(admin): card de produto com drag handle e botao excluir"
```

---

## Task 12: ProductList — split em 2 seções + drag-and-drop + delete wiring

**Files:**
- Modify: `app/components/admin/product-list.tsx` (reescrita completa)

- [ ] **Step 1: Reescrever o arquivo inteiro**

Substituir `app/components/admin/product-list.tsx`:

```tsx
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import type { Produto } from "@/lib/types"
import { reorderProducts, toggleProductActive } from "@/lib/admin-actions"
import { recomputeOrdens } from "@/lib/admin-ordem"
import ProductForm from "@/components/admin/product-form"
import ProductCardRow from "@/components/admin/product-card-row"
import DeleteProductModal from "@/components/admin/delete-product-modal"

type ProductListProps = {
  produtos: Produto[]
}

type SectionVolume = 50 | 30

const sortByOrdem = (a: Produto, b: Produto) => a.ordem - b.ordem

const ProductList = ({ produtos: initialProdutos }: ProductListProps) => {
  const [produtos, setProdutos] = useState<Produto[]>(() => [...initialProdutos].sort(sortByOrdem))
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Produto | undefined>()
  const [deletingProduct, setDeletingProduct] = useState<Produto | undefined>()
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [reorderError, setReorderError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sectionsByVolume = (volume: SectionVolume) =>
    produtos.filter((p) => p.volume_litros === volume).sort(sortByOrdem)

  const produtos50 = sectionsByVolume(50)
  const produtos30 = sectionsByVolume(30)

  const handleToggle = async (id: string, currentActive: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(id))
    try {
      await toggleProductActive(id, !currentActive)
      setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, ativo: !currentActive } : p)))
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleDeleted = (id: string) => {
    setProdutos((prev) => prev.filter((p) => p.id !== id))
  }

  const handleDragEnd = async (event: DragEndEvent, volume: SectionVolume) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const sectionItems = sectionsByVolume(volume)
    const oldIndex = sectionItems.findIndex((p) => p.id === active.id)
    const newIndex = sectionItems.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const previousProdutos = produtos
    const reorderedSection = arrayMove(sectionItems, oldIndex, newIndex)
    const updates = recomputeOrdens(reorderedSection.map((p) => p.id))
    const ordemById = new Map(updates.map((u) => [u.id, u.ordem]))
    const optimistic = produtos.map((p) =>
      ordemById.has(p.id) ? { ...p, ordem: ordemById.get(p.id)! } : p
    )
    setProdutos(optimistic)
    setReorderError(null)

    try {
      await reorderProducts(updates)
    } catch (err) {
      setProdutos(previousProdutos)
      setReorderError(err instanceof Error ? err.message : "Erro ao reordenar")
    }
  }

  const renderSection = (volume: SectionVolume, items: Produto[]) => {
    if (items.length === 0) return null
    return (
      <section className="mb-8">
        <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">BARRIS DE {volume}L</h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, volume)}
        >
          <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((produto) => (
                <ProductCardRow
                  key={produto.id}
                  produto={produto}
                  isToggling={togglingIds.has(produto.id)}
                  onToggle={() => handleToggle(produto.id, produto.ativo)}
                  onEdit={() => { setEditingProduct(produto); setShowForm(true) }}
                  onDelete={() => setDeletingProduct(produto)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    )
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex justify-between items-center mb-6"
      >
        <h1 className="font-display text-3xl font-bold text-white tracking-wide">CATALOGO</h1>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { setEditingProduct(undefined); setShowForm(true) }}
          className="bg-brand-yellow text-brand-black font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition cursor-pointer"
        >
          + Novo Produto
        </motion.button>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-brand-yellow/5 border border-brand-yellow/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-brand-yellow shrink-0">
          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-brand-yellow/80">Desativar um produto remove ele do catalogo visivel para os clientes. Arraste pelo icone <span aria-hidden="true">⋮⋮</span> para reordenar.</p>
      </motion.div>
      {reorderError && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{reorderError}</p>
      )}
      {renderSection(50, produtos50)}
      {renderSection(30, produtos30)}
      <AnimatePresence>
        {showForm && (
          <ProductForm produto={editingProduct} onClose={() => setShowForm(false)} />
        )}
        {deletingProduct && (
          <DeleteProductModal
            produto={deletingProduct}
            onClose={() => setDeletingProduct(undefined)}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ProductList
```

- [ ] **Step 2: Validar typecheck e build**

```bash
cd app && npm run typecheck && npm run build
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/product-list.tsx
git commit -m "feat(admin): split 50L/30L com drag-and-drop e delete"
```

---

## Task 13: Verificação manual end-to-end em dev

**Files:** nenhum

- [ ] **Step 1: Subir dev server**

```bash
cd app && npm run dev
```

Esperado: server up na porta 2998.

- [ ] **Step 2: Login no admin**

Abrir `http://localhost:2998/admin/login` no navegador. Login com `admin@alfachopp.com` / `Alfa2026chopp`.

- [ ] **Step 3: Validar split visual**

Abrir `/admin/catalogo`. Esperado: dois headers ("BARRIS DE 50L" e "BARRIS DE 30L") com produtos correspondentes em cada seção.

- [ ] **Step 4: Validar drag-and-drop**

Arrastar um produto da seção 50L para outra posição (dentro da mesma seção) usando o ícone de drag handle. Esperado: card move suavemente; após soltar, ordem persiste em refresh da página.

- [ ] **Step 5: Validar texto guia**

Clicar em "Editar" em qualquer produto. Esperado: abaixo do botão "Trocar imagem", aparece o texto "Recomendado: imagem quadrada (1:1), minimo 500x500px. JPG, PNG ou WebP, ate 5MB."

- [ ] **Step 6: Validar fix do upload**

No mesmo modal de edição, trocar a imagem por um PNG ~1MB+ (qualquer arquivo grande). Esperado: botão mostra "Otimizando…" rapidamente, depois "Trocar imagem" volta com preview da nova imagem. Clicar Salvar — modal fecha sem trava. Refresh da página: nova imagem aparece no card.

- [ ] **Step 7: Validar delete sem pedidos**

Criar um produto novo qualquer (ex: "Teste Delete", 30L, R$ 100). Aparece na seção 30L. Clicar no ícone de lixeira. Modal abre. Confirmar. Esperado: produto some da lista e do banco.

- [ ] **Step 8: Validar delete com pedidos vinculados**

No SQL editor do Supabase, identificar um produto que aparece em `pedido_itens`:

```sql
select distinct p.id, p.marca from produtos p join pedido_itens pi on pi.produto_id = p.id limit 1;
```

Tentar excluir esse produto na UI. Esperado: modal mostra erro "Este produto tem pedidos vinculados. Desative ele em vez de excluir." e não fecha.

- [ ] **Step 9: Validar storefront**

Abrir `http://localhost:2998/` (página pública). Esperado: produtos aparecem na ordem definida (50L primeiro, depois 30L), respeitando a ordem custom dentro de cada volume.

- [ ] **Step 10: Validar limite de upload >5MB**

No form de edição, tentar fazer upload de um arquivo >5MB. Esperado: erro vermelho "Imagem muito grande, maximo 5MB" abaixo do botão; nada é enviado pro servidor.

- [ ] **Step 11: Sem commit nesta task**

Esta é uma task de verificação. Se algum passo falhar, voltar à task correspondente, corrigir, e repetir esta verificação.

---

## Task 14: Deploy em produção

**Files:** nenhum (operação)

- [ ] **Step 1: Aplicar migration em produção**

Confirmar no Supabase dashboard que a migration `016_produtos_ordem.sql` foi aplicada (Task 1 já fez via `supabase db push` que aponta pro projeto remoto `rhuqttionnpfnftkmvmq`).

- [ ] **Step 2: Deploy Vercel**

```bash
cd app && vercel --prod
```

Esperado: deploy completa sem erro. Vercel não está conectado ao auto-deploy, então deploy manual é necessário (referência: project memory).

- [ ] **Step 3: Smoke test em produção**

Abrir `https://app-liart-one-77.vercel.app/admin/catalogo` autenticado. Repetir validação rápida: ver split, fazer um drag, validar persistência.

- [ ] **Step 4: Avisar Brum**

Mensagem pronta pro cliente:

> Pronto, irmão! Atualizei o catálogo com os ajustes:
> - Botão pra excluir produto (com aviso quando tem pedidos vinculados)
> - Drag-and-drop pra reordenar — a ordem que você definir aparece igual pro cliente
> - Separei 50L e 30L em duas seções
> - Texto no formulário com a dimensão recomendada da imagem
> - Bug do upload travando: corrigido, agora a imagem é otimizada automaticamente
>
> Pode usar pra deixar tudo organizado pras vendas.

- [ ] **Step 5: Sem commit nesta task**

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| Migration `016_produtos_ordem.sql` | Task 1 |
| `Produto.ordem: number` | Task 2 |
| Storefront sort | Task 3 |
| `deleteProduct` action | Task 5 |
| `reorderProducts` action | Task 5 |
| `bodySizeLimit` | Task 6 |
| Compressão client-side | Task 8 |
| Validação >5MB client | Task 8 |
| `try/catch` no form | Task 9 |
| Texto guia da dimensão | Task 9 |
| Modal de delete inline | Task 10 |
| Card com drag handle | Task 11 |
| Split em 2 seções | Task 12 |
| Drag-and-drop | Task 12 |
| Optimistic update + rollback | Task 12 |
| Verificação manual completa | Task 13 |

Sem gaps.

**2. Placeholder scan:** sem TBD/TODO; todas as tasks têm código completo executável.

**3. Type consistency:** `OrdemUpdate` definido em Task 4 e usado em Task 5; `Produto.ordem` definido em Task 2 e usado em Tasks 3, 11, 12; `recomputeOrdens` retorna `OrdemUpdate[]` (consistente).
