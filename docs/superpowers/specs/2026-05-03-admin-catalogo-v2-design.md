# Admin Catálogo v2 — Ajustes pós-feedback Brum

**Data:** 2026-05-03
**Origem:** feedback do cliente Brum em 2026-05-02 via WhatsApp, antes de iniciar vendas em 2026-05-03.
**Escopo:** ajustes na tela `/admin/catalogo` + bug de upload + integração com storefront.

## Contexto

Brum vai começar vendas amanhã e precisa preparar o catálogo. Pediu:

1. Botão para excluir produtos do catálogo.
2. Reordenar produtos arrastando cards (drag-and-drop).
3. Separar visualmente produtos de 50L e 30L na tela admin.
4. Texto na tela informando a dimensão recomendada para a imagem do produto.
5. Bug: ao trocar a imagem e clicar em Salvar, o form trava em loading infinito (testou PNG e WebP, em 500x500px 1:1).

A ordem definida no admin precisa refletir no storefront que o cliente final usa para fazer pedido.

## Decisões já tomadas

- **Ordem é global** — afeta admin e storefront. Storefront passa a ordenar por `(volume_litros desc, ordem asc)` em vez de `preco_avista asc`. 50L sempre antes de 30L; dentro de cada volume usa a ordem que o Brum definir.
- **Delete é hard delete** — se o produto tem pedidos vinculados (FK em `pedido_itens.produto_id`), o Postgres bloqueia e mostramos erro amigável: "Este produto tem pedidos vinculados. Desative ele em vez de excluir." Histórico de pedidos antigos fica preservado.
- **Split é em duas seções visíveis simultaneamente** — não tabs. Headers "BARRIS DE 50L" e "BARRIS DE 30L". Drag-and-drop funciona dentro de cada seção (não entre seções, já que volume é propriedade do produto).
- **Upload bug é fix completo** — aumentar `bodySizeLimit`, adicionar `try/catch`, compressão client-side via `browser-image-compression`, e validação client-side de tamanho. Brum nunca mais pensa em otimizar imagem.

## Database

### Migration `016_produtos_ordem.sql`

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

Backfill usa espaçamento de 10 entre items (10, 20, 30…) para permitir inserções futuras sem precisar reescrever toda a coluna.

## Camada de tipos

`app/lib/types.ts` — adicionar `ordem: number` ao tipo `Produto`.

## Storefront

`app/lib/queries.ts` — `getActiveProducts`:

```ts
.from("produtos")
.select("*")
.eq("ativo", true)
.order("volume_litros", { ascending: false })
.order("ordem", { ascending: true })
```

`app/components/catalog.tsx` — sem mudança visual. O grid segue mostrando todos os produtos juntos com filtro por tipo (chopp/vinho); só a ordem que vem do servidor mudou.

## Server actions

`app/lib/admin-actions.ts` — duas funções novas:

### `deleteProduct(id: string)`

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

Storage delete é best-effort: se o arquivo não existir não é erro fatal — `.remove()` retorna sem throw quando o objeto não existe.

### `reorderProducts(updates: Array<{ id: string; ordem: number }>)`

```ts
export const reorderProducts = async (updates: { id: string; ordem: number }[]) => {
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

Atualiza só os items afetados pelo drag (não a tabela inteira). O cliente envia o array da seção reordenada com novos ordens calculados em gaps de 10.

## Admin UI

### `app/components/admin/product-list.tsx` — reescrita

Estrutura:

```
<header>
<aviso desativar>
<section 50L>
  <h2>BARRIS DE 50L</h2>
  <DndContext><SortableContext>
    [ProductCard com drag handle, toggle, editar, excluir] x N
  </SortableContext></DndContext>
</section>
<section 30L>
  ...
