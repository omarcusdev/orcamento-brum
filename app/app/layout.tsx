import type { Metadata } from "next"
import { Bebas_Neue, DM_Sans } from "next/font/google"
import { CartProvider } from "@/lib/cart-context"
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
  description: "Delivery e locacao de chopp para eventos no Rio de Janeiro e Baixada Fluminense.",
  icons: { icon: "/favicon.png" },
  openGraph: {
    title: "ALFA Chopp Delivery",
    description: "Delivery de chopp para festas e eventos no RJ e Baixada Fluminense.",
    type: "website",
  },
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="pt-BR" className={`${bebasNeue.variable} ${dmSans.variable}`}>
    <body className="font-body antialiased">
      <CartProvider>{children}</CartProvider>
    </body>
  </html>
)

export default RootLayout
