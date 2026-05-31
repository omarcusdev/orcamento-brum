import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import { rm } from "node:fs/promises"
import pino from "pino"
import QRCode from "qrcode-terminal"
import { extractInbound, forwardInbound } from "./inbound.js"

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" })

let socket: WASocket | null = null
let connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected"
let paired = false
let currentQr: string | null = null
let currentCode: string | null = null
let pairingMethod: "qr" | "code" | null = null
let pairingPhone: string | null = null
let codeRequested = false

let alertSent = false
let offlineTimer: ReturnType<typeof setTimeout> | null = null
let missingAlertConfigLogged = false

const AUTH_DIR = "./auth_info"
const ALERT_GRACE_MS = Number(process.env.ALERT_GRACE_MS) || 180000

const sendDownAlert = async (reason: "logged_out" | "offline"): Promise<void> => {
  const webhookUrl = process.env.APP_ALERT_WEBHOOK_URL
  const secret = process.env.ALERT_WEBHOOK_SECRET

  if (!webhookUrl || !secret) {
    if (!missingAlertConfigLogged) {
      console.error("Alert webhook not configured (APP_ALERT_WEBHOOK_URL / ALERT_WEBHOOK_SECRET). Skipping alerts.")
      missingAlertConfigLogged = true
    }
    return
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "x-alert-secret": secret,
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason, since: new Date().toISOString() }),
    })
  } catch (err) {
    console.error("Failed to deliver WhatsApp down alert:", err)
  }
}

const clearOfflineTimer = (): void => {
  if (offlineTimer) {
    clearTimeout(offlineTimer)
    offlineTimer = null
  }
}

const resetToIdle = (): void => {
  try {
    socket?.end(undefined)
  } catch {}
  socket = null
  connectionStatus = "disconnected"
  currentQr = null
  currentCode = null
  pairingMethod = null
  pairingPhone = null
  codeRequested = false
  clearOfflineTimer()
}

// Brazil E.164: strip non-digits, prepend country code 55 for local-length numbers.
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "")
  return digits.length <= 11 ? `55${digits}` : digits
}

const createSocket = async (): Promise<WASocket> => {
  if (socket) {
    try {
      socket.end(undefined)
    } catch (err) {
      console.error("Error tearing down previous socket:", err)
    }
    socket = null
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  let version: [number, number, number] | undefined
  try {
    version = (await fetchLatestBaileysVersion()).version
  } catch (err) {
    console.error("fetchLatestBaileysVersion failed, using bundled default:", err)
  }

  paired = state.creds.registered

  const newSocket = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
  })

  newSocket.ev.on("creds.update", saveCreds)

  newSocket.ev.on("messages.upsert", ({ messages, type }) => {
    if (socket !== newSocket) return       // ignore superseded sockets (same guard as connection.update)
    if (type !== "notify") return          // skip 'append' backfill
    for (const msg of messages) {
      const payload = extractInbound(msg)
      if (payload) {
        forwardInbound(payload).catch((err) => console.error("inbound forward error:", err))
      }
    }
  })

  newSocket.ev.on("connection.update", (update) => {
    // Ignore events from a superseded socket (e.g. a previous /connect attempt) so its
    // late close can't clobber the current socket's module state.
    if (socket !== newSocket) return

    const { connection, lastDisconnect, qr } = update

    // The qr event signals the socket is ready to pair.
    if (qr) {
      if (pairingMethod === "code") {
        // Request the 8-char code now that the connection is ready (calling it earlier throws).
        if (pairingPhone && !codeRequested) {
          codeRequested = true
          newSocket
            .requestPairingCode(pairingPhone)
            .then((code) => {
              currentCode = code
              console.log("WhatsApp pairing code:", code)
            })
            .catch((err) => {
              console.error("requestPairingCode failed:", err)
              resetToIdle()
            })
        }
      } else if (pairingMethod === "qr") {
        currentQr = qr
        console.log("Scan this QR code to connect WhatsApp:")
        console.log("WA_QR " + qr)
        QRCode.generate(qr, { small: true })
      }
    }

    if (connection === "close") {
      connectionStatus = "disconnected"
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const wasPaired = paired

      if (statusCode === DisconnectReason.restartRequired) {
        // Baileys fires this right after a successful QR scan / code entry: creds are now
        // persisted (registered=true). We MUST recreate the socket to finish authenticated
        // login — without this, pairing never completes.
        console.log("Restart required after pairing. Reconnecting to finish login...")
        connectionStatus = "connecting"
        reconnect().catch((err) => console.error("post-pair reconnect failed:", err))
        return
      }

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("Logged out. Re-pair via the admin WhatsApp page.")
        socket = null
        paired = false
        currentQr = null
        currentCode = null
        pairingMethod = null
        clearOfflineTimer()
        if (wasPaired && !alertSent) {
          alertSent = true
          sendDownAlert("logged_out")
        }
      } else if (wasPaired) {
        console.log("Connection closed. Reconnecting...")
        setTimeout(() => {
          reconnect().catch((err) => console.error("reconnect failed:", err))
        }, 3000)

        if (!offlineTimer && !alertSent) {
          offlineTimer = setTimeout(() => {
            offlineTimer = null
            if (connectionStatus !== "connected" && !alertSent) {
              alertSent = true
              sendDownAlert("offline")
            }
          }, ALERT_GRACE_MS)
        }
      } else {
        // Unpaired pairing window closed without a scan/code: go idle, do NOT reconnect.
        console.log("Pairing attempt ended without pairing. Idle until next /connect.")
        socket = null
        currentQr = null
        currentCode = null
        pairingMethod = null
        clearOfflineTimer()
      }
    } else if (connection === "open") {
      connectionStatus = "connected"
      paired = true
      currentQr = null
      currentCode = null
      pairingMethod = null
      alertSent = false
      clearOfflineTimer()
      console.log("WhatsApp connected successfully!")
    }
  })

  return newSocket
}

