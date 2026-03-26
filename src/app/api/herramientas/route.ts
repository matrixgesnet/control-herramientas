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
    const conStockPorSede = searchParams.get('conStockPorSede')

    const where: Record<string, unknown> = {}
    
    if (categoriaId) {
      where.categoriaId = categoriaId
    }
    
    if (activo !== null) {
      where.activo = activo === 'true'
    }

    // Obtener sedes para el reporte
    const sedes = await db.sede.findMany({
      orderBy: { nombre: 'asc' }
    })

    const herramientas = await db.herramienta.findMany({
      where,
      orderBy: { nombre: 'asc' },
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

    // Si se solicita con stock por sede, retornar objeto con herramientas y sedes
    if (conStockPorSede === 'true') {
      return NextResponse.json({
        herramientas: herramientasConStock,
        sedes
      })
    }

    // Por defecto, retornar solo el array de herramientas (para compatibilidad con combobox)
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
      nombre, descripcion, unidad, categoriaId, 
      marca, modelo, controlaStock, stockMaximo, stockMinimo, activo 
    } = body

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Generar código automático simplificado
    // Obtener todas las herramientas y encontrar el máximo código numérico
    const todasHerramientas = await db.herramienta.findMany({
      select: { codigo: true }
    })

    let maxCodigo = 1000
    for (const h of todasHerramientas) {
      const num = parseInt(h.codigo, 10)
      if (!isNaN(num) && num > maxCodigo) {
        maxCodigo = num
      }
    }

    let nuevoCodigo = (maxCodigo + 1).toString()

    // Verificar que el código no exista (por seguridad)
    let intentos = 0
    let codigoDisponible = false
    while (!codigoDisponible && intentos < 100) {
      const existing = await db.herramienta.findUnique({ where: { codigo: nuevoCodigo } })
      if (existing) {
        maxCodigo++
        nuevoCodigo = (maxCodigo + 1).toString()
        intentos++
      } else {
        codigoDisponible = true
      }
    }

    const herramienta = await db.herramienta.create({
      data: {
        codigo: nuevoCodigo,
        nombre,
        descripcion: descripcion || null,
        unidad: unidad || 'UND',
        categoriaId: categoriaId || null,
        marca: marca || null,
        modelo: modelo || null,
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

    // No permitir actualizar el código desde el frontend
    delete data.codigo

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
