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
