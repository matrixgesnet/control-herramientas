'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import { 
  Plus, Search, ShoppingCart, ArrowRightLeft, UserMinus, RotateCcw, Trash2, 
  AlertTriangle, Pencil, XCircle, Eye, EyeOff
} from 'lucide-react'

async function fetchMovimientos(incluirAnulados: boolean) {
  const params = new URLSearchParams()
  if (incluirAnulados) params.append('incluirAnulados', 'true')
  const res = await fetch(`/api/movimientos?${params}`)
  if (!res.ok) throw new Error('Error al cargar movimientos')
  return res.json()
}

async function fetchSedes() {
  const res = await fetch('/api/sedes')
  if (!res.ok) throw new Error('Error al cargar sedes')
  return res.json()
}

async function fetchTecnicos() {
  const res = await fetch('/api/tecnicos')
  if (!res.ok) throw new Error('Error al cargar técnicos')
  return res.json()
}

async function fetchHerramientas() {
  const res = await fetch('/api/herramientas')
  if (!res.ok) throw new Error('Error al cargar herramientas')
  return res.json()
}

async function createMovimiento(data: Record<string, unknown>) {
  const res = await fetch('/api/movimientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al crear movimiento')
  }
  return res.json()
}

async function anularMovimiento(id: string, motivoAnulacion: string) {
  const res = await fetch('/api/movimientos', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, accion: 'anular', motivoAnulacion })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al anular')
  }
  return res.json()
}

async function editarMovimiento(id: string, data: Record<string, unknown>) {
  const res = await fetch('/api/movimientos', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, accion: 'editar', ...data })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al editar')
  }
  return res.json()
}

async function eliminarMovimiento(id: string) {
  const res = await fetch(`/api/movimientos?id=${id}`, {
    method: 'DELETE'
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al eliminar')
  }
  return res.json()
}

const tipoLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  COMPRA: { label: 'Compra', color: 'bg-green-100 text-green-700', icon: <ShoppingCart className="w-4 h-4" /> },
  TRANSFERENCIA: { label: 'Transferencia', color: 'bg-blue-100 text-blue-700', icon: <ArrowRightLeft className="w-4 h-4" /> },
  SALIDA: { label: 'Salida a Técnico', color: 'bg-orange-100 text-orange-700', icon: <UserMinus className="w-4 h-4" /> },
  DEVOLUCION_TECNICO: { label: 'Devolución Técnico', color: 'bg-purple-100 text-purple-700', icon: <RotateCcw className="w-4 h-4" /> },
  BAJA: { label: 'Baja', color: 'bg-red-100 text-red-700', icon: <Trash2 className="w-4 h-4" /> }
}

// Fecha máxima: hoy
const getMaxFecha = () => {
  const hoy = new Date()
  return hoy.toISOString().split('T')[0]
}

// Fecha mínima: hace un mes
const getMinFecha = () => {
  const fecha = new Date()
  fecha.setMonth(fecha.getMonth() - 1)
  return fecha.toISOString().split('T')[0]
}

