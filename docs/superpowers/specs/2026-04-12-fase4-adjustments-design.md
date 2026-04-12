# Fase 4 — Ajustes de fluxo e UX

**Data**: 2026-04-12
**Status**: Aprovado

## Resumo

Tres ajustes no fluxo de pedidos e checkout:

1. Remover `aguardando_documentos` como status bloqueante — docs viram lembrete paralelo
2. Limitar a 2 pedidos por hora cheia no checkout
3. Tooltip explicativo para tipo de chopeira (eletrica vs gelo)

## Contexto

O admin frequentemente valida documentos apenas um dia antes da entrega. O status `aguardando_documentos` bloqueia o avanço do pedido, travando o fluxo operacional. Alem disso, nao existe limite de pedidos por horario e o checkout nao explica a diferenca entre chopeiras.

---

## 1. Remover `aguardando_documentos`

### Objetivo

Pedido nasce como `confirmado`. Documentos continuam sendo coletados e verificados, mas nao bloqueiam o avanço de status. O admin recebe alertas visuais e um confirm dialog no despacho.

### Novo flow de status

```
confirmado → enviar_para_entregador → em_rota → entregue → pago → recolhido
```

Plus `cancelado` em qualquer estagio antes de `recolhido`.

### Migration 013

- `UPDATE pedidos SET status = 'confirmado' WHERE status = 'aguardando_documentos'`
- Atualizar `pedido_status_log` referencias a `aguardando_documentos` → `confirmado`
- Nova constraint: `('confirmado', 'enviar_para_entregador', 'em_rota', 'entregue', 'pago', 'recolhido', 'cancelado')`

### Server action — `createOrder` (`actions.ts`)

- Remover condicional das linhas 123-126 que so seta `confirmado` quando docs ja verificados
- Pedido sempre insere com `status: "confirmado"`
- `documento_status` continua como `"pendente"` (ou `"verificado"` se cliente recorrente com docs ok)

### Status actions (`status-actions.tsx`)

- Remover `aguardando_documentos` de `nextStatusMap`
- Remover `disabled={!docsVerified}` do botao de avancar
- Adicionar banner amarelo persistente quando `documentoStatus !== "verificado"`:
  - Texto: "Documentacao pendente de verificacao"
  - Estilo: `bg-yellow-500/10 border-yellow-500/30 text-yellow-400`
- No `handleAdvance` para `confirmado → enviar_para_entregador`: se docs nao verificados, exibir `confirm("Documentacao ainda nao verificada. Deseja despachar mesmo assim?")`

### Demais arquivos

- `order-status-badge.tsx`: remover entrada `aguardando_documentos` do `statusConfig`
- `order-tracker.tsx`: remover referencias ao status removido
- `admin/pedidos/page.tsx` (lista): remover filtro/referencia ao status
- `lib/types.ts`: remover `aguardando_documentos` do tipo `PedidoStatus`
- Pagina de confirmacao: ajustar se referencia o status antigo

---

## 2. Maximo 2 pedidos por hora

### Objetivo

Limitar a 2 pedidos por slot de hora cheia (ex: 14:00-14:59) em qualquer dia. Cliente ve horarios lotados como indisponiveis no checkout.

### Backend — validacao no `createOrder` (`actions.ts`)

Antes do insert, consultar:

```sql
SELECT count(*) FROM pedidos
WHERE data_evento = $data
AND EXTRACT(HOUR FROM horario_evento::time) = $hora
AND status != 'cancelado'
```

Se count >= 2, retornar `{ error: "Horario indisponivel. Escolha outro horario." }`.

### Backend — nova server action `getBookedSlots`

- Recebe: `dataEvento: string` (YYYY-MM-DD)
- Retorna: `Record<number, number>` — mapa de hora → contagem de pedidos (ex: `{ 14: 2, 16: 1 }`)
- Consulta pedidos nao-cancelados para a data, agrupados por hora
- Exportar de `actions.ts`

### Frontend — `checkout-form.tsx`

- Quando `dataEvento` fica completo (dia + mes + ano validos), chamar `getBookedSlots(dataEvento)`
- No select de hora: slots com contagem >= 2 ficam com `disabled` e texto "(indisponivel)" no option
- Se o cliente ja tinha selecionado uma hora que ficou cheia (raro, race condition), limpar selecao de hora
- Minutos (00, 15, 30, 45) continuam livres — limite e por hora cheia

### Notas

- Sem trigger no banco — validacao no server action e suficiente para o volume esperado
- Pedidos cancelados nao contam para o limite

---

## 3. Tooltip chopeira

### Objetivo

Explicar brevemente cada tipo de chopeira para clientes que nao conhecem a diferenca.

### Frontend — `checkout-form.tsx`

Adicionar `<span>` descritivo dentro de cada label de chopeira, abaixo do nome:

**Eletrica** (icone ⚡):
> Chopeira com refrigeracao propria — mantem o chopp gelado sem precisar de gelo

**Gelo** (icone 🧊):
> Chopeira tradicional resfriada com gelo — simples e sem necessidade de energia eletrica

- Estilo: `text-xs text-brand-warm-gray text-center`
- Sempre visivel (nao tooltip hover)
- Sem mudanca nas demais telas (admin detail, tracker, confirmacao) que so exibem o valor selecionado

---

## Arquivos impactados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/migrations/013_*.sql` | Nova migration removendo aguardando_documentos |
| `app/lib/actions.ts` | createOrder: status fixo, validacao 2/hora, getBookedSlots |
| `app/lib/types.ts` | Remover aguardando_documentos do PedidoStatus |
| `app/components/admin/status-actions.tsx` | Remover bloqueio por docs, adicionar banner + confirm |
| `app/components/checkout-form.tsx` | Slots indisponiveis, tooltip chopeira |
| `app/components/order-status-badge.tsx` | Remover config do status removido |
| `app/components/order-tracker.tsx` | Remover referencias ao status |
| `app/app/admin/(authenticated)/pedidos/page.tsx` | Remover filtro do status |
| `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` | Ajustar se necessario |

## Fora de escopo

- WhatsApp bot / lembretes automaticos
- Status `finalizado` (recolhido permanece como estado final)
- Notificacao automatica para entregadores
