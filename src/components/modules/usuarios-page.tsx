'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
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
import { Plus, Pencil, Search, Users, UserCheck, UserX, Shield } from 'lucide-react'

async function fetchUsers() {
  const res = await fetch('/api/users')
  if (!res.ok) throw new Error('Error al cargar usuarios')
  return res.json()
}

async function fetchSedes() {
  const res = await fetch('/api/sedes')
  if (!res.ok) throw new Error('Error al cargar sedes')
  return res.json()
}

async function createUser(data: Record<string, unknown>) {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al crear usuario')
  }
  return res.json()
}

async function updateUser(data: Record<string, unknown>) {
  const res = await fetch('/api/users', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al actualizar usuario')
  }
  return res.json()
}

async function deactivateUser(id: string) {
  const res = await fetch(`/api/users?id=${id}`, {
    method: 'DELETE'
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al desactivar usuario')
  }
  return res.json()
}

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrador', color: 'bg-red-100 text-red-700' },
  supervisor: { label: 'Supervisor', color: 'bg-blue-100 text-blue-700' },
  warehouse: { label: 'Encargado Almacén', color: 'bg-green-100 text-green-700' }
}

export function UsuariosPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: '',
    sedeId: '',
    active: true
  })

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers
  })

  const { data: sedes } = useQuery({
    queryKey: ['sedes'],
    queryFn: fetchSedes
  })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDialogOpen(false)
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDialogOpen(false)
      resetForm()
    }
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      password: '',
      role: '',
      sedeId: '',
      active: true
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
      email: item.email as string,
      name: item.name as string,
      password: '',
      role: item.role as string,
      sedeId: (item.sedeId as string) || '',
      active: item.active as boolean
    })
    setDialogOpen(true)
  }

  const openNew = () => {
    resetForm()
    setDialogOpen(true)
  }

  const filtered = users?.filter((u: Record<string, unknown>) =>
    (u.email as string)?.toLowerCase().includes(search.toLowerCase()) ||
    (u.name as string)?.toLowerCase().includes(search.toLowerCase())
  )

  const getRoleBadge = (role: string) => {
    const roleInfo = roleLabels[role] || { label: role, color: '' }
    return <Badge className={roleInfo.color}>{roleInfo.label}</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground">Gestión de usuarios del sistema</p>
        </div>
        <Button onClick={openNew} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Información del usuario actual */}
      <Card className="border-l-4 border-l-orange-500">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sesión actual</p>
              <p className="font-medium">{session?.user?.name}</p>
              <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
            </div>
            <div className="ml-auto">
              {getRoleBadge(session?.user?.role as string)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email o nombre..."
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
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((u: Record<string, unknown>) => (
                    <TableRow key={u.id as string} className={!u.active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{u.name as string}</TableCell>
                      <TableCell>{u.email as string}</TableCell>
                      <TableCell>{getRoleBadge(u.role as string)}</TableCell>
                      <TableCell>
                        {(u.sede as Record<string, unknown>)?.nombre || '-'}
                      </TableCell>
                      <TableCell>
                        {u.active ? (
                          <Badge className="bg-green-100 text-green-700">
                            <UserCheck className="w-3 h-3 mr-1" />
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <UserX className="w-3 h-3 mr-1" />
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(u.createdAt as string).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEdit(u)}
                            disabled={!u.active && u.id !== session?.user?.id}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {u.active && u.id !== session?.user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (confirm('¿Desactivar este usuario?')) {
                                  deactivateMutation.mutate(u.id as string)
                                }
                              }}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        No se encontraron usuarios
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Contraseña {editingItem ? '(dejar vacío para no cambiar)' : '*'}</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingItem}
                placeholder={editingItem ? '••••••••' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v, sedeId: v === 'warehouse' ? formData.sedeId : '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-700 text-xs">Admin</Badge>
                      <span>Administrador</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="supervisor">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700 text-xs">Supervisor</Badge>
                      <span>Supervisor</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="warehouse">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700 text-xs">Almacén</Badge>
                      <span>Encargado de Almacén</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === 'warehouse' && (
              <div className="space-y-2">
                <Label>Sede Asignada *</Label>
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
            )}

            {editingItem && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(v) => setFormData({ ...formData, active: v })}
                />
                <Label>Usuario activo</Label>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingItem ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
