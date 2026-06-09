# FRE-24 — Link conversa ↔ pedido no inbox (design)

**Data:** 2026-06-09
**Issue:** FRE-24 (Freelas, projeto "WhatsApp Integration — ALFA Chopp")
**Status:** desenho aprovado nas decisões-chave; pendente revisão do spec escrito.
**Depende de:** FRE-19 (inbox de atendimento v1).

## Goal

No inbox de atendimento, ligar a conversa ao(s) pedido(s) do cliente. Quando a conversa já casou com um `cliente_id`, mostrar os pedidos desse cliente numa faixa de contexto no topo da thread, com link pra página do pedido. Quando não casou ("sem cadastro"), permitir vincular a conversa a um cliente manualmente. E, partindo de um pedido, abrir a conversa do cliente no inbox.

**Sem mudança de schema** — todo o elo de dados já existe.

## Escopo (v1 — completo, escolhido pelo usuário)

1. **Faixa de contexto na thread** (núcleo): lista de pedidos do cliente casado.
2. **Vincular manual** (add-on 1): para conversas "sem cadastro" (`cliente_id` null).
3. **Link reverso** (add-on 2): da página do pedido → abrir a conversa no inbox.

**Grão:** conversa → `cliente_id` → **lista** de pedidos (1 cliente, N pedidos). Não existe e não se cria vínculo conversa↔pedido específico (`conversas_whatsapp.pedido_id` seria YAGNI).

**YAGNI / fora do v1:** página de filtro "todos os pedidos do cliente"; desvincular dedicado (o "trocar cliente" cobre correção de erro); paginação dos pedidos (mostra os 5 mais recentes + sinaliza se há mais, sem contar); histórico de vínculos.

## Arquitetura

O elo de dados já está montado (nada a migrar):

- `conversas_whatsapp.cliente_id` → `clientes(id)` (migração 022), preenchido no inbound por `matchClienteByPhone`. RLS de UPDATE admin já existe (o `markConversaRead` já faz `update conversas_whatsapp`).
- `pedidos.cliente_id` → `clientes(id)`, indexado (migração 001).
- `ConversaResumo` (em `chat-actions.ts`) **já carrega** `clienteId`, `nome`, `telefone` — a UI atual ignora `clienteId`.
- Alvo do link de pedido: rota dedicada **`/admin/pedidos/[id]`** (página de detalhe) — link comum, sem replicar drawer.

### Novas server actions — `app/lib/whatsapp/chat-actions.ts`

Mesmo padrão das existentes (`"use server"`, `requireAdmin` → `{ supabase }`, retornos tipados):

```ts
export type PedidoResumoCliente = {
  id: string
  status: string
  dataEvento: string   // 'YYYY-MM-DD'
  total: number
}

// últimos pedidos do cliente (mais recentes primeiro). Limite 6: exibe 5 e sinaliza se há um 6º.
getPedidosDoCliente(clienteId: string): Promise<PedidoResumoCliente[]>
//   select id, status, data_evento, total from pedidos
//   where cliente_id = clienteId order by created_at desc limit 6

export type ClienteBusca = { id: string; nome: string; telefone: string | null }

// busca por nome OU telefone para o picker do vincular. Termo < 2 chars → [].
buscarClientes(termo: string): Promise<ClienteBusca[]>
//   clientes where nome ilike %termo% or telefone ilike %digits% limit 8

// vincula a conversa a um cliente (sem-cadastro → cadastrado, ou troca)
vincularConversaCliente(conversaId: string, clienteId: string): Promise<{ ok: boolean }>
//   update conversas_whatsapp set cliente_id = clienteId where id = conversaId

// conversa mais recente de um cliente (para o link reverso); null se não houver
getConversaIdDoCliente(clienteId: string): Promise<string | null>
//   conversas_whatsapp where cliente_id = clienteId order by ultima_mensagem_em desc limit 1
```

### Módulo puro — `app/lib/whatsapp/pedido-contexto.ts` (novo, NÃO `"use server"`)

Helpers de apresentação, isolados e testáveis (sem I/O). Único lugar com a formatação da linha do pedido e a regra do termo de busca:

```ts
export const pedidoRefCurto = (id: string) => `#${id.slice(0, 8)}`
export const formatDataEvento = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}` }
export const formatTotalBR = (total: number) => total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
export const termoBuscaValido = (termo: string) => termo.trim().length >= 2
```

Os rótulos/cores do badge de status reaproveitam o helper já existente em `lib/admin-status.ts` (mesmo usado na lista de pedidos) — **não** duplicar mapa de status.

### Faixa de contexto na thread — `app/components/admin/atendimento/atendimento-client.tsx`

Renderizada no topo da área da thread (acima das mensagens), só quando há conversa selecionada. Layout aprovado: **faixa fixa no topo** (não rouba largura das 2 colunas atuais; não esconde por padrão).

Estado novo no componente: `pedidos: PedidoResumoCliente[]` + carregamento. Efeito: quando a conversa selecionada tem `clienteId`, chama `getPedidosDoCliente(clienteId)`; ao trocar de conversa, refaz. Quando `clienteId` é null, não busca.

Dois estados visuais:

- **Cliente casado:** `Nome · +telefone` + lista compacta. Cada linha:
  `pedidoRefCurto(id)` · badge de status (de `admin-status.ts`) · `formatDataEvento` · `formatTotalBR`, dentro de um `<Link href={\`/admin/pedidos/${id}\`}>`. Mostra os 5 mais recentes; se a query trouxe 6 (logo há mais), exibe "+ mais pedidos" como texto (sem número exato — evita um count extra).
  Cliente sem nenhum pedido → "Nenhum pedido ainda."
