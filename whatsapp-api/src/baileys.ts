import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import pino from "pino"
import QRCode from "qrcode-terminal"

const logger = pino({ level: "silent" })

let socket: WASocket | null = null
let connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected"

const AUTH_DIR = "./auth_info"

const connectToWhatsApp = async (): Promise<void> => {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  connectionStatus = "connecting"

  socket = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
  })

  socket.ev.on("creds.update", saveCreds)

  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log("Scan this QR code to connect WhatsApp:")
      QRCode.generate(qr, { small: true })
    }

    if (connection === "close") {
      connectionStatus = "disconnected"
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("Connection closed. Reconnecting...")
        setTimeout(connectToWhatsApp, 3000)
      } else {
        console.log("Logged out. Please delete auth_info and restart.")
      }
    } else if (connection === "open") {
      connectionStatus = "connected"
      console.log("WhatsApp connected successfully!")
    }
  })
}

const sendMessage = async (phoneNumber: string, message: string): Promise<boolean> => {
  if (!socket || connectionStatus !== "connected") {
    throw new Error("WhatsApp not connected")
  }

  const jid = phoneNumber.includes("@s.whatsapp.net")
    ? phoneNumber
    : `${phoneNumber.replace(/\D/g, "")}@s.whatsapp.net`

  await socket.sendMessage(jid, { text: message })
  return true
}

const getStatus = () => connectionStatus

export { connectToWhatsApp, sendMessage, getStatus }
