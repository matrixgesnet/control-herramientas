'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Building2, 
  Wrench, 
  Users, 
  ArrowRightLeft, 
  AlertTriangle,
  TrendingUp
} from 'lucide-react'

async function fetchDashboard() {
  const res = await fetch('/api/dashboard')
  if (!res.ok) throw new Error('Error al cargar dashboard')
  return res.json()
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard
  })

  if (isLoading) {
    return <div className="p-6">Cargando dashboard...</div>
  }

  const { resumen, stockPorSede, ultimosMovimientos, alertasStock } = data || {}

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general del sistema</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resumen?.totalSedes || 0}</p>
                <p className="text-sm text-muted-foreground">Sedes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Wrench className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resumen?.totalHerramientas || 0}</p>
                <p className="text-sm text-muted-foreground">Herramientas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resumen?.totalTecnicos || 0}</p>
                <p className="text-sm text-muted-foreground">Técnicos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ArrowRightLeft className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resumen?.totalMovimientos || 0}</p>
                <p className="text-sm text-muted-foreground">Movimientos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resumen?.asignacionesActivas || 0}</p>
                <p className="text-sm text-muted-foreground">Asignaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock por Sede */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stock por Sede</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stockPorSede?.map((sede: { sedeId: string; sedeNombre: string; total: number }) => (
                <div key={sede.sedeId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium">{sede.sedeNombre}</span>
                  <Badge variant="secondary">{sede.total} items</Badge>
                </div>
              ))}
              {(!stockPorSede || stockPorSede.length === 0) && (
                <p className="text-muted-foreground text-center py-4">No hay stock registrado</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Últimos Movimientos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ultimosMovimientos?.map((mov: { id: string; numero: string; tipo: string; fecha: string }) => (
                <div key={mov.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{mov.numero}</p>
                    <p className="text-xs text-muted-foreground">{mov.tipo}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(mov.fecha).toLocaleDateString('es-ES')}
                  </span>
                </div>
              ))}
              {(!ultimosMovimientos || ultimosMovimientos.length === 0) && (
                <p className="text-muted-foreground text-center py-4">No hay movimientos</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alertas de Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Alertas de Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertasStock?.map((alerta: { codigo: string; nombre: string; stockActual: number; stockMinimo: number | null }) => (
                <div key={alerta.codigo} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{alerta.codigo}</p>
                    <p className="text-xs text-muted-foreground">{alerta.nombre}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{alerta.stockActual}</p>
                    <p className="text-xs text-muted-foreground">Mín: {alerta.stockMinimo}</p>
                  </div>
                </div>
              ))}
              {(!alertasStock || alertasStock.length === 0) && (
                <p className="text-muted-foreground text-center py-4">No hay alertas</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
