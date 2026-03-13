'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FileDown, FileText, Printer, Building2 } from 'lucide-react'

async function fetchSedes() {
  const res = await fetch('/api/sedes')
  if (!res.ok) throw new Error('Error al cargar sedes')
  return res.json()
}

async function fetchReporteSede(sedeId: string) {
  const res = await fetch(`/api/reportes-sede?sedeId=${sedeId}`)
  if (!res.ok) throw new Error('Error al cargar reporte')
  return res.json()
}

export function ReporteSedePage() {
  const [sedeId, setSedeId] = useState('')

  const { data: sedes } = useQuery({ queryKey: ['sedes'], queryFn: fetchSedes })

  const { data: reporte, isLoading, refetch } = useQuery({
    queryKey: ['reporte-sede', sedeId],
    queryFn: () => fetchReporteSede(sedeId),
    enabled: !!sedeId
  })

  const handleConsultar = () => {
    if (sedeId) {
      refetch()
    }
  }

  // Exportar a Excel
  const exportToExcel = async () => {
    if (!sedeId) return

    try {
      const response = await fetch(`/api/reportes-sede/excel?sedeId=${sedeId}`)
      if (!response.ok) throw new Error('Error al generar Excel')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `reporte_${reporte?.sede?.nombre || 'sede'}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar Excel:', error)
    }
  }

  // Exportar a PDF
  const exportToPDF = () => {
    const printContent = document.getElementById('reporte-tabla')
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const tecnicosHeader = reporte?.tecnicos?.map((t: { nombre: string }) =>
      `<th style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${t.nombre}</th>`
    ).join('') || ''

    const rows = reporte?.herramientas?.map((h: {
      codigo: string
      nombre: string
      datosPorTecnico: Record<string, { cantidad: number; estado: string | null }>
      stockTotal: number
      totalTecnicos: number
      total: number
    }) => {
      const tecnicoCells = reporte.tecnicos.map((t: { id: string }) => {
        const dato = h.datosPorTecnico[t.id]
        if (dato && dato.cantidad > 0) {
          if (dato.estado && dato.estado !== 'BUENO') {
            return `<td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${dato.cantidad} (${dato.estado})</td>`
          }
          return `<td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${dato.cantidad}</td>`
        }
        return `<td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px; color: #ccc;">0</td>`
      }).join('')

      return `
        <tr>
          <td style="padding: 6px; border: 1px solid #ddd; font-family: monospace; font-size: 11px;">${h.codigo}</td>
          <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold; font-size: 11px;">${h.nombre}</td>
          ${tecnicoCells}
          <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-size: 11px;">${h.stockTotal}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-size: 11px; background-color: #fff7ed;">${h.totalTecnicos}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-size: 11px; background-color: #fed7aa;">${h.total}</td>
        </tr>
      `
    }).join('') || ''

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte por Sede - ${reporte?.sede?.nombre}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .header h1 { font-size: 18px; margin-bottom: 5px; }
            .header p { color: #666; font-size: 11px; }
            .sede-title { font-size: 14px; color: #f97316; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f97316; color: white; padding: 8px; border: 1px solid #ddd; font-size: 11px; }
            td { padding: 6px; border: 1px solid #ddd; font-size: 11px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .footer { margin-top: 20px; text-align: center; color: #666; font-size: 10px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🛠️ Reporte de Herramientas por Sede</h1>
            <p>Generado: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <p class="sede-title"><strong>Sede:</strong> ${reporte?.sede?.nombre}</p>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Herramienta</th>
                ${tecnicosHeader}
                <th>Stock Sede</th>
                <th>Total Técnicos</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="footer">
            <p>Sistema de Control de Herramientas</p>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  // Imprimir
  const handlePrint = () => {
    exportToPDF()
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reporte por Sede</h1>
        <p className="text-muted-foreground">Herramientas asignadas a técnicos por sede</p>
      </div>

      {/* Filtro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtrar por Sede</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label>Seleccionar Sede</Label>
              <Select value={sedeId} onValueChange={setSedeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sede..." />
                </SelectTrigger>
                <SelectContent>
                  {sedes?.map((s: { id: string; nombre: string }) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleConsultar} disabled={!sedeId} className="bg-orange-500 hover:bg-orange-600">
              Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-muted-foreground">Cargando reporte...</p>
          </CardContent>
        </Card>
      )}

      {reporte && !isLoading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {reporte.sede?.nombre} - {reporte.herramientas?.length} herramientas
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <FileDown className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto" id="reporte-tabla">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-orange-500 text-white">
                    <th className="p-2 text-left font-medium sticky left-0 bg-orange-500 z-20 min-w-[80px]">Código</th>
                    <th className="p-2 text-left font-medium sticky left-[80px] bg-orange-500 z-10 min-w-[200px]">Herramienta</th>
                    {reporte.tecnicos?.map((t: { id: string; nombre: string }) => (
                      <th key={t.id} className="p-2 text-center font-medium whitespace-nowrap min-w-[80px]">
                        {t.nombre}
                      </th>
                    ))}
                    <th className="p-2 text-center font-medium min-w-[80px]">Stock Sede</th>
                    <th className="p-2 text-center font-medium bg-orange-600 min-w-[90px]">Total Técnicos</th>
                    <th className="p-2 text-center font-medium sticky right-0 bg-orange-600 min-w-[70px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.herramientas?.map((h: {
                    codigo: string
                    nombre: string
                    datosPorTecnico: Record<string, { cantidad: number; estado: string | null }>
                    stockTotal: number
                    totalTecnicos: number
                    total: number
                  }) => (
                    <tr key={h.codigo} className="border-b hover:bg-slate-50">
                      <td className="p-2 font-mono sticky left-0 bg-white z-20">{h.codigo}</td>
                      <td className="p-2 font-medium sticky left-[80px] bg-white z-10">{h.nombre}</td>
                      {reporte.tecnicos?.map((t: { id: string }) => {
                        const dato = h.datosPorTecnico[t.id]
                        if (dato && dato.cantidad > 0) {
                          const colorEstado = dato.estado === 'USADO' ? 'bg-yellow-100 text-yellow-700' :
                                             dato.estado === 'REPARADO' ? 'bg-blue-100 text-blue-700' :
                                             dato.estado === 'DANADO' ? 'bg-red-100 text-red-700' :
                                             dato.estado === 'EN_MANTENIMIENTO' ? 'bg-purple-100 text-purple-700' :
                                             ''

                          if (dato.estado && dato.estado !== 'BUENO') {
                            return (
                              <td key={t.id} className="p-2 text-center">
                                <Badge className={colorEstado}>
                                  {dato.cantidad} ({dato.estado})
                                </Badge>
                              </td>
                            )
                          }
                          return (
                            <td key={t.id} className="p-2 text-center">
                              <Badge className="bg-green-100 text-green-700">{dato.cantidad}</Badge>
                            </td>
                          )
                        }
                        return <td key={t.id} className="p-2 text-center text-muted-foreground">-</td>
                      })}
                      <td className="p-2 text-center font-bold">{h.stockTotal}</td>
                      <td className="p-2 text-center font-bold bg-orange-50">{h.totalTecnicos}</td>
                      <td className="p-2 text-center font-bold sticky right-0 bg-orange-100">{h.total}</td>
                    </tr>
                  ))}
                  {reporte.herramientas?.length === 0 && (
                    <tr>
                      <td colSpan={5 + (reporte.tecnicos?.length || 0)} className="p-8 text-center text-muted-foreground">
                        No hay herramientas registradas en esta sede
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumen */}
            {reporte.herramientas?.length > 0 && (
              <div className="p-4 bg-slate-50 border-t">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span><strong>Total Herramientas:</strong> {reporte.herramientas?.length}</span>
                  <span><strong>Técnicos:</strong> {reporte.tecnicos?.length}</span>
                  <span><strong>Total Stock Sede:</strong> {reporte.herramientas?.reduce((sum: number, h: { stockTotal: number }) => sum + h.stockTotal, 0)}</span>
                  <span><strong>Total Técnicos:</strong> {reporte.herramientas?.reduce((sum: number, h: { totalTecnicos: number }) => sum + h.totalTecnicos, 0)}</span>
                  <span className="text-orange-600 font-semibold"><strong>Gran Total:</strong> {reporte.herramientas?.reduce((sum: number, h: { total: number }) => sum + h.total, 0)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className="bg-green-100 text-green-700">Bueno</Badge>
                  <Badge className="bg-yellow-100 text-yellow-700">Usado</Badge>
                  <Badge className="bg-blue-100 text-blue-700">Reparado</Badge>
                  <Badge className="bg-red-100 text-red-700">Dañado</Badge>
                  <Badge className="bg-purple-100 text-purple-700">En Mantenimiento</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!reporte && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Seleccione una sede para ver el reporte</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