// Resilience reconnect for an already-paired session; no QR/code, keeps existing creds.
const reconnect = async (): Promise<void> => {
  connectionStatus = "connecting"
  socket = await createSocket()
}

// On boot connect only if a real session exists; otherwise stay idle (no socket, no QR/code).
const init = async (): Promise<void> => {
  const { state } = await useMultiFileAuthState(AUTH_DIR)
  if (!state.creds.registered) {
    console.log("No paired session. Idle until operator connects via the admin WhatsApp page.")
    return
  }
  await reconnect()
}

const startPairing = async (method: "qr" | "code", phone?: string): Promise<void> => {
  if (connectionStatus === "connected") {
    return
  }

  if (method === "code" && !phone) {
    throw new Error("phone is required for code pairing")
  }

  // Fresh pairing always starts from scratch: tear down any socket and drop stale/partial
  // creds. Otherwise leftover auth_info makes Baileys try to RESUME the old session, which
  // fails with "logged out" and never emits a QR / pairing code.
  try {
    socket?.end(undefined)
  } catch {}
  socket = null
  try {
    await rm(AUTH_DIR, { recursive: true, force: true })
  } catch (err) {
    console.error("Failed to clear stale auth before pairing:", err)
  }
  paired = false

  pairingMethod = method
  pairingPhone = method === "code" && phone ? normalizePhone(phone) : null
  codeRequested = false
  currentQr = null
  currentCode = null
  connectionStatus = "connecting"
  // The pairing code (code mode) is requested inside the connection.update handler once the
  // socket is ready to pair — requesting it synchronously here throws (WS not yet established).
  socket = await createSocket()
}

const logout = async (): Promise<void> => {
  try {
    await socket?.logout()
  } catch (err) {
    console.error("socket.logout() failed (already disconnected?):", err)
  }

  try {
    await rm(AUTH_DIR, { recursive: true, force: true })
  } catch (err) {
    console.error("Failed to remove auth_info:", err)
  }

  socket = null
  connectionStatus = "disconnected"
  paired = false
  currentQr = null
  currentCode = null
  pairingMethod = null
  alertSent = false
  clearOfflineTimer()
}

const sendMessage = async (phoneNumber: string, message: string): Promise<boolean> => {
  if (!socket || connectionStatus !== "connected") {
    throw new Error("WhatsApp not connected")
  }

  const normalized = normalizePhone(phoneNumber)
  const jid = phoneNumber.includes("@s.whatsapp.net")
    ? phoneNumber
    : `${normalized}@s.whatsapp.net`

  await socket.sendMessage(jid, { text: message })
  return true
}

const getStatus = () => connectionStatus

const extractPhone = (jid: string | undefined): string | null => {
  if (!jid) {
    return null
  }
  const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "")
  return digits || null
}

const getConnectionInfo = () => ({
  status: connectionStatus,
  paired,
  qr: connectionStatus === "connected" ? null : currentQr,
  code: connectionStatus === "connected" ? null : currentCode,
  me: connectionStatus === "connected" ? extractPhone(socket?.user?.id) : null,
})

export { init, startPairing, sendMessage, getStatus, getConnectionInfo, logout }
