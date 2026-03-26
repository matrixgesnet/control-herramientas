'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Search, Wrench, FileSpreadsheet, FileText, Printer, Loader2 } from 'lucide-react'

async function fetchHerramientas() {
  const res = await fetch('/api/herramientas?conStockPorSede=true')
  if (!res.ok) throw new Error('Error al cargar herramientas')
  return res.json()
}

async function fetchCategorias() {
  const res = await fetch('/api/categorias')
  if (!res.ok) throw new Error('Error al cargar categorías')
  return res.json()
}

async function createHerramienta(data: Record<string, unknown>) {
  const res = await fetch('/api/herramientas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al crear')
  }
  return res.json()
}

async function updateHerramienta(data: Record<string, unknown>) {
  const res = await fetch('/api/herramientas', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al actualizar')
  }
  return res.json()
}

export function HerramientasPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    unidad: 'UND',
    categoriaId: '',
    marca: '',
    modelo: '',
    controlaStock: true,
    stockMaximo: '',
    stockMinimo: '',
    activo: true
  })

  const { data, isLoading } = useQuery({
    queryKey: ['herramientas-stock-sede'],
    queryFn: fetchHerramientas
  })

  // Extraer herramientas y sedes del response
  const herramientas = data?.herramientas || []
  const sedes = data?.sedes || []

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: fetchCategorias
  })

  const createMutation = useMutation({
    mutationFn: createHerramienta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herramientas-stock-sede'] })
      queryClient.invalidateQueries({ queryKey: ['herramientas'] })
      setDialogOpen(false)
      resetForm()
      toast({
        title: 'Éxito',
        description: 'Herramienta creada correctamente',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear la herramienta',
        variant: 'destructive'
      })
    }
  })

  const updateMutation = useMutation({
    mutationFn: updateHerramienta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herramientas-stock-sede'] })
      queryClient.invalidateQueries({ queryKey: ['herramientas'] })
      setDialogOpen(false)
      resetForm()
      toast({
        title: 'Éxito',
        description: 'Herramienta actualizada correctamente',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al actualizar la herramienta',
        variant: 'destructive'
      })
    }
  })

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      unidad: 'UND',
      categoriaId: '',
      marca: '',
      modelo: '',
      controlaStock: true,
      stockMaximo: '',
      stockMinimo: '',
      activo: true
    })
    setEditingItem(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const openEdit = (item: Record<string, unknown>) => {
    setEditingItem(item)
    setFormData({
      nombre: item.nombre as string,
      descripcion: (item.descripcion as string) || '',
      unidad: (item.unidad as string) || 'UND',
      categoriaId: (item.categoriaId as string) || '',
      marca: (item.marca as string) || '',
      modelo: (item.modelo as string) || '',
      controlaStock: item.controlaStock as boolean,
      stockMaximo: (item.stockMaximo as string) || '',
      stockMinimo: (item.stockMinimo as string) || '',
      activo: item.activo as boolean
    })
    setDialogOpen(true)
  }

  // Helper para obtener stock por sede
  const getStockPorSede = (h: Record<string, unknown>, sedeId: string): number => {
    const stocks = h.stocks as { sedeId: string; cantidad: number }[] | undefined
    if (!stocks) return 0
    const stock = stocks.find(s => s.sedeId === sedeId)
    return stock?.cantidad || 0
  }

  const filtered = herramientas?.filter((h: Record<string, unknown>) =>
    (h.codigo as string)?.toLowerCase().includes(search.toLowerCase()) ||
    (h.nombre as string)?.toLowerCase().includes(search.toLowerCase())
  )

  // Función para exportar a Excel
  const handleExportExcel = async () => {
    try {
      const response = await fetch('/api/herramientas/excel')
      if (!response.ok) throw new Error('Error al generar Excel')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `herramientas_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error al exportar Excel:', error)
      alert('Error al generar el archivo Excel')
    }
  }

  // Función para exportar a PDF (usando ventana de impresión)
  const handleExportPDF = () => {
    // Crear encabezados de sedes
    const sedesHeaders = sedes?.map((s: { nombre: string }) => 
      `<th style="padding: 8px; border: 1px solid #ddd; font-size: 10px; text-align: center;">${s.nombre}</th>`
    ).join('') || ''

    // Crear filas de datos
    const rows = filtered?.map((h: Record<string, unknown>) => {
      // Stock por sede
      const stockCells = sedes?.map((sede: { id: string; nombre: string }) => {
        const stock = getStockPorSede(h, sede.id)
        return `<td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 10px;">${stock}</td>`
      }).join('') || ''

      const stockTotal = h.stockTotal as number || 0
      const descripcion = (h.descripcion as string) || '-'
      const descripcionCorta = descripcion.length > 25 ? descripcion.substring(0, 25) + '...' : descripcion

      return `
        <tr>
          <td style="padding: 6px; border: 1px solid #ddd; font-family: monospace; font-size: 10px;">${h.codigo}</td>
          <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold; font-size: 10px;">${h.nombre}</td>
          <td style="padding: 6px; border: 1px solid #ddd; font-size: 10px;">${(h.categoria as Record<string, unknown>)?.nombre || '-'}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 10px;">${h.unidad}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 10px;">${h.stockMinimo || '-'}</td>
          ${stockCells}
          <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-size: 10px;">${stockTotal}</td>
          <td style="padding: 6px; border: 1px solid #ddd; font-size: 10px; color: #666;">${descripcionCorta}</td>
        </tr>
      `
    }).join('') || ''

    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Listado de Herramientas</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 15px; font-size: 11px; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
            .header h1 { font-size: 16px; margin-bottom: 5px; color: #333; }
            .header p { color: #666; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f97316; color: black; padding: 8px; border: 1px solid #ddd; font-size: 10px; font-weight: bold; }
            td { padding: 6px; border: 1px solid #ddd; font-size: 10px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .footer { margin-top: 15px; text-align: center; color: #666; font-size: 9px; }
            @media print { 
              body { padding: 10px; }
              @page { size: landscape; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LISTADO DE HERRAMIENTAS</h1>
            <p>Generado: ${new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - Total: ${filtered?.length || 0} herramientas</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Stock Mín.</th>
                ${sedesHeaders}
                <th>Stock Total</th>
                <th>Descripción</th>
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

  // Función para imprimir
  const handlePrint = () => {
    handleExportPDF()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock de Herramientas</h1>
          <p className="text-muted-foreground">Tabla maestra de herramientas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportExcel} variant="outline" size="sm">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Herramienta
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Cargando...</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-orange-50 hover:bg-orange-50">
                    <TableHead className="font-semibold">Código</TableHead>
                    <TableHead className="font-semibold">Nombre</TableHead>
                    <TableHead className="font-semibold w-28">Categoría</TableHead>
                    <TableHead className="font-semibold">Unidad</TableHead>
                    <TableHead className="font-semibold text-right">Stock Mín.</TableHead>
                    {sedes?.map((sede: { id: string; nombre: string }) => (
                      <TableHead key={sede.id} className="font-semibold text-right">
                        {sede.nombre}
                      </TableHead>
                    ))}
                    <TableHead className="font-semibold text-right">Stock Total</TableHead>
                    <TableHead className="font-semibold">Descripción</TableHead>
                    <TableHead className="font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((h: Record<string, unknown>) => (
                    <TableRow key={h.id as string}>
                      <TableCell className="font-mono font-medium">{h.codigo as string}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{h.nombre as string}</p>
                          {(h.marca as string) && (
                            <p className="text-xs text-muted-foreground">{h.marca as string}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="w-28">{(h.categoria as Record<string, unknown>)?.nombre || '-'}</TableCell>
                      <TableCell>{h.unidad as string}</TableCell>
                      <TableCell className="text-right">{h.stockMinimo || '-'}</TableCell>
                      {sedes?.map((sede: { id: string; nombre: string }) => (
                        <TableCell key={sede.id} className="text-right">
                          {getStockPorSede(h, sede.id)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Badge variant={((h.stockTotal as number) || 0) > 0 ? 'default' : 'destructive'}>
                          {h.stockTotal as number}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-32 truncate text-sm text-muted-foreground">
                        {(h.descripcion as string) || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(h)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9 + (sedes?.length || 0)} className="text-center py-8 text-muted-foreground">
                        <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        No se encontraron herramientas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Herramienta' : 'Nueva Herramienta'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Código solo se muestra al editar (autogenerado al crear) */}
            {editingItem && (
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={editingItem.codigo as string}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select value={formData.unidad} onValueChange={(v) => setFormData({ ...formData, unidad: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UND">UND - Unidad</SelectItem>
                    <SelectItem value="PAR">PAR - Par</SelectItem>
                    <SelectItem value="SET">SET - Set</SelectItem>
                    <SelectItem value="KIT">KIT - Kit</SelectItem>
                    <SelectItem value="M">M - Metro</SelectItem>
                    <SelectItem value="KG">KG - Kilogramo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={formData.categoriaId} onValueChange={(v) => setFormData({ ...formData, categoriaId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias?.map((c: Record<string, unknown>) => (
                      <SelectItem key={c.id as string} value={c.id as string}>
                        {c.nombre as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input
                  value={formData.marca}
                  onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock Mínimo</Label>
                <Input
                  type="number"
                  value={formData.stockMinimo}
                  onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock Máximo</Label>
                <Input
                  type="number"
                  value={formData.stockMaximo}
                  onChange={(e) => setFormData({ ...formData, stockMaximo: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.controlaStock}
                  onCheckedChange={(v) => setFormData({ ...formData, controlaStock: v })}
                />
                <Label>Controlar Stock</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.activo}
                  onCheckedChange={(v) => setFormData({ ...formData, activo: v })}
                />
                <Label>Activo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
                {editingItem ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
