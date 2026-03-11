import { db } from '@/lib/db'
import { getCurrentUser, generateMovimientoNumero, generateMovimientoNumeroTransferencia, calculateCostoPromedio } from '@/lib/utils-server'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

// GET - Listar movimientos
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const sedeId = searchParams.get('sedeId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const incluirAnulados = searchParams.get('incluirAnulados')

    const where: Prisma.MovimientoWhereInput = {}
    
    if (tipo) {
      where.tipo = tipo
    }
    
    if (sedeId) {
      where.OR = [
        { sedeOrigenId: sedeId },
        { sedeDestinoId: sedeId }
      ]
    }
    
    if (fechaDesde || fechaHasta) {
      where.fecha = {}
      if (fechaDesde) {
        where.fecha.gte = new Date(fechaDesde)
      }
      if (fechaHasta) {
        where.fecha.lte = new Date(fechaHasta)
      }
    }

    // Por defecto no mostrar anulados, a menos que se especifique
    if (incluirAnulados !== 'true') {
      where.anulado = false
    }

    const movimientos = await db.movimiento.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        sedeOrigen: true,
        sedeDestino: true,
        tecnico: true,
        usuario: { select: { id: true, name: true, email: true } },
        anuladoPor: { select: { id: true, name: true } },
        items: {
          include: { herramienta: true }
        }
      }
    })

    return NextResponse.json(movimientos)
  } catch (error) {
    console.error('Error al obtener movimientos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear movimiento (compra, transferencia, salida, devolución, baja)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { tipo, sedeOrigenId, sedeDestinoId, tecnicoId, proveedor, comprobante, observaciones, items, fecha } = body

    if (!tipo || !items || items.length === 0) {
      return NextResponse.json({ error: 'Tipo e items son requeridos' }, { status: 400 })
    }

    // Validar fecha
    // Validar fecha - CORREGIDO: tipo explícito y ajuste de zona horaria
    let fechaMovimiento: Date = new Date()
    if (fecha) {
      // Crear fecha ajustando zona horaria (agregar 12 horas para evitar problema de día anterior)
      fechaMovimiento = new Date(fecha + 'T12:00:00')
      
      // Validar que no sea fecha futura
      const hoy = new Date()
      hoy.setHours(23, 59, 59, 999)
      if (fechaMovimiento > hoy) {
        return NextResponse.json({ error: 'La fecha no puede ser futura' }, { status: 400 })
      }
      
      // Validar que no sea más de un mes atrás
      const haceUnMes = new Date()
      haceUnMes.setMonth(haceUnMes.getMonth() - 1)
      haceUnMes.setHours(0, 0, 0, 0)
      if (fechaMovimiento < haceUnMes) {
        return NextResponse.json({ error: 'La fecha no puede ser anterior a un mes' }, { status: 400 })
      }
    }

    // Validaciones según el tipo
    switch (tipo) {
      case 'COMPRA':
        if (!sedeDestinoId) {
          return NextResponse.json({ error: 'La sede de destino es requerida para compras' }, { status: 400 })
        }
        break
      case 'TRANSFERENCIA':
        if (!sedeOrigenId || !sedeDestinoId) {
          return NextResponse.json({ error: 'Sede origen y destino son requeridas para transferencias' }, { status: 400 })
        }
        if (sedeOrigenId === sedeDestinoId) {
          return NextResponse.json({ error: 'La sede origen y destino no pueden ser la misma' }, { status: 400 })
        }
        break
      case 'SALIDA':
        if (!sedeOrigenId || !tecnicoId) {
          return NextResponse.json({ error: 'Sede origen y técnico son requeridos para salidas' }, { status: 400 })
        }
        break
      case 'DEVOLUCION_TECNICO':
        if (!sedeDestinoId || !tecnicoId) {
          return NextResponse.json({ error: 'Sede destino y técnico son requeridos para devoluciones' }, { status: 400 })
        }
        break
      case 'BAJA':
        if (!sedeOrigenId) {
          return NextResponse.json({ error: 'La sede de origen es requerida para bajas' }, { status: 400 })
        }
        break
    }

    // Obtener costo promedio de las herramientas para movimientos que no son compra
    const itemsConCosto = await Promise.all(items.map(async (item: { herramientaId: string; cantidad: number; costoUnitario: number; serial?: string; estado?: string }) => {
      let costoUnitario = parseFloat(item.costoUnitario) || 0
      
      // Para movimientos que no son compra, obtener el costo promedio de la herramienta
      if (tipo !== 'COMPRA' && costoUnitario === 0) {
        const herramienta = await db.herramienta.findUnique({
          where: { id: item.herramientaId },
          select: { costoPromedio: true }
        })
        costoUnitario = herramienta?.costoPromedio || 0
      }
      
      return {
        ...item,
        costoUnitario,
        cantidad: parseFloat(item.cantidad)
      }
    }))

    // Usar transacción para garantizar integridad
    const result = await db.$transaction(async (tx) => {
      
      // === TRANSFERENCIA: Crear 2 movimientos (SALIDA + INGRESO) ===
      if (tipo === 'TRANSFERENCIA') {
        // Generar números para ambos movimientos
        const numeros = await generateMovimientoNumeroTransferencia(tx)
        
        const sedeOrigen = await tx.sede.findUnique({ where: { id: sedeOrigenId } })
        const sedeDestino = await tx.sede.findUnique({ where: { id: sedeDestinoId } })
        
        // 1. Crear movimiento de SALIDA
        const movimientoSalida = await tx.movimiento.create({
          data: {
            numero: numeros.salida,
            fecha: fechaMovimiento,
            tipo: 'TRANSFERENCIA_SALIDA',
            sedeOrigenId,
            sedeDestinoId,
            comprobante,
            observaciones: `Transferencia hacia ${sedeDestino?.nombre}. ${observaciones || ''}`,
            usuarioId: user.id,
            items: {
              create: itemsConCosto.map((item) => ({
                herramientaId: item.herramientaId,
                cantidad: item.cantidad,
                costoUnitario: item.costoUnitario,
                costoTotal: item.cantidad * item.costoUnitario,
                serial: item.serial,
                estado: item.estado
              }))
            }
          },
          include: {
            items: { include: { herramienta: true } }
          }
        })

        // 2. Crear movimiento de INGRESO
        const movimientoIngreso = await tx.movimiento.create({
          data: {
            numero: numeros.ingreso,
            fecha: fechaMovimiento,
            tipo: 'TRANSFERENCIA_INGRESO',
            sedeOrigenId,
            sedeDestinoId,
            comprobante,
            observaciones: `Transferencia desde ${sedeOrigen?.nombre}. ${observaciones || ''}`,
            usuarioId: user.id,
            items: {
              create: itemsConCosto.map((item) => ({
                herramientaId: item.herramientaId,
                cantidad: item.cantidad,
                costoUnitario: item.costoUnitario,
                costoTotal: item.cantidad * item.costoUnitario,
                serial: item.serial,
                estado: item.estado
              }))
            }
          },
          include: {
            items: { include: { herramienta: true } }
          }
        })

        // Actualizar stock para cada item
        for (const item of itemsConCosto) {
          // Decrementar en origen
          const stockOrigen = await tx.stock.findUnique({
            where: { sedeId_herramientaId: { sedeId: sedeOrigenId, herramientaId: item.herramientaId } }
          })
          
          if (!stockOrigen || stockOrigen.cantidad < item.cantidad) {
            throw new Error(`Stock insuficiente para ${item.herramientaId} en sede origen`)
          }

          await tx.stock.update({
            where: { id: stockOrigen.id },
            data: { cantidad: { decrement: item.cantidad } }
          })

          // Incrementar en destino
          const stockDestino = await tx.stock.findUnique({
            where: { sedeId_herramientaId: { sedeId: sedeDestinoId, herramientaId: item.herramientaId } }
          })

          if (stockDestino) {
            await tx.stock.update({
              where: { id: stockDestino.id },
              data: { 
                cantidad: { increment: item.cantidad },
                costoPromedio: item.costoUnitario // Mantener el costo promedio
              }
            })
          } else {
            await tx.stock.create({
              data: {
                sedeId: sedeDestinoId,
                herramientaId: item.herramientaId,
                cantidad: item.cantidad,
                costoPromedio: item.costoUnitario
              }
            })
          }
        }

        return { movimientoSalida, movimientoIngreso, esTransferencia: true }
      }

      // === OTROS TIPOS DE MOVIMIENTO ===
      const numero = await generateMovimientoNumero(tipo)

      const movimiento = await tx.movimiento.create({
        data: {
          numero,
          fecha: fechaMovimiento,
          tipo,
          sedeOrigenId: ['SALIDA', 'BAJA'].includes(tipo) ? sedeOrigenId : null,
          sedeDestinoId: ['COMPRA', 'DEVOLUCION_TECNICO'].includes(tipo) ? sedeDestinoId : null,
          tecnicoId: ['SALIDA', 'DEVOLUCION_TECNICO'].includes(tipo) ? tecnicoId : null,
          proveedor: tipo === 'COMPRA' ? proveedor : null,
          comprobante,
          observaciones,
          usuarioId: user.id,
          items: {
            create: itemsConCosto.map((item) => ({
              herramientaId: item.herramientaId,
              cantidad: item.cantidad,
              costoUnitario: item.costoUnitario,
              costoTotal: item.cantidad * item.costoUnitario,
              serial: item.serial,
              estado: item.estado
            }))
          }
        },
        include: {
          items: { include: { herramienta: true } }
        }
      })

      // Actualizar stock según el tipo de movimiento
      for (const item of itemsConCosto) {
        switch (tipo) {
          case 'COMPRA': {
            // Incrementar stock en sede destino
            const stockExistente = await tx.stock.findUnique({
              where: { sedeId_herramientaId: { sedeId: sedeDestinoId, herramientaId: item.herramientaId } }
            })

            if (stockExistente) {
              const nuevoCostoPromedio = calculateCostoPromedio(
                stockExistente.cantidad,
                stockExistente.costoPromedio,
                item.cantidad,
                item.costoUnitario
              )
              await tx.stock.update({
                where: { id: stockExistente.id },
                data: {
                  cantidad: { increment: item.cantidad },
                  costoPromedio: nuevoCostoPromedio
                }
              })
            } else {
              await tx.stock.create({
                data: {
                  sedeId: sedeDestinoId,
                  herramientaId: item.herramientaId,
                  cantidad: item.cantidad,
                  costoPromedio: item.costoUnitario
                }
              })
            }

            // Actualizar costo promedio global de la herramienta
            const herramienta = await tx.herramienta.findUnique({ where: { id: item.herramientaId } })
            if (herramienta) {
              const nuevoCostoGlobal = calculateCostoPromedio(
                herramienta.costoPromedio > 0 ? 1 : 0,
                herramienta.costoPromedio,
                item.cantidad,
                item.costoUnitario
              )
              await tx.herramienta.update({
                where: { id: item.herramientaId },
                data: { costoPromedio: nuevoCostoGlobal }
              })
            }
            break
          }

          case 'SALIDA': {
            // Decrementar stock de la sede
            const stockSede = await tx.stock.findUnique({
              where: { sedeId_herramientaId: { sedeId: sedeOrigenId, herramientaId: item.herramientaId } }
            })
            
            if (!stockSede || stockSede.cantidad < item.cantidad) {
              throw new Error(`Stock insuficiente para ${item.herramientaId} en la sede`)
            }

            await tx.stock.update({
              where: { id: stockSede.id },
              data: { cantidad: { decrement: item.cantidad } }
            })

            // Crear asignación al técnico
            await tx.asignacionTecnico.create({
              data: {
                tecnicoId: tecnicoId!,
                herramientaId: item.herramientaId,
                sedeId: sedeOrigenId,
                cantidad: item.cantidad,
                cantidadDevuelta: 0,
                fechaAsignacion: fechaMovimiento, // Usar fecha del movimiento, no la actual
                serial: item.serial
              }
            })
            break
          }

          case 'DEVOLUCION_TECNICO': {
            // CORREGIDO: Manejo de devoluciones parciales
            // Buscar la asignación activa (con cantidad pendiente)
            const asignacion = await tx.asignacionTecnico.findFirst({
              where: {
                tecnicoId,
                herramientaId: item.herramientaId,
                estado: 'asignado'
              },
              orderBy: { fechaAsignacion: 'asc' } // FIFO: primero en entrar, primero en salir
            })

            if (!asignacion) {
              throw new Error(`No se encontró asignación activa para ${item.herramientaId} al técnico`)
            }

            // Verificar que no se devuelva más de lo pendiente
            const cantidadPendiente = asignacion.cantidad - asignacion.cantidadDevuelta
            if (item.cantidad > cantidadPendiente) {
              throw new Error(`Cantidad a devolver (${item.cantidad}) excede la cantidad pendiente (${cantidadPendiente})`)
            }

            // Actualizar la asignación
            const nuevaCantidadDevuelta = asignacion.cantidadDevuelta + item.cantidad
            const nuevaCantidadPendiente = asignacion.cantidad - nuevaCantidadDevuelta

            await tx.asignacionTecnico.update({
              where: { id: asignacion.id },
              data: {
                cantidadDevuelta: nuevaCantidadDevuelta,
                // Solo marcar como devuelto si se devolvió todo
                estado: nuevaCantidadPendiente === 0 ? 'devuelto' : 'asignado',
                fechaDevolucion: nuevaCantidadPendiente === 0 ? new Date() : null,
                estadoHerramienta: item.estado,
                observaciones: item.estado ? `Estado: ${item.estado}` : null
              }
            })

            // Incrementar stock en sede destino
            const stockSede = await tx.stock.findUnique({
              where: { sedeId_herramientaId: { sedeId: sedeDestinoId, herramientaId: item.herramientaId } }
            })

            if (stockSede) {
              await tx.stock.update({
                where: { id: stockSede.id },
                data: { cantidad: { increment: item.cantidad } }
              })
            } else {
              await tx.stock.create({
                data: {
                  sedeId: sedeDestinoId,
                  herramientaId: item.herramientaId,
                  cantidad: item.cantidad,
                  costoPromedio: item.costoUnitario
                }
              })
            }
            break
          }


          case 'BAJA': {
            // Decrementar stock
            const stockSede = await tx.stock.findUnique({
              where: { sedeId_herramientaId: { sedeId: sedeOrigenId, herramientaId: item.herramientaId } }
            })
            
            if (!stockSede || stockSede.cantidad < item.cantidad) {
              throw new Error(`Stock insuficiente para dar de baja`)
            }

            await tx.stock.update({
              where: { id: stockSede.id },
              data: { cantidad: { decrement: item.cantidad } }
            })
            break
          }
        }
      }

      return { movimiento, esTransferencia: false }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error al crear movimiento:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PUT - Anular movimiento
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, motivoAnulacion, accion } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // Si es anulación
    if (accion === 'anular') {
      if (!motivoAnulacion) {
        return NextResponse.json({ error: 'El motivo de anulación es requerido' }, { status: 400 })
      }

      const movimiento = await db.movimiento.findUnique({
        where: { id },
        include: { items: true }
      })

      if (!movimiento) {
        return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
      }

      if (movimiento.anulado) {
        return NextResponse.json({ error: 'El movimiento ya está anulado' }, { status: 400 })
      }

      // Revertir stock usando transacción
      await db.$transaction(async (tx) => {
        // Marcar como anulado
        await tx.movimiento.update({
          where: { id },
          data: {
            anulado: true,
            motivoAnulacion,
            fechaAnulacion: new Date(),
            anuladoPorId: user.id
          }
        })

        // Revertir stock según el tipo
        for (const item of movimiento.items) {
          const cantidad = item.cantidad

          switch (movimiento.tipo) {
            case 'COMPRA': {
              // Revertir: descontar stock
              const stock = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeDestinoId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stock) {
                await tx.stock.update({
                  where: { id: stock.id },
                  data: { cantidad: { decrement: cantidad } }
                })
              }
              break
            }

            case 'TRANSFERENCIA_SALIDA':
            case 'TRANSFERENCIA_INGRESO': {
              // Buscar el movimiento complementario
              const prefijo = movimiento.numero.includes('-S-') 
                ? movimiento.numero.replace('-S-', '-I-')
                : movimiento.numero.replace('-I-', '-S-')
              
              const movimientoComplementario = await tx.movimiento.findFirst({
                where: { 
                  numero: prefijo,
                  anulado: false
                }
              })

              // Anular también el movimiento complementario
              if (movimientoComplementario && !movimientoComplementario.anulado) {
                await tx.movimiento.update({
                  where: { id: movimientoComplementario.id },
                  data: {
                    anulado: true,
                    motivoAnulacion: `Anulado automáticamente por anulación de ${movimiento.numero}`,
                    fechaAnulacion: new Date(),
                    anuladoPorId: user.id
                  }
                })
              }

              // Revertir stock según sea salida o ingreso
              if (movimiento.tipo === 'TRANSFERENCIA_SALIDA') {
                // Devolver a origen
                const stockOrigen = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimiento.sedeOrigenId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (stockOrigen) {
                  await tx.stock.update({
                    where: { id: stockOrigen.id },
                    data: { cantidad: { increment: cantidad } }
                  })
                }
              } else {
                // Quitar de destino
                const stockDestino = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimiento.sedeDestinoId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (stockDestino) {
                  await tx.stock.update({
                    where: { id: stockDestino.id },
                    data: { cantidad: { decrement: cantidad } }
                  })
                }
              }
              break
            }

            case 'TRANSFERENCIA': {
              // Transferencia antigua (sin separar)
              // Revertir: devolver a origen, quitar de destino
              const stockOrigen = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeOrigenId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockOrigen) {
                await tx.stock.update({
                  where: { id: stockOrigen.id },
                  data: { cantidad: { increment: cantidad } }
                })
              }

              const stockDestino = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeDestinoId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockDestino) {
                await tx.stock.update({
                  where: { id: stockDestino.id },
                  data: { cantidad: { decrement: cantidad } }
                })
              }
              break
            }

            case 'SALIDA': {
              // Revertir: devolver stock a sede, eliminar asignación
              const stockSede = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeOrigenId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockSede) {
                await tx.stock.update({
                  where: { id: stockSede.id },
                  data: { cantidad: { increment: cantidad } }
                })
              }

              // Buscar y revertir asignación
              const asignacion = await tx.asignacionTecnico.findFirst({
                where: {
                  tecnicoId: movimiento.tecnicoId!,
                  herramientaId: item.herramientaId,
                  estado: 'asignado'
                }
              })
              if (asignacion) {
                await tx.asignacionTecnico.update({
                  where: { id: asignacion.id },
                  data: { estado: 'devuelto', fechaDevolucion: new Date() }
                })
              }
              break
            }

            case 'DEVOLUCION_TECNICO': {
              // Revertir: quitar stock de sede, reactivar asignación
              const stockSede = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeDestinoId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockSede) {
                await tx.stock.update({
                  where: { id: stockSede.id },
                  data: { cantidad: { decrement: cantidad } }
                })
              }

              // Reactivar asignación (reducir cantidadDevuelta)
              const asignacion = await tx.asignacionTecnico.findFirst({
                where: {
                  tecnicoId: movimiento.tecnicoId!,
                  herramientaId: item.herramientaId,
                  cantidadDevuelta: { gt: 0 }
                },
                orderBy: { fechaDevolucion: 'desc' }
              })
              if (asignacion) {
                const nuevaCantidadDevuelta = asignacion.cantidadDevuelta - cantidad
                await tx.asignacionTecnico.update({
                  where: { id: asignacion.id },
                  data: { 
                    cantidadDevuelta: nuevaCantidadDevuelta,
                    estado: 'asignado',
                    fechaDevolucion: null
                  }
                })
              }
              break
            }


            case 'BAJA': {
              // Revertir: devolver stock
              const stockSede = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeOrigenId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockSede) {
                await tx.stock.update({
                  where: { id: stockSede.id },
                  data: { cantidad: { increment: cantidad } }
                })
              }
              break
            }
          }
        }
      })

      return NextResponse.json({ message: 'Movimiento anulado correctamente' })
    }

    // Si es edición
    if (accion === 'editar') {
      const { fecha, proveedor, comprobante, observaciones, items } = body

      // Validar fecha
      let fechaMovimiento: Date | undefined = undefined
      if (fecha) {
        fechaMovimiento = new Date(fecha + 'T12:00:00')
        
        const hoy = new Date()
        hoy.setHours(23, 59, 59, 999)
        if (fechaMovimiento > hoy) {
          return NextResponse.json({ error: 'La fecha no puede ser futura' }, { status: 400 })
        }
        
        const haceUnMes = new Date()
        haceUnMes.setMonth(haceUnMes.getMonth() - 1)
        haceUnMes.setHours(0, 0, 0, 0)
        if (fechaMovimiento < haceUnMes) {
          return NextResponse.json({ error: 'La fecha no puede ser anterior a un mes' }, { status: 400 })
        }
      }

      const movimientoActual = await db.movimiento.findUnique({
        where: { id },
        include: { items: true }
      })

      if (!movimientoActual) {
        return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
      }

      if (movimientoActual.anulado) {
        return NextResponse.json({ error: 'No se puede editar un movimiento anulado' }, { status: 400 })
      }

      // No permitir editar transferencias (deben anularse y crearse de nuevo)
      if (movimientoActual.tipo === 'TRANSFERENCIA_SALIDA' || movimientoActual.tipo === 'TRANSFERENCIA_INGRESO') {
        return NextResponse.json({ error: 'Las transferencias no se pueden editar. Debe anularlas y crear una nueva.' }, { status: 400 })
      }

      // Función para comparar si los items cambiaron
      const itemsCambiaron = (itemsActuales: typeof movimientoActual.items, nuevosItems: typeof items) => {
        if (!nuevosItems || nuevosItems.length !== itemsActuales.length) {
          return nuevosItems && nuevosItems.length > 0 // Si hay items nuevos y diferente cantidad, cambiaron
        }
        
        // Ordenar ambos arrays por herramientaId para comparar
        const actualesOrdenados = [...itemsActuales].sort((a, b) => a.herramientaId.localeCompare(b.herramientaId))
        const nuevosOrdenados = [...nuevosItems].sort((a, b) => a.herramientaId.localeCompare(b.herramientaId))
        
        for (let i = 0; i < actualesOrdenados.length; i++) {
          const actual = actualesOrdenados[i]
          const nuevo = nuevosOrdenados[i]
          
          if (actual.herramientaId !== nuevo.herramientaId) return true
          if (Math.abs(actual.cantidad - parseFloat(nuevo.cantidad || 0)) > 0.001) return true
          if ((actual.serial || '') !== (nuevo.serial || '')) return true
        }
        
        return false // No cambiaron
      }

      // Verificar si los items cambiaron realmente
      const hayCambiosEnItems = items && itemsCambiaron(movimientoActual.items, items)

      // Si hay items para editar y REALMENTE CAMBIARON, actualizar stock y asignaciones
      if (hayCambiosEnItems) {
        // Obtener costo promedio para items sin costo
        const itemsConCosto = await Promise.all(items.map(async (item: { herramientaId: string; cantidad: number; costoUnitario: number; serial?: string; estado?: string }) => {
          let costoUnitario = parseFloat(item.costoUnitario) || 0
          
          if (movimientoActual.tipo !== 'COMPRA' && costoUnitario === 0) {
            const herramienta = await db.herramienta.findUnique({
              where: { id: item.herramientaId },
              select: { costoPromedio: true }
            })
            costoUnitario = herramienta?.costoPromedio || 0
          }
          
          return {
            ...item,
            costoUnitario,
            cantidad: parseFloat(item.cantidad)
          }
        }))

        await db.$transaction(async (tx) => {
          // 1. Revertir el efecto de los items antiguos
          for (const itemAntiguo of movimientoActual.items) {
            const cantidadAntigua = itemAntiguo.cantidad

            switch (movimientoActual.tipo) {
              case 'COMPRA': {
                const stock = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeDestinoId!, 
                      herramientaId: itemAntiguo.herramientaId 
                    } 
                  }
                })
                if (stock) {
                  await tx.stock.update({
                    where: { id: stock.id },
                    data: { cantidad: { decrement: cantidadAntigua } }
                  })
                }
                break
              }
              case 'TRANSFERENCIA': {
                // Devolver a origen
                const stockOrigen = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeOrigenId!, 
                      herramientaId: itemAntiguo.herramientaId 
                    } 
                  }
                })
                if (stockOrigen) {
                  await tx.stock.update({
                    where: { id: stockOrigen.id },
                    data: { cantidad: { increment: cantidadAntigua } }
                  })
                }
                // Quitar de destino
                const stockDestino = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeDestinoId!, 
                      herramientaId: itemAntiguo.herramientaId 
                    } 
                  }
                })
                if (stockDestino) {
                  await tx.stock.update({
                    where: { id: stockDestino.id },
                    data: { cantidad: { decrement: cantidadAntigua } }
                  })
                }
                break
              }
              case 'SALIDA': {
                const stockSede = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeOrigenId!, 
                      herramientaId: itemAntiguo.herramientaId 
                    } 
                  }
                })
                if (stockSede) {
                  await tx.stock.update({
                    where: { id: stockSede.id },
                    data: { cantidad: { increment: cantidadAntigua } }
                  })
                }
                // CORREGIDO: Eliminar la asignación completamente (no marcar como devuelto)
                // Esto evita duplicados y problemas con el cálculo de pendientes
                const asignacion = await tx.asignacionTecnico.findFirst({
                  where: {
                    tecnicoId: movimientoActual.tecnicoId!,
                    herramientaId: itemAntiguo.herramientaId,
                    cantidadDevuelta: 0 // Solo eliminar asignaciones sin devoluciones
                  },
                  orderBy: { fechaAsignacion: 'desc' } // La más reciente primero
                })
                if (asignacion) {
                  await tx.asignacionTecnico.delete({
                    where: { id: asignacion.id }
                  })
                }
                break
              }
              case 'DEVOLUCION_TECNICO': {
                const stockSede = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeDestinoId!, 
                      herramientaId: itemAntiguo.herramientaId 
                    } 
                  }
                })
                if (stockSede) {
                  await tx.stock.update({
                    where: { id: stockSede.id },
                    data: { cantidad: { decrement: cantidadAntigua } }
                  })
                }
                // CORREGIDO: Reactivar asignación reduciendo cantidadDevuelta
                const asignacion = await tx.asignacionTecnico.findFirst({
                  where: {
                    tecnicoId: movimientoActual.tecnicoId!,
                    herramientaId: itemAntiguo.herramientaId,
                    cantidadDevuelta: { gt: 0 } // Buscar asignaciones con devoluciones
                  },
                  orderBy: { fechaDevolucion: 'desc' }
                })
                if (asignacion) {
                  const nuevaCantidadDevuelta = asignacion.cantidadDevuelta - cantidadAntigua
                  await tx.asignacionTecnico.update({
                    where: { id: asignacion.id },
                    data: { 
                      cantidadDevuelta: nuevaCantidadDevuelta,
                      estado: nuevaCantidadDevuelta < asignacion.cantidad ? 'asignado' : 'devuelto',
                      fechaDevolucion: null
                    }
                  })
                }
                break
              }
              case 'BAJA': {
                const stockSede = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeOrigenId!, 
                      herramientaId: itemAntiguo.herramientaId 
                    } 
                  }
                })
                if (stockSede) {
                  await tx.stock.update({
                    where: { id: stockSede.id },
                    data: { cantidad: { increment: cantidadAntigua } }
                  })
                }
                break
              }
            }
          }

          // 2. Eliminar items antiguos
          await tx.movimientoItem.deleteMany({ where: { movimientoId: id } })

          // 3. Crear nuevos items
          const nuevosItems = itemsConCosto.map((item) => ({
            movimientoId: id,
            herramientaId: item.herramientaId,
            cantidad: item.cantidad,
            costoUnitario: item.costoUnitario,
            costoTotal: item.cantidad * item.costoUnitario,
            serial: item.serial,
            estado: item.estado
          }))

          await tx.movimientoItem.createMany({ data: nuevosItems })

          // 4. Aplicar el efecto de los nuevos items
          for (const item of itemsConCosto) {
            switch (movimientoActual.tipo) {
              case 'COMPRA': {
                const stockExistente = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeDestinoId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (stockExistente) {
                  const nuevoCostoPromedio = calculateCostoPromedio(
                    stockExistente.cantidad,
                    stockExistente.costoPromedio,
                    item.cantidad,
                    item.costoUnitario
                  )
                  await tx.stock.update({
                    where: { id: stockExistente.id },
                    data: {
                      cantidad: { increment: item.cantidad },
                      costoPromedio: nuevoCostoPromedio
                    }
                  })
                } else {
                  await tx.stock.create({
                    data: {
                      sedeId: movimientoActual.sedeDestinoId!,
                      herramientaId: item.herramientaId,
                      cantidad: item.cantidad,
                      costoPromedio: item.costoUnitario
                    }
                  })
                }
                break
              }
              case 'TRANSFERENCIA': {
                const stockOrigen = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeOrigenId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (!stockOrigen || stockOrigen.cantidad < item.cantidad) {
                  throw new Error(`Stock insuficiente para ${item.herramientaId} en sede origen`)
                }
                await tx.stock.update({
                  where: { id: stockOrigen.id },
                  data: { cantidad: { decrement: item.cantidad } }
                })

                const stockDestino = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeDestinoId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (stockDestino) {
                  await tx.stock.update({
                    where: { id: stockDestino.id },
                    data: { cantidad: { increment: item.cantidad } }
                  })
                } else {
                  await tx.stock.create({
                    data: {
                      sedeId: movimientoActual.sedeDestinoId!,
                      herramientaId: item.herramientaId,
                      cantidad: item.cantidad,
                      costoPromedio: item.costoUnitario
                    }
                  })
                }
                break
              }
              case 'SALIDA': {
                const stockSede = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeOrigenId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (!stockSede || stockSede.cantidad < item.cantidad) {
                  throw new Error(`Stock insuficiente para ${item.herramientaId} en la sede`)
                }
                await tx.stock.update({
                  where: { id: stockSede.id },
                  data: { cantidad: { decrement: item.cantidad } }
                })

                await tx.asignacionTecnico.create({
                  data: {
                    tecnicoId: movimientoActual.tecnicoId!,
                    herramientaId: item.herramientaId,
                    sedeId: movimientoActual.sedeOrigenId!,
                    cantidad: item.cantidad,
                    cantidadDevuelta: 0,
                    // CORREGIDO: Usar fecha editada si existe, sino la fecha original del movimiento
                    fechaAsignacion: fechaMovimiento || movimientoActual.fecha,
                    serial: item.serial
                  }
                })
                break
              }
              case 'DEVOLUCION_TECNICO': {
                const stockSede = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeDestinoId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (stockSede) {
                  await tx.stock.update({
                    where: { id: stockSede.id },
                    data: { cantidad: { increment: item.cantidad } }
                  })
                } else {
                  await tx.stock.create({
                    data: {
                      sedeId: movimientoActual.sedeDestinoId!,
                      herramientaId: item.herramientaId,
                      cantidad: item.cantidad,
                      costoPromedio: item.costoUnitario
                    }
                  })
                }

                // CORREGIDO: Buscar asignación con cantidad pendiente y actualizar correctamente
                const asignacion = await tx.asignacionTecnico.findFirst({
                  where: {
                    tecnicoId: movimientoActual.tecnicoId!,
                    herramientaId: item.herramientaId,
                    estado: 'asignado'
                  },
                  orderBy: { fechaAsignacion: 'asc' } // FIFO: Primero en entrar, primero en salir
                })
                if (asignacion) {
                  const nuevaCantidadDevuelta = asignacion.cantidadDevuelta + item.cantidad
                  const cantidadPendiente = asignacion.cantidad - nuevaCantidadDevuelta
                  
                  await tx.asignacionTecnico.update({
                    where: { id: asignacion.id },
                    data: { 
                      cantidadDevuelta: nuevaCantidadDevuelta,
                      estado: cantidadPendiente <= 0 ? 'devuelto' : 'asignado',
                      fechaDevolucion: cantidadPendiente <= 0 ? new Date() : null,
                      estadoHerramienta: item.estado
                    }
                  })
                }
                break
              }
              case 'BAJA': {
                const stockSede = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimientoActual.sedeOrigenId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (!stockSede || stockSede.cantidad < item.cantidad) {
                  throw new Error(`Stock insuficiente para dar de baja`)
                }
                await tx.stock.update({
                  where: { id: stockSede.id },
                  data: { cantidad: { decrement: item.cantidad } }
                })
                break
              }
            }
          }

          // 5. Actualizar cabecera del movimiento
          await tx.movimiento.update({
            where: { id },
            data: {
              fecha: fechaMovimiento,
              proveedor,
              comprobante,
              observaciones
            }
          })
        })

        return NextResponse.json({ message: 'Movimiento actualizado correctamente' })
      }

      // Si solo se edita la cabecera (sin items)
      const movimiento = await db.movimiento.update({
        where: { id },
        data: {
          fecha: fechaMovimiento,
          proveedor,
          comprobante,
          observaciones
        }
      })

      return NextResponse.json(movimiento)
    }  

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('Error al procesar movimiento:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE - Eliminar movimiento (solo admin)
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo el administrador puede eliminar movimientos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const movimiento = await db.movimiento.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!movimiento) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
    }

    // Si no está anulado, primero revertir stock
    if (!movimiento.anulado) {
      await db.$transaction(async (tx) => {
        // Revertir stock (misma lógica que anulación)
        for (const item of movimiento.items) {
          const cantidad = item.cantidad

          switch (movimiento.tipo) {
            case 'COMPRA': {
              const stock = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeDestinoId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stock) {
                await tx.stock.update({
                  where: { id: stock.id },
                  data: { cantidad: { decrement: cantidad } }
                })
              }
              break
            }
            case 'TRANSFERENCIA_SALIDA':
            case 'TRANSFERENCIA_INGRESO': {
              // Buscar y eliminar también el movimiento complementario
              const prefijo = movimiento.numero.includes('-S-') 
                ? movimiento.numero.replace('-S-', '-I-')
                : movimiento.numero.replace('-I-', '-S-')
              
              const movimientoComplementario = await tx.movimiento.findFirst({
                where: { numero: prefijo }
              })

              if (movimientoComplementario) {
                // Revertir stock del complementario
                for (const itemComp of movimientoComplementario.items) {
                  if (movimientoComplementario.tipo === 'TRANSFERENCIA_SALIDA') {
                    const stockOrigen = await tx.stock.findUnique({
                      where: { 
                        sedeId_herramientaId: { 
                          sedeId: movimientoComplementario.sedeOrigenId!, 
                          herramientaId: itemComp.herramientaId 
                        } 
                      }
                    })
                    if (stockOrigen) {
                      await tx.stock.update({
                        where: { id: stockOrigen.id },
                        data: { cantidad: { increment: itemComp.cantidad } }
                      })
                    }
                  } else {
                    const stockDestino = await tx.stock.findUnique({
                      where: { 
                        sedeId_herramientaId: { 
                          sedeId: movimientoComplementario.sedeDestinoId!, 
                          herramientaId: itemComp.herramientaId 
                        } 
                      }
                    })
                    if (stockDestino) {
                      await tx.stock.update({
                        where: { id: stockDestino.id },
                        data: { cantidad: { decrement: itemComp.cantidad } }
                      })
                    }
                  }
                }
                await tx.movimientoItem.deleteMany({ where: { movimientoId: movimientoComplementario.id } })
                await tx.movimiento.delete({ where: { id: movimientoComplementario.id } })
              }

              // Revertir stock del movimiento actual
              if (movimiento.tipo === 'TRANSFERENCIA_SALIDA') {
                const stockOrigen = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimiento.sedeOrigenId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (stockOrigen) {
                  await tx.stock.update({
                    where: { id: stockOrigen.id },
                    data: { cantidad: { increment: cantidad } }
                  })
                }
              } else {
                const stockDestino = await tx.stock.findUnique({
                  where: { 
                    sedeId_herramientaId: { 
                      sedeId: movimiento.sedeDestinoId!, 
                      herramientaId: item.herramientaId 
                    } 
                  }
                })
                if (stockDestino) {
                  await tx.stock.update({
                    where: { id: stockDestino.id },
                    data: { cantidad: { decrement: cantidad } }
                  })
                }
              }
              break
            }
            case 'TRANSFERENCIA': {
              const stockOrigen = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeOrigenId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockOrigen) {
                await tx.stock.update({
                  where: { id: stockOrigen.id },
                  data: { cantidad: { increment: cantidad } }
                })
              }
              const stockDestino = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeDestinoId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockDestino) {
                await tx.stock.update({
                  where: { id: stockDestino.id },
                  data: { cantidad: { decrement: cantidad } }
                })
              }
              break
            }
            case 'SALIDA': {
              const stockSede = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeOrigenId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockSede) {
                await tx.stock.update({
                  where: { id: stockSede.id },
                  data: { cantidad: { increment: cantidad } }
                })
              }
              const asignacion = await tx.asignacionTecnico.findFirst({
                where: {
                  tecnicoId: movimiento.tecnicoId!,
                  herramientaId: item.herramientaId,
                  estado: 'asignado'
                }
              })
              if (asignacion) {
                await tx.asignacionTecnico.update({
                  where: { id: asignacion.id },
                  data: { estado: 'devuelto', fechaDevolucion: new Date() }
                })
              }
              break
            }
            case 'DEVOLUCION_TECNICO': {
              const stockSede = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeDestinoId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockSede) {
                await tx.stock.update({
                  where: { id: stockSede.id },
                  data: { cantidad: { decrement: cantidad } }
                })
              }
              const asignacion = await tx.asignacionTecnico.findFirst({
                where: {
                  tecnicoId: movimiento.tecnicoId!,
                  herramientaId: item.herramientaId,
                  estado: 'devuelto'
                },
                orderBy: { fechaDevolucion: 'desc' }
              })
              if (asignacion) {
                await tx.asignacionTecnico.update({
                  where: { id: asignacion.id },
                  data: { estado: 'asignado', fechaDevolucion: null }
                })
              }
              break
            }
            case 'BAJA': {
              const stockSede = await tx.stock.findUnique({
                where: { 
                  sedeId_herramientaId: { 
                    sedeId: movimiento.sedeOrigenId!, 
                    herramientaId: item.herramientaId 
                  } 
                }
              })
              if (stockSede) {
                await tx.stock.update({
                  where: { id: stockSede.id },
                  data: { cantidad: { increment: cantidad } }
                })
              }
              break
            }
          }
        }

        // Eliminar items y movimiento
        await tx.movimientoItem.deleteMany({ where: { movimientoId: id } })
        await tx.movimiento.delete({ where: { id } })
      })
    } else {
      // Si ya está anulado, solo eliminar
      await db.$transaction(async (tx) => {
        await tx.movimientoItem.deleteMany({ where: { movimientoId: id } })
        await tx.movimiento.delete({ where: { id } })
      })
    }

    return NextResponse.json({ message: 'Movimiento eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar movimiento:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