</section>
<ProductForm modal>
<DeleteConfirm modal>
```

Cada `SortableContext` recebe só os IDs da sua seção. Headers somem se a seção tiver 0 produtos.

Card structure (preserva visual atual + adiciona drag handle e botão excluir):

```
[≡ handle] [Marca][badge volume][badge tipo][preços]  [toggle][Editar][🗑]
```

Drag handle: ícone `≡` à esquerda, cursor `grab`/`grabbing`. Resto do card não é arrastável (clica em qualquer lugar abre nada — só o handle inicia drag).

### Lógica do drag

- `onDragEnd({active, over})`:
  - Se `over` é null ou `active.id === over.id`, ignora
  - Identifica seção pelo `volume_litros` do produto arrastado
  - Calcula nova ordem visual via `arrayMove(items, oldIndex, newIndex)` da `@dnd-kit/sortable`
  - Reatribui `ordem` sequencial em gaps de 10: items[0].ordem = 10, items[1].ordem = 20, etc.
  - Optimistic update: aplica nova ordem no state local imediatamente
  - Chama `reorderProducts(updates)` em background
  - Se falhar: reverte state + mostra toast de erro

### Botão excluir

Ícone lixeira pequeno, vermelho discreto (`text-red-400/70 hover:text-red-300`). Click abre modal de confirmação inline (não nativo `confirm()`):

```
Excluir {marca} {volume}L?
Esta ação não pode ser desfeita.
[Cancelar]  [Excluir]
```

Confirmar chama `deleteProduct(id)`. Em caso de sucesso: remove do state local. Em caso de erro: mostra mensagem do server no próprio modal antes de fechar (ou substitui CTA por texto vermelho + botão Fechar).

## Form de produto

### `app/components/admin/product-form.tsx`

Mudanças:

1. `handleSubmit` envolto em `try/catch/finally`:
   ```ts
   try { ... } catch (err) { setError(err instanceof Error ? err.message : "Erro ao salvar") } finally { setLoading(false) }
   ```
2. Novo state `error: string | null` renderizado acima dos botões com cor vermelha.
3. Texto guia abaixo do `<ImageUpload>`:
   > Recomendado: imagem quadrada (1:1), mínimo 500×500px. JPG, PNG ou WebP, até 5MB.

### `app/components/admin/image-upload.tsx`

Mudanças:

1. Importar `imageCompression` de `browser-image-compression`.
2. States novos: `compressing: boolean`, `error: string | null`.
3. `handleFile` async:
   ```ts
   setError(null)
   if (!file.type.startsWith("image/")) { setError("Arquivo precisa ser uma imagem"); return }
   if (file.size > 5 * 1024 * 1024) { setError("Imagem muito grande, maximo 5MB"); return }
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
   ```
4. Mostrar "Otimizando…" no botão enquanto `compressing`.
5. Renderizar `error` em texto vermelho pequeno abaixo do botão.

## Next config

`app/next.config.ts` — adicionar:

```ts
experimental: {
  serverActions: { bodySizeLimit: "5mb" }
}
```

Limite alto pra cobrir caso raro em que compressão falha ou usuário envia foto não comprimida via API direta. Compressão client-side mantém payload típico em ~200-500KB.

## Dependências novas

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
- `browser-image-compression`

## Error handling

- **Form save**: `try/catch` mostra erro inline acima dos botões. `setLoading(false)` no `finally` (resolve o "loading infinito").
- **Reorder fail**: reverte state local + toast inline acima da lista.
- **Delete fail (FK)**: mostra mensagem amigável no próprio modal de confirmação.
- **Upload >5MB pre-compress**: rejeita no client com mensagem; não vai pro servidor.
- **Compressão fail**: cai no catch e mostra "Não consegui processar essa imagem. Tente outra."

## Testes

Manual via browser autenticado como `admin@alfachopp.com` em produção:

1. Criar produto novo de 50L → aparece na seção correta no admin e no storefront.
2. Drag de produto 50L para outra posição → ordem persiste após reload e reflete no storefront.
3. Excluir produto novo (sem pedidos) → some.
4. Tentar excluir produto com pedidos vinculados (qualquer produto que apareça em `pedido_itens`) → erro amigável.
5. Upload de PNG 800×800 ~1.5MB → comprime e salva, sem trava.
6. Tentar upload >5MB → rejeitado client-side.
7. Brum vê texto da dimensão recomendada no form.
8. Storefront cliente mostra produtos na ordem definida (50L primeiro, depois 30L).

Sem testes automatizados — projeto não tem cobertura admin existente e a entrega tem prazo de horas, não dias.

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/016_produtos_ordem.sql` | NOVO |
| `app/next.config.ts` | + `experimental.serverActions.bodySizeLimit` |
| `app/lib/types.ts` | + `ordem: number` em Produto |
| `app/lib/queries.ts` | order de getActiveProducts |
| `app/lib/admin-actions.ts` | + deleteProduct, + reorderProducts |
| `app/components/admin/product-list.tsx` | reescrita (split + dnd + delete) |
| `app/components/admin/product-form.tsx` | try/catch + texto guia |
| `app/components/admin/image-upload.tsx` | compressão client-side + validação |
| `app/package.json` | + 4 deps |

## Fora de escopo

- Reordenação cross-volume (mover 50L pra perto de 30L): bloqueado por design.
- Editar volume de produto existente movendo ele entre seções no admin: já funciona via form de edição, drag não precisa cobrir.
- Lazy loading de imagens do storefront: já tem `next/image`.
- Histórico de exclusões / undo: YAGNI pra MVP.
- Testes automatizados de admin.
