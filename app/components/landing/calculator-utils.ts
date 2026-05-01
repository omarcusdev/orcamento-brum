export type EstiloConsumo = "moderado" | "padrao" | "alto"

const FATORES: Record<EstiloConsumo, number> = {
  moderado: 0.4,
  padrao: 0.5,
  alto: 0.7,
}

export const calcularLitros = (pessoas: number, horas: number, estilo: EstiloConsumo): number => {
  if (pessoas <= 0 || horas <= 0) return 0
  const bruto = pessoas * horas * FATORES[estilo]
  return Math.ceil(bruto / 5) * 5
}

export type Combo = { b50: number; b30: number; total: number; sobra: number }

export const resolverCombo = (litros: number): Combo => {
  if (litros <= 0) return { b50: 0, b30: 0, total: 0, sobra: 0 }
  const candidatos: Combo[] = []
  const max50 = Math.ceil(litros / 50)
  const max30 = Math.ceil(litros / 30)
  for (let b50 = 0; b50 <= max50; b50++) {
    for (let b30 = 0; b30 <= max30; b30++) {
      const total = b50 * 50 + b30 * 30
      if (total >= litros) candidatos.push({ b50, b30, total, sobra: total - litros })
    }
  }
  candidatos.sort((a, b) =>
    (a.b50 + a.b30) - (b.b50 + b.b30)
    || a.sobra - b.sobra
  )
  return candidatos[0]
}
