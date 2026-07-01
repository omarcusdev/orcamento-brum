// The five pieces of pairing-flow state that baileys.ts resets together at every idle transition
// (reset-to-idle, logged-out, pairing-window-closed, connected, logout). One object + one factory
// replaces five scattered `let`s and five near-identical reset blocks.
export type PairingState = {
  currentQr: string | null
  currentCode: string | null
  pairingMethod: "qr" | "code" | null
  pairingPhone: string | null
  codeRequested: boolean
}

export const idlePairingState = (): PairingState => ({
  currentQr: null,
  currentCode: null,
  pairingMethod: null,
  pairingPhone: null,
  codeRequested: false,
})
