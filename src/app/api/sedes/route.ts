import { db } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Listar todas las sedes
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const sedes = await db.sede.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { stocks: true, tecnicos: true }
        }
      }
    })

    return NextResponse.json(sedes)
  } catch (error) {
    console.error('Error al obtener sedes:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear nueva sede
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || !hasRole('admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { nombre, direccion, telefono } = body

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Verificar si ya existe
    const existing = await db.sede.findUnique({ where: { nombre } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una sede con ese nombre' }, { status: 400 })
    }

    const sede = await db.sede.create({
      data: { nombre, direccion, telefono }
    })

    return NextResponse.json(sede, { status: 201 })
  } catch (error) {
    console.error('Error al crear sede:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
