import type { Metadata } from "next"
import Header from "@/components/header"
import Footer from "@/components/footer"
import MeusPedidosForm from "@/components/meus-pedidos-form"

export const metadata: Metadata = {
  title: "Meus Pedidos — ALFA Chopp Delivery",
}

const MeusPedidosPage = () => (
  <>
    <Header />
    <main className="min-h-screen bg-brand-dark">
      <MeusPedidosForm />
    </main>
    <Footer />
  </>
)

export default MeusPedidosPage