- **Sem cadastro** (`clienteId` null): linha curta "Sem cadastro" + botão **"Vincular a um cliente"** (ver add-on 1).

Visual segue os primitivos/cores existentes (`bg-brand-surface`/`text-brand-warm-gray`/`text-brand-yellow`, badges como na lista de pedidos).

### Vincular manual (add-on 1)

Botão "Vincular a um cliente" abre uma **busca inline** na própria faixa (não modal): um `Input` que dispara `buscarClientes(termo)` (só com `termoBuscaValido`), renderizando os resultados (`nome · telefone`) como botões. Clicar num resultado chama `vincularConversaCliente(conversaId, clienteId)`; em `ok`, fecha a busca e a faixa recarrega já no estado "cliente casado" (refetch dos pedidos). O realtime existente em `conversas_whatsapp` também propaga a troca de `cliente_id` para a lista.

Quando já há cliente vinculado, um link discreto **"trocar cliente"** reabre o mesmo picker (corrige vínculo errado). Sem ação de "desvincular" dedicada no v1.

### Link reverso (add-on 2) — `app/admin/(authenticated)/pedidos/[id]/page.tsx`

Server component: resolve `getConversaIdDoCliente(pedido.cliente_id)`. Se retornar um id, renderiza um link/botão **"Abrir conversa no WhatsApp"** → `/admin/whatsapp?conversa=<conversaId>`. Se null (cliente nunca conversou), o botão **não aparece**.

O inbox (`atendimento-client.tsx`) passa a ler `?conversa=<id>` via `useSearchParams` para definir o `selId` inicial: usa o param se ele existir e corresponder a uma conversa da lista; senão cai no comportamento atual (`initial[0]?.id`).

### Realtime / refresh

A subscription atual (`conversas_whatsapp` + `mensagens_conversa_whatsapp`) já existe e não muda. Após `vincularConversaCliente`, além do realtime, o componente refaz `getPedidosDoCliente` localmente para resposta imediata. A faixa de pedidos não precisa de realtime próprio (status de pedido muda raramente durante uma conversa; o operador reabre a thread se precisar do estado novo).

## Fluxo de dados

```
Inbox: seleciona conversa
  → conversa.clienteId != null ?
       sim → getPedidosDoCliente(clienteId) → faixa lista pedidos → Link /admin/pedidos/[id]
       não → faixa "sem cadastro" → [Vincular] → buscarClientes(termo)
                  → escolhe → vincularConversaCliente → refetch pedidos (+ realtime)

Página do pedido (/admin/pedidos/[id])
  → getConversaIdDoCliente(cliente_id)
       achou → link "Abrir conversa" → /admin/whatsapp?conversa=<id> → inbox pré-seleciona a thread
       null  → sem link
```

## Tratamento de erro

- Toda action via `requireAdmin`. Falha de leitura → retorna `[]`/`null` e a faixa mostra estado neutro (nunca quebra o chat).
- `vincularConversaCliente` falho → `{ ok: false }`; a UI mantém o estado "sem cadastro" e mostra um aviso curto.
- `buscarClientes` com termo < 2 chars → `[]` (sem ir ao banco).
- `?conversa=` inválido/ausente → fallback pro comportamento atual de seleção.
- Cliente sem pedidos → "Nenhum pedido ainda" (não é erro).

## Testes

- **Unit (módulo puro `pedido-contexto.ts`):** `pedidoRefCurto` (8 chars + `#`), `formatDataEvento` (`'2026-06-10'` → `'10/06'`), `formatTotalBR` (`880` → `R$ 880,00`), `termoBuscaValido` (`' a '`→false, `'an'`→true). Vitest.
- **Server actions:** sem teste unitário novo — `chat-actions.ts` não tem testes (padrão do repo); cobertas no E2E.
- **E2E (manual, staging — fora desta feature, entra na FRE-4 final):** (a) conversa casada → faixa lista os pedidos, link abre `/admin/pedidos/[id]`; (b) conversa sem cadastro → vincular → busca → escolhe → faixa popula; (c) "trocar cliente" corrige vínculo; (d) link reverso do pedido abre a thread certa; (e) cliente sem pedido / sem conversa → estados neutros.

## Arquivos

**Novos**
- `app/lib/whatsapp/pedido-contexto.ts` — módulo puro (helpers de formatação + termo de busca).
- `app/lib/whatsapp/pedido-contexto.test.ts` — testes do módulo puro.

**Modificados**
- `app/lib/whatsapp/chat-actions.ts` — `getPedidosDoCliente`, `buscarClientes`, `vincularConversaCliente`, `getConversaIdDoCliente` (+ tipos `PedidoResumoCliente`, `ClienteBusca`).
- `app/components/admin/atendimento/atendimento-client.tsx` — faixa de contexto (estados casado / sem-cadastro), picker inline do vincular, leitura de `?conversa=` para pré-seleção.
- `app/admin/(authenticated)/pedidos/[id]/page.tsx` — link reverso "Abrir conversa no WhatsApp".

**Sem migration** (reusa `conversas_whatsapp.cliente_id` + a policy de UPDATE admin existente).

## Decisões travadas

1. v1 completo: faixa de contexto + vincular manual + link reverso. ✅
2. Layout: faixa fixa no topo da thread. ✅
3. Grão conversa → cliente → lista de pedidos; sem coluna `pedido_id` nova. ✅
4. 5 pedidos na faixa (+ "mais pedidos" se houver 6º); picker **inline** (não modal); link reverso via `?conversa=<id>`. ✅
5. Sem migration; badge de status reaproveita `lib/admin-status.ts`. ✅
</content>
