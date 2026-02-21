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
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Search, Building2 } from 'lucide-react'

async function fetchSedes() {
  const res = await fetch('/api/sedes')
  if (!res.ok) throw new Error('Error al cargar sedes')
  return res.json()
}

async function createSede(data: Record<string, unknown>) {
  const res = await fetch('/api/sedes', {
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

export function SedesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: ''
  })

  const { data: sedes, isLoading } = useQuery({
    queryKey: ['sedes'],
    queryFn: fetchSedes
  })

  const createMutation = useMutation({
    mutationFn: createSede,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sedes'] })
      setDialogOpen(false)
      setFormData({ nombre: '', direccion: '', telefono: '' })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const filtered = sedes?.filter((s: Record<string, unknown>) =>
    (s.nombre as string)?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sedes / Almacenes</h1>
          <p className="text-muted-foreground">Gestión de sedes y almacenes de la empresa</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Sede
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar sede..."
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
                    <TableHead>Nombre</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-center">Items en Stock</TableHead>
                    <TableHead className="text-center">Técnicos</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((s: Record<string, unknown>) => {
                    const count = s._count as Record<string, number>
                    return (
                      <TableRow key={s.id as string}>
                        <TableCell className="font-medium">{s.nombre as string}</TableCell>
                        <TableCell>{(s.direccion as string) || '-'}</TableCell>
                        <TableCell>{(s.telefono as string) || '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{count?.stocks || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{count?.tecnicos || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.activo ? 'default' : 'secondary'}>
                            {s.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filtered?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        No se encontraron sedes
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Sede</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
