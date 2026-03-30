import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header' // <-- Importamos o novo Header

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-[#f5faf9]">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen relative">
        <Header />
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>

      </div>
    </div>
  )
}