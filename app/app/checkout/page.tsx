import type { Metadata } from "next"
import Header from "@/components/header"
import CheckoutForm from "@/components/checkout-form"
import Footer from "@/components/footer"
import { getDeliveryConfig, getExclusionZones } from "@/lib/queries"

export const metadata: Metadata = {
  title: "Checkout — ALFA Chopp Delivery",
}

const CheckoutPage = async () => {
  const [deliveryConfig, zones] = await Promise.all([
    getDeliveryConfig(),
    getExclusionZones(),
  ])

  return (
    <>
      <Header />
      <main>
        <CheckoutForm
          deliveryConfig={deliveryConfig}
          exclusionZones={zones.map((z) => z.poligono as { lat: number; lng: number }[])}
        />
      </main>
      <Footer />
    </>
  )
}

export default CheckoutPage
