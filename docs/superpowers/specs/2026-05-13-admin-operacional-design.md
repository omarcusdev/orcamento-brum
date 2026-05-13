# Ajustes operacionais admin — Pedido manual, edicao, consignado e doc

**Data**: 2026-05-13
**Status**: Aprovado (aguardando review do spec escrito)

## Resumo

Seis features para Jean operar pedidos via admin sem depender do checkout do cliente:

1. **Cadastro manual de pedidos** — admin cria pedido completo via modal/drawer
2. **Voltar status do pedido** — admin reverte status para qualquer estado anterior
3. **Identidade frente + verso** — cliente envia 1-2 fotos do documento pessoal
4. **Barril consignado** — segundo barril marcado como consignado (so paga se usar)
5. **Desverificar documento** — admin reverte verificacao de documento clicada por engano
6. **Editar pedido** — admin edita campos do pedido com log de auditoria

## Contexto

Jean opera o ALFA Chopp Delivery via WhatsApp e atualmente depende dos clientes
completarem o checkout publico. Muitos clientes preferem fechar pedido por WhatsApp
e Jean precisa cadastrar manualmente. Pedidos tambem mudam apos confirmacao (horario,
endereco, itens) e Jean nao consegue editar. Documentos enviados pelo cliente as vezes
vem com apenas um lado da identidade — precisa pedir frente e verso. Quando Jean clica
"Verificar" sem querer, nao tem como desfazer. E quando cliente quer 2 barris mas tem
duvida, Jean costuma oferecer o segundo como consignado.

---

## Migration 020 — `020_admin_operacional.sql`

### Mudanca em `clientes`

- `documento_pessoal_url TEXT` → `documento_pessoal_urls TEXT[]`
- Migration: `UPDATE clientes SET documento_pessoal_urls = ARRAY[documento_pessoal_url] WHERE documento_pessoal_url IS NOT NULL`
- Constraint: `array_length(documento_pessoal_urls, 1) BETWEEN 1 AND 2` quando nao nulo

### Mudanca em `pedido_items`

- `is_consignado BOOLEAN NOT NULL DEFAULT false`
- `consignado_status TEXT NULL CHECK (consignado_status IN ('pendente','usado','devolvido'))`
- Check constraint: `is_consignado = false OR consignado_status IS NOT NULL`
- Check constraint: `is_consignado = false OR quantidade = 1` (consignado eh sempre 1 unidade)
- Partial unique index garantindo no maximo 1 item consignado por pedido:
  `CREATE UNIQUE INDEX pedido_items_um_consignado_por_pedido ON pedido_items (pedido_id) WHERE is_consignado = true`

### Nova tabela `pedido_edit_log`

```sql
CREATE TABLE pedido_edit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pedido_edit_log_pedido_id_idx ON pedido_edit_log(pedido_id, changed_at DESC);
```

RLS: somente admin role pode ler/escrever (mesmo padrao das outras tabelas admin-only).

---

## 1. Cadastro manual de pedidos

### Trigger

Botao "Novo pedido manual" no topo de `/admin` (pagina principal de pedidos).

### UI — Drawer lateral direita

Componente novo `components/admin/manual-order-drawer.tsx`. Sheet do shadcn ou custom.
Sem wizard — todos os campos visiveis, scroll vertical.

**Secao 1: Cliente**

- Input "Buscar por telefone ou CPF" com debounce 300ms
- Dropdown abaixo com resultados (nome + telefone + cidade)
- Se sem resultado ou usuario clicar "Criar novo cliente":
  - Form inline: nome*, telefone*, CPF (opcional), email (opcional)
- Cliente selecionado preenche endereco padrao se houver

**Secao 2: Endereco**

- Reusa `components/address-autocomplete.tsx`
- Preenche `endereco` + `endereco_completo`

**Secao 3: Evento**

- `data_evento` (date picker), `horario_evento` (time)
- `tipo_chopeira` (radio: gelo / eletrica)
- `rampas_escadas` (textarea opcional)
- `observacoes` (textarea opcional)

**Secao 4: Itens**

- Para cada item:
  - Select produto, input quantidade
  - Se `quantidade === 2` e produto tem `preco_segundo_barril`:
    - Checkbox aparece: "Marcar 2º barril como consignado"
    - Tooltip ao lado: "So paga se usar. Mostra preco do 1º / 2º com desconto."
