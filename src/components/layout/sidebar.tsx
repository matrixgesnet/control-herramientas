'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Building2, 
  ArrowRightLeft,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Wrench,
  Search
} from 'lucide-react'

export type PageType = 'dashboard' | 'herramientas' | 'tecnicos' | 'sedes' | 'movimientos' | 'kardex' | 'reportes' | 'usuarios' | 'categorias' | 'consulta'| 'reporte-sede'

interface SidebarProps {
  currentPage: PageType
  onPageChange: (page: PageType) => void
}

const menuItems: { id: PageType; label: string; icon: React.ReactNode; roles?: string[] }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'herramientas', label: 'Herramientas', icon: <Wrench className="w-5 h-5" /> },
  { id: 'tecnicos', label: 'Técnicos', icon: <Users className="w-5 h-5" /> },
  { id: 'sedes', label: 'Sedes / Almacenes', icon: <Building2 className="w-5 h-5" /> },
  { id: 'movimientos', label: 'Movimientos', icon: <ArrowRightLeft className="w-5 h-5" /> },
  { id: 'kardex', label: 'Kardex', icon: <FileText className="w-5 h-5" /> },
  { id: 'consulta', label: 'Consulta', icon: <Search className="w-5 h-5" /> },
  { id: 'reportes', label: 'Reportes', icon: <FileText className="w-5 h-5" /> },
  { id: 'categorias', label: 'Categorías', icon: <Package className="w-5 h-5" /> },
  { id: 'usuarios', label: 'Usuarios', icon: <Settings className="w-5 h-5" />, roles: ['admin'] },
  { id: 'reporte-sede', label: 'Reporte por Sede', icon: <Building2 className="w-5 h-5" /> },
]

function getRoleBadge(role: string) {
  const colors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    supervisor: 'bg-blue-100 text-blue-700',
    warehouse: 'bg-green-100 text-green-700'
  }
  const labels: Record<string, string> = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    warehouse: 'Encargado Almacén'
  }
  return <Badge className={colors[role] || ''}>{labels[role] || role}</Badge>
}

interface SidebarContentProps {
  collapsed: boolean
  currentPage: PageType
  userRole: string
  userName: string
  onPageChange: (page: PageType) => void
  onMobileClose: () => void
}

function SidebarContent({ collapsed, currentPage, userRole, userName, onPageChange, onMobileClose }: SidebarContentProps) {
  const filteredItems = menuItems.filter(item => {
    if (!item.roles) return true
    return item.roles.includes(userRole || '')
  })

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-lg truncate">Herramientas</h1>
            <p className="text-xs text-muted-foreground truncate">Control de Inventario</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onPageChange(item.id)
              onMobileClose()
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
              currentPage === item.id
                ? 'bg-orange-500 text-white'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            {item.icon}
            {!collapsed && <span className="font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User info */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 bg-slate-200">
            <AvatarFallback className="bg-orange-500 text-white">
              {userName?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="font-medium text-sm truncate">{userName}</p>
              <div className="mt-1">{getRoleBadge(userRole || '')}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3 text-slate-600 hover:text-red-600 hover:bg-red-50"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        )}
      </div>
    </div>
  )
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-white z-50 transform transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent 
          collapsed={false}
          currentPage={currentPage}
          userRole={session?.user?.role || ''}
          userName={session?.user?.name || ''}
          onPageChange={onPageChange}
          onMobileClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Desktop sidebar */}
      <div
        className={`hidden lg:flex flex-col h-screen bg-white border-r transition-all relative ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        <SidebarContent 
          collapsed={collapsed}
          currentPage={currentPage}
          userRole={session?.user?.role || ''}
          userName={session?.user?.name || ''}
          onPageChange={onPageChange}
          onMobileClose={() => {}}
        />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1/2 -right-3 w-6 h-6 bg-white border rounded-full flex items-center justify-center shadow hover:bg-slate-50"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>
    </>
  )
}

// Header component for search
export function Header() {
  return (
    <header className="h-16 border-b bg-white px-6 flex items-center gap-4">
      <div className="flex-1 max-w-md">
        <Input placeholder="Buscar..." className="w-full" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </span>
      </div>
    </header>
  )
}