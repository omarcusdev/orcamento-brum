# FRE-24 — Link conversa ↔ pedido no inbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No inbox de atendimento, mostrar os pedidos do cliente numa faixa no topo da thread (link → página do pedido), permitir vincular conversas "sem cadastro" a um cliente, e abrir a conversa a partir da página do pedido.

**Architecture:** Sem migration — o elo `conversa.cliente_id → clientes → pedidos` já existe. Um módulo puro de formatação + 3 server actions novas em `chat-actions.ts`; um componente novo `ThreadContexto` (a faixa, com a busca de vínculo) renderizado no topo da thread; e um link reverso na página do pedido (lookup inline) que abre o inbox via `?conversa=<id>`.

**Tech Stack:** Next.js 16 (App Router, server actions, server components), React 19, TypeScript, Tailwind v4, vitest, Supabase (auth-aware client via `requireAdmin`).

**Branch:** `staging` (FRE-24 em cima da FRE-23; PR único no go-live). NÃO trabalhar em `main`.

**Reference (ler para imitar o padrão):**
- `app/lib/whatsapp/chat-actions.ts` — actions existentes (`"use server"`, `requireAdmin` → `{ supabase }`, retornos tipados, `.map` de snake→camel). `ConversaResumo` já tem `clienteId`/`nome`/`telefone`.
- `app/components/admin/atendimento/atendimento-client.tsx` — inbox (lista `w-2/5` + thread `flex-1`, `selId`, realtime, `formatContato`).
- `app/components/order-status-badge.tsx` — `OrderStatusBadge` (default export, `{ status: PedidoStatus }`), badge a reusar.
- `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` — server component; `supabase` (de `@/lib/supabase/server`); card CLIENTE em ~linhas 156–182; `pedido.clientes.id` é o `cliente_id`.
- `app/components/ui` — `Button` (variants `primary`/`ghost`, `size="sm"`), `Input`.
- `app/lib/types.ts` — `PedidoStatus`.

**Comandos (rodar de `app/`):** testes `npm test`; typecheck `npm run typecheck`; build `npm run build`.

---

## File Structure

**Novos**
- `app/lib/whatsapp/pedido-contexto.ts` — módulo puro: `pedidoRefCurto`, `formatDataEvento`, `formatTotalBR`, `sanitizeTermoBusca`, `termoBuscaValido`.
- `app/lib/whatsapp/pedido-contexto.test.ts` — testes do módulo puro.
- `app/components/admin/atendimento/thread-contexto.tsx` — a faixa de contexto (lista de pedidos + busca de vínculo). Isola a feature do `atendimento-client` (que cuida de lista/thread/realtime).

**Modificados**
- `app/lib/whatsapp/chat-actions.ts` — `getPedidosDoCliente`, `buscarClientes`, `vincularConversaCliente` (+ tipos `PedidoResumoCliente`, `ClienteBusca`).
- `app/components/admin/atendimento/atendimento-client.tsx` — renderiza `<ThreadContexto>` no topo da thread; lê `?conversa=` pra pré-selecionar.
- `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` — lookup inline da conversa do cliente + link "Abrir conversa no WhatsApp".

**Sem migration.**

---

## Task 1: Módulo puro `pedido-contexto.ts`

**Files:**
- Create: `app/lib/whatsapp/pedido-contexto.ts`
- Test: `app/lib/whatsapp/pedido-contexto.test.ts`

- [ ] **Step 1: Escrever o teste (que vai falhar)**

