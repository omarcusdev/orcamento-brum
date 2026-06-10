export const BOT_SAUDACAO_FLAG_KEY = "whatsapp_bot_saudacao_ativo" as const
export const BOT_SAUDACAO_MSG_KEY = "whatsapp_bot_saudacao_msg" as const
export const BOT_SAUDACAO_JANELA_KEY = "whatsapp_bot_saudacao_janela_horas" as const

export const DEFAULT_BOT_SAUDACAO_JANELA_HORAS = 24
export const DEFAULT_BOT_SAUDACAO_MSG =
  "Oi! 🍻 Você falou com o ALFA Chopp Delivery. Pra fazer seu pedido é só acessar https://www.alfachopp.com.br — e qualquer dúvida, responde por aqui que a gente te atende!"

// Fail-closed (inverso do parseFlag, que é fail-open): só o literal "true" liga o bot.
// Config ausente, "false" ou qualquer outra coisa = DESLIGADO.
export const botSaudacaoAtivo = (valor: string | null | undefined): boolean =>
  valor?.trim().toLowerCase() === "true"

// Janela de sessão em horas (1–168 = até 1 semana). Inválido/ausente → default 24.
// Guarda-se a string vazia/nula antes de Number(): Number("") e Number(null) viram 0,
// que passaria no range se não fosse o filtro >= 1.
export const parseJanelaHoras = (valor: string | null | undefined): number => {
  if (!valor || valor.trim() === "") return DEFAULT_BOT_SAUDACAO_JANELA_HORAS
  const n = Number(valor)
  return Number.isInteger(n) && n >= 1 && n <= 168 ? n : DEFAULT_BOT_SAUDACAO_JANELA_HORAS
}

// Sessão nova = não há mensagem anterior, ou a anterior é mais velha que a janela.
// Boundary exato (= janela), timestamps inválidos e datas no futuro contam como sessão ATIVA
// (na dúvida, não saúda). Date.parse de string inválida → NaN, e toda comparação com NaN é false.
export const isSessaoNova = (
  anteriorIso: string | null | undefined,
  agora: Date,
  janelaHoras: number,
): boolean => {
  if (anteriorIso === null || anteriorIso === undefined) return true
  return agora.getTime() - Date.parse(anteriorIso) > janelaHoras * 3_600_000
}