- Botao "Adicionar item"
- Constraint UI: no maximo 1 item do pedido pode ter consignado marcado

**Secao 5: Pagamento + entrega**

- `metodo_pagamento` (radio: pix / cartao / dinheiro)
- `pago` (checkbox: "Cliente ja pagou")
- `frete` (input number)

**Resumo**

- Subtotal, desconto (0 default), frete, total
- Se consignado: total exibido como `R$ {min} / R$ {max}`

**Acoes**

- "Criar pedido" → server action `createManualOrder()`
- "Cancelar" → fecha drawer

### Server action — `lib/admin-actions.ts`

```ts
export const createManualOrder = async (input: ManualOrderInput) => {
  // 1. Se cliente_id ausente, INSERT cliente
  // 2. INSERT pedido com status='confirmado', documento_status='pendente'
  // 3. INSERT pedido_items, marcando is_consignado se input pediu
  //    - quando is_consignado=true, consignado_status='pendente'
  // 4. INSERT pedido_status_log (status_anterior=null, status_novo='confirmado')
  // 5. revalidatePath('/admin')
  // 6. Return pedido_id
}
```

Validacao Zod em `lib/schemas.ts` — `manualOrderInputSchema`.

### Status inicial

`confirmado`. Sem gate de documento. Sem gate de dispatch.

---

## 2. Voltar status do pedido

### UI — Order detail (`/admin/pedidos/[id]`)

Botao "Voltar status" ao lado dos botoes de status atuais.
Abre modal listando todos os status anteriores ao atual + `cancelado`.

Exemplo: pedido esta em `em_rota` → opcoes:
- Voltar para `enviar_para_entregador`
- Voltar para `confirmado`
- Marcar como `cancelado`

Modal de confirmacao: "Voltar de `em_rota` para `confirmado`?"

### Server action

```ts
export const revertOrderStatus = async (pedidoId: string, newStatus: PedidoStatus) => {
  const pedido = await getPedido(pedidoId)
  const currentIndex = STATUS_FLOW_ORDER.indexOf(pedido.status)
  const targetIndex = STATUS_FLOW_ORDER.indexOf(newStatus)
  if (newStatus !== 'cancelado' && targetIndex >= currentIndex) {
    throw new Error('Status alvo precisa ser anterior ao atual')
  }
  // UPDATE pedidos SET status = newStatus, updated_at = now()
  // INSERT pedido_status_log (status_anterior=pedido.status, status_novo=newStatus, changed_by=admin_id)
  // revalidatePath
}
```

`STATUS_FLOW_ORDER = ['confirmado','enviar_para_entregador','em_rota','entregue','pago','recolhido']`

### Side-effects ao voltar

- `enviar_para_entregador → confirmado`: nao limpa `entregador_id` (mantem para re-dispatch rapido)
- `pago → entregue`: nao mexe em `pago` boolean (campo separado)
- Cancelamento sempre permitido a partir de qualquer status nao-`recolhido`

---

## 3. Identidade frente + verso

### Schema

Coluna `clientes.documento_pessoal_url` substituida por `documento_pessoal_urls` (array).

### Tipo TypeScript

```ts
type Cliente = {
  // ...
  documento_pessoal_urls: string[] | null  // 1-2 itens quando enviado
  // ...
}
```

### UI cliente — `components/document-upload-section.tsx`

- Label: "Documento de identidade"
- Hint: "Envie frente e verso. RG: 2 fotos. CNH: pode mandar so 1 foto aberta mostrando os dois lados."
- Aceita 1 ou 2 arquivos
- Apos primeiro upload, aparece slot opcional pro segundo
- Botao remover por foto

### UI admin — viewer

Em `app/admin/pedidos/[id]/page.tsx` (ou onde tiver doc viewer):
- Renderiza `documento_pessoal_urls.map(url => <img src={signedUrl(url)} />)` lado a lado
- Mantem viewer do comprovante de residencia separado

### Server actions

- `uploadDocumentoPessoal(pedidoId, file, slot: 'primeiro' | 'segundo')` — append no array
- `removeDocumentoPessoal(pedidoId, urlIndex)` — splice no array

