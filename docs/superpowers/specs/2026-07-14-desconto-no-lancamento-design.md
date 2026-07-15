# Campo Desconto no lançamento (pedido manual)

**Data:** 2026-07-14
**Origem:** Jean lançou um pedido (3x Vila Império 50L, R$1.270) e precisou dar desconto, mas o drawer de pedido manual **não tem campo de desconto** — só dá pra aplicar desconto DEPOIS, editando o pedido. Resultado: a confirmação foi ao cliente com o valor cheio (R$1.270) e o Jean teve que corrigir na conversa ("só posso lançar o desconto depois que lanço no sistema"). Queremos aplicar o desconto **já na criação**, pro valor certo chegar ao cliente.

## Decisão (aprovada)

Adicionar campo **Desconto** ao drawer de criar pedido manual. A confirmação (WhatsApp/email) mostra **só o Total já com desconto** — sem itemizar o abatimento (mínimo, consistente com o "editar pedido", que já funciona assim).

## Contexto: quase tudo já existe

- `calculateStoredTotals(items, frete, desconto)` → `total = subtotal − desconto + frete`. Já pronto.
- `consignadoSplit(items, frete, desconto)` → `totalCheio` e `aPagar` já abatem o desconto. Já pronto.
- Edit drawer (`edit-order-drawer.tsx`) já tem o campo `desconto` (MoneyInput + estado + total). Referência de padrão.
- `buildConfirmationMessage` usa `pedido.total`. Se o total sair com desconto, a msg mostra o valor certo — **sem mudar a mensagem**.
- Coluna `pedidos.desconto` já existe (o editar já grava). **Sem migration.**

O gap é só: `createManualOrder` **hardcoda `desconto: 0`**, e o drawer não coleta desconto.

## Mudanças

### 1. Drawer (`app/components/admin/manual-order-drawer.tsx`)
- `const [desconto, setDesconto] = useState(0)` + `setDesconto(0)` no `resetForm`.
- `MoneyInput` **Desconto** no Pagamento, ao lado do Frete (grid 2 colunas Frete | Desconto), `min={0}`.
- `consignadoSplit(itemRowsForTotals, frete, desconto)` (hoje passa `0`).
- Linha "Desconto − R$X" no resumo, nos DOIS ramos (com e sem consignado), quando `desconto > 0`.
- Incluir `desconto` no objeto `input` do submit.

### 2. Schema (`app/lib/schemas.ts`)
- `manualOrderInputSchema`: adicionar `desconto: z.number().nonnegative()` (mesmo padrão do `frete`).

### 3. `createManualOrder` (`app/lib/admin-actions/pedido-edit.ts`)
- `calculateStoredTotals(itemRows, data.frete, data.desconto)` (era `..., data.frete, 0`).
- RPC `p_pedido.desconto: data.desconto` (era `desconto: 0`).

### 4. Confirmação (WhatsApp + email)
- **Nenhuma mudança.** `pedido.total` já reflete o desconto; `buildConfirmationMessage`/`sendCustomerOrderConfirmation` são total-driven.

## Interação com consignado

Desconto reduz o `aPagar` (parte firme) via `consignadoSplit` — comportamento natural: o abatimento entra no que o cliente paga firme, não no consignado.

## Testes (TDD, vitest)

- `schemas.test.ts` — `manualOrderInputSchema`: aceita `desconto` válido; rejeita `desconto` negativo; (o pedido-base do teste ganha `desconto: 0`).
- `calculateStoredTotals` com desconto já é coberto em `pricing.test.ts` (sem novo teste necessário).
- Wiring `createManualOrder` (desconto → total): sem harness de action no repo; verificado por leitura + typecheck + build + eyeball em staging.

## Não-objetivos

- Não itemizar o desconto na mensagem ao cliente (só o total).
- Não mexer no fluxo de editar pedido (já tem desconto).
- Sem migration; sem mudança de RPC (só passa o valor real).
- Sem clamp superior de desconto (espelha o editar; `min=0` no input; o admin vê o Total no resumo antes de criar).

## Verificação

`npx vitest run` local, typecheck, build. Revisão adversarial multi-agente. Push staging → testar no navegador (lançar com desconto → resumo mostra Total abatido → confirmar valor certo). Depois prod.
