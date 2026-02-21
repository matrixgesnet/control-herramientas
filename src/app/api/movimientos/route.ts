import { db } from '@/lib/db'
import { getCurrentUser, generateMovimientoNumero, calculateCostoPromedio } from '@/lib/utils-server'
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
    let fechaMovimiento = new Date()
    if (fecha) {
      fechaMovimiento = new Date(fecha)
      
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

    // Generar número de movimiento
    const numero = await generateMovimientoNumero(tipo)

    // Usar transacción para garantizar integridad
    const result = await db.$transaction(async (tx) => {
      // Crear el movimiento
      const movimiento = await tx.movimiento.create({
        data: {
          numero,
          fecha: fechaMovimiento,
          tipo,
          sedeOrigenId: ['TRANSFERENCIA', 'SALIDA', 'BAJA'].includes(tipo) ? sedeOrigenId : null,
          sedeDestinoId: ['COMPRA', 'TRANSFERENCIA', 'DEVOLUCION_TECNICO'].includes(tipo) ? sedeDestinoId : null,
          tecnicoId: ['SALIDA', 'DEVOLUCION_TECNICO'].includes(tipo) ? tecnicoId : null,
          proveedor: tipo === 'COMPRA' ? proveedor : null,
          comprobante,
          observaciones,
          usuarioId: user.id,
          items: {
            create: items.map((item: { herramientaId: string; cantidad: number; costoUnitario: number; serial?: string; estado?: string }) => ({
              herramientaId: item.herramientaId,
              cantidad: parseFloat(item.cantidad),
              costoUnitario: parseFloat(item.costoUnitario) || 0,
              costoTotal: parseFloat(item.cantidad) * parseFloat(item.costoUnitario || 0),
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
      for (const item of items) {
        const cantidad = parseFloat(item.cantidad)
        const costoUnitario = parseFloat(item.costoUnitario) || 0

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
                cantidad,
                costoUnitario
              )
              await tx.stock.update({
                where: { id: stockExistente.id },
                data: {
                  cantidad: { increment: cantidad },
                  costoPromedio: nuevoCostoPromedio
                }
              })
            } else {
              await tx.stock.create({
                data: {
                  sedeId: sedeDestinoId,
                  herramientaId: item.herramientaId,
                  cantidad,
                  costoPromedio: costoUnitario
                }
              })
            }

            // Actualizar costo promedio global de la herramienta
            const herramienta = await tx.herramienta.findUnique({ where: { id: item.herramientaId } })
            if (herramienta) {
              const nuevoCostoGlobal = calculateCostoPromedio(
                herramienta.costoPromedio > 0 ? 1 : 0,
                herramienta.costoPromedio,
                cantidad,
                costoUnitario
              )
              await tx.herramienta.update({
                where: { id: item.herramientaId },
                data: { costoPromedio: nuevoCostoGlobal }
              })
            }
            break
          }

          case 'TRANSFERENCIA': {
            // Decrementar en origen
            const stockOrigen = await tx.stock.findUnique({
              where: { sedeId_herramientaId: { sedeId: sedeOrigenId, herramientaId: item.herramientaId } }
            })
            
            if (!stockOrigen || stockOrigen.cantidad < cantidad) {
              throw new Error(`Stock insuficiente para ${item.herramientaId} en sede origen`)
            }

            await tx.stock.update({
              where: { id: stockOrigen.id },
              data: { cantidad: { decrement: cantidad } }
            })

            // Incrementar en destino
            const stockDestino = await tx.stock.findUnique({
              where: { sedeId_herramientaId: { sedeId: sedeDestinoId, herramientaId: item.herramientaId } }
            })

            if (stockDestino) {
              await tx.stock.update({
                where: { id: stockDestino.id },
                data: { cantidad: { increment: cantidad } }
              })
            } else {
              await tx.stock.create({
                data: {
                  sedeId: sedeDestinoId,
                  herramientaId: item.herramientaId,
                  cantidad,
                  costoPromedio: stockOrigen.costoPromedio
                }
              })
            }
            break
          }

          case 'SALIDA': {
            // Decrementar stock de la sede
            const stockSede = await tx.stock.findUnique({
              where: { sedeId_herramientaId: { sedeId: sedeOrigenId, herramientaId: item.herramientaId } }
            })
            
            if (!stockSede || stockSede.cantidad < cantidad) {
              throw new Error(`Stock insuficiente para ${item.herramientaId} en la sede`)
            }

            await tx.stock.update({
              where: { id: stockSede.id },
              data: { cantidad: { decrement: cantidad } }
            })

            // Crear asignación al técnico
            await tx.asignacionTecnico.create({
              data: {
                tecnicoId,
                herramientaId: item.herramientaId,
                sedeId: sedeOrigenId,
                cantidad,
                serial: item.serial
              }
            })
            break
          }

          case 'DEVOLUCION_TECNICO': {
            // Buscar la asignación activa
            const asignacion = await tx.asignacionTecnico.findFirst({
              where: {
                tecnicoId,
                herramientaId: item.herramientaId,
                estado: 'asignado'
              }
            })

            if (!asignacion) {
              throw new Error(`No se encontró asignación activa para ${item.herramientaId} al técnico`)
            }

            // Marcar como devuelta
            await tx.asignacionTecnico.update({
              where: { id: asignacion.id },
              data: {
                estado: 'devuelto',
                fechaDevolucion: new Date(),
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
                data: { cantidad: { increment: cantidad } }
              })
            } else {
              await tx.stock.create({
                data: {
                  sedeId: sedeDestinoId,
                  herramientaId: item.herramientaId,
                  cantidad
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
            
            if (!stockSede || stockSede.cantidad < cantidad) {
              throw new Error(`Stock insuficiente para dar de baja`)
            }

            await tx.stock.update({
              where: { id: stockSede.id },
              data: { cantidad: { decrement: cantidad } }
            })
            break
          }
        }
      }

      return movimiento
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

            case 'TRANSFERENCIA': {
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

              // Reactivar asignación
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
  // Si es edición
if (accion === 'editar') {
  const { fecha, proveedor, comprobante, observaciones, items } = body

  // Validar fecha
  let fechaMovimiento = undefined
  if (fecha) {
    fechaMovimiento = new Date(fecha)
    
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

  // Si hay items para editar, actualizar stock
  if (items && items.length > 0) {
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
            // Quitar asignación
            const asignacion = await tx.asignacionTecnico.findFirst({
              where: {
                tecnicoId: movimientoActual.tecnicoId!,
                herramientaId: itemAntiguo.herramientaId,
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
            // Reactivar asignación
            const asignacion = await tx.asignacionTecnico.findFirst({
              where: {
                tecnicoId: movimientoActual.tecnicoId!,
                herramientaId: itemAntiguo.herramientaId,
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
      const nuevosItems = items.map((item: { herramientaId: string; cantidad: number; costoUnitario: number; serial?: string }) => ({
        movimientoId: id,
        herramientaId: item.herramientaId,
        cantidad: parseFloat(item.cantidad),
        costoUnitario: parseFloat(item.costoUnitario) || 0,
        costoTotal: parseFloat(item.cantidad) * parseFloat(item.costoUnitario || 0),
        serial: item.serial
      }))

      await tx.movimientoItem.createMany({ data: nuevosItems })

      // 4. Aplicar el efecto de los nuevos items
      for (const item of items) {
        const cantidad = parseFloat(item.cantidad)
        const costoUnitario = parseFloat(item.costoUnitario) || 0

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
                cantidad,
                costoUnitario
              )
              await tx.stock.update({
                where: { id: stockExistente.id },
                data: {
                  cantidad: { increment: cantidad },
                  costoPromedio: nuevoCostoPromedio
                }
              })
            } else {
              await tx.stock.create({
                data: {
                  sedeId: movimientoActual.sedeDestinoId!,
                  herramientaId: item.herramientaId,
                  cantidad,
                  costoPromedio: costoUnitario
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
            if (!stockOrigen || stockOrigen.cantidad < cantidad) {
              throw new Error(`Stock insuficiente para ${item.herramientaId} en sede origen`)
            }
            await tx.stock.update({
              where: { id: stockOrigen.id },
              data: { cantidad: { decrement: cantidad } }
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
                data: { cantidad: { increment: cantidad } }
              })
            } else {
              await tx.stock.create({
                data: {
                  sedeId: movimientoActual.sedeDestinoId!,
                  herramientaId: item.herramientaId,
                  cantidad,
                  costoPromedio: stockOrigen.costoPromedio
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
            if (!stockSede || stockSede.cantidad < cantidad) {
              throw new Error(`Stock insuficiente para ${item.herramientaId} en la sede`)
            }
            await tx.stock.update({
              where: { id: stockSede.id },
              data: { cantidad: { decrement: cantidad } }
            })

            await tx.asignacionTecnico.create({
              data: {
                tecnicoId: movimientoActual.tecnicoId!,
                herramientaId: item.herramientaId,
                sedeId: movimientoActual.sedeOrigenId!,
                cantidad,
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
                data: { cantidad: { increment: cantidad } }
              })
            } else {
              await tx.stock.create({
                data: {
                  sedeId: movimientoActual.sedeDestinoId!,
                  herramientaId: item.herramientaId,
                  cantidad
                }
              })
            }

            const asignacion = await tx.asignacionTecnico.findFirst({
              where: {
                tecnicoId: movimientoActual.tecnicoId!,
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
          case 'BAJA': {
            const stockSede = await tx.stock.findUnique({
              where: { 
                sedeId_herramientaId: { 
                  sedeId: movimientoActual.sedeOrigenId!, 
                  herramientaId: item.herramientaId 
                } 
              }
            })
            if (!stockSede || stockSede.cantidad < cantidad) {
              throw new Error(`Stock insuficiente para dar de baja`)
            }
            await tx.stock.update({
              where: { id: stockSede.id },
              data: { cantidad: { decrement: cantidad } }
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