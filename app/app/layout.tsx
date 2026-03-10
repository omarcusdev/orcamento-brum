import type { Metadata } from "next"
import { Bebas_Neue, DM_Sans } from "next/font/google"
import "./globals.css"

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  title: "ALFA Chopp Delivery — Chopp para seu evento",
  description: "Delivery e locacao de chopp para eventos no Rio de Janeiro e Baixada Fluminense. Chopeira inclusa, sem taxa de instalacao.",
  icons: { icon: "/favicon.png" },
  openGraph: {
    title: "ALFA Chopp Delivery",
    description: "Chopp gelado para seu evento com entrega e chopeira inclusa.",
    type: "website",
  },
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="pt-BR" className={`${bebasNeue.variable} ${dmSans.variable}`}>
    <body className="font-body antialiased">{children}</body>
  </html>
)

export default RootLayout
