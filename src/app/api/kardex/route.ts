import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

interface KardexEntry {
  fecha: Date
  numeroMovimiento: string
  tipo: string
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

// GET - Obtener Kardex de una herramienta
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const herramientaId = searchParams.get('herramientaId')
    const sedeId = searchParams.get('sedeId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    if (!herramientaId) {
      return NextResponse.json({ error: 'herramientaId es requerido' }, { status: 400 })
    }

    // Obtener la herramienta
    const herramienta = await db.herramienta.findUnique({
      where: { id: herramientaId }
    })

    if (!herramienta) {
      return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 })
    }

    // Construir filtros - SIEMPRE excluir movimientos anulados
    const where: Prisma.MovimientoItemWhereInput = {
      herramientaId,
      movimiento: {
        anulado: false  // No mostrar movimientos anulados
      }
    }

    if (fechaDesde || fechaHasta) {
      (where.movimiento as Prisma.MovimientoWhereInput).fecha = {}
      if (fechaDesde) {
        (where.movimiento as Prisma.MovimientoWhereInput).fecha = {
          ...(where.movimiento as Prisma.MovimientoWhereInput).fecha,
          gte: new Date(fechaDesde)
        }
      }
      if (fechaHasta) {
        (where.movimiento as Prisma.MovimientoWhereInput).fecha = {
          ...(where.movimiento as Prisma.MovimientoWhereInput).fecha,
          lte: new Date(fechaHasta)
        }
      }
    }

    // Obtener todos los items de movimientos de esta herramienta
    const items = await db.movimientoItem.findMany({
      where,
      include: {
        movimiento: {
          include: {
            sedeOrigen: true,
            sedeDestino: true,
            tecnico: true
          }
        }
      },
      orderBy: {
        movimiento: { fecha: 'asc' }
      }
    })

    // Filtrar por sede si se especifica
    const itemsFiltrados = sedeId 
      ? items.filter(item => {
          const mov = item.movimiento
          // Compras hacia esta sede
          if (mov.tipo === 'COMPRA' && mov.sedeDestinoId === sedeId) return true
          // Transferencias SALIDA desde esta sede
          if (mov.tipo === 'TRANSFERENCIA_SALIDA' && mov.sedeOrigenId === sedeId) return true
          // Transferencias INGRESO hacia esta sede
          if (mov.tipo === 'TRANSFERENCIA_INGRESO' && mov.sedeDestinoId === sedeId) return true
          // Transferencias antiguas (sin separar)
          if (mov.tipo === 'TRANSFERENCIA') {
            return mov.sedeOrigenId === sedeId || mov.sedeDestinoId === sedeId
          }
          // Salidas desde esta sede
          if (mov.tipo === 'SALIDA' && mov.sedeOrigenId === sedeId) return true
          // Devoluciones hacia esta sede
          if (mov.tipo === 'DEVOLUCION_TECNICO' && mov.sedeDestinoId === sedeId) return true
          // Bajas desde esta sede
          if (mov.tipo === 'BAJA' && mov.sedeOrigenId === sedeId) return true
          return false
        })
      : items

    // Construir el Kardex
    const kardex: KardexEntry[] = []
    let saldoAcumulado = 0
    let costoPromedioAcumulado = herramienta.costoPromedio

    // Agregar saldo inicial
    kardex.push({
      fecha: new Date(0),
      numeroMovimiento: '',
      tipo: 'SALDO_INICIAL',
      sedeOrigen: '',
      sedeDestino: sedeId ? '' : undefined,
      ingreso: 0,
      salida: 0,
      saldo: 0,
      costoUnitario: 0,
      costoTotal: 0,
      costoPromedio: 0
    })

    for (const item of itemsFiltrados) {
      const mov = item.movimiento
      let ingreso = 0
      let salida = 0
      let sedeOrigen = mov.sedeOrigen?.nombre
      let sedeDestino = mov.sedeDestino?.nombre
      let tipoDisplay = mov.tipo

      switch (mov.tipo) {
        case 'COMPRA':
          ingreso = item.cantidad
          break
        case 'TRANSFERENCIA_SALIDA':
          salida = item.cantidad
          tipoDisplay = 'TRANSF. SALIDA'
          break
        case 'TRANSFERENCIA_INGRESO':
          ingreso = item.cantidad
          tipoDisplay = 'TRANSF. INGRESO'
          break
        case 'TRANSFERENCIA':
          // Transferencia antigua (sin separar)
          if (sedeId) {
            if (mov.sedeDestinoId === sedeId) {
              ingreso = item.cantidad
            } else {
              salida = item.cantidad
            }
          } else {
            // Sin filtro de sede, mostrar como transferencia
            ingreso = item.cantidad // Simplificación para vista general
          }
          break
        case 'SALIDA':
          salida = item.cantidad
          break
        case 'DEVOLUCION_TECNICO':
          ingreso = item.cantidad
          tipoDisplay = 'DEVOLUCIÓN'
          break
        case 'BAJA':
          salida = item.cantidad
          break
      }

      saldoAcumulado += ingreso - salida

      const entry: KardexEntry = {
        fecha: mov.fecha,
        numeroMovimiento: mov.numero,
        tipo: tipoDisplay,
        sedeOrigen,
        sedeDestino,
        tecnico: mov.tecnico ? `${mov.tecnico.nombre} ${mov.tecnico.apellido || ''}`.trim() : undefined,
        proveedor: mov.proveedor || undefined,
        comprobante: mov.comprobante || undefined,
        ingreso,
        salida,
        saldo: saldoAcumulado,
        costoUnitario: item.costoUnitario,
        costoTotal: item.costoTotal,
        costoPromedio: costoPromedioAcumulado
      }

      kardex.push(entry)
    }

    return NextResponse.json({
      herramienta,
      kardex,
      saldoFinal: saldoAcumulado,
      costoPromedioFinal: costoPromedioAcumulado
    })
  } catch (error) {
    console.error('Error al obtener kardex:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
