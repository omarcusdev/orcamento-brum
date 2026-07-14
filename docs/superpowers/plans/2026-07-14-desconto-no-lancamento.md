# Desconto no lançamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coletar `desconto` no drawer de pedido manual e aplicá-lo na criação, pro `pedido.total` (e a confirmação ao cliente) já saírem com o desconto.

**Architecture:** `calculateStoredTotals`/`consignadoSplit` já aceitam desconto; a confirmação é total-driven. O gap é: schema não tem `desconto`, `createManualOrder` hardcoda `0`, e o drawer não coleta. Três edits pequenos + 1 teste. Sem migration, sem mudança de RPC (só passa o valor real), sem mudança na mensagem.

**Tech Stack:** TypeScript, React 19, Zod, Vitest.

## Global Constraints

- `desconto` segue o mesmo padrão do `frete`: `z.number().nonnegative()`, `MoneyInput min={0}`.
- Confirmação (WhatsApp/email) NÃO muda — só o `pedido.total` reflete o desconto.
- Sem migration; o RPC `create_manual_order` já insere `(p_pedido->>'desconto')` e `(p_pedido->>'total')` verbatim.
- CI pula vitest — rodar `npx vitest run` local.

---

### Task 1: Schema — `desconto` no `manualOrderInputSchema`

**Files:**
- Modify: `app/lib/schemas.ts` (~L108, dentro de `manualOrderInputSchema`)
- Test: `app/lib/schemas.test.ts`

**Interfaces:**
- Produces: `ManualOrderInput` passa a ter `desconto: number`.

- [ ] **Step 1: Escrever o teste que falha**

Em `app/lib/schemas.test.ts`, adicionar `desconto: 0` ao objeto `validManualOrder` (senão os testes existentes quebram, pois `desconto` passa a ser obrigatório), e adicionar um bloco:

```ts
describe("manualOrderInputSchema — desconto", () => {
  it("aceita desconto valido", () => {
    expect(manualOrderInputSchema.safeParse({ ...validManualOrder, desconto: 50 }).success).toBe(true)
  })
  it("rejeita desconto negativo", () => {
    expect(manualOrderInputSchema.safeParse({ ...validManualOrder, desconto: -10 }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd /Users/marcusgoncalves/projects/orcamento-brum/app && npx vitest run lib/schemas.test.ts`
Expected: FAIL — sem `desconto` no schema, `validManualOrder` (agora com `desconto: 0`) é rejeitado (unrecognized key não falha por default no zod, mas o caso "rejeita negativo" espera `success=false` e obtém `true`). Pelo menos o caso negativo falha.

- [ ] **Step 3: Implementar o mínimo**

Em `app/lib/schemas.ts`, dentro de `manualOrderInputSchema`, após `frete: z.number().nonnegative(),`:

```ts
  frete: z.number().nonnegative(),
  desconto: z.number().nonnegative(),
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd /Users/marcusgoncalves/projects/orcamento-brum/app && npx vitest run lib/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/schemas.ts app/lib/schemas.test.ts
git commit -m "feat(desconto): desconto no manualOrderInputSchema"
```

---

### Task 2: `createManualOrder` usa `data.desconto`

**Files:**
- Modify: `app/lib/admin-actions/pedido-edit.ts` (~L117 e ~L145)

**Interfaces:**
- Consumes: `ManualOrderInput.desconto` (Task 1).

> Sem teste unitário (action supabase-backed sem harness); `calculateStoredTotals(desconto)` já é testado. Verificação por typecheck + build.

- [ ] **Step 1: `calculateStoredTotals` com desconto**

Trocar:
```ts
  const { subtotal, total } = calculateStoredTotals(
    itemRows.map((r) => ({
      subtotal: r.subtotal,
      is_consignado: r.is_consignado,
      consignado_status: r.consignado_status,
    })),
    data.frete,
    0,
  )
```
por (última arg `0` → `data.desconto`):
```ts
  const { subtotal, total } = calculateStoredTotals(
    itemRows.map((r) => ({
      subtotal: r.subtotal,
      is_consignado: r.is_consignado,
      consignado_status: r.consignado_status,
    })),
    data.frete,
    data.desconto,
  )
```

- [ ] **Step 2: RPC payload com desconto real**

No `p_pedido`, trocar `desconto: 0,` por `desconto: data.desconto,`.

- [ ] **Step 3: Verificar typecheck + build**

