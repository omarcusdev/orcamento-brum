export type OrdemUpdate = { id: string; ordem: number }

export const recomputeOrdens = (ids: string[]): OrdemUpdate[] =>
  ids.map((id, index) => ({ id, ordem: (index + 1) * 10 }))
