import { describe, it, expect } from "vitest"
import { parseInboundPayload } from "./inbound"

const valid = {
  telefone: "5521998123344",
  waMessageId: "ABC123",
  direcao: "entrada",
  corpo: "Oi, qual o horário?",
  ocorridaEm: "2026-05-30T17:32:00.000Z",
}

describe("parseInboundPayload", () => {
  it("aceita payload válido", () => {
    expect(parseInboundPayload(valid)).toEqual(valid)
  })

  it("rejeita direcao inválida", () => {
    expect(parseInboundPayload({ ...valid, direcao: "x" })).toBeNull()
  })

  it("rejeita campos faltando", () => {
    expect(parseInboundPayload({ telefone: "55", corpo: "oi" })).toBeNull()
  })

  it("rejeita timestamp inválido", () => {
    expect(parseInboundPayload({ ...valid, ocorridaEm: "oi" })).toBeNull()
  })

  it("rejeita não-objeto", () => {
    expect(parseInboundPayload(null)).toBeNull()
    expect(parseInboundPayload("nope")).toBeNull()
  })

  // --- Inbound media (Task B2) ---------------------------------------------------------------

  it("aceita payload com mídia de imagem", () => {
    const comImagem = {
      ...valid,
      corpo: "🖼️ Imagem recebida",
      midiaTipo: "image",
      mimeType: "image/jpeg",
      midiaBase64: "iVBORw0KGgoAAAANSUhEUg==",
    }
    expect(parseInboundPayload(comImagem)).toEqual(comImagem)
  })

  it("aceita payload com áudio (nota de voz)", () => {
    const comAudio = {
      ...valid,
      corpo: "🎤 Áudio recebido",
      midiaTipo: "audio",
      mimeType: "audio/ogg; codecs=opus",
      midiaBase64: "T2dnUwACAAAAAAAAAAA=",
    }
    expect(parseInboundPayload(comAudio)).toEqual(comAudio)
  })

  it("aceita mídia sem bytes (só tipo + mime, ex.: acima do limite de tamanho)", () => {
    const semBytes = { ...valid, corpo: "🎥 Vídeo recebido", midiaTipo: "video", mimeType: "video/mp4" }
    expect(parseInboundPayload(semBytes)).toEqual(semBytes)
  })

  it("mantém compat quando não há campos de mídia (payload do EC2 atual → undefined)", () => {
    const parsed = parseInboundPayload(valid)
    expect(parsed).not.toBeNull()
    expect(parsed).toEqual(valid)
    expect(parsed?.midiaTipo).toBeUndefined()
    expect(parsed?.mimeType).toBeUndefined()
    expect(parsed?.midiaBase64).toBeUndefined()
  })

  it("trata campos de mídia null como ausentes (JSON pode serializar como null)", () => {
    const parsed = parseInboundPayload({ ...valid, midiaTipo: null, mimeType: null, midiaBase64: null })
    expect(parsed).not.toBeNull()
    expect(parsed).toEqual(valid)
    expect(parsed?.midiaTipo).toBeUndefined()
    expect(parsed?.mimeType).toBeUndefined()
    expect(parsed?.midiaBase64).toBeUndefined()
  })

  it("rejeita midiaTipo fora do enum (protege o CHECK da migration 030)", () => {
    expect(parseInboundPayload({ ...valid, midiaTipo: "gif" })).toBeNull()
  })

  it("rejeita mimeType/midiaBase64 não-string quando presentes", () => {
    expect(parseInboundPayload({ ...valid, midiaTipo: "image", mimeType: 123 })).toBeNull()
    expect(parseInboundPayload({ ...valid, midiaTipo: "image", midiaBase64: {} })).toBeNull()
  })
})
