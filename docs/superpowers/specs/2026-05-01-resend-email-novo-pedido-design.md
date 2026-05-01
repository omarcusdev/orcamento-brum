# Notificação por email a cada novo pedido (Resend)

**Status**: Design aprovado, pronto pra plano de implementação
**Data**: 2026-05-01
**Autor**: Marcus (com Claude)

## Objetivo

Enviar email automático ao destinatário configurado pelo admin toda vez que um pedido novo for criado pelo cliente. Notificação interna (CFO da Brum precisa saber em tempo real).

## Decisões (resultado do brainstorm)

| Pergunta | Resposta |
|----------|----------|
| Quando dispara? | **Apenas criação de pedido** (não muda quando documento é verificado, pedido cancelado, etc.) |
| Destinatário | **1 email só**, default `huno.cfo@gmail.com`, configurável no admin |
| Toggle on/off | **Sim**, separado do campo de email |
| Conteúdo | **Resumo completo** (cliente, telefone, evento, endereço, itens, total, pagamento) + link admin |
| Falha no envio | **Silenciosa** — pedido sempre criado, erro logado no Vercel |
| Domínio | `mail.ozapgpt.com.br` (já verificado no Resend) |
| Disparo técnico | `after()` do Next 15 — não bloqueia resposta do checkout |

## Arquitetura

```
Cliente fecha checkout
  ↓
criarPedido() (server action em app/lib/actions.ts)
  ↓ INSERT pedidos + pedido_itens
  ↓ retorna { pedidoId } pro cliente
  ↓
after(() => sendNewOrderEmail(pedidoId))   ← Next 15 after()
  ↓
sendNewOrderEmail() em app/lib/email.ts
  ↓ lê config (destinatário + toggle)
  ↓ se ativo:
  ↓   busca pedido + cliente + itens (service client)
  ↓   monta HTML
  ↓   resend.emails.send()
  ↓ catch → console.error (Vercel logs)
```

## Componentes

### Banco de dados

**Migration `015_email_notificacao_config.sql`** — adiciona 2 chaves em `configuracoes`:

```sql
insert into configuracoes (chave, valor) values
  ('email_notificacao_destinatario', 'huno.cfo@gmail.com'),
  ('email_notificacao_ativo', 'true')
on conflict (chave) do nothing;
```

### Env vars

- `RESEND_API_KEY` — chave da API "chopp" (ou nova) — server-only, nunca `NEXT_PUBLIC_`
- Adicionar em `app/.env.local` (dev) e Vercel env (prod)

### Código

| Arquivo | Mudança |
|---------|---------|
| `app/lib/email.ts` | **Novo**. Exports `sendNewOrderEmail(pedidoId)`. Importa Resend SDK, monta HTML, manda. |
| `app/lib/actions.ts` | Em `criarPedido`: importar `after` do `next/server`, chamar `after(() => sendNewOrderEmail(pedido.id))` antes do return. |
| `app/lib/queries.ts` | Adicionar `getEmailConfig()` que retorna `{ destinatario, ativo }` lendo `configuracoes`. |
| `app/lib/admin-actions.ts` | `updateConfig` já existe — usar pra os 2 campos novos. |
| `app/app/admin/(authenticated)/configuracoes/page.tsx` | Buscar email_notificacao_* além do whatsapp_numero. |
| `app/components/admin/config-form.tsx` | Adicionar 2 campos: input de email + toggle ativo/inativo. |
| `package.json` (do `app/`) | Adicionar `resend` |

## Data flow detalhado

1. **Checkout submit** → `criarPedido(data)` em `lib/actions.ts:60`
2. INSERT clientes (se novo) → INSERT pedidos → INSERT pedido_itens (todos sequenciais, transação implícita)
3. Função retorna `{ pedidoId, clienteId }` pro front-end (cliente já redireciona pra `/pedido/[id]/confirmacao`)
4. **Após o return**, Next executa `after(() => sendNewOrderEmail(pedidoId))`
5. `sendNewOrderEmail` lê `email_notificacao_ativo` — se `false`, sai
6. Lê `email_notificacao_destinatario`
7. Busca pedido completo (cliente, itens, valores) usando service role client
8. Monta HTML inline-styled (compatível com Gmail/Outlook)
9. `resend.emails.send({ from: 'ALFA Chopp <chopp@mail.ozapgpt.com.br>', to: [destinatario], subject, html })`
10. Em caso de erro: `console.error("[email-notificacao] erro:", err)` — visível em Vercel logs

## Conteúdo do email

**From**: `ALFA Chopp <chopp@mail.ozapgpt.com.br>`
**To**: valor de `email_notificacao_destinatario`
**Subject**: `Novo pedido #{pedidoId.slice(0,8)} — R$ {total} — {clienteNome}`
**Body** (HTML inline):

```
Novo pedido recebido

Cliente: {nome}
Telefone: {telefone}

Evento: {data} às {horario}
Endereço: {endereco}
Tipo de chopeira: {eletrica|gelo}

Itens:
- {qtd}x {marca} {volume}L — R$ {subtotal}
- ...

Subtotal: R$ {subtotal}
Frete: R$ {frete} (ou "a definir")
Total: R$ {total}

Pagamento: {Pix|Cartão|Dinheiro}
Observações: {se houver}

[Ver pedido no admin] → https://app-liart-one-77.vercel.app/admin/pedidos/{id}
```

## Tratamento de erro

- `RESEND_API_KEY` ausente → `console.error` e early return (não quebra criarPedido)
- `email_notificacao_ativo === 'false'` → não envia, sem erro
- Resend retorna erro (rate limit, domínio não verificado, etc.) → `console.error` com detalhes
- Pedido buscado é null → `console.error("pedido não encontrado")` e return
- Em todos os casos: o cliente recebe o redirect normal, sem nenhuma indicação do erro

## Plano de teste

1. **Local**: rodar dev server, criar pedido pelo checkout, ver email chegar em `huno.cfo@gmail.com` (ou redirecionado pra meu email durante dev)
2. **MCP dry-run**: usar `mcp__resend__send-email` antes de fazer deploy pra confirmar que o domínio aceita o `from`
3. **Produção**: criar pedido de teste após deploy, confirmar email chegou; depois cancelar/limpar
4. **Toggle off**: setar `email_notificacao_ativo = 'false'` no admin, criar pedido, confirmar que NADA é enviado
5. **Mudar destinatário**: setar email diferente no admin, criar pedido, confirmar entregue no novo

## Fora do escopo (YAGNI)

- ❌ Múltiplos destinatários (já decidido — adiciona depois se precisar)
- ❌ Email em outras transições de status (cliente quis só "novo pedido")
- ❌ Templates customizáveis no admin (HTML hard-coded por enquanto)
- ❌ Retry em caso de falha (silencioso por design)
- ❌ Email pro próprio cliente (sistema de comunicação com cliente é WhatsApp)
- ❌ Tracking de aberturas / cliques
- ❌ Domínio próprio `alfachopp.com.br` (cliente preferiu velocidade — `mail.ozapgpt.com.br` resolve)

## Próximo passo

Plano de implementação via `superpowers:writing-plans`.
