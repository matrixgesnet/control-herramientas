import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Listar todas las herramientas
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoriaId = searchParams.get('categoriaId')
    const activo = searchParams.get('activo')

    const where: Record<string, unknown> = {}
    
    if (categoriaId) {
      where.categoriaId = categoriaId
    }
    
    if (activo !== null) {
      where.activo = activo === 'true'
    }

    const herramientas = await db.herramienta.findMany({
      where,
      orderBy: { codigo: 'asc' },
      include: {
        categoria: true,
        stocks: {
          include: { sede: true }
        }
      }
    })

    // Calcular stock total
    const herramientasConStock = herramientas.map(h => ({
      ...h,
      stockTotal: h.stocks.reduce((sum, s) => sum + s.cantidad, 0)
    }))

    return NextResponse.json(herramientasConStock)
  } catch (error) {
    console.error('Error al obtener herramientas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear nueva herramienta
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      codigo, nombre, descripcion, unidad, categoriaId, 
      marca, modelo, controlaStock, stockMaximo, stockMinimo, activo 
    } = body

    if (!codigo || !nombre) {
      return NextResponse.json({ error: 'Código y nombre son requeridos' }, { status: 400 })
    }

    const existing = await db.herramienta.findUnique({ where: { codigo } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una herramienta con ese código' }, { status: 400 })
    }

    const herramienta = await db.herramienta.create({
      data: {
        codigo,
        nombre,
        descripcion,
        unidad: unidad || 'UND',
        categoriaId,
        marca,
        modelo,
        controlaStock: controlaStock ?? true,
        stockMaximo: stockMaximo ? parseFloat(stockMaximo) : null,
        stockMinimo: stockMinimo ? parseFloat(stockMinimo) : null,
        activo: activo ?? true
      },
      include: { categoria: true }
    })

    return NextResponse.json(herramienta, { status: 201 })
  } catch (error) {
    console.error('Error al crear herramienta:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PUT - Actualizar herramienta
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // Si se está actualizando el código, verificar que no exista
    if (data.codigo) {
      const existing = await db.herramienta.findFirst({
        where: { codigo: data.codigo, NOT: { id } }
      })
      if (existing) {
        return NextResponse.json({ error: 'Ya existe una herramienta con ese código' }, { status: 400 })
      }
    }

    const herramienta = await db.herramienta.update({
      where: { id },
      data: {
        ...data,
        stockMaximo: data.stockMaximo ? parseFloat(data.stockMaximo) : null,
        stockMinimo: data.stockMinimo ? parseFloat(data.stockMinimo) : null
      },
      include: { categoria: true }
    })

    return NextResponse.json(herramienta)
  } catch (error) {
    console.error('Error al actualizar herramienta:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE - Eliminar herramienta
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // Verificar si tiene movimientos
    const tieneMovimientos = await db.movimientoItem.findFirst({
      where: { herramientaId: id }
    })

    if (tieneMovimientos) {
      // En lugar de eliminar, marcar como inactivo
      await db.herramienta.update({
        where: { id },
        data: { activo: false }
      })
      return NextResponse.json({ message: 'Herramienta desactivada' })
    }

    await db.herramienta.delete({ where: { id } })
    return NextResponse.json({ message: 'Herramienta eliminada' })
  } catch (error) {
    console.error('Error al eliminar herramienta:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
