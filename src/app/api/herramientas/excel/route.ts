import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

// GET - Exportar herramientas a Excel
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener todas las sedes activas
    const sedes = await db.sede.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    })

    const herramientas = await db.herramienta.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        categoria: true,
        stocks: {
          include: { sede: true }
        }
      }
    })

    // Preparar datos con stock por sede
    const reporte = herramientas.map(h => {
      const stockPorSede: Record<string, number> = {}
      sedes.forEach(sede => {
        const stockSede = h.stocks.find(s => s.sedeId === sede.id)
        stockPorSede[sede.nombre] = stockSede?.cantidad || 0
      })

      return {
        codigo: h.codigo,
        nombre: h.nombre,
        categoria: h.categoria?.nombre || '-',
        unidad: h.unidad,
        stockMinimo: h.stockMinimo || 0,
        stockTotal: h.stocks.reduce((sum, s) => sum + s.cantidad, 0),
        stockPorSede,
        descripcion: h.descripcion || '-'
      }
    })

    // Crear workbook Excel
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Herramientas')

    // Configurar estilos
    const borderStyle = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }
    const headerFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF97316' }
    }
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }

    // Título
    worksheet.mergeCells('A1:K1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'Listado de Herramientas'
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    worksheet.getRow(1).height = 30

    // Fecha
    worksheet.mergeCells('A2:K2')
    const dateCell = worksheet.getCell('A2')
    dateCell.value = `Generado: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    dateCell.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
    worksheet.getRow(2).height = 20

    // Encabezados (fila 4)
    const headers = ['Código', 'Nombre', 'Categoría', 'Unidad', 'Stock Mín.', 'Stock Total']
    sedes.forEach(s => headers.push(s.nombre))
    headers.push('Descripción')

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
    reporte.forEach((item, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 5)

      // Código
      row.getCell(1).value = item.codigo
      row.getCell(1).font = { name: 'Courier New', size: 10 }
      row.getCell(1).alignment = { horizontal: 'left' }

      // Nombre
      row.getCell(2).value = item.nombre
      row.getCell(2).font = { bold: true, size: 10 }

      // Categoría
      row.getCell(3).value = item.categoria
      row.getCell(3).alignment = { horizontal: 'left' }

      // Unidad
      row.getCell(4).value = item.unidad
      row.getCell(4).alignment = { horizontal: 'center' }

      // Stock Mínimo
      row.getCell(5).value = item.stockMinimo
      row.getCell(5).alignment = { horizontal: 'right' }

      // Stock Total
      row.getCell(6).value = item.stockTotal
      row.getCell(6).alignment = { horizontal: 'right' }
      row.getCell(6).font = { bold: true, size: 10 }

      // Stock por sede
      let colIndex = 7
      sedes.forEach(sede => {
        const stockSede = item.stockPorSede[sede.nombre] || 0
        row.getCell(colIndex).value = stockSede
        row.getCell(colIndex).alignment = { horizontal: 'right' }
        if (stockSede > 0) {
          row.getCell(colIndex).font = { bold: true, size: 10 }
        }
        colIndex++
      })

      // Descripción
      row.getCell(colIndex).value = item.descripcion
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

    // Fila de totales
    const totalRow = worksheet.getRow(reporte.length + 5)
    totalRow.getCell(1).value = 'TOTALES'
    totalRow.getCell(1).font = { bold: true, size: 11 }
    totalRow.getCell(6).value = { formula: `SUM(F5:F${reporte.length + 4})` }
    totalRow.getCell(6).font = { bold: true, size: 10 }
    totalRow.getCell(6).alignment = { horizontal: 'right' }

    // Totales por sede
    let colIndex = 7
    sedes.forEach(() => {
      const colLetter = getColumnLetter(colIndex)
      totalRow.getCell(colIndex).value = { formula: `SUM(${colLetter}5:${colLetter}${reporte.length + 4})` }
      totalRow.getCell(colIndex).font = { bold: true, size: 10 }
      totalRow.getCell(colIndex).alignment = { horizontal: 'right' }
      colIndex++
    })

    // Bordes fila total
    for (let i = 1; i <= headers.length; i++) {
      totalRow.getCell(i).border = {
        top: { style: 'medium', color: { argb: 'FF9CA3AF' } },
        left: borderStyle,
        bottom: borderStyle,
        right: borderStyle
      }
    }

    // Ajustar anchos de columna
    worksheet.columns.forEach((column, index) => {
      if (index === 0) column.width = 10 // Código
      else if (index === 1) column.width = 35 // Nombre
      else if (index === 2) column.width = 12 // Categoría
      else if (index === 3) column.width = 8 // Unidad
      else if (index === 4) column.width = 10 // Stock Mín
      else if (index === 5) column.width = 10 // Stock Total
      else if (index === headers.length - 1) column.width = 30 // Descripción
      else column.width = 10 // Sedes
    })

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

// Función auxiliar para obtener letra de columna
function getColumnLetter(col: number): string {
  let letter = ''
  let temp = col
  while (temp > 0) {
    const mod = (temp - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    temp = Math.floor((temp - 1) / 26)
  }
  return letter
}
