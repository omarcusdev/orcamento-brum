import Image from "next/image"
import Link from "next/link"

const Header = () => (
  <header className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur-sm border-b border-brand-yellow/20">
    <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <Link href="/">
        <Image src="/logo-white.png" alt="ALFA Chopp Delivery" width={48} height={48} priority />
      </Link>
      <a
        href="#catalogo"
        className="bg-brand-yellow text-brand-black font-semibold px-6 py-2 rounded-lg hover:brightness-110 transition"
      >
        Fazer Pedido
      </a>
    </nav>
  </header>
)

export default Header