Criar `app/lib/whatsapp/pedido-contexto.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  pedidoRefCurto,
  formatDataEvento,
  formatTotalBR,
  sanitizeTermoBusca,
  termoBuscaValido,
} from "./pedido-contexto"

describe("pedidoRefCurto", () => {
  it("prefixa # e corta em 8 chars", () => {
    expect(pedidoRefCurto("1a2b3c4d-aaaa-bbbb")).toBe("#1a2b3c4d")
  })
})

describe("formatDataEvento", () => {
  it("YYYY-MM-DD -> DD/MM", () => {
    expect(formatDataEvento("2026-06-10")).toBe("10/06")
    expect(formatDataEvento("2026-12-01")).toBe("01/12")
  })
})

describe("formatTotalBR", () => {
  it("formata em BRL pt-BR (espaço pode ser NBSP)", () => {
    expect(formatTotalBR(880)).toMatch(/^R\$\s?880,00$/)
    expect(formatTotalBR(550.5)).toMatch(/^R\$\s?550,50$/)
  })
})

describe("sanitizeTermoBusca", () => {
  it("apara e remove chars com significado no .or() do PostgREST", () => {
    expect(sanitizeTermoBusca("  João  ")).toBe("João")
    expect(sanitizeTermoBusca("a,b(c)%*\\d")).toBe("abcd")
  })
})

describe("termoBuscaValido", () => {
  it("exige >= 2 chars após sanitizar", () => {
    expect(termoBuscaValido(" a ")).toBe(false)
    expect(termoBuscaValido("an")).toBe(true)
    expect(termoBuscaValido("%,(")).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run (de `app/`): `npm test -- pedido-contexto`
Expected: FAIL — `Failed to resolve import "./pedido-contexto"`.

- [ ] **Step 3: Implementar o módulo**

Criar `app/lib/whatsapp/pedido-contexto.ts`:

```ts
// Helpers puros de apresentação da faixa de contexto do inbox. Sem I/O.

export const pedidoRefCurto = (id: string): string => `#${id.slice(0, 8)}`

