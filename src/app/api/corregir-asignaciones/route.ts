import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Análisis de asignaciones (dry-run) - NO modifica nada
// POST - Corrección de asignaciones - SI modifica la base de datos

interface AsignacionCorrecta {
  tecnicoId: string
  herramientaId: string
  sedeId: string
  cantidad: number
  cantidadDevuelta: number
  fechaAsignacion: Date
}

interface ProblemaDetectado {
  tipo: 'DUPLICADO' | 'SIN_SALIDA' | 'CANTIDAD_MAL' | 'ESTADO_MAL'
  asignacionId: string
  tecnico: string
  herramienta: string
  cantidad: number
  cantidadDevuelta: number
  estado: string
  descripcion: string
}

// GET - Solo análisis, no modifica nada
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden ejecutar este análisis' }, { status: 403 })
    }

    // 1. Obtener todas las asignaciones actuales
    const asignacionesActuales = await db.asignacionTecnico.findMany({
      include: {
        tecnico: { select: { nombre: true, apellido: true } },
        herramienta: { select: { codigo: true, nombre: true } }
      }
    })

    // 2. Obtener todos los movimientos de SALIDA (no anulados)
    const movimientosSalida = await db.movimiento.findMany({
      where: { tipo: 'SALIDA', anulado: false },
      include: {
        items: true,
        tecnico: { select: { nombre: true, apellido: true } }
      }
    })

    // 3. Obtener todos los movimientos de DEVOLUCION_TECNICO (no anulados)
    const movimientosDevolucion = await db.movimiento.findMany({
      where: { tipo: 'DEVOLUCION_TECNICO', anulado: false },
      include: { items: true }
    })

    // 4. Calcular lo que DEBERÍA haber según los movimientos
    // Estructura: tecnicoId_herramientaId -> { cantidadAsignada, cantidadDevuelta, asignaciones[] }
    const esperado: Map<string, { 
      cantidadAsignada: number
      cantidadDevuelta: number
      asignaciones: { fecha: Date; cantidad: number; sedeId: string }[]
    }> = new Map()

    // Procesar salidas
    for (const mov of movimientosSalida) {
      for (const item of mov.items) {
        const key = `${mov.tecnicoId}_${item.herramientaId}`
        const actual = esperado.get(key) || { cantidadAsignada: 0, cantidadDevuelta: 0, asignaciones: [] }
        actual.cantidadAsignada += item.cantidad
        actual.asignaciones.push({ fecha: mov.fecha, cantidad: item.cantidad, sedeId: mov.sedeOrigenId! })
        esperado.set(key, actual)
      }
    }

    // Procesar devoluciones
    for (const mov of movimientosDevolucion) {
      for (const item of mov.items) {
        const key = `${mov.tecnicoId}_${item.herramientaId}`
        const actual = esperado.get(key)
        if (actual) {
          actual.cantidadDevuelta += item.cantidad
        }
      }
    }

    // 5. Comparar con lo que realmente hay
    const problemas: ProblemaDetectado[] = []
    
    // Agrupar asignaciones por tecnicoId_herramientaId
    const asignacionesPorTecnicoHerramienta: Map<string, typeof asignacionesActuales> = new Map()
    for (const asig of asignacionesActuales) {
      const key = `${asig.tecnicoId}_${asig.herramientaId}`
      const lista = asignacionesPorTecnicoHerramienta.get(key) || []
      lista.push(asig)
      asignacionesPorTecnicoHerramienta.set(key, lista)
    }

    // Verificar cada combinación técnico-herramienta
    for (const [key, datosEsperados] of esperado) {
      const asignacionesReales = asignacionesPorTecnicoHerramienta.get(key) || []
      const cantidadPendienteEsperada = datosEsperados.cantidadAsignada - datosEsperados.cantidadDevuelta

      // Si hay más de una asignación para la misma herramienta-técnico = DUPLICADO
      if (asignacionesReales.length > 1) {
        const cantidadTotalReal = asignacionesReales.reduce((sum, a) => sum + a.cantidad, 0)
        const cantidadDevueltaReal = asignacionesReales.reduce((sum, a) => sum + a.cantidadDevuelta, 0)
        
        for (const asig of asignacionesReales) {
          problemas.push({
            tipo: 'DUPLICADO',
            asignacionId: asig.id,
            tecnico: `${asig.tecnico.nombre} ${asig.tecnico.apellido || ''}`,
            herramienta: `${asig.herramienta.codigo} - ${asig.herramienta.nombre}`,
            cantidad: asig.cantidad,
            cantidadDevuelta: asig.cantidadDevuelta,
            estado: asig.estado,
            descripcion: `Hay ${asignacionesReales.length} asignaciones para esta combinación. Total real: ${cantidadTotalReal} asignadas, ${cantidadDevueltaReal} devueltas. Esperado: ${datosEsperados.cantidadAsignada} asignadas, ${datosEsperados.cantidadDevuelta} devueltas.`
          })
        }
      }
      // Si hay una sola asignación pero los números no coinciden
      else if (asignacionesReales.length === 1) {
        const asig = asignacionesReales[0]
        const cantidadPendienteReal = asig.cantidad - asig.cantidadDevuelta

        if (Math.abs(cantidadPendienteReal - cantidadPendienteEsperada) > 0.01) {
          problemas.push({
            tipo: 'CANTIDAD_MAL',
            asignacionId: asig.id,
            tecnico: `${asig.tecnico.nombre} ${asig.tecnico.apellido || ''}`,
            herramienta: `${asig.herramienta.codigo} - ${asig.herramienta.nombre}`,
            cantidad: asig.cantidad,
            cantidadDevuelta: asig.cantidadDevuelta,
            estado: asig.estado,
            descripcion: `Pendiente real: ${cantidadPendienteReal}, esperado: ${cantidadPendienteEsperada}. Asignada: ${asig.cantidad}, devuelta: ${asig.cantidadDevuelta}. Esperado asignado: ${datosEsperados.cantidadAsignada}, esperado devuelto: ${datosEsperados.cantidadDevuelta}.`
          })
        }

        // Verificar estado
        const estadoCorrecto = cantidadPendienteEsperada <= 0 ? 'devuelto' : 'asignado'
        if (asig.estado !== estadoCorrecto && cantidadPendienteEsperada <= 0) {
          problemas.push({
            tipo: 'ESTADO_MAL',
            asignacionId: asig.id,
            tecnico: `${asig.tecnico.nombre} ${asig.tecnico.apellido || ''}`,
            herramienta: `${asig.herramienta.codigo} - ${asig.herramienta.nombre}`,
            cantidad: asig.cantidad,
            cantidadDevuelta: asig.cantidadDevuelta,
            estado: asig.estado,
            descripcion: `Estado debería ser '${estadoCorrecto}' pero es '${asig.estado}'`
          })
        }
      }
      // Si no hay asignación pero debería haber (si hay cantidad pendiente)
      else if (cantidadPendienteEsperada > 0) {
        const [tecnicoId, herramientaId] = key.split('_')
        const tecnico = await db.tecnico.findUnique({ where: { id: tecnicoId }, select: { nombre: true, apellido: true } })
        const herramienta = await db.herramienta.findUnique({ where: { id: herramientaId }, select: { codigo: true, nombre: true } })
        
        problemas.push({
          tipo: 'SIN_SALIDA',
          asignacionId: 'N/A',
          tecnico: `${tecnico?.nombre || 'N/A'} ${tecnico?.apellido || ''}`,
          herramienta: `${herramienta?.codigo || 'N/A'} - ${herramienta?.nombre || 'N/A'}`,
          cantidad: datosEsperados.cantidadAsignada,
          cantidadDevuelta: datosEsperados.cantidadDevuelta,
          estado: 'N/A',
          descripcion: `Falta asignación. Debería haber ${cantidadPendienteEsperada} pendientes.`
        })
      }
    }

    // 6. Buscar asignaciones que NO tienen salida correspondiente
    for (const asig of asignacionesActuales) {
      const key = `${asig.tecnicoId}_${asig.herramientaId}`
      if (!esperado.has(key)) {
        problemas.push({
          tipo: 'SIN_SALIDA',
          asignacionId: asig.id,
          tecnico: `${asig.tecnico.nombre} ${asig.tecnico.apellido || ''}`,
          herramienta: `${asig.herramienta.codigo} - ${asig.herramienta.nombre}`,
          cantidad: asig.cantidad,
          cantidadDevuelta: asig.cantidadDevuelta,
          estado: asig.estado,
          descripcion: 'Asignación sin movimiento de SALIDA correspondiente. Posiblemente quedó huérfana.'
        })
      }
    }

    // Resumen
    const resumen = {
      totalAsignacionesActuales: asignacionesActuales.length,
      totalMovimientosSalida: movimientosSalida.length,
      totalMovimientosDevolucion: movimientosDevolucion.length,
      totalProblemas: problemas.length,
      problemasPorTipo: {
        duplicados: problemas.filter(p => p.tipo === 'DUPLICADO').length,
        sinSalida: problemas.filter(p => p.tipo === 'SIN_SALIDA').length,
        cantidadMal: problemas.filter(p => p.tipo === 'CANTIDAD_MAL').length,
        estadoMal: problemas.filter(p => p.tipo === 'ESTADO_MAL').length
      }
    }

    return NextResponse.json({
      mensaje: 'Análisis completado. NO se modificaron datos.',
      resumen,
      problemas
    })

  } catch (error) {
    console.error('Error en análisis:', error)
    return NextResponse.json({ error: 'Error en análisis', detalle: String(error) }, { status: 500 })
  }
}