### Migracao de clientes existentes

`UPDATE clientes SET documento_pessoal_urls = ARRAY[documento_pessoal_url] WHERE documento_pessoal_url IS NOT NULL`.
Coluna antiga removida na mesma migration apos o `UPDATE`.

---

## 4. Barril consignado

### Regras de negocio (definidas por Jean via audio 2026-05-13)

- So 1 barril consignado por pedido
- So vale para o 2º barril do mesmo produto que ja tem 1 unidade no pedido
- Cliente paga o 1º barril e o consignado fica "pendente" ate settlement
- Apos entrega, admin marca como "usado" (cobra) ou "devolvido" (estorna)

### Estrutura no DB

Item normal: `quantidade=1, is_consignado=false`
Item consignado: `quantidade=1, is_consignado=true, consignado_status='pendente'`
Cliente com "1 barril + 1 consignado" tem 2 rows em `pedido_items`.

### Pricing

`lib/pricing.ts` — nova funcao:

```ts
export const calculateOrderTotals = (items: ConsigItem[]) => {
  const committedSubtotal = items
    .filter(i => !i.is_consignado || i.consignado_status === 'usado')
    .reduce((sum, i) => sum + i.subtotal, 0)

  const maxSubtotal = items.reduce((sum, i) => sum + i.subtotal, 0)

  return {
    subtotalMin: committedSubtotal,
    subtotalMax: maxSubtotal,
    hasPendente: items.some(i => i.is_consignado && i.consignado_status === 'pendente'),
  }
}
```

### Coluna `pedidos.total`

- Enquanto `consignado_status='pendente'`: armazena o valor MINIMO (committed)
- Apos settlement `usado`: recalcula incluindo consignado
- Apos settlement `devolvido`: mantem minimo

### UI

**Modal pedido manual (criacao):**
- Checkbox "Marcar 2º barril como consignado" aparece quando qty=2 mesmo produto

**Order detail:**
- Banner amarelo "Consignado pendente" + texto "R$ X esperando settlement"
- 2 botoes: "Marcar como usado" (verde) / "Marcar como devolvido" (cinza)

**Display do total:**
- Se `hasPendente`: exibe `R$ {subtotalMin} / R$ {subtotalMax}` com tooltip "minimo/maximo"
- Senao: exibe total normal

### Server action — settle consignado

```ts
export const settleConsignado = async (pedidoItemId: string, status: 'usado' | 'devolvido') => {
  // UPDATE pedido_items SET consignado_status = status WHERE id = pedidoItemId
  // RECALC pedidos.subtotal/total via funcao calculateOrderTotals
  // INSERT pedido_edit_log (field='consignado_status', old=pendente, new=status)
  // revalidatePath
}
```

### Constraint

- Server-side guard em `createManualOrder` e `addPedidoItem`: rejeitar se ja existe item consignado naquele pedido
- Rejeitar consignado se quantidade do produto base != 1 no pedido

---

## 5. Desverificar documento

### UI

No order detail, ao lado de "Verificado em DD/MM/AAAA por Marcus":
- Botao secundario "Revisar de novo"
- Modal confirmacao: "Desfazer verificacao do documento? Sera necessario verificar novamente antes de avancar."

### Server action

```ts
export const revertDocumentoVerificacao = async (clienteId: string) => {
  // UPDATE clientes SET
  //   documento_verificado = false,
  //   documento_verificado_em = NULL,
  //   documento_verificado_por = NULL
  // UPDATE pedidos SET documento_status = 'enviado' WHERE cliente_id = clienteId AND documento_status = 'verificado'
  // INSERT pedido_edit_log para cada pedido afetado (field='documento_status', old='verificado', new='enviado')
  // revalidatePath
}
```

Nota: a desverificacao afeta TODOS os pedidos do cliente que estavam em `verificado`.
Eh esperado — eh o cliente cujo doc foi marcado errado.

---

## 6. Editar pedido + log

### Statuses editaveis

`confirmado`, `enviar_para_entregador`, `em_rota`.

Locked: `entregue`, `pago`, `recolhido`, `cancelado`.

### Campos editaveis

