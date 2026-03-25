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
    const conStockPorSede = searchParams.get('conStockPorSede') // Nuevo parámetro

    const where: Record<string, unknown> = {}
    
    if (categoriaId) {
      where.categoriaId = categoriaId
    }
    
    if (activo !== null) {
      where.activo = activo === 'true'
    }

    // Obtener todas las sedes activas
    const sedes = await db.sede.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    })

    const herramientas = await db.herramienta.findMany({
      where,
      orderBy: { nombre: 'asc' }, // Ordenar por nombre
      include: {
        categoria: true,
        stocks: {
          include: { sede: true }
        }
      }
    })

    // Calcular stock total y stock por sede
    const herramientasConStock = herramientas.map(h => {
      // Crear objeto con stock por cada sede
      const stockPorSede: Record<string, number> = {}
      sedes.forEach(sede => {
        const stockSede = h.stocks.find(s => s.sedeId === sede.id)
        stockPorSede[sede.nombre] = stockSede?.cantidad || 0
      })

      return {
        ...h,
        stockTotal: h.stocks.reduce((sum, s) => sum + s.cantidad, 0),
        stockPorSede
      }
    })

    // Si se solicita con stock por sede, devolver objeto con sedes
    if (conStockPorSede === 'true') {
      return NextResponse.json({
        herramientas: herramientasConStock,
        sedes: sedes.map(s => s.nombre)
      })
    }

    // Por defecto, devolver array simple para compatibilidad con otros componentes
    return NextResponse.json(herramientasConStock)
  } catch (error) {
    console.error('Error al obtener herramientas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// Función para generar el siguiente código
async function generarSiguienteCodigo(): Promise<string> {
  // Buscar todos los códigos y encontrar el máximo numérico
  const herramientas = await db.herramienta.findMany({
    select: { codigo: true }
  })
  
  let maxNumero = 1000
  herramientas.forEach(h => {
    const num = parseInt(h.codigo, 10)
    if (!isNaN(num) && num > maxNumero) {
      maxNumero = num
    }
  })
  
  return String(maxNumero + 1)
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

    // Generar código automáticamente
    const codigo = await generarSiguienteCodigo()

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

    // No permitir actualizar el código (es autogenerado y no debe cambiar)

    const herramienta = await db.herramienta.update({
      where: { id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        unidad: data.unidad,
        categoriaId: data.categoriaId,
        marca: data.marca,
        modelo: data.modelo,
        controlaStock: data.controlaStock,
        stockMaximo: data.stockMaximo ? parseFloat(data.stockMaximo) : null,
        stockMinimo: data.stockMinimo ? parseFloat(data.stockMinimo) : null,
        activo: data.activo
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
