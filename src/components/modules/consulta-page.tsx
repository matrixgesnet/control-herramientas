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
import { 
  Search, User, ArrowUpRight, ArrowDownRight, Clock, 
  CheckCircle, Package, Phone, Building2, Users
} from 'lucide-react'

async function fetchTecnicos() {
  const res = await fetch('/api/tecnicos')
  if (!res.ok) throw new Error('Error al cargar técnicos')
  return res.json()
}

async function fetchConsulta(tecnicoId: string) {
  const res = await fetch(`/api/consulta?tecnicoId=${tecnicoId}`)
  if (!res.ok) throw new Error('Error al cargar consulta')
  return res.json()
}

export function ConsultaPage() {
  const [tecnicoId, setTecnicoId] = useState('')
  const [searchTecnico, setSearchTecnico] = useState('')
  const [dniBusqueda, setDniBusqueda] = useState('')

  const { data: tecnicos } = useQuery({ 
    queryKey: ['tecnicos'], 
    queryFn: fetchTecnicos 
  })

  const { data: consultaData, isLoading: consultaLoading, refetch } = useQuery({
    queryKey: ['consulta', tecnicoId],
    queryFn: () => fetchConsulta(tecnicoId),
    enabled: !!tecnicoId
  })

  const filteredTecnicos = tecnicos?.filter((t: Record<string, unknown>) =>
    (t.dni as string)?.includes(searchTecnico) ||
    (t.nombre as string)?.toLowerCase().includes(searchTecnico.toLowerCase()) ||
    (t.apellido as string)?.toLowerCase().includes(searchTecnico.toLowerCase())
  )

  const buscarPorDni = () => {
    const tecnico = tecnicos?.find((t: Record<string, unknown>) => t.dni === dniBusqueda)
    if (tecnico) {
      setTecnicoId(tecnico.id as string)
    }
  }

  const { tecnico, resumen, pendientes, devueltas, historial } = consultaData || {}

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Consulta de Técnico</h1>
        <p className="text-muted-foreground">Busca un técnico para ver su historial de asignaciones y devoluciones</p>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buscar Técnico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Buscar por nombre */}
            <div className="space-y-2">
              <Label>Buscar por Nombre o DNI</Label>
              <Select value={tecnicoId} onValueChange={setTecnicoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar técnico..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Buscar..."
                      value={searchTecnico}
                      onChange={(e) => setSearchTecnico(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredTecnicos?.map((t: Record<string, unknown>) => (
                      <SelectItem key={t.id as string} value={t.id as string}>
                        {t.dni as string} - {t.nombre as string} {t.apellido as string}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Buscar directamente por DNI */}
            <div className="space-y-2">
              <Label>O buscar por DNI exacto</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: 12345678"
                  value={dniBusqueda}
                  onChange={(e) => setDniBusqueda(e.target.value)}
                  maxLength={8}
                />
                <Button onClick={buscarPorDni} variant="secondary">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Botón consultar */}
            <div className="flex items-end">
              <Button 
                onClick={() => refetch()} 
                disabled={!tecnicoId}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                <Search className="w-4 h-4 mr-2" />
                Consultar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {consultaLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-muted-foreground">Cargando información...</p>
          </CardContent>
        </Card>
      )}

      {tecnico && !consultaLoading && (
        <div className="space-y-6">
          {/* Información del Técnico */}
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {tecnico.nombre} {tecnico.apellido}
                    </h2>
                    <p className="text-muted-foreground">DNI: {tecnico.dni}</p>
                  </div>
                </div>
                <Badge variant={tecnico.activo ? 'default' : 'secondary'} className="text-sm">
                  {tecnico.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{tecnico.telefono || 'Sin teléfono'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>{tecnico.sede?.nombre || 'Sin sede'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>Cuadrilla: {tecnico.numeroCuadrilla || '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Recibido</p>
                    <p className="text-2xl font-bold">{resumen?.totalPendiente + resumen?.totalDevuelto || 0}</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pendiente por Devolver</p>
                    <p className="text-2xl font-bold text-orange-600">{resumen?.totalPendiente || 0}</p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Devuelto</p>
                    <p className="text-2xl font-bold text-green-600">{resumen?.totalDevuelto || 0}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tipos de Herramientas</p>
                    <p className="text-2xl font-bold">{pendientes?.length || 0}</p>
                  </div>
                  <Package className="w-8 h-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Herramientas Pendientes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Herramientas Pendientes por Devolver ({pendientes?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendientes?.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-orange-50">
                        <TableHead>Código</TableHead>
                        <TableHead>Herramienta</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead>Fecha Asignación</TableHead>
                        <TableHead>Serial</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendientes?.map((p: Record<string, unknown>) => (
                        <TableRow key={p.id as string}>
                          <TableCell className="font-mono">{p.codigo}</TableCell>
                          <TableCell className="font-medium">{p.nombre}</TableCell>
                          <TableCell>{p.categoria || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-orange-100 text-orange-700">{p.cantidad}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(p.fechaAsignacion as string).toLocaleDateString('es-ES')}
                          </TableCell>
                          <TableCell>{p.serial || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No tiene herramientas pendientes por devolver</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial de Movimientos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Historial de Movimientos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historial?.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Herramienta</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead>Sede</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historial?.map((h: Record<string, unknown>, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="text-sm">
                            {new Date(h.fecha as string).toLocaleDateString('es-ES')}
                          </TableCell>
                          <TableCell>
                            {h.tipo === 'SALIDA' ? (
                              <Badge className="bg-orange-100 text-orange-700 flex items-center gap-1 w-fit">
                                <ArrowUpRight className="w-3 h-3" />
                                Salida
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                                <ArrowDownRight className="w-3 h-3" />
                                Devolución
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{h.numero}</TableCell>
                          <TableCell className="font-mono">{h.codigo}</TableCell>
                          <TableCell className="font-medium">{h.herramienta}</TableCell>
                          <TableCell className="text-center">{h.cantidad}</TableCell>
                          <TableCell>{h.sede}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay movimientos registrados</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Herramientas Devueltas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Herramientas Devueltas ({devueltas?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {devueltas?.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-green-50">
                        <TableHead>Código</TableHead>
                        <TableHead>Herramienta</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead>Fecha Asignación</TableHead>
                        <TableHead>Fecha Devolución</TableHead>
                        <TableHead>Observaciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devueltas?.map((d: Record<string, unknown>) => (
                        <TableRow key={d.id as string}>
                          <TableCell className="font-mono">{d.codigo}</TableCell>
                          <TableCell className="font-medium">{d.nombre}</TableCell>
                          <TableCell>{d.categoria || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-700">{d.cantidad}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(d.fechaAsignacion as string).toLocaleDateString('es-ES')}
                          </TableCell>
                          <TableCell>
                            {d.fechaDevolucion 
                              ? new Date(d.fechaDevolucion as string).toLocaleDateString('es-ES')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {d.observaciones || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay herramientas devueltas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!tecnico && !consultaLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Seleccione un técnico</p>
            <p className="text-sm">Busque por nombre, DNI o seleccione de la lista</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}