- `data_evento`, `horario_evento`
- `endereco`, `endereco_completo`
- `observacoes`, `rampas_escadas`
- `tipo_chopeira`
- `frete`
- Itens (adicionar, remover, mudar quantidade — recalcula subtotal)
- `metodo_pagamento`, `pago`

### UI

Order detail tem botao "Editar pedido" → abre drawer parecido com o de cadastro manual
mas pre-preenchido. Campos travados aparecem com cadeado e tooltip "Pedido em status X — nao editavel".

Drawer mostra historico de edicoes no rodape: 
"Editado por Marcus em 2026-05-13 14:32 — alterou horario_evento de 14:00 para 12:00"

### Server action

```ts
export const updatePedido = async (pedidoId: string, changes: Partial<Pedido>) => {
  const pedido = await getPedido(pedidoId)
  if (LOCKED_STATUSES.includes(pedido.status)) throw new Error('Pedido travado')

  // Para cada campo em changes:
  //   se valor mudou, INSERT pedido_edit_log com old/new
  // UPDATE pedidos SET ...changes, updated_at = now()
  // revalidatePath
}
```

### Itens

Edicao de itens vira atraves de actions separadas `addPedidoItem`, `removePedidoItem`,
`updatePedidoItemQuantity`. Cada uma loga em `pedido_edit_log` com field tipo
`items.added`, `items.removed`, `items.quantity_changed`.

---

## Testes

### Unit (vitest)

- `pricing.test.ts`:
  - Total com 1 item normal + 1 consignado pendente → min/max corretos
  - Total apos usado → recalcula com consignado
  - Total apos devolvido → mantem minimo
  - Tentar marcar 2 consignados no mesmo pedido → erro

- `admin-ordem.test.ts`:
  - revertOrderStatus rejeita ir para frente
  - revertOrderStatus permite cancelado
  - updatePedido rejeita campos em status locked

### Integration / E2E (Playwright manual)

1. Criar pedido manual com cliente novo
2. Criar pedido manual com cliente existente (busca por telefone)
3. Criar pedido manual com consignado (2 barris) → ver total `min/max`
4. Marcar consignado como usado → total ajusta
5. Marcar consignado como devolvido → total mantem minimo
6. Voltar status `em_rota → confirmado` → log gravado
7. Cliente sobe 1 foto de identidade → admin ve 1 foto
8. Cliente sobe 2 fotos de identidade → admin ve 2 fotos lado a lado
9. Admin marca doc como verificado → desverifica → status volta para `enviado`
10. Admin edita horario em pedido `em_rota` → log gravado
11. Admin tenta editar pedido em `entregue` → bloqueado

---

## Out of scope (deixar para depois)

- Audit log na UI completa (so mostra resumo no order detail)
- Notificacao por WhatsApp quando admin edita pedido
- Permissoes granulares (todo admin pode tudo por enquanto)
- Consignado em mais de um produto / mais de 1 unidade consignada
- Edicao de cliente (so editamos pedido)

---

## Arquivos afetados (estimativa)

### Novos

- `supabase/migrations/020_admin_operacional.sql`
- `app/components/admin/manual-order-drawer.tsx`
- `app/components/admin/edit-order-drawer.tsx`
- `app/components/admin/revert-status-modal.tsx`
- `app/components/admin/consignado-banner.tsx`
- `app/components/admin/edit-log.tsx`

### Modificados

- `app/lib/types.ts` — atualizar `Cliente`, `PedidoItem`, novo `PedidoEditLog`
- `app/lib/schemas.ts` — `manualOrderInputSchema`, `updatePedidoSchema`
- `app/lib/admin-actions.ts` — novas server actions
- `app/lib/pricing.ts` — `calculateOrderTotals` com consignado
- `app/lib/queries.ts` — query pedido com items + consignado info
- `app/components/document-upload-section.tsx` — aceita 1-2 arquivos
- `app/components/document-upload.tsx` — slot multi-arquivo
- `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` — botoes voltar/editar/desverificar + banner consignado
- `app/components/admin/status-actions.tsx` — botao "Voltar status"
- `app/components/order-status-badge.tsx` — sem mudancas (status nao mudou)

### Tests

- `app/lib/pricing.test.ts` — casos de consignado
- `app/lib/admin-ordem.test.ts` — casos de revert/edit
