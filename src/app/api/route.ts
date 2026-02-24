import { db } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/utils-server'
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
        sede: { select: { id: true, nombre: true } },
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
      return NextResponse.json({ error: 'Email, nombre, contraseña y rol son requeridos' }, { status: 400 })
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
        sedeId: role === 'warehouse' ? sedeId : null,
        active: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        sedeId: true,
        sede: { select: { id: true, nombre: true } }
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
    const { id, email, name, password, role, sedeId, active } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // Verificar si el email ya existe en otro usuario
    if (email) {
      const existing = await db.user.findFirst({
        where: { email, NOT: { id } }
      })
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 400 })
      }
    }

    // Construir datos a actualizar
    const updateData: Record<string, unknown> = {}
    
    if (email) updateData.email = email
    if (name) updateData.name = name
    if (role) {
      updateData.role = role
      updateData.sedeId = role === 'warehouse' ? sedeId : null
    }
    if (active !== undefined) updateData.active = active
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10)
    }
    if (role === 'warehouse' && sedeId) {
      updateData.sedeId = sedeId
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
        sedeId: true,
        sede: { select: { id: true, nombre: true } }
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error al actualizar usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE - Desactivar usuario
export async function DELETE(request: Request) {
  try {
    if (!await hasRole('admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // No permitir desactivar el último admin
    const user = await db.user.findUnique({ where: { id } })
    if (user?.role === 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin', active: true } })
      if (adminCount <= 1) {
        return NextResponse.json({ 
          error: 'No se puede desactivar el último administrador' 
        }, { status: 400 })
      }
    }

    // Desactivar en lugar de eliminar
    await db.user.update({
      where: { id },
      data: { active: false }
    })

    return NextResponse.json({ message: 'Usuario desactivado' })
  } catch (error) {
    console.error('Error al desactivar usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
