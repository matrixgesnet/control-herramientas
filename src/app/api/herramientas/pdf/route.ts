import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener sedes
    const sedes = await db.sede.findMany({
      orderBy: { nombre: 'asc' }
    })

    // Obtener herramientas con stocks
    const herramientas = await db.herramienta.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        categoria: true,
        stocks: {
          include: { sede: true }
        }
      }
    })

    // Crear PDF en orientación landscape para más columnas
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    // Título
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('LISTADO DE HERRAMIENTAS', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' })
    
    // Fecha de generación
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generado: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' })

    // Preparar encabezados
    const headers: string[][] = [
      ['Código', 'Nombre', 'Categoría', 'Unidad', 'Stock Mín.', ...sedes.map(s => s.nombre), 'Stock Total', 'Descripción']
    ]

    // Preparar datos
    const data = herramientas.map(h => {
      const row: string[] = [
        h.codigo,
        h.nombre,
        h.categoria?.nombre || '-',
        h.unidad,
        h.stockMinimo?.toString() || '-'
      ]

      // Agregar stock por sede
      sedes.forEach(sede => {
        const stock = h.stocks.find(s => s.sedeId === sede.id)
        row.push((stock?.cantidad || 0).toString())
      })

      // Stock total
      const stockTotal = h.stocks.reduce((sum, s) => sum + s.cantidad, 0)
      row.push(stockTotal.toString())
      
      // Descripción (truncada si es muy larga)
      const desc = h.descripcion || '-'
      row.push(desc.length > 30 ? desc.substring(0, 30) + '...' : desc)

      return row
    })

    // Generar tabla
    autoTable(doc, {
      head: headers,
      body: data,
      startY: 28,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        halign: 'left'
      },
      headStyles: {
        fillColor: [251, 146, 60], // Naranja (orange-500)
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // gray-50
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'left' },   // Código
        1: { cellWidth: 40, halign: 'left' },   // Nombre
        2: { cellWidth: 25, halign: 'left' },   // Categoría
        3: { cellWidth: 12, halign: 'center' }, // Unidad
        4: { cellWidth: 15, halign: 'center' }, // Stock Mín.
        // Columnas dinámicas para sedes (se ajustan automáticamente)
      },
      margin: { top: 28, left: 5, right: 5 },
      didDrawPage: (data) => {
        // Número de página
        const pageCount = doc.getNumberOfPages()
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          doc.internal.pageSize.getWidth() - 10,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'right' }
        )
      }
    })

    // Generar buffer
    const buffer = Buffer.from(doc.output('arraybuffer'))

    // Retornar como respuesta
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="herramientas_${new Date().toISOString().split('T')[0]}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error al exportar PDF:', error)
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 })
  }
}
