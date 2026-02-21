'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { Plus, Pencil, Search, Users, Wrench } from 'lucide-react'

async function fetchTecnicos() {
  const res = await fetch('/api/tecnicos')
  if (!res.ok) throw new Error('Error al cargar técnicos')
  return res.json()
}

async function fetchSedes() {
  const res = await fetch('/api/sedes')
  if (!res.ok) throw new Error('Error al cargar sedes')
  return res.json()
}

async function createTecnico(data: Record<string, unknown>) {
  const res = await fetch('/api/tecnicos', {
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

async function updateTecnico(data: Record<string, unknown>) {
  const res = await fetch('/api/tecnicos', {
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

export function TecnicosPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState({
    dni: '',
    nombre: '',
    apellido: '',
    telefono: '',
    sedeId: '',
    numeroCuadrilla: '',
    fechaIngreso: new Date().toISOString().split('T')[0]
  })

  const { data: tecnicos, isLoading } = useQuery({
    queryKey: ['tecnicos'],
    queryFn: fetchTecnicos
  })

  const { data: sedes } = useQuery({
    queryKey: ['sedes'],
    queryFn: fetchSedes
  })

  const createMutation = useMutation({
    mutationFn: createTecnico,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tecnicos'] })
      setDialogOpen(false)
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: updateTecnico,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tecnicos'] })
      setDialogOpen(false)
      resetForm()
    }
  })

  const resetForm = () => {
    setFormData({
      dni: '',
      nombre: '',
      apellido: '',
      telefono: '',
      sedeId: '',
      numeroCuadrilla: '',
      fechaIngreso: new Date().toISOString().split('T')[0]
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
      dni: item.dni as string,
      nombre: item.nombre as string,
      apellido: (item.apellido as string) || '',
      telefono: (item.telefono as string) || '',
      sedeId: item.sedeId as string,
      numeroCuadrilla: (item.numeroCuadrilla as string) || '',
      fechaIngreso: new Date(item.fechaIngreso as string).toISOString().split('T')[0]
    })
    setDialogOpen(true)
  }

  const filtered = tecnicos?.filter((t: Record<string, unknown>) =>
    (t.dni as string)?.includes(search) ||
    (t.nombre as string)?.toLowerCase().includes(search.toLowerCase()) ||
    (t.apellido as string)?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Técnicos</h1>
          <p className="text-muted-foreground">Gestión de técnicos y sus asignaciones</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Técnico
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por DNI o nombre..."
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
                    <TableHead>DNI</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Cuadrilla</TableHead>
                    <TableHead className="text-center">Herramientas Asignadas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((t: Record<string, unknown>) => {
                    const asignaciones = (t.asignaciones as Record<string, unknown>[]) || []
                    const totalHerramientas = asignaciones.reduce((sum, a) => sum + ((a.cantidad as number) || 0), 0)
                    
                    return (
                      <TableRow key={t.id as string}>
                        <TableCell className="font-mono">{t.dni as string}</TableCell>
                        <TableCell>
                          <p className="font-medium">{t.nombre as string} {t.apellido as string}</p>
                        </TableCell>
                        <TableCell>{(t.telefono as string) || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{(t.sede as Record<string, unknown>)?.nombre as string}</Badge>
                        </TableCell>
                        <TableCell>{(t.numeroCuadrilla as string) || '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-100 text-blue-700">
                            {totalHerramientas} items
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.activo ? 'default' : 'secondary'}>
                            {t.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filtered?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        No se encontraron técnicos
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Técnico' : 'Nuevo Técnico'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>DNI *</Label>
                <Input
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  required
                  maxLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sede *</Label>
                <Select value={formData.sedeId} onValueChange={(v) => setFormData({ ...formData, sedeId: v })}>
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
              <div className="space-y-2">
                <Label>Número Cuadrilla</Label>
                <Input
                  value={formData.numeroCuadrilla}
                  onChange={(e) => setFormData({ ...formData, numeroCuadrilla: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fecha de Ingreso</Label>
              <Input
                type="date"
                value={formData.fechaIngreso}
                onChange={(e) => setFormData({ ...formData, fechaIngreso: e.target.value })}
              />
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