// data_evento chega como 'YYYY-MM-DD' (string) -> 'DD/MM' sem depender de fuso
export const formatDataEvento = (iso: string): string => {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

export const formatTotalBR = (total: number): string =>
  total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// Remove chars com significado no filtro `.or()` do PostgREST (vírgula, parênteses,
// curinga %, *, barra) — sem isso um termo do operador poderia quebrar/injetar o filtro.
export const sanitizeTermoBusca = (termo: string): string =>
  termo.trim().replace(/[,()%*\\]/g, "")

export const termoBuscaValido = (termo: string): boolean =>
  sanitizeTermoBusca(termo).length >= 2
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run (de `app/`): `npm test -- pedido-contexto`
Expected: PASS (5 describes verdes).

- [ ] **Step 5: Typecheck**

Run (de `app/`): `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add app/lib/whatsapp/pedido-contexto.ts app/lib/whatsapp/pedido-contexto.test.ts
git commit -m "feat(whatsapp): modulo puro de contexto pedido↔conversa (FRE-24)"
```

---

## Task 2: Server actions em `chat-actions.ts`

**Files:**
- Modify: `app/lib/whatsapp/chat-actions.ts` (adicionar import + 3 actions/tipos no fim)

(Sem teste unitário — `chat-actions.ts` não tem testes no repo; validado por typecheck + E2E em staging.)

- [ ] **Step 1: Adicionar o import do módulo puro**

No topo de `app/lib/whatsapp/chat-actions.ts`, depois do bloco de imports existente (`import { sendWhatsAppMessage } from "@/lib/whatsapp"`), acrescentar:

```ts
import { sanitizeTermoBusca } from "@/lib/whatsapp/pedido-contexto"
```

- [ ] **Step 2: Adicionar tipos + actions no fim do arquivo**

Acrescentar ao final de `app/lib/whatsapp/chat-actions.ts`:

```ts
export type PedidoResumoCliente = {
  id: string
  status: string
  dataEvento: string
  total: number
}

// Últimos pedidos do cliente (mais recentes primeiro). Limite 6: a UI mostra 5 e
// sinaliza "+ mais" se vier um 6º.
export const getPedidosDoCliente = async (clienteId: string): Promise<PedidoResumoCliente[]> => {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("pedidos")
    .select("id, status, data_evento, total")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(6)

  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    dataEvento: r.data_evento,
    total: Number(r.total),
  }))
}

export type ClienteBusca = { id: string; nome: string; telefone: string | null }

// Busca para o picker do vincular: nome OU telefone. Termo é sanitizado (anti-injeção
// no `.or()`) e exige >= 2 chars úteis, senão retorna [] sem ir ao banco.
export const buscarClientes = async (termo: string): Promise<ClienteBusca[]> => {
  const safe = sanitizeTermoBusca(termo)
  if (safe.length < 2) return []

  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("clientes")
    .select("id, nome, telefone")
    .or(`nome.ilike.%${safe}%,telefone.ilike.%${safe}%`)
    .limit(8)

  return (data ?? []).map((r) => ({ id: r.id, nome: r.nome, telefone: r.telefone }))
}

// Vincula (ou troca) o cliente de uma conversa. Reusa a policy de UPDATE admin
// que o markConversaRead já usa — sem migration.
export const vincularConversaCliente = async (
  conversaId: string,
  clienteId: string,
): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from("conversas_whatsapp")
    .update({ cliente_id: clienteId })
    .eq("id", conversaId)

  return { ok: !error }
}
```

- [ ] **Step 3: Typecheck**

Run (de `app/`): `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/lib/whatsapp/chat-actions.ts
git commit -m "feat(whatsapp): actions getPedidosDoCliente/buscarClientes/vincular (FRE-24)"
```

---

## Task 3: Faixa de contexto `ThreadContexto` + wire na thread

**Files:**
- Create: `app/components/admin/atendimento/thread-contexto.tsx`
- Modify: `app/components/admin/atendimento/atendimento-client.tsx`

(Sem teste de componente — não há testes de componente no repo; validado por typecheck/build + E2E em staging.)

- [ ] **Step 1: Criar o componente da faixa**

Criar `app/components/admin/atendimento/thread-contexto.tsx`:

```tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import type { PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"
import { Button, Input } from "@/components/ui"
import {
  buscarClientes,
  getPedidosDoCliente,
  vincularConversaCliente,
  type ClienteBusca,
  type ConversaResumo,
  type PedidoResumoCliente,
} from "@/lib/whatsapp/chat-actions"
import {
  pedidoRefCurto,
  formatDataEvento,
  formatTotalBR,
  termoBuscaValido,
} from "@/lib/whatsapp/pedido-contexto"

const formatContato = (c: ConversaResumo) => c.nome ?? `+${c.telefone}`

type Props = { conversa: ConversaResumo; onVinculo: () => void }

const ThreadContexto = ({ conversa, onVinculo }: Props) => {
  const [pedidos, setPedidos] = useState<PedidoResumoCliente[]>([])
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [termo, setTermo] = useState("")
  const [resultados, setResultados] = useState<ClienteBusca[]>([])
  const [, startTransition] = useTransition()

  const clienteId = conversa.clienteId

  // Busca os pedidos quando a conversa tem cliente; limpa quando não tem.
  useEffect(() => {
    if (!clienteId) {
      setPedidos([])
      return
    }
    let ativo = true
    getPedidosDoCliente(clienteId).then((p) => {
      if (ativo) setPedidos(p)
    })
    return () => {
      ativo = false
    }
  }, [clienteId])

  // Fecha/zera o picker ao trocar de conversa.
  useEffect(() => {
    setBuscaAberta(false)
    setTermo("")
    setResultados([])
  }, [conversa.id])

  const onTermo = (v: string) => {
    setTermo(v)
    if (!termoBuscaValido(v)) {
      setResultados([])
      return
    }
    startTransition(async () => setResultados(await buscarClientes(v)))
  }

  const vincular = (id: string) => {
    startTransition(async () => {
      const { ok } = await vincularConversaCliente(conversa.id, id)
      if (ok) {
        setBuscaAberta(false)
        setTermo("")
        setResultados([])
        onVinculo() // pai refaz getConversas → prop atualiza clienteId → efeito busca pedidos
      }
    })
  }

  const picker = (
    <div className="mt-2 space-y-2">
      <Input
        autoFocus
        value={termo}
        onChange={(e) => onTermo(e.target.value)}
        placeholder="Buscar cliente por nome ou telefone…"
        aria-label="Buscar cliente"
      />
      {resultados.length > 0 && (
        <ul className="max-h-40 overflow-y-auto divide-y divide-white/5 rounded-lg border border-white/10">
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => vincular(c.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition cursor-pointer"
              >
                <span className="text-white">{c.nome}</span>
                {c.telefone && <span className="text-brand-warm-gray"> · {c.telefone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {termoBuscaValido(termo) && resultados.length === 0 && (
        <p className="text-xs text-brand-warm-gray">Nenhum cliente encontrado.</p>
      )}
    </div>
  )

  return (
    <div className="border-b border-white/5 pb-3 mb-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white">{formatContato(conversa)}</span>
        {clienteId ? (
          <button
            type="button"
            onClick={() => setBuscaAberta((v) => !v)}
            className="text-xs text-brand-warm-gray hover:text-white transition cursor-pointer"
          >
            trocar cliente
          </button>
        ) : (
          !buscaAberta && (
            <Button variant="ghost" size="sm" onClick={() => setBuscaAberta(true)}>
              Vincular a um cliente
            </Button>
          )
        )}
      </div>

      {!clienteId && !buscaAberta && (
        <p className="text-xs text-brand-warm-gray mt-1">
          Sem cadastro — vincule a um cliente para ver os pedidos.
        </p>
      )}

      {clienteId && (
        <div className="mt-2 space-y-1">
          {pedidos.length === 0 ? (
            <p className="text-xs text-brand-warm-gray">Nenhum pedido ainda.</p>
          ) : (
            <>
              {pedidos.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/pedidos/${p.id}`}
                  className="flex items-center gap-2 text-sm hover:bg-white/5 rounded px-1 py-0.5 transition"
                >
                  <span className="font-mono text-xs text-brand-warm-gray">{pedidoRefCurto(p.id)}</span>
                  <OrderStatusBadge status={p.status as PedidoStatus} />
                  <span className="text-xs text-brand-warm-gray">{formatDataEvento(p.dataEvento)}</span>
                  <span className="text-white ml-auto">{formatTotalBR(p.total)}</span>
                </Link>
              ))}
              {pedidos.length > 5 && <p className="text-xs text-brand-warm-gray">+ mais pedidos</p>}
            </>
          )}
        </div>
      )}

      {buscaAberta && picker}
    </div>
  )
}

