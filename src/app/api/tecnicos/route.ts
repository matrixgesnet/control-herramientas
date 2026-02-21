import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Listar técnicos
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sedeId = searchParams.get('sedeId')
    const activo = searchParams.get('activo')

    const where: Record<string, unknown> = {}
    
    if (sedeId) {
      where.sedeId = sedeId
    }
    
    if (activo !== null) {
      where.activo = activo === 'true'
    }

    const tecnicos = await db.tecnico.findMany({
      where,
      orderBy: [{ nombre: 'asc' }],
      include: {
        sede: true,
        asignaciones: {
          where: { estado: 'asignado' },
          include: { herramienta: true }
        }
      }
    })

    return NextResponse.json(tecnicos)
  } catch (error) {
    console.error('Error al obtener técnicos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear técnico
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { dni, nombre, apellido, telefono, sedeId, numeroCuadrilla, fechaIngreso } = body

    if (!dni || !nombre || !sedeId) {
      return NextResponse.json({ error: 'DNI, nombre y sede son requeridos' }, { status: 400 })
    }

    const existing = await db.tecnico.findUnique({ where: { dni } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un técnico con ese DNI' }, { status: 400 })
    }

    const tecnico = await db.tecnico.create({
      data: {
        dni,
        nombre,
        apellido,
        telefono,
        sedeId,
        numeroCuadrilla,
        fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : new Date()
      },
      include: { sede: true }
    })

    return NextResponse.json(tecnico, { status: 201 })
  } catch (error) {
    console.error('Error al crear técnico:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PUT - Actualizar técnico
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

    // Si se está actualizando el DNI, verificar que no exista
    if (data.dni) {
      const existing = await db.tecnico.findFirst({
        where: { dni: data.dni, NOT: { id } }
      })
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un técnico con ese DNI' }, { status: 400 })
      }
    }

    const tecnico = await db.tecnico.update({
      where: { id },
      data: {
        ...data,
        fechaIngreso: data.fechaIngreso ? new Date(data.fechaIngreso) : undefined
      },
      include: { sede: true }
    })

    return NextResponse.json(tecnico)
  } catch (error) {
    console.error('Error al actualizar técnico:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE - Desactivar técnico
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

    // Verificar si tiene herramientas asignadas
    const asignacionesActivas = await db.asignacionTecnico.findFirst({
      where: { tecnicoId: id, estado: 'asignado' }
    })

    if (asignacionesActivas) {
      return NextResponse.json({ 
        error: 'El técnico tiene herramientas asignadas. Debe devolverlas antes de desactivarlo.' 
      }, { status: 400 })
    }

    // Desactivar en lugar de eliminar
    await db.tecnico.update({
      where: { id },
      data: { activo: false }
    })

    return NextResponse.json({ message: 'Técnico desactivado' })
  } catch (error) {
    console.error('Error al desactivar técnico:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
