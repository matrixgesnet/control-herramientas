import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Dashboard con estadísticas
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Ejecutar todas las consultas en paralelo
    const [
      totalSedes,
      totalHerramientas,
      totalTecnicos,
      totalMovimientos,
      stockPorSede,
      ultimosMovimientos,
      alertasStock,
      asignacionesActivas
    ] = await Promise.all([
      // Total de sedes activas
      db.sede.count({ where: { activo: true } }),
      
      // Total de herramientas activas
      db.herramienta.count({ where: { activo: true } }),
      
      // Total de técnicos activos
      db.tecnico.count({ where: { activo: true } }),
      
      // Total de movimientos
      db.movimiento.count(),
      
      // Stock por sede
      db.stock.groupBy({
        by: ['sedeId'],
        _sum: {
          cantidad: true
        }
      }),
      
      // Últimos 5 movimientos
      db.movimiento.findMany({
        take: 5,
        orderBy: { fecha: 'desc' },
        include: {
          sedeOrigen: true,
          sedeDestino: true,
          tecnico: true,
          items: { include: { herramienta: true } }
        }
      }),
      
      // Herramientas con stock bajo
      db.herramienta.findMany({
        where: {
          activo: true,
          controlaStock: true,
          stockMinimo: { not: null }
        },
        include: {
          stocks: true
        }
      }),
      
      // Total de asignaciones activas
      db.asignacionTecnico.count({ where: { estado: 'asignado' } })
    ])

    // Obtener nombres de sedes para el stock
    const sedes = await db.sede.findMany()
    const stockConSedes = stockPorSede.map(s => {
      const sede = sedes.find(sd => sd.id === s.sedeId)
      return {
        sedeId: s.sedeId,
        sedeNombre: sede?.nombre || 'Desconocido',
        total: s._sum.cantidad || 0
      }
    })

    // Filtrar alertas de stock bajo
    const alertas = alertasStock
      .filter(h => {
        const stockTotal = h.stocks.reduce((sum, s) => sum + s.cantidad, 0)
        return stockTotal < (h.stockMinimo || 0)
      })
      .map(h => ({
        codigo: h.codigo,
        nombre: h.nombre,
        stockActual: h.stocks.reduce((sum, s) => sum + s.cantidad, 0),
        stockMinimo: h.stockMinimo
      }))

    return NextResponse.json({
      resumen: {
        totalSedes,
        totalHerramientas,
        totalTecnicos,
        totalMovimientos,
        asignacionesActivas
      },
      stockPorSede: stockConSedes,
      ultimosMovimientos,
      alertasStock: alertas
    })
  } catch (error) {
    console.error('Error al obtener dashboard:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
