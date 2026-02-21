import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Listar todas las categorías
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const categorias = await db.categoria.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { herramientas: true }
        }
      }
    })

    return NextResponse.json(categorias)
  } catch (error) {
    console.error('Error al obtener categorías:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear nueva categoría
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { nombre, descripcion } = body

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const existing = await db.categoria.findUnique({ where: { nombre } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 })
    }

    const categoria = await db.categoria.create({
      data: { nombre, descripcion }
    })

    return NextResponse.json(categoria, { status: 201 })
  } catch (error) {
    console.error('Error al crear categoría:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
