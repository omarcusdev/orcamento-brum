import LoginForm from "@/components/admin/login-form"

const AdminLoginPage = () => (
  <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
    <div className="max-w-sm w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Painel ALFA Chopp</h1>
        <p className="text-gray-400 text-sm">Acesse sua conta para gerenciar pedidos</p>
      </div>
      <LoginForm />
    </div>
  </div>
)

export default AdminLoginPage
