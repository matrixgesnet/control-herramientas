'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { Sidebar, Header, PageType } from '@/components/layout/sidebar'
import { DashboardPage } from '@/components/modules/dashboard-page'
import { HerramientasPage } from '@/components/modules/herramientas-page'
import { TecnicosPage } from '@/components/modules/tecnicos-page'
import { SedesPage } from '@/components/modules/sedes-page'
import { CategoriasPage } from '@/components/modules/categorias-page'
import { MovimientosPage } from '@/components/modules/movimientos-page'
import { KardexPage } from '@/components/modules/kardex-page'
import { ConsultaPage } from '@/components/modules/consulta-page'
import { ReportesPage } from '@/components/modules/reportes-page'

export function MainApp() {
  const { data: session, status } = useSession()
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard')

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session) {
    return null
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />
      case 'herramientas':
        return <HerramientasPage />
      case 'tecnicos':
        return <TecnicosPage />
      case 'sedes':
        return <SedesPage />
      case 'categorias':
        return <CategoriasPage />
      case 'movimientos':
        return <MovimientosPage />
      case 'kardex':
        return <KardexPage />
      case 'consulta':
        return <ConsultaPage />
      case 'reportes':
        return <ReportesPage />
      case 'usuarios':
        return <div className="p-6"><h1 className="text-2xl font-bold">Usuarios</h1><p className="text-muted-foreground">Módulo en desarrollo...</p></div>
      default:
        return <DashboardPage />
    }
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
