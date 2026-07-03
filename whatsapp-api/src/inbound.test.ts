import { describe, it, expect, vi, beforeEach } from "vitest"

// Keep the real normalizeMessageContent (pure), mock only the network download.
vi.mock("@whiskeysockets/baileys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@whiskeysockets/baileys")>()
  return { ...actual, downloadMediaMessage: vi.fn() }
})

import { downloadMediaMessage } from "@whiskeysockets/baileys"
import { extractInbound } from "./inbound.js"

const mockDownload = vi.mocked(downloadMediaMessage)
const sock = { updateMediaMessage: vi.fn(async (m: any) => m) }

const FAKE_BYTES = Buffer.from("hello-media-bytes")
const FAKE_B64 = FAKE_BYTES.toString("base64")

const msgWith = (message: any, keyOver: Record<string, unknown> = {}) => ({
  key: { remoteJid: "5521999998888@s.whatsapp.net", id: "WAID-1", fromMe: false, ...keyOver },
  message,
  messageTimestamp: 1_700_000_000,
})

beforeEach(() => {
  mockDownload.mockReset()
  delete process.env.MEDIA_INLINE_MAX_BYTES
  sock.updateMediaMessage.mockClear()
})

describe("extractInbound — plain text (existing behavior preserved)", () => {
  it("keeps a normal text body and sets no media fields", async () => {
    const out = await extractInbound(msgWith({ conversation: "oi, tudo bem?" }), sock)
    expect(out).toMatchObject({
      telefone: "5521999998888",
      waMessageId: "WAID-1",
      direcao: "entrada",
      corpo: "oi, tudo bem?",
    })
    expect(out).not.toHaveProperty("midiaTipo")
    expect(out).not.toHaveProperty("midiaBase64")
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it("returns null for groups, broadcast and empty/protocol messages", async () => {
    expect(await extractInbound(msgWith({ conversation: "x" }, { remoteJid: "123@g.us" }), sock)).toBeNull()
    expect(await extractInbound(msgWith({ protocolMessage: {} }), sock)).toBeNull()
    expect(await extractInbound(msgWith(undefined), sock)).toBeNull()
  })
})

describe("extractInbound — image (inline under cap)", () => {
  it("inlines base64 + mimeType and uses the labeled placeholder when there is no caption", async () => {
    mockDownload.mockResolvedValue(FAKE_BYTES as any)
    const out = await extractInbound(msgWith({ imageMessage: { mimetype: "image/jpeg" } }), sock)
    expect(out).toMatchObject({
      corpo: "🖼️ Imagem recebida",
      midiaTipo: "image",
      mimeType: "image/jpeg",
      midiaBase64: FAKE_B64,
    })
    expect(mockDownload).toHaveBeenCalledTimes(1)
  })

  it("keeps the customer caption as corpo but still inlines the bytes", async () => {
    mockDownload.mockResolvedValue(FAKE_BYTES as any)
    const out = await extractInbound(msgWith({ imageMessage: { mimetype: "image/jpeg", caption: "olha essa foto" } }), sock)
    expect(out).toMatchObject({ corpo: "olha essa foto", midiaTipo: "image", midiaBase64: FAKE_B64 })
  })

  it("passes the live socket's updateMediaMessage as the reupload handler", async () => {
    mockDownload.mockResolvedValue(FAKE_BYTES as any)
    await extractInbound(msgWith({ imageMessage: { mimetype: "image/jpeg" } }), sock)
    const ctx = mockDownload.mock.calls[0][3] as { reuploadRequest: (m: unknown) => unknown }
    ctx.reuploadRequest({ tag: 1 })
    expect(sock.updateMediaMessage).toHaveBeenCalledWith({ tag: 1 })
  })
})

describe("extractInbound — audio + ptt flag", () => {
  it("labels a voice note (ptt) with the microphone emoji and inlines it", async () => {
    mockDownload.mockResolvedValue(FAKE_BYTES as any)
    const out = await extractInbound(msgWith({ audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true } }), sock)
    expect(out).toMatchObject({
      corpo: "🎤 Áudio recebido",
      midiaTipo: "audio",
      mimeType: "audio/ogg; codecs=opus",
      midiaBase64: FAKE_B64,
    })
  })

  it("labels a non-ptt audio file differently but still as audio", async () => {
    mockDownload.mockResolvedValue(FAKE_BYTES as any)
    const out = await extractInbound(msgWith({ audioMessage: { mimetype: "audio/mpeg", ptt: false } }), sock)
    expect(out).toMatchObject({ corpo: "🎵 Áudio recebido", midiaTipo: "audio" })
  })
})

describe("extractInbound — resilience: download failure never throws", () => {
  it("falls back to the labeled placeholder with type but no bytes when download rejects", async () => {
    mockDownload.mockRejectedValue(new Error("network / decrypt boom"))
    const out = await extractInbound(msgWith({ audioMessage: { mimetype: "audio/ogg", ptt: true } }), sock)
    expect(out).toMatchObject({ corpo: "🎤 Áudio recebido", midiaTipo: "audio" })
    expect(out).not.toHaveProperty("midiaBase64")
  })
})

describe("extractInbound — size cap", () => {
  it("skips the download entirely when the declared fileLength exceeds the cap", async () => {
    const out = await extractInbound(msgWith({ imageMessage: { mimetype: "image/jpeg", fileLength: 10_000_000 } }), sock)
    expect(out).toMatchObject({ corpo: "🖼️ Imagem recebida", midiaTipo: "image" })
    expect(out).not.toHaveProperty("midiaBase64")
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it("drops the bytes when the downloaded buffer is over the cap", async () => {
    process.env.MEDIA_INLINE_MAX_BYTES = "4"
    mockDownload.mockResolvedValue(Buffer.from("way too many bytes") as any)
    const out = await extractInbound(msgWith({ imageMessage: { mimetype: "image/jpeg" } }), sock)
    expect(out).toMatchObject({ corpo: "🖼️ Imagem recebida", midiaTipo: "image" })
    expect(out).not.toHaveProperty("midiaBase64")
  })
})

describe("extractInbound — video / document / sticker (type + placeholder, never inlined)", () => {
  it("labels video and does NOT download", async () => {
    const out = await extractInbound(msgWith({ videoMessage: { mimetype: "video/mp4" } }), sock)
    expect(out).toMatchObject({ corpo: "🎥 Vídeo recebido", midiaTipo: "video", mimeType: "video/mp4" })
    expect(out).not.toHaveProperty("midiaBase64")
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it("labels document and does NOT download", async () => {
    const out = await extractInbound(msgWith({ documentMessage: { mimetype: "application/pdf", fileName: "nota.pdf" } }), sock)
    expect(out).toMatchObject({ corpo: "📄 Documento recebido", midiaTipo: "document" })
    expect(out).not.toHaveProperty("midiaBase64")
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it("labels sticker and does NOT download", async () => {
    const out = await extractInbound(msgWith({ stickerMessage: { mimetype: "image/webp" } }), sock)
    expect(out).toMatchObject({ corpo: "💟 Figurinha recebida", midiaTipo: "sticker" })
    expect(out).not.toHaveProperty("midiaBase64")
    expect(mockDownload).not.toHaveBeenCalled()
  })
})

describe("extractInbound — location / contact / poll (labeled instead of dropped)", () => {
  it("emits a labeled placeholder for a location (previously vanished)", async () => {
    const out = await extractInbound(msgWith({ locationMessage: { degreesLatitude: -22.9, degreesLongitude: -43.2 } }), sock)
    expect(out).toMatchObject({ corpo: "📍 Localização recebida" })
    expect(out).not.toHaveProperty("midiaTipo")
  })

  it("emits a labeled placeholder for a shared contact", async () => {
    const out = await extractInbound(msgWith({ contactMessage: { displayName: "Fulano" } }), sock)
    expect(out).toMatchObject({ corpo: "👤 Contato recebido" })
  })

  it("emits a labeled placeholder for a poll", async () => {
    const out = await extractInbound(msgWith({ pollCreationMessageV3: { name: "Qual chopp?" } }), sock)
    expect(out).toMatchObject({ corpo: "📊 Enquete recebida" })
  })
})