// POST - Corregir asignaciones
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden ejecutar la corrección' }, { status: 403 })
    }

    // 1. Obtener todos los movimientos
    const movimientosSalida = await db.movimiento.findMany({
      where: { tipo: 'SALIDA', anulado: false },
      include: { items: true }
    })

    const movimientosDevolucion = await db.movimiento.findMany({
      where: { tipo: 'DEVOLUCION_TECNICO', anulado: false },
      include: { items: true }
    })

    // 2. Calcular lo correcto según movimientos
    const datosCorrectos: Map<string, {
      tecnicoId: string
      herramientaId: string
      sedeId: string
      cantidadAsignada: number
      cantidadDevuelta: number
      asignaciones: { fecha: Date; cantidad: number; sedeId: string }[]
    }> = new Map()

    // Procesar salidas
    for (const mov of movimientosSalida) {
      for (const item of mov.items) {
        const key = `${mov.tecnicoId}_${item.herramientaId}`
        const actual = datosCorrectos.get(key) || {
          tecnicoId: mov.tecnicoId!,
          herramientaId: item.herramientaId,
          sedeId: mov.sedeOrigenId!,
          cantidadAsignada: 0,
          cantidadDevuelta: 0,
          asignaciones: []
        }
        actual.cantidadAsignada += item.cantidad
        actual.asignaciones.push({ fecha: mov.fecha, cantidad: item.cantidad, sedeId: mov.sedeOrigenId! })
        datosCorrectos.set(key, actual)
      }
    }

    // Procesar devoluciones
    for (const mov of movimientosDevolucion) {
      for (const item of mov.items) {
        const key = `${mov.tecnicoId}_${item.herramientaId}`
        const actual = datosCorrectos.get(key)
        if (actual) {
          actual.cantidadDevuelta += item.cantidad
        }
      }
    }

    let eliminadas = 0
    let creadas = 0
    let actualizadas = 0

    await db.$transaction(async (tx) => {
      // 3. Eliminar TODAS las asignaciones actuales para esta combinación
      for (const [key, datos] of datosCorrectos) {
        const [tecnicoId, herramientaId] = key.split('_')
        
        // Contar cuántas se eliminarán
        const aEliminar = await tx.asignacionTecnico.count({
          where: { tecnicoId, herramientaId }
        })
        eliminadas += aEliminar

        // Eliminar
        await tx.asignacionTecnico.deleteMany({
          where: { tecnicoId, herramientaId }
        })
      }

      // 4. Crear asignaciones correctas
      for (const [key, datos] of datosCorrectos) {
        const cantidadPendiente = datos.cantidadAsignada - datos.cantidadDevuelta
        
        if (cantidadPendiente > 0) {
          // Crear una asignación con los datos correctos
          // Usar la fecha de la primera salida
          const fechaPrimeraSalida = datos.asignaciones.length > 0 
            ? datos.asignaciones.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())[0].fecha 
            : new Date()

          await tx.asignacionTecnico.create({
            data: {
              tecnicoId: datos.tecnicoId,
              herramientaId: datos.herramientaId,
              sedeId: datos.sedeId,
              cantidad: datos.cantidadAsignada,
              cantidadDevuelta: datos.cantidadDevuelta,
              fechaAsignacion: fechaPrimeraSalida,
              estado: 'asignado'
            }
          })
          creadas++
        } else if (datos.cantidadDevuelta > 0) {
          // Si todo fue devuelto, crear registro histórico
          const fechaPrimeraSalida = datos.asignaciones.length > 0 
            ? datos.asignaciones.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())[0].fecha 
            : new Date()

          await tx.asignacionTecnico.create({
            data: {
              tecnicoId: datos.tecnicoId,
              herramientaId: datos.herramientaId,
              sedeId: datos.sedeId,
              cantidad: datos.cantidadAsignada,
              cantidadDevuelta: datos.cantidadDevuelta,
              fechaAsignacion: fechaPrimeraSalida,
              fechaDevolucion: new Date(),
              estado: 'devuelto'
            }
          })
          creadas++
        }
      }
    })

    return NextResponse.json({
      mensaje: 'Corrección completada exitosamente',
      resumen: {
        asignacionesEliminadas: eliminadas,
        asignacionesCreadas: creadas,
        actualizadas
      }
    })

  } catch (error) {
    console.error('Error en corrección:', error)
    return NextResponse.json({ error: 'Error en corrección', detalle: String(error) }, { status: 500 })
  }
}
