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
import { Plus, Pencil, Trash2, Search, Wrench } from 'lucide-react'

async function fetchHerramientas() {
  const res = await fetch('/api/herramientas')
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
    codigo: '',
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

  const { data: herramientas, isLoading } = useQuery({
    queryKey: ['herramientas'],
    queryFn: fetchHerramientas
  })

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: fetchCategorias
  })

  const createMutation = useMutation({
    mutationFn: createHerramienta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herramientas'] })
      setDialogOpen(false)
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: updateHerramienta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herramientas'] })
      setDialogOpen(false)
      resetForm()
    }
  })

  const resetForm = () => {
    setFormData({
      codigo: '',
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
      codigo: item.codigo as string,
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

  const filtered = herramientas?.filter((h: Record<string, unknown>) =>
    (h.codigo as string)?.toLowerCase().includes(search.toLowerCase()) ||
    (h.nombre as string)?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Herramientas</h1>
          <p className="text-muted-foreground">Gestión del catálogo de herramientas y materiales</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Herramienta
        </Button>
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
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Stock Total</TableHead>
                    <TableHead className="text-right">Costo Prom.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
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
                      <TableCell>{(h.categoria as Record<string, unknown>)?.nombre || '-'}</TableCell>
                      <TableCell>{h.unidad as string}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={((h.stockTotal as number) || 0) > 0 ? 'default' : 'destructive'}>
                          {h.stockTotal as number}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        S/ {(h.costoPromedio as number)?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={h.activo ? 'default' : 'secondary'}>
                          {h.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
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
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  required
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
