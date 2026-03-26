import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

// GET - Exportar listado de herramientas a Excel
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

    // Helper para obtener stock por sede
    const getStockPorSede = (h: typeof herramientas[0], sedeId: string): number => {
      const stock = h.stocks.find(s => s.sedeId === sedeId)
      return stock?.cantidad || 0
    }

    // Crear workbook Excel
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Herramientas')

    // Configurar estilos
    const headerFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF97316' }
    }
    const headerFont = { bold: true, color: { argb: 'FF000000' }, size: 11 }
    const borderStyle = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }

    // Título
    worksheet.mergeCells('A1:Z1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'Listado de Herramientas'
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    worksheet.getRow(1).height = 30

    // Fecha
    worksheet.mergeCells('A2:Z2')
    const dateCell = worksheet.getCell('A2')
    dateCell.value = `Generado: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - Total: ${herramientas.length} herramientas`
    dateCell.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
    worksheet.getRow(2).height = 20

    // Construir encabezados
    const headers = ['Código', 'Nombre', 'Categoría', 'Unidad', 'Stock Mín.']
    sedes.forEach(sede => headers.push(sede.nombre))
    headers.push('Stock Total', 'Descripción')

    // Escribir encabezados (fila 4)
    const headerRow = worksheet.getRow(4)
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1)
      cell.value = header
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: borderStyle,
        left: borderStyle,
        bottom: borderStyle,
        right: borderStyle
      }
    })
    worksheet.getRow(4).height = 25

    // Datos
    herramientas.forEach((item, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 5)

      // Código
      row.getCell(1).value = item.codigo
      row.getCell(1).font = { name: 'Courier New', size: 10 }
      row.getCell(1).alignment = { horizontal: 'left' }

      // Nombre
      row.getCell(2).value = item.nombre
      row.getCell(2).font = { bold: true, size: 10 }

      // Categoría
      row.getCell(3).value = item.categoria?.nombre || '-'
      row.getCell(3).alignment = { horizontal: 'left' }

      // Unidad
      row.getCell(4).value = item.unidad
      row.getCell(4).alignment = { horizontal: 'center' }

      // Stock Mínimo
      row.getCell(5).value = item.stockMinimo || '-'
      row.getCell(5).alignment = { horizontal: 'center' }

      // Stock por sede
      let colIndex = 6
      sedes.forEach(sede => {
        const stock = getStockPorSede(item, sede.id)
        const cell = row.getCell(colIndex)
        cell.value = stock
        cell.alignment = { horizontal: 'center' }
        if (stock > 0) {
          cell.font = { bold: true, size: 10 }
        }
        colIndex++
      })

      // Stock Total
      const stockTotal = item.stocks.reduce((sum, s) => sum + s.cantidad, 0)
      row.getCell(colIndex).value = stockTotal
      row.getCell(colIndex).alignment = { horizontal: 'center' }
      row.getCell(colIndex).font = { bold: true, size: 10 }
      colIndex++

      // Descripción
      row.getCell(colIndex).value = item.descripcion || '-'
      row.getCell(colIndex).alignment = { horizontal: 'left' }

      // Bordes
      for (let i = 1; i <= headers.length; i++) {
        row.getCell(i).border = {
          top: borderStyle,
          left: borderStyle,
          bottom: borderStyle,
          right: borderStyle
        }
      }
    })

    // Ajustar anchos de columna
    worksheet.getColumn(1).width = 10   // Código
    worksheet.getColumn(2).width = 35   // Nombre
    worksheet.getColumn(3).width = 15   // Categoría
    worksheet.getColumn(4).width = 8    // Unidad
    worksheet.getColumn(5).width = 10   // Stock Mín.
    
    // Columnas de sedes
    sedes.forEach((_, index) => {
      worksheet.getColumn(6 + index).width = 10
    })
    
    worksheet.getColumn(6 + sedes.length).width = 12     // Stock Total
    worksheet.getColumn(7 + sedes.length).width = 30     // Descripción

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Retornar archivo Excel
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="herramientas_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
  } catch (error) {
    console.error('Error al generar Excel:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