Run: `cd /Users/marcusgoncalves/projects/orcamento-brum/app && npx tsc --noEmit && npm run build`
Expected: sem erros; build ok.

- [ ] **Step 4: Commit**

```bash
git add app/lib/admin-actions/pedido-edit.ts
git commit -m "feat(desconto): createManualOrder aplica data.desconto no total e no RPC"
```

---

### Task 3: Drawer — campo Desconto + resumo + submit

**Files:**
- Modify: `app/components/admin/manual-order-drawer.tsx`

**Interfaces:**
- Consumes: `manualOrderInputSchema`/`ManualOrderInput` com `desconto` (Task 1).

> Sem teste unitário (drawer sem harness RTL). Verificação por typecheck + build + eyeball em staging.

- [ ] **Step 1: Estado + reset**

Após `const [frete, setFrete] = useState(0)` (~L67):
```ts
  const [frete, setFrete] = useState(0)
  const [desconto, setDesconto] = useState(0)
```
No `resetForm`, após `setFrete(0)`:
```ts
    setFrete(0)
    setDesconto(0)
```

- [ ] **Step 2: `consignadoSplit` com desconto**

Trocar `const split = consignadoSplit(itemRowsForTotals, frete, 0)` por:
```ts
  const split = consignadoSplit(itemRowsForTotals, frete, desconto)
```

- [ ] **Step 3: Campo Desconto no Pagamento (ao lado do Frete)**

Trocar o bloco do Frete:
```tsx
            <div>
              <label className={fieldLabelClass}>Frete</label>
              <MoneyInput value={frete} onChange={setFrete} min={0} aria-label="Frete" />
            </div>
```
por um grid Frete | Desconto:
```tsx
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={fieldLabelClass}>Frete</label>
                <MoneyInput value={frete} onChange={setFrete} min={0} aria-label="Frete" />
              </div>
              <div>
                <label className={fieldLabelClass}>Desconto</label>
                <MoneyInput value={desconto} onChange={setDesconto} min={0} aria-label="Desconto" />
              </div>
            </div>
```

- [ ] **Step 4: Linha Desconto no resumo (ramo consignado)**

Após a linha do Frete indentado (a `<div>` com `<span className="pl-2">Frete</span>`), inserir:
```tsx
                  {desconto > 0 && (
                    <div className="flex justify-between text-brand-warm-gray text-xs">
                      <span className="pl-2">Desconto</span>
                      <span className="tabular-nums">− {formatBRL(desconto)}</span>
                    </div>
                  )}
```

- [ ] **Step 5: Linha Desconto no resumo (ramo sem consignado)**

No ramo `else` (sem consignado), após a `<div>` do Frete (`<span>Frete</span>`) e ANTES da `<div>` do Total, inserir:
```tsx
                  {desconto > 0 && (
                    <div className="flex justify-between text-brand-warm-gray">
                      <span>Desconto</span>
                      <span className="tabular-nums">− {formatBRL(desconto)}</span>
                    </div>
                  )}
```

- [ ] **Step 6: Submit inclui desconto**

No objeto `input`, após `frete,`:
```ts
        frete,
        desconto,
```

- [ ] **Step 7: Verificar typecheck + build**

Run: `cd /Users/marcusgoncalves/projects/orcamento-brum/app && npx tsc --noEmit && npm run build`
Expected: sem erros; build ok.

- [ ] **Step 8: Commit**

```bash
git add app/components/admin/manual-order-drawer.tsx
git commit -m "feat(desconto): campo Desconto no drawer de pedido manual + resumo"
```

---

## Verificação final

- [ ] `cd app && npx vitest run` — suíte verde.
- [ ] `cd app && npx tsc --noEmit && npm run build` — ok.
- [ ] Revisão adversarial multi-agente (foco: total com desconto, interação consignado, negativos).
- [ ] Push staging → eyeball: lançar 3x Vila Império (R$1.270) + Desconto R$35 → resumo Total R$1.235; criar → confirmar que o total gravado/mensagem = R$1.235.

## Self-review

- **Cobertura do spec:** schema desconto (Task 1) ✓; createManualOrder aplica (Task 2) ✓; drawer campo+resumo+submit (Task 3) ✓; confirmação inalterada (total-driven) ✓; sem migration ✓. Sem gaps.
- **Placeholders:** nenhum.
- **Tipos:** `desconto: number` em `ManualOrderInput`; drawer envia `desconto` (state number); `consignadoSplit(..., desconto)` e `calculateStoredTotals(..., data.desconto)` já tipados. OK.
