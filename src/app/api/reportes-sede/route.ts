import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Reporte de herramientas por sede con técnicos (formato matriz)
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sedeId = searchParams.get('sedeId')

    if (!sedeId) {
      return NextResponse.json({ error: 'sedeId es requerido' }, { status: 400 })
    }

    // Obtener la sede
    const sede = await db.sede.findUnique({
      where: { id: sedeId }
    })

    if (!sede) {
      return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
    }

    // Obtener técnicos de la sede (ordenados por cuadrilla)
    const tecnicos = await db.tecnico.findMany({
      where: { sedeId, activo: true },
      orderBy: [{ numeroCuadrilla: 'asc' }, { nombre: 'asc' }]
    })

    // Obtener todas las herramientas activas
    const herramientas = await db.herramienta.findMany({
      where: { activo: true },
      include: { categoria: true },
      orderBy: { codigo: 'asc' }
    })

    // CORREGIDO: Obtener todas las asignaciones de técnicos de esta sede
    // y calcular la cantidad pendiente (cantidad - cantidadDevuelta)
    const asignaciones = await db.asignacionTecnico.findMany({
      where: {
        tecnico: { sedeId }
      },
      include: {
        tecnico: true,
        herramienta: true
      }
    })

    // Calcular cantidad pendiente por técnico y herramienta
    const cantidadPorTecnicoHerramienta: Record<string, Record<string, number>> = {}
    
    asignaciones.forEach(asignacion => {
      const tecnicoId = asignacion.tecnicoId
      const herramientaId = asignacion.herramientaId
      const cantidadPendiente = asignacion.cantidad - asignacion.cantidadDevuelta
      
      if (cantidadPendiente > 0) {
        if (!cantidadPorTecnicoHerramienta[tecnicoId]) {
          cantidadPorTecnicoHerramienta[tecnicoId] = {}
        }
        if (!cantidadPorTecnicoHerramienta[tecnicoId][herramientaId]) {
          cantidadPorTecnicoHerramienta[tecnicoId][herramientaId] = 0
        }
        cantidadPorTecnicoHerramienta[tecnicoId][herramientaId] += cantidadPendiente
      }
    })

    // Obtener stock por estado en la sede
    const stockEstados = await db.stockEstado.findMany({
      where: { sedeId }
    })

    // Obtener stock total en la sede
    const stocks = await db.stock.findMany({
      where: { sedeId }
    })

    // Construir la matriz del reporte
    const reporte = herramientas.map(herramienta => {
      // Obtener asignaciones de esta herramienta
      const asignacionesHerramienta = asignaciones.filter(a => a.herramientaId === herramienta.id)
      
      // Obtener stock por estado
      const estadosHerramienta = stockEstados.filter(s => s.herramientaId === herramienta.id)
      const stockTotal = stocks.find(s => s.herramientaId === herramienta.id)

      // Crear objeto con datos por técnico
      const datosPorTecnico: Record<string, { cantidad: number; estado: string | null }> = {}
      
      tecnicos.forEach(tecnico => {
        const asignacion = asignacionesHerramienta.find(a => a.tecnicoId === tecnico.id)
        if (asignacion) {
          // CORRECTO - usa cantidad pendiente (no devuelta)
          const cantidadPendiente = cantidadPorTecnicoHerramienta[tecnico.id]?.[herramienta.id] || 0

          datosPorTecnico[tecnico.id] = {
          cantidad: cantidadPendiente,  // ← Ahora muestra solo lo que NO ha devuelto
          estado: null
        }
        } else {
          datosPorTecnico[tecnico.id] = {
            cantidad: 0,
            estado: null
          }
        }
      })

      // Stock en sede por estado
      const stockPorEstado: Record<string, number> = {
        BUENO: 0,
        USADO: 0,
        REPARADO: 0,
        DANADO: 0,
        EN_MANTENIMIENTO: 0
      }

      estadosHerramienta.forEach(se => {
        stockPorEstado[se.estado] = se.cantidad
      })

      return {
        codigo: herramienta.codigo,
        nombre: herramienta.nombre,
        categoria: herramienta.categoria?.nombre || '-',
        unidad: herramienta.unidad,
        datosPorTecnico,
        stockTotal: stockTotal?.cantidad || 0,
        stockPorEstado
      }
    })

    // Filtrar solo herramientas que tienen asignaciones o stock
    const reporteFiltrado = reporte.filter(r => 
      Object.values(r.datosPorTecnico).some(d => d.cantidad > 0) || r.stockTotal > 0
    )

    return NextResponse.json({
      sede: {
        id: sede.id,
        nombre: sede.nombre
      },
      tecnicos: tecnicos.map(t => ({
        id: t.id,
        nombre: `${t.nombre} ${t.apellido || ''}`.trim(),
        dni: t.dni,
        cuadrilla: t.numeroCuadrilla
      })),
      herramientas: reporteFiltrado
    })
  } catch (error) {
    console.error('Error al generar reporte:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
