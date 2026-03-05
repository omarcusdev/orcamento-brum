import Image from "next/image"
import Link from "next/link"

const Footer = () => (
  <footer className="bg-brand-dark text-gray-400 py-12 px-4">
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-white.png"
            alt="ALFA Chopp Delivery"
            width={40}
            height={40}
          />
          <span className="text-white font-semibold">ALFA Chopp Delivery</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <a
            href="https://wa.me/5521999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-yellow transition"
          >
            WhatsApp
          </a>
          <Link href="/admin" className="hover:text-brand-yellow transition">
            Painel
          </Link>
        </div>
      </div>
      <div className="text-center text-xs text-gray-600 mt-8">
        © {new Date().getFullYear()} ALFA Chopp Delivery. Todos os direitos
        reservados.
      </div>
    </div>
  </footer>
)

export default Footer
