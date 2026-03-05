import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ALFA Chopp Delivery — Chopp para seu evento",
  description: "Delivery e locacao de chopp para eventos no Rio de Janeiro e Baixada Fluminense. Chopeira inclusa, sem taxa de instalacao.",
  openGraph: {
    title: "ALFA Chopp Delivery",
    description: "Chopp gelado para seu evento com entrega e chopeira inclusa.",
    type: "website",
  },
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="pt-BR">
    <body className={`${inter.className} antialiased`}>{children}</body>
  </html>
)

export default RootLayout
