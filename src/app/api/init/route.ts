import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// POST - Inicializar datos por defecto
export async function POST() {
  try {
    // Hashear contraseñas
    const hashedAdminPassword = await bcrypt.hash('admin123', 10)
    const hashedSupervisorPassword = await bcrypt.hash('super123', 10)
    const hashedWarehousePassword = await bcrypt.hash('almacen123', 10)

    // Crear usuario admin si no existe
    const existingAdmin = await db.user.findUnique({ where: { email: 'admin@test.com' } })
    
    if (!existingAdmin) {
      await db.user.create({
        data: {
          email: 'admin@test.com',
          name: 'Administrador',
          password: hashedAdminPassword,
          role: 'admin',
          active: true
        }
      })
    }

    // Crear usuario supervisor si no existe
    const existingSupervisor = await db.user.findUnique({ where: { email: 'supervisor@test.com' } })
    
    if (!existingSupervisor) {
      await db.user.create({
        data: {
          email: 'supervisor@test.com',
          name: 'Supervisor',
          password: hashedSupervisorPassword,
          role: 'supervisor',
          active: true
        }
      })
    }

    // Crear sedes si no existen
    const sedesCount = await db.sede.count()
    if (sedesCount === 0) {
      await db.sede.createMany({
        data: [
          { nombre: 'Sede Principal', direccion: 'Av. Principal 123', telefono: '01-1234567' },
          { nombre: 'Sede Norte', direccion: 'Calle Norte 456', telefono: '01-2345678' },
          { nombre: 'Sede Sur', direccion: 'Jr. Sur 789', telefono: '01-3456789' },
          { nombre: 'Sede Este', direccion: 'Av. Este 321', telefono: '01-4567890' }
        ]
      })
    }

    // Crear categorías si no existen
    const categoriasCount = await db.categoria.count()
    if (categoriasCount === 0) {
      await db.categoria.createMany({
        data: [
          { nombre: 'Herramientas Eléctricas', descripcion: 'Taladros, sierras, lijadoras eléctricas' },
          { nombre: 'Herramientas Manuales', descripcion: 'Destornilladores, llaves, martillos' },
          { nombre: 'Equipos de Seguridad', descripcion: 'Cascos, guantes, botas, arneses' },
          { nombre: 'Equipos de Medición', descripcion: 'Multímetros, térmometros, niveles' },
          { nombre: 'Consumibles', descripcion: 'Cintas, adhesivos, lubricantes' }
        ]
      })
    }

    // Crear usuario de almacén
    const sede = await db.sede.findFirst()
    const existingWarehouse = await db.user.findUnique({ where: { email: 'almacen@test.com' } })
    
    if (!existingWarehouse && sede) {
      await db.user.create({
        data: {
          email: 'almacen@test.com',
          name: 'Encargado de Almacén',
          password: hashedWarehousePassword,
          role: 'warehouse',
          sedeId: sede.id,
          active: true
        }
      })
    }

    // Crear algunas herramientas de ejemplo
    const herramientasCount = await db.herramienta.count()
    const categoria = await db.categoria.findFirst()
    
    if (herramientasCount === 0 && categoria) {
      await db.herramienta.createMany({
        data: [
          { codigo: 'B0001', nombre: 'BOTA DIELÉCTRICA', unidad: 'PAR', categoriaId: categoria.id, marca: 'SegPro', controlaStock: true, stockMinimo: 5, stockMaximo: 20, activo: true },
          { codigo: 'CH001', nombre: 'CHALECO REFLECTIVO', unidad: 'UND', categoriaId: categoria.id, marca: 'SafeWork', controlaStock: true, stockMinimo: 10, stockMaximo: 50, activo: true },
          { codigo: 'CS001', nombre: 'CASCO DE SEGURIDAD', unidad: 'UND', categoriaId: categoria.id, marca: 'ProtecHead', controlaStock: true, stockMinimo: 10, stockMaximo: 30, activo: true },
          { codigo: 'GV001', nombre: 'GUANTES DE SEGURIDAD', unidad: 'PAR', categoriaId: categoria.id, marca: 'HandPro', controlaStock: true, stockMinimo: 20, stockMaximo: 100, activo: true },
          { codigo: 'AR001', nombre: 'ARNÉS DE SEGURIDAD', unidad: 'UND', categoriaId: categoria.id, marca: 'SafeClimb', controlaStock: true, stockMinimo: 3, stockMaximo: 15, activo: true }
        ]
      })
    }

    // Crear técnicos de ejemplo
    const tecnicosCount = await db.tecnico.count()
    const primeraSede = await db.sede.findFirst()
    
    if (tecnicosCount === 0 && primeraSede) {
      await db.tecnico.createMany({
        data: [
          { dni: '12345678', nombre: 'Juan', apellido: 'Pérez García', telefono: '999888777', sedeId: primeraSede.id, numeroCuadrilla: 'C-001', activo: true },
          { dni: '87654321', nombre: 'María', apellido: 'López Torres', telefono: '999777666', sedeId: primeraSede.id, numeroCuadrilla: 'C-001', activo: true },
          { dni: '11223344', nombre: 'Carlos', apellido: 'Ramírez Mendoza', telefono: '999666555', sedeId: primeraSede.id, numeroCuadrilla: 'C-002', activo: true }
        ]
      })
    }

    return NextResponse.json({ 
      message: 'Datos inicializados correctamente',
      users: await db.user.count(),
      sedes: await db.sede.count(),
      categorias: await db.categoria.count(),
      herramientas: await db.herramienta.count(),
      tecnicos: await db.tecnico.count()
    })
  } catch (error) {
    console.error('Error al inicializar datos:', error)
    return NextResponse.json({ error: 'Error al inicializar datos' }, { status: 500 })
  }
}

// GET - Verificar estado de inicialización
export async function GET() {
  try {
    const users = await db.user.count()
    const sedes = await db.sede.count()
    const categorias = await db.categoria.count()
    const herramientas = await db.herramienta.count()
    const tecnicos = await db.tecnico.count()

    return NextResponse.json({
      initialized: users > 0,
      stats: { users, sedes, categorias, herramientas, tecnicos }
    })
  } catch (error) {
    console.error('Error al verificar estado:', error)
    return NextResponse.json({ error: 'Error al verificar estado' }, { status: 500 })
  }
}