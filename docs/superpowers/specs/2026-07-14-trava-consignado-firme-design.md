# Trava: pedido precisa de ≥1 barril firme (bloqueia 100% consignado)

**Data:** 2026-07-14
**Origem:** Jean reportou um pedido manual criado 100% consignado (2x Vila Império 50L, ambos consignado → "A pagar R$ 20,00" = só o frete). Cliente não paga nada firme; risco de negócio.

## Regra de negócio

Todo pedido precisa de **ao menos 1 barril firme** (não-consignado). Um pedido onde **todos** os itens são consignado é inválido e deve ser bloqueado.

Consignado = cliente só paga se usar. Sem nenhum item firme, o cliente paga apenas o frete e pode devolver tudo. A trava garante que sempre exista pelo menos uma venda firme.

Nota histórica: migration 020 criou um índice "um consignado por pedido"; migration 031 o removeu (2+ consignado é legítimo). Esta regra **não** limita a quantidade de consignado — apenas exige ≥1 firme coexistindo.

## Onde consignado entra no sistema

- **Checkout do cliente** (`createOrderSchema`): itens são só `{produto_id, quantidade}`. **Não existe consignado no checkout** — logo, um pedido 100% consignado só pode nascer pelo admin.
- **Pedido manual** (`createManualOrder`): itens têm `is_consignado`. ← caso reportado.
- **Edição** (`addPedidoItem` / `removePedidoItem`): admin liga/desliga consignado item a item.

## Escopo (aprovado)

App-level, **sem migration**. Guardar criação **e** edição.

## Núcleo puro

Em `app/lib/pricing.ts` (colocado junto da lógica consignado; módulo puro, já importado no drawer client, no schema server e na action server — sem ciclo):

```ts
export const REQUIRE_FIRME_MESSAGE = "Pedido precisa de ao menos 1 item nao-consignado (firme)"

export const hasFirmeItem = (items: readonly { is_consignado: boolean }[]): boolean =>
  items.some((i) => !i.is_consignado)
```

`hasFirmeItem` é a única definição da regra — reusada em todos os guards.

## Guards

### 1. Server — criação (`app/lib/schemas.ts`)
`manualOrderInputSchema.superRefine`: se `!hasFirmeItem(val.items)` → issue em `["items"]` com `REQUIRE_FIRME_MESSAGE`. Bloqueia o caminho reportado inclusive contra request forjado que pule o drawer.

### 2. Server — edição, remover (`app/lib/admin-actions/pedido-edit.ts` → `removePedidoItem`)
Antes de deletar, buscar os **outros** itens do pedido. Se remover o alvo deixar `remaining.length > 0 && !hasFirmeItem(remaining)` → `throw new Error(REQUIRE_FIRME_MESSAGE)`. Bloqueia "remover o último firme deixando tudo consignado". Esvaziar o pedido até 0 itens continua permitido (fora do escopo desta trava).

### 3. Client — UX do drawer (`app/components/admin/manual-order-drawer.tsx`)
Adicionar `hasFirmeItem(items)` à condição `canSubmit`. Quando houver itens mas todos consignado, mostrar aviso inline perto do rodapé com `REQUIRE_FIRME_MESSAGE`, para o botão desabilitado ter motivo visível.

### 4. Server — edição, adicionar (`addPedidoItem`) — defense-in-depth
Se `isConsignado` e o pedido atual tiver 0 itens firme (`!hasFirmeItem(existentes)`) → `throw new Error(REQUIRE_FIRME_MESSAGE)`. Fecha o buraco obscuro "esvaziar pedido → adicionar consignado". Adicionar item firme é sempre permitido.

## Testes (TDD, vitest)

- `pricing.test.ts` — `hasFirmeItem`: misto→true, tudo-consignado→false, vazio→false, tudo-firme→true.
- `schemas.test.ts` — `manualOrderInputSchema`: rejeita tudo-consignado (com `REQUIRE_FIRME_MESSAGE`); aceita misto; aceita 1 único firme.
- Edit path (`removePedidoItem`/`addPedidoItem`): sem harness de teste de action no repo (supabase-backed). A unidade testada é o predicado puro; o wiring é verificado por leitura + typecheck + build.

## Verificação

- `npx vitest run` local (CI pula vitest — gotcha conhecido do repo).
- typecheck + build.
- Revisão adversarial multi-agente do diff (caça-buracos na trava).

## Não-objetivos

- Não limitar quantidade de consignado.
- Não bloquear pedido vazio (0 itens) — problema distinto.
- Nenhuma mudança de banco/migration.