export default ThreadContexto
```

- [ ] **Step 2: Renderizar a faixa no topo da thread**

Em `app/components/admin/atendimento/atendimento-client.tsx`:

(a) Adicionar o import (junto aos outros imports de componente):

```ts
import ThreadContexto from "@/components/admin/atendimento/thread-contexto"
```

(b) Logo após a linha `const [erroEnvio, setErroEnvio] = useState(false)` (fim do bloco de `useState`), derivar a conversa selecionada:

```ts
  const sel = conversas.find((c) => c.id === selId) ?? null
```

(c) Dentro do bloco da thread, o trecho atual é:

```tsx
        {selId ? (
          <>
            <div ref={threadRef} className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3">
```

Trocar por (insere a faixa antes do `threadRef`):

```tsx
        {selId ? (
          <>
            {sel && <ThreadContexto conversa={sel} onVinculo={refetchConversas} />}
            <div ref={threadRef} className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3">
```

- [ ] **Step 3: Typecheck + build**

Run (de `app/`): `npm run typecheck && npm run build`
Expected: sem erros; build conclui. (Confirma os imports de `OrderStatusBadge`, `Input`, `PedidoStatus` e as actions novas.)

- [ ] **Step 4: Commit**

```bash
git add app/components/admin/atendimento/thread-contexto.tsx app/components/admin/atendimento/atendimento-client.tsx
git commit -m "feat(admin): faixa de pedidos do cliente + vincular na thread do inbox (FRE-24)"
```

---

## Task 4: Link reverso (pedido → conversa)

**Files:**
- Modify: `app/components/admin/atendimento/atendimento-client.tsx` (pré-seleção via `?conversa=`)
- Modify: `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` (lookup inline + link)

- [ ] **Step 1: Inbox lê `?conversa=` para pré-selecionar**

Em `app/components/admin/atendimento/atendimento-client.tsx`:

(a) Adicionar ao import de `next/navigation` (ou criar o import):

```ts
import { useSearchParams } from "next/navigation"
```

(b) Trocar a inicialização do `selId`. Hoje:

```ts
  const [conversas, setConversas] = useState(initial)
  const [selId, setSelId] = useState<string | null>(initial[0]?.id ?? null)
```

Por (usa o param `?conversa=` se ele existir e corresponder a uma conversa carregada; senão, primeira da lista):

```ts
  const searchParams = useSearchParams()
  const [conversas, setConversas] = useState(initial)
  const [selId, setSelId] = useState<string | null>(() => {
    const alvo = searchParams.get("conversa")
    if (alvo && initial.some((c) => c.id === alvo)) return alvo
    return initial[0]?.id ?? null
  })
```

> Nota: a página `/admin/whatsapp` é `export const dynamic = "force-dynamic"`, então `useSearchParams` não exige `<Suspense>`. Se mesmo assim o `npm run build` reclamar de `useSearchParams()/Suspense`, envolver `<AtendimentoClient .../>` num `<Suspense fallback={null}>` em `app/app/admin/(authenticated)/whatsapp/page.tsx`.

- [ ] **Step 2: Lookup inline da conversa na página do pedido**

Em `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`, logo após a linha `const whatsappLink = ...` (≈ linha 92), acrescentar:

```ts
  const { data: conversaCliente } = await supabase
    .from("conversas_whatsapp")
    .select("id")
    .eq("cliente_id", pedido.clientes.id)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
```

- [ ] **Step 3: Render do link no card CLIENTE**

No card CLIENTE, o bloco do telefone hoje é:

```tsx
                <div className="flex justify-between">
                  <span className="text-brand-warm-gray">Telefone</span>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                    {pedido.clientes.telefone}
                  </a>
                </div>
```

Logo **depois** desse `<div>`, acrescentar (link só aparece se houver conversa):

```tsx
                {conversaCliente && (
                  <div className="flex justify-end">
                    <Link
                      href={`/admin/whatsapp?conversa=${conversaCliente.id}`}
                      className="text-sm text-brand-yellow hover:underline"
                    >
                      Abrir conversa no WhatsApp →
                    </Link>
                  </div>
                )}
```

(`Link` já está importado no topo da página — `import Link from "next/link"`.)

- [ ] **Step 4: Typecheck + build**

Run (de `app/`): `npm run typecheck && npm run build`
Expected: sem erros; build conclui com `/admin/whatsapp` e `/admin/pedidos/[id]`. Se o build acusar `useSearchParams` precisando de Suspense, aplicar a nota do Step 1.

- [ ] **Step 5: Rodar a suíte de testes inteira**

Run (de `app/`): `npm test`
Expected: tudo verde (os testes de `pedido-contexto` somam aos existentes; nada quebrado).

- [ ] **Step 6: Commit**

```bash
git add "app/components/admin/atendimento/atendimento-client.tsx" "app/app/admin/(authenticated)/pedidos/[id]/page.tsx"
git commit -m "feat(admin): link reverso pedido→conversa + ?conversa= no inbox (FRE-24)"
```

---

## Pós-execução (coordenador — fora do subagent-driven)

Depois dos 4 tasks:
1. **Deploy staging** (push `staging`) e **E2E manual** no inbox: (a) conversa casada → faixa lista pedidos, link abre `/admin/pedidos/[id]`; (b) conversa sem cadastro → "Vincular" → buscar → escolher → faixa popula; (c) "trocar cliente"; (d) na página de um pedido cujo cliente tem conversa → "Abrir conversa no WhatsApp" cai na thread certa; (e) cliente sem pedido / sem conversa → estados neutros (sem link, "Nenhum pedido ainda").
2. Sem migration e sem env nova — nada a aplicar no Supabase/Vercel. Prod junto no go-live (FRE-21).
```
</content>
