import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Reportes varios
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') // stock-total, stock-sede, tecnicos-asignaciones

    switch (tipo) {
      case 'stock-total': {
        // Stock total de todas las herramientas
        const herramientas = await db.herramienta.findMany({
          where: { activo: true, controlaStock: true },
          include: {
            categoria: true,
            stocks: {
              include: { sede: true }
            }
          },
          orderBy: { codigo: 'asc' }
        })

        const reporte = herramientas.map(h => {
          const stockTotal = h.stocks.reduce((sum, s) => sum + s.cantidad, 0)
          const valorTotal = h.stocks.reduce((sum, s) => sum + (s.cantidad * s.costoPromedio), 0)

          return {
            codigo: h.codigo,
            nombre: h.nombre,
            unidad: h.unidad,
            categoria: h.categoria?.nombre,
            stockTotal,
            costoPromedio: h.costoPromedio,
            valorTotal,
            stockPorSede: h.stocks.map(s => ({
              sede: s.sede.nombre,
              cantidad: s.cantidad,
              costoPromedio: s.costoPromedio,
              valor: s.cantidad * s.costoPromedio
            }))
          }
        })

        return NextResponse.json(reporte)
      }

      case 'stock-sede': {
        // Stock por sede específica
        const sedeId = searchParams.get('sedeId')
        if (!sedeId) {
          return NextResponse.json({ error: 'sedeId es requerido' }, { status: 400 })
        }

        const stock = await db.stock.findMany({
          where: { sedeId },
          include: {
            herramienta: {
              include: { categoria: true }
            },
            sede: true
          },
          orderBy: { herramienta: { codigo: 'asc' } }
        })

        const reporte = stock.map(s => ({
          codigo: s.herramienta.codigo,
          nombre: s.herramienta.nombre,
          unidad: s.herramienta.unidad,
          categoria: s.herramienta.categoria?.nombre,
          cantidad: s.cantidad,
          costoPromedio: s.costoPromedio,
          valorTotal: s.cantidad * s.costoPromedio,
          stockMinimo: s.herramienta.stockMinimo,
          stockMaximo: s.herramienta.stockMaximo,
          estadoStock: s.herramienta.stockMinimo && s.cantidad < s.herramienta.stockMinimo 
            ? 'bajo' 
            : s.herramienta.stockMaximo && s.cantidad > s.herramienta.stockMaximo 
              ? 'alto' 
              : 'normal'
        }))

        return NextResponse.json({
          sede: stock[0]?.sede.nombre || 'Sede',
          items: reporte
        })
      }

      case 'tecnicos-asignaciones': {
        // Herramientas asignadas a técnicos
        const sedeId = searchParams.get('sedeId')
        
        const where: Record<string, unknown> = { activo: true }
        if (sedeId) {
          where.sedeId = sedeId
        }

        const tecnicos = await db.tecnico.findMany({
          where,
          include: {
            sede: true,
            asignaciones: {
              where: { estado: 'asignado' },
              include: {
                herramienta: { include: { categoria: true } }
              }
            }
          },
          orderBy: [{ nombre: 'asc' }]
        })

        const reporte = tecnicos.map(t => ({
          dni: t.dni,
          nombre: `${t.nombre} ${t.apellido || ''}`.trim(),
          sede: t.sede.nombre,
          numeroCuadrilla: t.numeroCuadrilla,
          totalHerramientas: t.asignaciones.reduce((sum, a) => sum + a.cantidad, 0),
          herramientas: t.asignaciones.map(a => ({
            codigo: a.herramienta.codigo,
            nombre: a.herramienta.nombre,
            cantidad: a.cantidad,
            fechaAsignacion: a.fechaAsignacion,
            serial: a.serial,
            categoria: a.herramienta.categoria?.nombre
          }))
        }))

        return NextResponse.json(reporte)
      }

      case 'alertas-stock': {
        // Herramientas con stock bajo
        const herramientas = await db.herramienta.findMany({
          where: { 
            activo: true, 
            controlaStock: true,
            stockMinimo: { not: null }
          },
          include: {
            categoria: true,
            stocks: { include: { sede: true } }
          }
        })

        const alertas = herramientas
          .map(h => {
            const stockTotal = h.stocks.reduce((sum, s) => sum + s.cantidad, 0)
            return {
              codigo: h.codigo,
              nombre: h.nombre,
              stockActual: stockTotal,
              stockMinimo: h.stockMinimo,
              diferencia: stockTotal - (h.stockMinimo || 0),
              porcentaje: h.stockMinimo ? (stockTotal / h.stockMinimo * 100) : 100
            }
          })
          .filter(h => h.stockActual < (h.stockMinimo || 0))

        return NextResponse.json(alertas)
      }

      default:
        return NextResponse.json({ error: 'Tipo de reporte no válido' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error al generar reporte:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
