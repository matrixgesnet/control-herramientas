'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Search, FileText, ArrowDownRight, ArrowUpRight, Calendar, X } from 'lucide-react'

async function fetchHerramientas() {
  const res = await fetch('/api/herramientas')
  if (!res.ok) throw new Error('Error al cargar herramientas')
  return res.json()
}

async function fetchSedes() {
  const res = await fetch('/api/sedes')
  if (!res.ok) throw new Error('Error al cargar sedes')
  return res.json()
}

async function fetchKardex(herramientaId: string, sedeId?: string, fechaDesde?: string, fechaHasta?: string) {
  const params = new URLSearchParams({ herramientaId })
  if (sedeId) params.append('sedeId', sedeId)
  if (fechaDesde) params.append('fechaDesde', fechaDesde)
  if (fechaHasta) params.append('fechaHasta', fechaHasta)
  const res = await fetch(`/api/kardex?${params}`)
  if (!res.ok) throw new Error('Error al cargar kardex')
  return res.json()
}

const tipoLabels: Record<string, { label: string; color: string }> = {
  SALDO_INICIAL: { label: 'Saldo Inicial', color: 'bg-slate-100 text-slate-700' },
  COMPRA: { label: 'Compra', color: 'bg-green-100 text-green-700' },
  TRANSFERENCIA: { label: 'Transferencia', color: 'bg-blue-100 text-blue-700' },
  SALIDA: { label: 'Salida', color: 'bg-orange-100 text-orange-700' },
  DEVOLUCION_TECNICO: { label: 'Devolución', color: 'bg-purple-100 text-purple-700' },
  BAJA: { label: 'Baja', color: 'bg-red-100 text-red-700' },
  ANULADO: { label: 'Anulado', color: 'bg-gray-100 text-gray-700' }
}

