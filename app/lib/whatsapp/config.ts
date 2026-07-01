// Single source for resolving a configuracoes row -> valor. Replaces the
// (chave) => rows?.find((r) => r.chave === chave)?.valor lambda that was
// duplicated across the whatsapp modules.
export const configValue = (
  rows: { chave: string; valor: string | null }[] | null | undefined,
  chave: string,
) => rows?.find((r) => r.chave === chave)?.valor
