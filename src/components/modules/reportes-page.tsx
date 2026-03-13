'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { FileDown, FileSpreadsheet, FileText, Users, Package, Building2, Printer } from 'lucide-react'

async function fetchSedes() {
  const res = await fetch('/api/sedes')
  if (!res.ok) throw new Error('Error al cargar sedes')
  return res.json()
}

async function fetchReporte(tipo: string, sedeId?: string) {
  const params = new URLSearchParams({ tipo })
  if (sedeId) params.append('sedeId', sedeId)
  const res = await fetch(`/api/reportes?${params}`)
  if (!res.ok) throw new Error('Error al cargar reporte')
  return res.json()
}

export function ReportesPage() {
  const [sedeId, setSedeId] = useState('')
  const [activeTab, setActiveTab] = useState('stock-total')

  const { data: sedes } = useQuery({ queryKey: ['sedes'], queryFn: fetchSedes })

  const { data: stockTotal, isLoading: loadingStock } = useQuery({
    queryKey: ['reporte', 'stock-total'],
    queryFn: () => fetchReporte('stock-total'),
    enabled: activeTab === 'stock-total'
  })

  const { data: stockSede, isLoading: loadingSede } = useQuery({
    queryKey: ['reporte', 'stock-sede', sedeId],
    queryFn: () => fetchReporte('stock-sede', sedeId),
    enabled: activeTab === 'stock-sede' && !!sedeId
  })

  const { data: tecnicosAsignaciones, isLoading: loadingTecnicos } = useQuery({
    queryKey: ['reporte', 'tecnicos-asignaciones', sedeId],
    queryFn: () => fetchReporte('tecnicos-asignaciones', sedeId || undefined),
    enabled: activeTab === 'tecnicos'
  })

  // Exportar a Excel
  const exportToExcel = async (tipo: string, sedeId?: string) => {
    try {
      const params = new URLSearchParams({ tipo })
      if (sedeId) params.append('sedeId', sedeId)
      const response = await fetch(`/api/reportes/excel?${params}`)
      if (!response.ok) throw new Error('Error al generar Excel')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar Excel:', error)
    }
  }

  // Exportar a PDF (abre ventana de impresión con opción de guardar como PDF)
  const exportToPDF = (title: string, elementId: string) => {
    const printContent = document.getElementById(elementId)
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              font-size: 12px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              font-size: 18px;
              margin-bottom: 5px;
            }
            .header p {
              color: #666;
              font-size: 11px;
            }
            .report-title {
              font-size: 14px;
              color: #333;
              margin-bottom: 15px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #f97316;
              color: white;
              padding: 8px 6px;
              text-align: left;
              font-size: 11px;
              font-weight: bold;
            }
            td {
              padding: 6px;
              border-bottom: 1px solid #ddd;
              font-size: 11px;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            tr:hover {
              background-color: #f1f1f1;
            }
            .badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: bold;
            }
            .badge-green { background-color: #dcfce7; color: #166534; }
            .badge-red { background-color: #fee2e2; color: #991b1b; }
            .badge-blue { background-color: #dbeafe; color: #1e40af; }
            .badge-gray { background-color: #f3f4f6; color: #374151; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
              font-size: 10px;
            }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🛠️ Sistema de Control de Herramientas</h1>
            <p>Generado el: ${new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
          ${printContent.innerHTML}
          <div class="footer">
            <p>Sistema de Control de Herramientas - Reporte generado automáticamente</p>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    
    // Esperar a que cargue y luego imprimir
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  // Imprimir directamente
  const handlePrint = (title: string, elementId: string) => {
    const printContent = document.getElementById(elementId)
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              font-size: 12px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              font-size: 18px;
              margin-bottom: 5px;
            }
            .header p {
              color: #666;
              font-size: 11px;
            }
            .report-title {
              font-size: 14px;
              color: #333;
              margin-bottom: 15px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #333;
              color: white;
              padding: 8px 6px;
              text-align: left;
              font-size: 11px;
              font-weight: bold;
            }
            td {
              padding: 6px;
              border-bottom: 1px solid #ddd;
              font-size: 11px;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: bold;
            }
            .badge-green { background-color: #dcfce7; color: #166534; }
            .badge-red { background-color: #fee2e2; color: #991b1b; }
            .badge-blue { background-color: #dbeafe; color: #1e40af; }
            .badge-gray { background-color: #f3f4f6; color: #374151; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
              font-size: 10px;
            }
            @media print {
              body { padding: 10px; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🛠️ Sistema de Control de Herramientas</h1>
            <p>Generado el: ${new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
          ${printContent.innerHTML}
          <div class="footer">
            <p>Sistema de Control de Herramientas - Reporte generado automáticamente</p>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 500)
  }

  // Generar nombre de archivo con fecha
  const getFilename = (baseName: string) => {
    const date = new Date().toISOString().split('T')[0]
    return `${baseName}_${date}`
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reportes</h1>
        <p className="text-muted-foreground">Informes y exportación de datos</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="stock-total">Stock Total</TabsTrigger>
          <TabsTrigger value="stock-sede">Por Sede</TabsTrigger>
          <TabsTrigger value="tecnicos">Técnicos</TabsTrigger>
        </TabsList>

        {/* Stock Total */}
        <TabsContent value="stock-total" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Stock Total de Herramientas
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportToExcel('stock-total')}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportToPDF('Stock Total', 'report-stock-total')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePrint('Stock Total', 'report-stock-total')}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingStock ? (
                <p className="p-4">Cargando...</p>
              ) : (
                <div className="overflow-auto" id="report-stock-total">
                  <div className="p-4 bg-slate-50 border-b print:hidden">
                    <p className="text-sm text-muted-foreground">
                      Reporte generado: {new Date().toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Stock Total</TableHead>
                        <TableHead className="text-right">Costo Prom.</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockTotal?.map((item: Record<string, unknown>) => (
                        <TableRow key={item.codigo as string}>
                          <TableCell className="font-mono">{item.codigo}</TableCell>
                          <TableCell className="font-medium">{item.nombre}</TableCell>
                          <TableCell>{item.categoria || '-'}</TableCell>
                          <TableCell className="text-right">{item.stockTotal}</TableCell>
                          <TableCell className="text-right">S/ {(item.costoPromedio as number)?.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">S/ {(item.valorTotal as number)?.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {stockTotal?.length > 0 && (
                    <div className="p-4 bg-slate-50 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Total de herramientas: {stockTotal?.length}</span>
                        <span className="font-medium">
                          Valor Total: S/ {stockTotal?.reduce((sum: number, item: Record<string, unknown>) => 
                            sum + ((item.valorTotal as number) || 0), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock por Sede */}
        <TabsContent value="stock-sede" className="mt-6 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="space-y-2 flex-1 max-w-xs">
                  <Label>Seleccionar Sede</Label>
                  <Select value={sedeId} onValueChange={setSedeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sede..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sedes?.map((s: Record<string, unknown>) => (
                        <SelectItem key={s.id as string} value={s.id as string}>
                          {s.nombre as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {sedeId && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {stockSede?.sede || 'Sede'}
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => exportToExcel('stock-sede', sedeId)}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Excel
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => exportToPDF(`Stock - ${stockSede?.sede}`, 'report-stock-sede')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handlePrint(`Stock - ${stockSede?.sede}`, 'report-stock-sede')}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingSede ? (
                  <p className="p-4">Cargando...</p>
                ) : (
                  <div className="overflow-auto" id="report-stock-sede">
                    <div className="p-4 bg-slate-50 border-b">
                      <p className="font-medium">{stockSede?.sede}</p>
                      <p className="text-sm text-muted-foreground">
                        Reporte generado: {new Date().toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Costo Prom.</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockSede?.items?.map((item: Record<string, unknown>) => (
                          <TableRow key={item.codigo as string}>
                            <TableCell className="font-mono">{item.codigo}</TableCell>
                            <TableCell className="font-medium">{item.nombre}</TableCell>
                            <TableCell>{item.categoria || '-'}</TableCell>
                            <TableCell className="text-right">{item.cantidad}</TableCell>
                            <TableCell className="text-right">S/ {(item.costoPromedio as number)?.toFixed(2)}</TableCell>
                            <TableCell className="text-right">S/ {(item.valorTotal as number)?.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={item.estadoStock === 'bajo' ? 'destructive' : item.estadoStock === 'alto' ? 'secondary' : 'default'}
                              >
                                {item.estadoStock}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {stockSede?.items?.length > 0 && (
                      <div className="p-4 bg-slate-50 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Total de items: {stockSede?.items?.length}</span>
                          <span className="font-medium">
                            Valor Total: S/ {stockSede?.items?.reduce((sum: number, item: Record<string, unknown>) => 
                              sum + ((item.valorTotal as number) || 0), 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!sedeId && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Seleccione una sede para ver su stock</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Técnicos y Asignaciones */}
        <TabsContent value="tecnicos" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Herramientas Asignadas a Técnicos
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportToExcel('tecnicos-asignaciones')}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportToPDF('Técnicos - Asignaciones', 'report-tecnicos')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePrint('Técnicos - Asignaciones', 'report-tecnicos')}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTecnicos ? (
                <p className="p-4">Cargando...</p>
              ) : (
                <div className="overflow-auto" id="report-tecnicos">
                  <div className="p-4 bg-slate-50 border-b">
                    <p className="text-sm text-muted-foreground">
                      Reporte generado: {new Date().toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DNI</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Sede</TableHead>
                        <TableHead>Cuadrilla</TableHead>
                        <TableHead className="text-center">Total Items</TableHead>
                        <TableHead>Herramientas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tecnicosAsignaciones?.map((t: Record<string, unknown>) => (
                        <TableRow key={t.dni as string}>
                          <TableCell className="font-mono">{t.dni}</TableCell>
                          <TableCell className="font-medium">{t.nombre}</TableCell>
                          <TableCell><Badge variant="outline">{t.sede}</Badge></TableCell>
                          <TableCell>{t.numeroCuadrilla || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-700">{t.totalHerramientas}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(t.herramientas as Record<string, unknown>[])?.slice(0, 3).map((h, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {h.codigo} ({h.cantidad})
                                </Badge>
                              ))}
                              {((t.herramientas as Record<string, unknown>[])?.length || 0) > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{(t.herramientas as Record<string, unknown>[])?.length - 3} más
                                </Badge>
                              )}
                              {((t.herramientas as Record<string, unknown>[])?.length || 0) === 0 && (
                                <span className="text-muted-foreground text-xs">Sin asignaciones</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {tecnicosAsignaciones?.length > 0 && (
                    <div className="p-4 bg-slate-50 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Total de técnicos: {tecnicosAsignaciones?.length}</span>
                        <span className="font-medium">
                          Total de asignaciones: {tecnicosAsignaciones?.reduce((sum: number, t: Record<string, unknown>) => 
                            sum + ((t.totalHerramientas as number) || 0), 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}