export function KardexPage() {
  const [herramientaId, setHerramientaId] = useState('')
  const [sedeId, setSedeId] = useState('todas')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [searchHerramienta, setSearchHerramienta] = useState('')

  const { data: herramientas } = useQuery({ queryKey: ['herramientas'], queryFn: fetchHerramientas })
  const { data: sedes } = useQuery({ queryKey: ['sedes'], queryFn: fetchSedes })

  const { data: kardexData, isLoading: kardexLoading, refetch: fetchKardexData } = useQuery({
    queryKey: ['kardex', herramientaId, sedeId, fechaDesde, fechaHasta],
    queryFn: () => fetchKardex(
      herramientaId, 
      sedeId === 'todas' ? undefined : sedeId,
      fechaDesde || undefined,
      fechaHasta || undefined
    ),
    enabled: !!herramientaId
  })

  const filteredHerramientas = herramientas?.filter((h: Record<string, unknown>) =>
    (h.codigo as string)?.toLowerCase().includes(searchHerramienta.toLowerCase()) ||
    (h.nombre as string)?.toLowerCase().includes(searchHerramienta.toLowerCase())
  )

  const { herramienta, kardex, saldoFinal, costoPromedioFinal } = kardexData || {}

  const limpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setSedeId('todas')
  }

  // Verificar si hay filtros activos
  const hayFiltrosActivos = sedeId !== 'todas' || fechaDesde || fechaHasta

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Kardex</h1>
        <p className="text-muted-foreground">Historial detallado de movimientos por herramienta</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filtros</CardTitle>
            {hayFiltrosActivos && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Herramienta */}
            <div className="space-y-2">
              <Label>Herramienta *</Label>
              <Select value={herramientaId} onValueChange={setHerramientaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Buscar..."
                      value={searchHerramienta}
                      onChange={(e) => setSearchHerramienta(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredHerramientas?.map((h: Record<string, unknown>) => (
                      <SelectItem key={h.id as string} value={h.id as string}>
                        {h.codigo as string} - {h.nombre as string}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Sede */}
            <div className="space-y-2">
              <Label>Sede</Label>
              <Select value={sedeId} onValueChange={setSedeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las sedes</SelectItem>
                  {sedes?.map((s: Record<string, unknown>) => (
                    <SelectItem key={s.id as string} value={s.id as string}>
                      {s.nombre as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha Desde */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Fecha Desde
              </Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                max={fechaHasta || undefined}
              />
            </div>

            {/* Fecha Hasta */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Fecha Hasta
              </Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                min={fechaDesde || undefined}
              />
            </div>

            {/* Botón Consultar */}
            <div className="flex items-end">
              <Button 
                onClick={() => fetchKardexData()} 
                disabled={!herramientaId} 
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                <Search className="w-4 h-4 mr-2" />
                Consultar
              </Button>
            </div>
          </div>

          {/* Indicador de filtros activos */}
          {hayFiltrosActivos && (
            <div className="mt-4 flex flex-wrap gap-2">
              {sedeId !== 'todas' && (
                <Badge variant="secondary" className="gap-1">
                  Sede: {sedes?.find((s: Record<string, unknown>) => s.id === sedeId)?.nombre}
                  <button onClick={() => setSedeId('todas')} className="ml-1 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {fechaDesde && (
                <Badge variant="secondary" className="gap-1">
                  Desde: {new Date(fechaDesde).toLocaleDateString('es-ES')}
                  <button onClick={() => setFechaDesde('')} className="ml-1 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {fechaHasta && (
                <Badge variant="secondary" className="gap-1">
                  Hasta: {new Date(fechaHasta).toLocaleDateString('es-ES')}
                  <button onClick={() => setFechaHasta('')} className="ml-1 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {herramienta && (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">
                  {herramienta.codigo} - {herramienta.nombre}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Unidad: {herramienta.unidad} | Costo Promedio: S/ {(herramienta.costoPromedio || 0).toFixed(2)}
                </p>
                {(fechaDesde || fechaHasta) && (
                  <p className="text-sm text-blue-600 mt-1">
                    Período: {fechaDesde ? new Date(fechaDesde).toLocaleDateString('es-ES') : 'Inicio'} - {fechaHasta ? new Date(fechaHasta).toLocaleDateString('es-ES') : 'Actual'}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Saldo en Período</p>
                <p className="text-2xl font-bold">{saldoFinal || 0}</p>
                <p className="text-sm text-muted-foreground">
                  Valor: S/ {((saldoFinal || 0) * (costoPromedioFinal || 0)).toFixed(2)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {kardexLoading ? (
              <p className="p-4">Cargando kardex...</p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-24">Fecha</TableHead>
                      <TableHead className="w-28">Número</TableHead>
                      <TableHead className="w-32">Tipo</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="w-20 text-center">Ingreso</TableHead>
                      <TableHead className="w-20 text-center">Salida</TableHead>
                      <TableHead className="w-20 text-right">Saldo</TableHead>
                      <TableHead className="w-24 text-right">Costo Unit.</TableHead>
                      <TableHead className="w-24 text-right">Costo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kardex?.map((entry: Record<string, unknown>, index: number) => {
                      const tipoInfo = tipoLabels[entry.tipo as string] || { label: entry.tipo, color: '' }
                      return (
                        <TableRow key={index}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {entry.tipo === 'SALDO_INICIAL' ? '-' : 
                              new Date(entry.fecha as string).toLocaleDateString('es-ES')}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{entry.numeroMovimiento || '-'}</TableCell>
                          <TableCell>
                            <Badge className={tipoInfo.color}>{tipoInfo.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="space-y-1">
                              {entry.tecnico && <div><span className="text-muted-foreground">Técnico:</span> {entry.tecnico}</div>}
                              {entry.proveedor && <div><span className="text-muted-foreground">Prov:</span> {entry.proveedor}</div>}
                              {entry.sedeOrigen && entry.sedeDestino && (
                                <div>
                                  <span className="text-muted-foreground">{entry.sedeOrigen}</span>
                                  <span className="mx-1">→</span>
                                  <span>{entry.sedeDestino}</span>
                                </div>
                              )}
                              {!entry.tecnico && !entry.proveedor && !entry.sedeOrigen && '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {(entry.ingreso as number) > 0 && (
                              <span className="text-green-600 font-medium flex items-center justify-center gap-1">
                                <ArrowDownRight className="w-4 h-4" />
                                {entry.ingreso}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {(entry.salida as number) > 0 && (
                              <span className="text-red-600 font-medium flex items-center justify-center gap-1">
                                <ArrowUpRight className="w-4 h-4" />
                                {entry.salida}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{entry.saldo}</TableCell>
                          <TableCell className="text-right">S/ {(entry.costoUnitario as number)?.toFixed(2)}</TableCell>
                          <TableCell className="text-right">S/ {(entry.costoTotal as number)?.toFixed(2)}</TableCell>
                        </TableRow>
                      )
                    })}
                    {kardex?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          No hay movimientos registrados en el período seleccionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!herramienta && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Seleccione una herramienta</p>
            <p className="text-sm">Elija una herramienta del menú desplegable para ver su kardex</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}