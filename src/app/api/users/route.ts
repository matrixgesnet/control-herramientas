import { db } from '@/lib/db'
import { hasRole } from '@/lib/utils-server'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// GET - Listar usuarios
export async function GET() {
  try {
    if (!await hasRole('admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        sedeId: true,
        sede: { select: { nombre: true } },
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error al obtener usuarios:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear usuario
export async function POST(request: Request) {
  try {
    if (!await hasRole('admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { email, name, password, role, sedeId } = body

    if (!email || !name || !password || !role) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 400 })
    }

    // Hashear contraseña con bcrypt
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await db.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
        sedeId: role === 'warehouse' ? sedeId : null
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        sedeId: true
      }
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error al crear usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PUT - Actualizar usuario
export async function PUT(request: Request) {
  try {
    if (!await hasRole('admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, password, ...data } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // Construir objeto de actualización
    const updateData: Record<string, unknown> = {
      ...data,
      sedeId: data.role === 'warehouse' ? data.sedeId : null
    }

    // Si se proporciona una nueva contraseña, hashearla
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        sedeId: true
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error al actualizar usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}