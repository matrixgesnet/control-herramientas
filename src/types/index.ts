// ==================== TIPOS DEL SISTEMA DE CONTROL DE HERRAMIENTAS ====================

// Roles de usuario
export type UserRole = 'admin' | 'supervisor' | 'warehouse'

// Estados de herramientas
export type EstadoHerramienta = 'nuevo' | 'usado' | 'en_mantenimiento'

// Tipos de movimiento
export type TipoMovimiento = 'COMPRA' | 'TRANSFERENCIA' | 'SALIDA' | 'DEVOLUCION' | 'BAJA' | 'DEVOLUCION_TECNICO'

// Estados de asignación
export type EstadoAsignacion = 'asignado' | 'devuelto'

// ==================== INTERFACES ====================

export interface Sede {
  id: string
  nombre: string
  direccion?: string
  telefono?: string
  activo: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Categoria {
  id: string
  nombre: string
  descripcion?: string
  activo: boolean
}

export interface Herramienta {
  id: string
  codigo: string
  nombre: string
  descripcion?: string
  unidad: string
  categoriaId?: string
  categoria?: Categoria
  marca?: string
  modelo?: string
  controlaStock: boolean
  stockMaximo?: number
  stockMinimo?: number
  costoPromedio: number
  activo: boolean
}

export interface Tecnico {
  id: string
  dni: string
  nombre: string
  apellido?: string
  telefono?: string
  sedeId: string
  sede?: Sede
  numeroCuadrilla?: string
  fechaIngreso: Date
  activo: boolean
}

export interface Stock {
  id: string
  sedeId: string
  sede?: Sede
  herramientaId: string
  herramienta?: Herramienta
  cantidad: number
  costoPromedio: number
}

export interface Movimiento {
  id: string
  numero: string
  fecha: Date
  tipo: TipoMovimiento
  sedeOrigenId?: string
  sedeOrigen?: Sede
  sedeDestinoId?: string
  sedeDestino?: Sede
  tecnicoId?: string
  tecnico?: Tecnico
  proveedor?: string
  comprobante?: string
  observaciones?: string
  usuarioId: string
  items: MovimientoItem[]
}

export interface MovimientoItem {
  id: string
  movimientoId: string
  herramientaId: string
  herramienta?: Herramienta
  cantidad: number
  costoUnitario: number
  costoTotal: number
  serial?: string
  estado?: EstadoHerramienta
}

export interface AsignacionTecnico {
  id: string
  tecnicoId: string
  tecnico?: Tecnico
  herramientaId: string
  herramienta?: Herramienta
  sedeId: string
  cantidad: number
  fechaAsignacion: Date
  fechaDevolucion?: Date
  estado: EstadoAsignacion
  serial?: string
  observaciones?: string
}

// ==================== TIPOS PARA FORMULARIOS ====================

export interface HerramientaFormData {
  codigo: string
  nombre: string
  descripcion?: string
  unidad: string
  categoriaId?: string
  marca?: string
  modelo?: string
  controlaStock: boolean
  stockMaximo?: number
  stockMinimo?: number
  activo: boolean
}

export interface TecnicoFormData {
  dni: string
  nombre: string
  apellido?: string
  telefono?: string
  sedeId: string
  numeroCuadrilla?: string
  fechaIngreso: Date
}

export interface MovimientoFormData {
  tipo: TipoMovimiento
  sedeOrigenId?: string
  sedeDestinoId?: string
  tecnicoId?: string
  proveedor?: string
  comprobante?: string
  observaciones?: string
  items: MovimientoItemFormData[]
}

export interface MovimientoItemFormData {
  herramientaId: string
  cantidad: number
  costoUnitario: number
  serial?: string
  estado?: EstadoHerramienta
}

// ==================== TIPOS PARA REPORTES ====================

export interface StockReport {
  herramientaId: string
  codigo: string
  nombre: string
  unidad: string
  categoria?: string
  stockTotal: number
  valorTotal: number
  stockPorSede: StockPorSede[]
}

export interface StockPorSede {
  sedeId: string
  sedeNombre: string
  cantidad: number
  costoPromedio: number
}

export interface KardexEntry {
  fecha: Date
  numeroMovimiento: string
  tipo: TipoMovimiento
  sedeOrigen?: string
  sedeDestino?: string
  tecnico?: string
  proveedor?: string
  comprobante?: string
  ingreso: number
  salida: number
  saldo: number
  costoUnitario: number
  costoTotal: number
  costoPromedio: number
}

export interface TecnicoAsignacionReport {
  tecnicoId: string
  tecnicoNombre: string
  tecnicoDni: string
  sedeNombre: string
  herramientas: HerramientaAsignada[]
}

export interface HerramientaAsignada {
  herramientaId: string
  codigo: string
  nombre: string
  cantidad: number
  fechaAsignacion: Date
  serial?: string
}