export function MovimientosPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [incluirAnulados, setIncluirAnulados] = useState(false)
  
  // Dialog crear/editar
  const [dialogOpen, setDialogOpen] = useState(false)
  const [movimientoTipo, setMovimientoTipo] = useState<string>('COMPRA')
  const [formData, setFormData] = useState({
    sedeOrigenId: '',
    sedeDestinoId: '',
    tecnicoId: '',
    proveedor: '',
    comprobante: '',
    observaciones: '',
    fecha: new Date().toISOString().split('T')[0],
    items: [{ herramientaId: '', cantidad: '', costoUnitario: '' }]
  })

  // Dialog anular
  const [dialogAnularOpen, setDialogAnularOpen] = useState(false)
  const [movimientoAnular, setMovimientoAnular] = useState<Record<string, unknown> | null>(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')

  // Dialog editar
  const [dialogEditarOpen, setDialogEditarOpen] = useState(false)
  const [movimientoEditar, setMovimientoEditar] = useState<Record<string, unknown> | null>(null)
  const [editarData, setEditarData] = useState<{
  fecha: string
  proveedor: string
  comprobante: string
  observaciones: string
  items?: { herramientaId: string; cantidad: string; costoUnitario: string; serial?: string }[]
}>({
  fecha: '',
  proveedor: '',
  comprobante: '',
  observaciones: '',
  items: []
})

  // Dialog eliminar
  const [dialogEliminarOpen, setDialogEliminarOpen] = useState(false)
  const [movimientoEliminar, setMovimientoEliminar] = useState<Record<string, unknown> | null>(null)

  const { data: movimientos, isLoading } = useQuery({
    queryKey: ['movimientos', incluirAnulados],
    queryFn: () => fetchMovimientos(incluirAnulados)
  })

  const { data: sedes } = useQuery({ queryKey: ['sedes'], queryFn: fetchSedes })
  const { data: tecnicos } = useQuery({ queryKey: ['tecnicos'], queryFn: fetchTecnicos })
  const { data: herramientas } = useQuery({ queryKey: ['herramientas'], queryFn: fetchHerramientas })

  const createMutation = useMutation({
    mutationFn: createMovimiento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['herramientas'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
      resetForm()
    }
  })

  const anularMutation = useMutation({
    mutationFn: (data: { id: string; motivo: string }) => anularMovimiento(data.id, data.motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['herramientas'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogAnularOpen(false)
      setMovimientoAnular(null)
      setMotivoAnulacion('')
    }
  })

  const editarMutation = useMutation({
    mutationFn: (data: { id: string; data: Record<string, unknown> }) => editarMovimiento(data.id, data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      setDialogEditarOpen(false)
      setMovimientoEditar(null)
    }
  })

  const eliminarMutation = useMutation({
    mutationFn: eliminarMovimiento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['herramientas'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogEliminarOpen(false)
      setMovimientoEliminar(null)
    }
  })

  const resetForm = () => {
    setFormData({
      sedeOrigenId: '',
      sedeDestinoId: '',
      tecnicoId: '',
      proveedor: '',
      comprobante: '',
      observaciones: '',
      fecha: new Date().toISOString().split('T')[0],
      items: [{ herramientaId: '', cantidad: '', costoUnitario: '' }]
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      tipo: movimientoTipo,
      ...formData,
      items: formData.items.filter(i => i.herramientaId && i.cantidad)
    })
  }

  const handleAnular = () => {
    if (movimientoAnular && motivoAnulacion.trim()) {
      anularMutation.mutate({ id: movimientoAnular.id as string, motivo: motivoAnulacion })
    }
  }

  const handleEditar = () => {
    if (movimientoEditar) {
      editarMutation.mutate({ 
        id: movimientoEditar.id as string, 
        data: editarData 
      })
    }
  }

  const handleEliminar = () => {
    if (movimientoEliminar) {
      eliminarMutation.mutate(movimientoEliminar.id as string)
    }
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { herramientaId: '', cantidad: '', costoUnitario: '' }]
    })
  }

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setFormData({ ...formData, items: newItems })
  }

  const filtered = movimientos?.filter((m: Record<string, unknown>) =>
    (m.numero as string)?.toLowerCase().includes(search.toLowerCase()) ||
    (m.tipo as string)?.toLowerCase().includes(search.toLowerCase())
  )

  const openNewMovimiento = (tipo: string) => {
    setMovimientoTipo(tipo)
    resetForm()
    setDialogOpen(true)
  }

  const openEditar = (mov: Record<string, unknown>) => {
  setMovimientoEditar(mov)
  setEditarData({
    fecha: new Date(mov.fecha as string).toISOString().split('T')[0],
    proveedor: (mov.proveedor as string) || '',
    comprobante: (mov.comprobante as string) || '',
    observaciones: (mov.observaciones as string) || '',
    items: ((mov.items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>) => ({
      herramientaId: item.herramientaId as string,
      cantidad: (item.cantidad as number).toString(),
      costoUnitario: (item.costoUnitario as number).toString(),
      serial: (item.serial as string) || ''
    }))
  })
  setDialogEditarOpen(true)
}

  const openAnular = (mov: Record<string, unknown>) => {
    setMovimientoAnular(mov)
    setMotivoAnulacion('')
    setDialogAnularOpen(true)
  }

  const openEliminar = (mov: Record<string, unknown>) => {
    setMovimientoEliminar(mov)
    setDialogEliminarOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Movimientos</h1>
          <p className="text-muted-foreground">Registro de entradas, salidas y transferencias</p>
        </div>
      </div>

      {/* Botones de acción rápida */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Button onClick={() => openNewMovimiento('COMPRA')} className="bg-green-600 hover:bg-green-700">
          <ShoppingCart className="w-4 h-4 mr-2" />
          Compra
        </Button>
        <Button onClick={() => openNewMovimiento('TRANSFERENCIA')} className="bg-blue-600 hover:bg-blue-700">
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          Transferencia
        </Button>
        <Button onClick={() => openNewMovimiento('SALIDA')} className="bg-orange-600 hover:bg-orange-700">
          <UserMinus className="w-4 h-4 mr-2" />
          Salida
        </Button>
        <Button onClick={() => openNewMovimiento('DEVOLUCION_TECNICO')} className="bg-purple-600 hover:bg-purple-700">
          <RotateCcw className="w-4 h-4 mr-2" />
          Devolución
        </Button>
        <Button onClick={() => openNewMovimiento('BAJA')} className="bg-red-600 hover:bg-red-700">
          <Trash2 className="w-4 h-4 mr-2" />
          Baja
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar movimiento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="incluirAnulados"
                checked={incluirAnulados}
                onCheckedChange={(checked) => setIncluirAnulados(checked as boolean)}
              />
              <label htmlFor="incluirAnulados" className="text-sm flex items-center gap-1 cursor-pointer">
                {incluirAnulados ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Ver anulados
              </label>
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
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origen/Destino</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((m: Record<string, unknown>) => {
                    const items = (m.items as Record<string, unknown>[]) || []
                    const montoTotal = items.reduce((sum, i) => sum + ((i.costoTotal as number) || 0), 0)
                    const tipoInfo = tipoLabels[m.tipo as string]
                    const esAnulado = m.anulado as boolean
                    
                    return (
                      <TableRow key={m.id as string} className={esAnulado ? 'bg-red-50 opacity-70' : ''}>
                        <TableCell className="font-mono font-medium">
                          {m.numero as string}
                          {esAnulado && (
                            <Badge className="ml-2 bg-red-100 text-red-700">ANULADO</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(m.fecha as string).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell>
                          <Badge className={tipoInfo?.color || ''}>
                            {tipoInfo?.icon}
                            <span className="ml-1">{tipoInfo?.label || m.tipo}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(m.sedeOrigen as Record<string, unknown>)?.nombre && (
                            <span className="text-muted-foreground">{(m.sedeOrigen as Record<string, unknown>).nombre as string} → </span>
                          )}
                          {(m.sedeDestino as Record<string, unknown>)?.nombre as string}
                        </TableCell>
                        <TableCell>
                          {(m.tecnico as Record<string, unknown>)?.nombre ? 
                            `${(m.tecnico as Record<string, unknown>).nombre as string} ${(m.tecnico as Record<string, unknown>).apellido as string}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">{items.length}</TableCell>
                        <TableCell className="text-right font-medium">
                          S/ {montoTotal.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {esAnulado ? (
                            <div className="text-xs text-red-600">
                              <p>Anulado: {m.motivoAnulacion ? (m.motivoAnulacion as string).substring(0, 20) + '...' : '-'}</p>
                              <p className="text-muted-foreground">
                                Por: {(m.anuladoPor as Record<string, unknown>)?.name as string}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="default" className="bg-green-100 text-green-700">Activo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!esAnulado && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => openEditar(m)}
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => openAnular(m)}
                                  className="text-orange-600 hover:text-orange-700"
                                  title="Anular"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {session?.user?.role === 'admin' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openEliminar(m)}
                                className="text-red-600 hover:text-red-700"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filtered?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No se encontraron movimientos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear movimiento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tipoLabels[movimientoTipo]?.icon}
              Nuevo Movimiento: {tipoLabels[movimientoTipo]?.label}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo de fecha */}
            <div className="space-y-2">
              <Label>Fecha del Movimiento *</Label>
              <Input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                max={getMaxFecha()}
                min={getMinFecha()}
                required
              />
              <p className="text-xs text-muted-foreground">
                La fecha debe estar entre hace un mes y hoy
              </p>
            </div>

            {/* Campos según el tipo */}
            {movimientoTipo === 'COMPRA' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sede Destino *</Label>
                  <Select value={formData.sedeDestinoId} onValueChange={(v) => setFormData({ ...formData, sedeDestinoId: v })}>
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
                  <Label>Proveedor</Label>
                  <Input
                    value={formData.proveedor}
                    onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                  />
                </div>
              </div>
            )}

            {movimientoTipo === 'TRANSFERENCIA' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sede Origen *</Label>
                  <Select value={formData.sedeOrigenId} onValueChange={(v) => setFormData({ ...formData, sedeOrigenId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
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
                  <Label>Sede Destino *</Label>
                  <Select value={formData.sedeDestinoId} onValueChange={(v) => setFormData({ ...formData, sedeDestinoId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
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
            )}

            {movimientoTipo === 'SALIDA' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sede Origen *</Label>
                  <Select value={formData.sedeOrigenId} onValueChange={(v) => setFormData({ ...formData, sedeOrigenId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
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
                  <Label>Técnico *</Label>
                  <Select value={formData.tecnicoId} onValueChange={(v) => setFormData({ ...formData, tecnicoId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tecnicos?.filter((t: Record<string, unknown>) => t.activo).map((t: Record<string, unknown>) => (
                        <SelectItem key={t.id as string} value={t.id as string}>
                          {t.nombre as string} {t.apellido as string} - {t.dni as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {movimientoTipo === 'DEVOLUCION_TECNICO' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Técnico *</Label>
                  <Select value={formData.tecnicoId} onValueChange={(v) => setFormData({ ...formData, tecnicoId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tecnicos?.filter((t: Record<string, unknown>) => t.activo).map((t: Record<string, unknown>) => (
                        <SelectItem key={t.id as string} value={t.id as string}>
                          {t.nombre as string} {t.apellido as string} - {t.dni as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sede Destino *</Label>
                  <Select value={formData.sedeDestinoId} onValueChange={(v) => setFormData({ ...formData, sedeDestinoId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
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
            )}

            {movimientoTipo === 'BAJA' && (
              <div className="space-y-2">
                <Label>Sede Origen *</Label>
                <Select value={formData.sedeOrigenId} onValueChange={(v) => setFormData({ ...formData, sedeOrigenId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
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

            <div className="space-y-2">
              <Label>Comprobante</Label>
              <Input
                value={formData.comprobante}
                onChange={(e) => setFormData({ ...formData, comprobante: e.target.value })}
                placeholder="Número de factura, guía, etc."
              />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items del Movimiento</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar Item
                </Button>
              </div>
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg">
                    <Select value={item.herramientaId} onValueChange={(v) => updateItem(index, 'herramientaId', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Herramienta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {herramientas?.filter((h: Record<string, unknown>) => h.activo).map((h: Record<string, unknown>) => (
                          <SelectItem key={h.id as string} value={h.id as string}>
                            {h.codigo as string} - {h.nombre as string}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Cantidad"
                      value={item.cantidad}
                      onChange={(e) => updateItem(index, 'cantidad', e.target.value)}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Costo Unit."
                      value={item.costoUnitario}
                      onChange={(e) => updateItem(index, 'costoUnitario', e.target.value)}
                      disabled={movimientoTipo !== 'COMPRA'}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Procesando...' : 'Registrar Movimiento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para anular */}
      <Dialog open={dialogAnularOpen} onOpenChange={setDialogAnularOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Anular Movimiento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Está a punto de anular el movimiento <strong>{movimientoAnular?.numero as string}</strong>.
              Esta acción revertirá todos los cambios de stock.
            </p>
            <div className="space-y-2">
              <Label>Motivo de Anulación *</Label>
              <Textarea
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Ej: Error en el registro, Duplicado, etc."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAnularOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleAnular}
              disabled={!motivoAnulacion.trim() || anularMutation.isPending}
            >
              {anularMutation.isPending ? 'Anulando...' : 'Anular Movimiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar */}
      {/* Dialog para editar */}
<Dialog open={dialogEditarOpen} onOpenChange={setDialogEditarOpen}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Pencil className="w-5 h-5" />
        Editar Movimiento
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Movimiento: <strong>{movimientoEditar?.numero as string}</strong> - 
        Tipo: <strong>{tipoLabels[movimientoEditar?.tipo as string]?.label}</strong>
      </p>
      
      <div className="space-y-2">
        <Label>Fecha</Label>
        <Input
          type="date"
          value={editarData.fecha}
          onChange={(e) => setEditarData({ ...editarData, fecha: e.target.value })}
          max={getMaxFecha()}
          min={getMinFecha()}
        />
      </div>
      
      {movimientoEditar?.tipo === 'COMPRA' && (
        <div className="space-y-2">
          <Label>Proveedor</Label>
          <Input
            value={editarData.proveedor}
            onChange={(e) => setEditarData({ ...editarData, proveedor: e.target.value })}
          />
        </div>
      )}
      
      <div className="space-y-2">
        <Label>Comprobante</Label>
        <Input
          value={editarData.comprobante}
          onChange={(e) => setEditarData({ ...editarData, comprobante: e.target.value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label>Observaciones</Label>
        <Textarea
          value={editarData.observaciones}
          onChange={(e) => setEditarData({ ...editarData, observaciones: e.target.value })}
        />
      </div>

      {/* Items editables */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Items del Movimiento</Label>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => setEditarData({ 
              ...editarData, 
              items: [...(editarData.items || []), { herramientaId: '', cantidad: '', costoUnitario: '' }]
            })}
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar Item
          </Button>
        </div>
        <div className="space-y-2">
          {(editarData.items || [])?.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 p-3 bg-slate-50 rounded-lg items-center">
              <div className="col-span-5">
                <Select 
                  value={item.herramientaId} 
                  onValueChange={(v) => {
                    const newItems = [...(editarData.items || [])]
                    newItems[index] = { ...newItems[index], herramientaId: v }
                    setEditarData({ ...editarData, items: newItems })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Herramienta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {herramientas?.filter((h: Record<string, unknown>) => h.activo).map((h: Record<string, unknown>) => (
                      <SelectItem key={h.id as string} value={h.id as string}>
                        {h.codigo as string} - {h.nombre as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  placeholder="Cantidad"
                  value={item.cantidad}
                  onChange={(e) => {
                    const newItems = [...(editarData.items || [])]
                    newItems[index] = { ...newItems[index], cantidad: e.target.value }
                    setEditarData({ ...editarData, items: newItems })
                  }}
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Costo Unit."
                  value={item.costoUnitario}
                  onChange={(e) => {
                    const newItems = [...(editarData.items || [])]
                    newItems[index] = { ...newItems[index], costoUnitario: e.target.value }
                    setEditarData({ ...editarData, items: newItems })
                  }}
                  disabled={movimientoEditar?.tipo !== 'COMPRA'}
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    const newItems = (editarData.items || []).filter((_, i) => i !== index)
                    setEditarData({ ...editarData, items: newItems })
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDialogEditarOpen(false)}>
        Cancelar
      </Button>
      <Button 
        className="bg-orange-500 hover:bg-orange-600"
        onClick={() => {
          if (movimientoEditar) {
            editarMutation.mutate({ 
              id: movimientoEditar.id as string, 
              data: {
                ...editarData,
                items: editarData.items?.filter(i => i.herramientaId && i.cantidad)
              }
            })
          }
        }}
        disabled={editarMutation.isPending}
      >
        {editarMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* Dialog para eliminar */}
      <Dialog open={dialogEliminarOpen} onOpenChange={setDialogEliminarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Eliminar Movimiento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>¡Advertencia!</strong> Esta acción eliminará permanentemente el movimiento 
                <strong> {movimientoEliminar?.numero as string}</strong> y no se podrá recuperar.
              </p>
              <p className="text-sm text-red-600 mt-2">
                {!movimientoEliminar?.anulado && 
                  "Además, se revertirán todos los cambios de stock asociados."
                }
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogEliminarOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleEliminar}
              disabled={eliminarMutation.isPending}
            >
              {eliminarMutation.isPending ? 'Eliminando...' : 'Eliminar Permanentemente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}