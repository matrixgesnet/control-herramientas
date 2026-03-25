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
import { Plus, Pencil, Search, Wrench, FileDown, FileText, Printer } from 'lucide-react'

interface HerramientaData {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  unidad: string
  categoriaId: string | null
  marca: string | null
  modelo: string | null
  controlaStock: boolean
  stockMaximo: number | null
  stockMinimo: number | null
  costoPromedio: number
  activo: boolean
  categoria: { nombre: string } | null
  stockTotal: number
  stockPorSede: Record<string, number>
}

interface ApiResponse {
  herramientas: HerramientaData[]
  sedes: string[]
}

async function fetchHerramientas(): Promise<ApiResponse> {
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
    queryKey: ['herramientas-con-sede'],
    queryFn: fetchHerramientas
  })

  const herramientas = data?.herramientas || []
  const sedes = data?.sedes || []

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: fetchCategorias
  })

  const createMutation = useMutation({
    mutationFn: createHerramienta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herramientas-con-sede'] })
      queryClient.invalidateQueries({ queryKey: ['herramientas'] })
      setDialogOpen(false)
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: updateHerramienta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herramientas-con-sede'] })
      queryClient.invalidateQueries({ queryKey: ['herramientas'] })
      setDialogOpen(false)
      resetForm()
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

  const filtered = herramientas?.filter((h) =>
    h.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    h.codigo?.toLowerCase().includes(search.toLowerCase())
  )

  // Exportar a Excel
  const exportToExcel = async () => {
    try {
      const response = await fetch('/api/herramientas/excel')
      if (!response.ok) throw new Error('Error al generar Excel')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `herramientas_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar Excel:', error)
    }
  }

  // Exportar a PDF
  const exportToPDF = () => {
    const printContent = document.getElementById('tabla-herramientas')
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Listado de Herramientas</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 10px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .header h1 { font-size: 16px; margin-bottom: 5px; }
            .header p { color: #666; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f97316; color: white; padding: 6px 4px; text-align: left; font-size: 9px; font-weight: bold; }
            td { padding: 4px; border-bottom: 1px solid #ddd; font-size: 9px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .footer { margin-top: 20px; text-align: center; color: #666; font-size: 9px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🛠️ Listado de Herramientas</h1>
            <p>Generado: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          ${printContent.innerHTML}
          <div class="footer">
            <p>Sistema de Control de Herramientas - Total: ${filtered?.length || 0} herramientas</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Herramientas</h1>
          <p className="text-muted-foreground">Gestión del catálogo de herramientas y materiales</p>
        </div>
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
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Herramienta
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 bg-slate-100">
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
            <div className="text-sm text-muted-foreground">
              Total: {filtered?.length || 0} herramientas
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4">Cargando...</p>
          ) : (
            <div className="overflow-auto">
              <Table id="tabla-herramientas">
                <TableHeader>
                  <TableRow className="bg-orange-500 hover:bg-orange-600">
                    <TableHead className="text-white font-bold">Código</TableHead>
                    <TableHead className="text-white font-bold">Nombre</TableHead>
                    <TableHead className="text-white font-bold w-[100px]">Categoría</TableHead>
                    <TableHead className="text-white font-bold w-[60px]">Unidad</TableHead>
                    <TableHead className="text-white font-bold text-right w-[80px]">Stock Mín.</TableHead>
                    <TableHead className="text-white font-bold text-right w-[80px]">Stock Total</TableHead>
                    {sedes.map((sede) => (
                      <TableHead key={sede} className="text-white font-bold text-right w-[70px]">{sede}</TableHead>
                    ))}
                    <TableHead className="text-white font-bold">Descripción</TableHead>
                    <TableHead className="text-white font-bold text-right w-[80px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono font-medium">{h.codigo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{h.nombre}</p>
                          {h.marca && (
                            <p className="text-xs text-muted-foreground">{h.marca}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="w-[100px]">{h.categoria?.nombre || '-'}</TableCell>
                      <TableCell className="w-[60px]">{h.unidad}</TableCell>
                      <TableCell className="text-right w-[80px]">
                        {h.stockMinimo ?? '-'}
                      </TableCell>
                      <TableCell className="text-right w-[80px]">
                        <Badge variant={h.stockTotal > 0 ? 'default' : 'destructive'}>
                          {h.stockTotal}
                        </Badge>
                      </TableCell>
                      {sedes.map((sede) => (
                        <TableCell key={sede} className="text-right w-[70px]">
                          {(h.stockPorSede?.[sede] || 0) > 0 ? (
                            <span className="font-medium">{h.stockPorSede?.[sede] || 0}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="max-w-[200px] truncate" title={h.descripcion || ''}>
                        {h.descripcion || '-'}
                      </TableCell>
                      <TableCell className="text-right w-[80px]">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(h as Record<string, unknown>)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8 + sedes.length} className="text-center py-8 text-muted-foreground">
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
            {editingItem && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input
                    value={editingItem.codigo as string}
                    disabled
                    className="bg-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}
            
            {!editingItem && (
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  placeholder="Ingrese el nombre de la herramienta"
                />
                <p className="text-xs text-muted-foreground">El código se generará automáticamente</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción de la herramienta"
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
