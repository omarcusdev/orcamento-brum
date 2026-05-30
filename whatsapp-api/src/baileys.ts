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

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" })

let socket: WASocket | null = null
let connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected"
let currentQr: string | null = null

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

const connectToWhatsApp = async (): Promise<void> => {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  let version: [number, number, number] | undefined
  try {
    version = (await fetchLatestBaileysVersion()).version
  } catch (err) {
    console.error("fetchLatestBaileysVersion failed, using bundled default:", err)
  }

  connectionStatus = "connecting"

  socket = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger,
    printQRInTerminal: false,
  })

  socket.ev.on("creds.update", saveCreds)

  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      currentQr = qr
      console.log("Scan this QR code to connect WhatsApp:")
      console.log("WA_QR " + qr)
      QRCode.generate(qr, { small: true })
    }

    if (connection === "close") {
      connectionStatus = "disconnected"
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("Logged out. Please re-pair via the admin WhatsApp page.")
        clearOfflineTimer()
        if (!alertSent) {
          alertSent = true
          sendDownAlert("logged_out")
        }
      } else {
        console.log("Connection closed. Reconnecting...")
        setTimeout(connectToWhatsApp, 3000)

        if (!offlineTimer && !alertSent) {
          offlineTimer = setTimeout(() => {
            offlineTimer = null
            if (connectionStatus !== "connected" && !alertSent) {
              alertSent = true
              sendDownAlert("offline")
            }
          }, ALERT_GRACE_MS)
        }
      }
    } else if (connection === "open") {
      connectionStatus = "connected"
      currentQr = null
      alertSent = false
      clearOfflineTimer()
      console.log("WhatsApp connected successfully!")
    }
  })
}

const logoutAndReconnect = async (): Promise<void> => {
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
  currentQr = null
  alertSent = false
  clearOfflineTimer()

  await connectToWhatsApp()
}

const sendMessage = async (phoneNumber: string, message: string): Promise<boolean> => {
  if (!socket || connectionStatus !== "connected") {
    throw new Error("WhatsApp not connected")
  }

  const digits = phoneNumber.replace(/\D/g, "")
  const normalized = digits.length <= 11 ? `55${digits}` : digits
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
  qr: connectionStatus === "connected" ? null : currentQr,
  me: connectionStatus === "connected" ? extractPhone(socket?.user?.id) : null,
})

export { connectToWhatsApp, sendMessage, getStatus, getConnectionInfo, logoutAndReconnect }
