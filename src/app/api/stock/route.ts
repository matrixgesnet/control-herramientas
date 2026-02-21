import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'

// GET - Obtener stock actual
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sedeId = searchParams.get('sedeId')
    const herramientaId = searchParams.get('herramientaId')

    const where: Record<string, unknown> = {}
    
    if (sedeId) {
      where.sedeId = sedeId
    }
    
    if (herramientaId) {
      where.herramientaId = herramientaId
    }

    const stock = await db.stock.findMany({
      where,
      include: {
        sede: true,
        herramienta: {
          include: { categoria: true }
        }
      },
      orderBy: [
        { herramienta: { codigo: 'asc' } }
      ]
    })

    // Calcular valor total
    const stockConValor = stock.map(s => ({
      ...s,
      valorTotal: s.cantidad * s.costoPromedio
    }))

    return NextResponse.json(stockConValor)
  } catch (error) {
    console.error('Error al obtener stock:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
