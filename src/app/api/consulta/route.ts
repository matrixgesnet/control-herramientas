import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Consulta de técnico con su historial
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tecnicoId = searchParams.get('tecnicoId')
    const dni = searchParams.get('dni')

    if (!tecnicoId && !dni) {
      return NextResponse.json({ error: 'Se requiere tecnicoId o dni' }, { status: 400 })
    }

    // Buscar técnico
    const tecnico = tecnicoId 
      ? await db.tecnico.findUnique({
          where: { id: tecnicoId },
          include: { sede: true }
        })
      : await db.tecnico.findUnique({
          where: { dni: dni! },
          include: { sede: true }
        })

    if (!tecnico) {
      return NextResponse.json({ error: 'Técnico no encontrado' }, { status: 404 })
    }

    // Obtener todas las asignaciones (activas y devueltas)
    const asignaciones = await db.asignacionTecnico.findMany({
      where: { tecnicoId: tecnico.id },
      include: {
        herramienta: {
          include: { categoria: true }
        }
      },
      orderBy: { fechaAsignacion: 'desc' }
    })

    // Obtener movimientos de salida y devolución relacionados
    const movimientosSalida = await db.movimiento.findMany({
      where: {
        tecnicoId: tecnico.id,
        tipo: 'SALIDA',
        anulado: false
      },
      include: {
        items: { include: { herramienta: true } },
        sedeOrigen: true
      },
      orderBy: { fecha: 'desc' }
    })

    const movimientosDevolucion = await db.movimiento.findMany({
      where: {
        tecnicoId: tecnico.id,
        tipo: 'DEVOLUCION_TECNICO',
        anulado: false
      },
      include: {
        items: { include: { herramienta: true } },
        sedeDestino: true
      },
      orderBy: { fecha: 'desc' }
    })

    // CORREGIDO: Calcular pendientes y devueltas correctamente
    // Pendientes: cantidad - cantidadDevuelta > 0
    const pendientes = asignaciones
      .filter(a => (a.cantidad - a.cantidadDevuelta) > 0)
      .map(a => ({
        id: a.id,
        herramientaId: a.herramientaId,
        codigo: a.herramienta.codigo,
        nombre: a.herramienta.nombre,
        categoria: a.herramienta.categoria?.nombre || null,
        cantidad: a.cantidad - a.cantidadDevuelta, // Cantidad pendiente real
        cantidadOriginal: a.cantidad,
        cantidadDevuelta: a.cantidadDevuelta,
        fechaAsignacion: a.fechaAsignacion,
        serial: a.serial,
        sedeAsignacion: tecnico.sede?.nombre || null
      }))

    // Devueltas: Asignaciones donde cantidadDevuelta > 0
    const devueltas = asignaciones
      .filter(a => a.cantidadDevuelta > 0)
      .map(a => ({
        id: a.id,
        herramientaId: a.herramientaId,
        codigo: a.herramienta.codigo,
        nombre: a.herramienta.nombre,
        categoria: a.herramienta.categoria?.nombre || null,
        cantidad: a.cantidadDevuelta, // Cantidad realmente devuelta
        cantidadOriginal: a.cantidad,
        fechaAsignacion: a.fechaAsignacion,
        fechaDevolucion: a.fechaDevolucion,
        observaciones: a.observaciones,
        estadoHerramienta: a.estadoHerramienta
      }))

    // Calcular totales
    const totalPendiente = pendientes.reduce((sum, a) => sum + a.cantidad, 0)
    const totalDevuelto = devueltas.reduce((sum, a) => sum + a.cantidad, 0)

    // Historial completo combinando salidas y devoluciones
    const historial: {
      fecha: Date
      tipo: string
      numero: string
      herramienta: string
      codigo: string
      cantidad: number
      sede: string
      observaciones: string | null
    }[] = []

    // Agregar salidas
    for (const mov of movimientosSalida) {
      for (const item of mov.items) {
        historial.push({
          fecha: mov.fecha,
          tipo: 'SALIDA',
          numero: mov.numero,
          herramienta: item.herramienta.nombre,
          codigo: item.herramienta.codigo,
          cantidad: item.cantidad,
          sede: mov.sedeOrigen?.nombre || '-',
          observaciones: mov.observaciones
        })
      }
    }

    // Agregar devoluciones
    for (const mov of movimientosDevolucion) {
      for (const item of mov.items) {
        historial.push({
          fecha: mov.fecha,
          tipo: 'DEVOLUCION',
          numero: mov.numero,
          herramienta: item.herramienta.nombre,
          codigo: item.herramienta.codigo,
          cantidad: item.cantidad,
          sede: mov.sedeDestino?.nombre || '-',
          observaciones: mov.observaciones
        })
      }
    }

    // Ordenar por fecha descendente
    historial.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    return NextResponse.json({
      tecnico: {
        id: tecnico.id,
        dni: tecnico.dni,
        nombre: tecnico.nombre,
        apellido: tecnico.apellido,
        telefono: tecnico.telefono,
        sede: tecnico.sede,
        numeroCuadrilla: tecnico.numeroCuadrilla,
        activo: tecnico.activo
      },
      resumen: {
        totalPendiente,
        totalDevuelto,
        cantidadPendientes: pendientes.length,
        cantidadDevueltas: devueltas.length
      },
      pendientes,
      devueltas,
      historial
    })
  } catch (error) {
    console.error('Error en consulta:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
