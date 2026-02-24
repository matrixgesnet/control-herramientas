import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { db } from './db'
import { PrismaClient } from '@prisma/client'

// Obtener la sesión actual del usuario
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

// Verificar si el usuario tiene un rol específico
export async function hasRole(role: string | string[]) {
  const user = await getCurrentUser()
  if (!user) return false
  
  if (Array.isArray(role)) {
    return role.includes(user.role)
  }
  return user.role === role
}

// Verificar si el usuario puede acceder a una sede específica
export async function canAccessSede(sedeId: string) {
  const user = await getCurrentUser()
  if (!user) return false
  
  // Admin y supervisor pueden acceder a todas las sedes
  if (user.role === 'admin' || user.role === 'supervisor') {
    return true
  }
  
  // Los encargados de almacén solo pueden acceder a su sede asignada
  return user.sedeId === sedeId
}

// Obtener las sedes a las que el usuario tiene acceso
export async function getAccessibleSedes() {
  const user = await getCurrentUser()
  if (!user) return []
  
  if (user.role === 'admin' || user.role === 'supervisor') {
    return db.sede.findMany({ where: { activo: true } })
  }
  
  if (user.sedeId) {
    return db.sede.findMany({ where: { id: user.sedeId, activo: true } })
  }
  
  return []
}

// Generar número de movimiento automático
export async function generateMovimientoNumero(tipo: string) {
  const year = new Date().getFullYear()
  const prefix = tipo.substring(0, 3).toUpperCase()
  
  const lastMovimiento = await db.movimiento.findFirst({
    where: {
      numero: { startsWith: `${prefix}-${year}-` }
    },
    orderBy: { numero: 'desc' }
  })
  
  let nextNumber = 1
  if (lastMovimiento) {
    const parts = lastMovimiento.numero.split('-')
    if (parts.length === 3) {
      nextNumber = parseInt(parts[2]) + 1
    }
  }
  
  return `${prefix}-${year}-${nextNumber.toString().padStart(6, '0')}`
}

// Generar números para transferencia (SALIDA + INGRESO)
export async function generateMovimientoNumeroTransferencia(tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'> = db) {
  const year = new Date().getFullYear()
  
  // Buscar el último número de transferencia
  const lastTransferencia = await tx.movimiento.findFirst({
    where: {
      OR: [
        { numero: { startsWith: `TRA-${year}-` } },
        { numero: { contains: `-S-` } },
        { numero: { contains: `-I-` } }
      ]
    },
    orderBy: { numero: 'desc' }
  })
  
  let nextNumber = 1
  if (lastTransferencia) {
    // Extraer el número base (sin el sufijo -S o -I)
    const match = lastTransferencia.numero.match(/TRA-\d{4}-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1]) + 1
    }
  }
  
  const baseNumber = nextNumber.toString().padStart(6, '0')
  
  return {
    salida: `TRA-${year}-${baseNumber}-S`,   // Salida de sede origen
    ingreso: `TRA-${year}-${baseNumber}-I`   // Ingreso a sede destino
  }
}

// Calcular costo promedio ponderado
export function calculateCostoPromedio(
  stockActual: number,
  costoPromedioActual: number,
  cantidadIngreso: number,
  costoUnitarioIngreso: number
): number {
  if (stockActual === 0) {
    return costoUnitarioIngreso
  }
  
  const valorActual = stockActual * costoPromedioActual
  const valorIngreso = cantidadIngreso * costoUnitarioIngreso
  const nuevoStock = stockActual + cantidadIngreso
  
  if (nuevoStock === 0) return costoPromedioActual
  
  return (valorActual + valorIngreso) / nuevoStock
}

