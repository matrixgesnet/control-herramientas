import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

// GET - Exportar reporte de sede a Excel
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sedeId = searchParams.get('sedeId')

    if (!sedeId) {
      return NextResponse.json({ error: 'sedeId es requerido' }, { status: 400 })
    }

    // Obtener la sede
    const sede = await db.sede.findUnique({
      where: { id: sedeId }
    })

    if (!sede) {
      return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
    }

    // Obtener técnicos de la sede
    const tecnicos = await db.tecnico.findMany({
      where: { sedeId, activo: true },
      orderBy: [{ numeroCuadrilla: 'asc' }, { nombre: 'asc' }]
    })

    // Obtener todas las herramientas activas
    const herramientas = await db.herramienta.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' }
    })

    // Obtener asignaciones
    const asignaciones = await db.asignacionTecnico.findMany({
      where: { tecnico: { sedeId } },
      include: { tecnico: true, herramienta: true }
    })

    // Calcular cantidad pendiente por técnico y herramienta
    const cantidadPorTecnicoHerramienta: Record<string, Record<string, number>> = {}

    asignaciones.forEach(asignacion => {
      const tecnicoId = asignacion.tecnicoId
      const herramientaId = asignacion.herramientaId
      const cantidadPendiente = asignacion.cantidad - asignacion.cantidadDevuelta

      if (cantidadPendiente > 0) {
        if (!cantidadPorTecnicoHerramienta[tecnicoId]) {
          cantidadPorTecnicoHerramienta[tecnicoId] = {}
        }
        if (!cantidadPorTecnicoHerramienta[tecnicoId][herramientaId]) {
          cantidadPorTecnicoHerramienta[tecnicoId][herramientaId] = 0
        }
        cantidadPorTecnicoHerramienta[tecnicoId][herramientaId] += cantidadPendiente
      }
    })

    // Obtener stock
    const stocks = await db.stock.findMany({
      where: { sedeId }
    })

    // Construir datos del reporte
    const reporte = herramientas.map(herramienta => {
      const stockTotal = stocks.find(s => s.herramientaId === herramienta.id)

      const datosPorTecnico: Record<string, number> = {}

      tecnicos.forEach(tecnico => {
        const cantidadPendiente = cantidadPorTecnicoHerramienta[tecnico.id]?.[herramienta.id] || 0
        datosPorTecnico[tecnico.id] = cantidadPendiente
      })

      const totalTecnicos = Object.values(datosPorTecnico).reduce((sum, c) => sum + c, 0)
      const stockSede = stockTotal?.cantidad || 0

      return {
        codigo: herramienta.codigo,
        nombre: herramienta.nombre,
        datosPorTecnico,
        stockTotal: stockSede,
        totalTecnicos,
        total: totalTecnicos + stockSede
      }
    })

    // Filtrar herramientas con datos
    const reporteFiltrado = reporte.filter(r =>
      Object.values(r.datosPorTecnico).some(c => c > 0) || r.stockTotal > 0
    )

    // Crear workbook Excel
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Reporte por Sede')

    // Configurar estilos
    const headerFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF97316' }
    }
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    const borderStyle = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }

    // Título
    worksheet.mergeCells('A1:Z1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = `Reporte de Herramientas por Sede - ${sede.nombre}`
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    worksheet.getRow(1).height = 30

    // Fecha
    worksheet.mergeCells('A2:Z2')
    const dateCell = worksheet.getCell('A2')
    dateCell.value = `Generado: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    dateCell.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
    worksheet.getRow(2).height = 20

    // Encabezados (fila 4)
    const headers = ['Código', 'Herramienta']
    tecnicos.forEach(t => {
      headers.push(`${t.nombre} ${t.apellido || ''}`.trim())
    })
    headers.push('Stock Sede', 'Total Técnicos', 'Total')

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
    reporteFiltrado.forEach((item, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 5)

      // Código
      row.getCell(1).value = item.codigo
      row.getCell(1).font = { name: 'Courier New', size: 10 }
      row.getCell(1).alignment = { horizontal: 'left' }

      // Herramienta
      row.getCell(2).value = item.nombre
      row.getCell(2).font = { bold: true, size: 10 }

      // Técnicos
      let colIndex = 3
      tecnicos.forEach(tecnico => {
        const cantidad = item.datosPorTecnico[tecnico.id] || 0
        const cell = row.getCell(colIndex)
        cell.value = cantidad > 0 ? cantidad : 0
        cell.alignment = { horizontal: 'center' }
        if (cantidad > 0) {
          cell.font = { bold: true, size: 10 }
        }
        colIndex++
      })

      // Stock Sede
      row.getCell(colIndex).value = item.stockTotal
      row.getCell(colIndex).alignment = { horizontal: 'center' }
      row.getCell(colIndex).font = { bold: true, size: 10 }
      colIndex++

      // Total Técnicos
      row.getCell(colIndex).value = item.totalTecnicos
      row.getCell(colIndex).alignment = { horizontal: 'center' }
      row.getCell(colIndex).font = { bold: true, size: 10 }
      row.getCell(colIndex).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF7ED' }
      }
      colIndex++

      // Total
      row.getCell(colIndex).value = item.total
      row.getCell(colIndex).alignment = { horizontal: 'center' }
      row.getCell(colIndex).font = { bold: true, size: 10 }
      row.getCell(colIndex).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFED7AA' }
      }

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
    const totalRow = worksheet.getRow(reporteFiltrado.length + 5)
    totalRow.getCell(1).value = 'TOTALES'
    totalRow.getCell(1).font = { bold: true, size: 11 }
    totalRow.getCell(1).alignment = { horizontal: 'left' }

    totalRow.getCell(2).value = ''
    totalRow.getCell(2).font = { bold: true }

    // Sumar columnas de técnicos
    let colIndex = 3
    const numTecnicos = tecnicos.length
    tecnicos.forEach(() => {
      const colLetter = getColumnLetter(colIndex)
      totalRow.getCell(colIndex).value = { formula: `SUM(${colLetter}5:${colLetter}${reporteFiltrado.length + 4})` }
      totalRow.getCell(colIndex).font = { bold: true, size: 10 }
      totalRow.getCell(colIndex).alignment = { horizontal: 'center' }
      colIndex++
    })

    // Total Stock Sede
    const stockColLetter = getColumnLetter(3 + numTecnicos)
    totalRow.getCell(colIndex).value = { formula: `SUM(${stockColLetter}5:${stockColLetter}${reporteFiltrado.length + 4})` }
    totalRow.getCell(colIndex).font = { bold: true, size: 10 }
    totalRow.getCell(colIndex).alignment = { horizontal: 'center' }
    colIndex++

    // Total Técnicos
    const totalTecColLetter = getColumnLetter(4 + numTecnicos)
    totalRow.getCell(colIndex).value = { formula: `SUM(${totalTecColLetter}5:${totalTecColLetter}${reporteFiltrado.length + 4})` }
    totalRow.getCell(colIndex).font = { bold: true, size: 10 }
    totalRow.getCell(colIndex).alignment = { horizontal: 'center' }
    totalRow.getCell(colIndex).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF7ED' }
    }
    colIndex++

    // Gran Total
    const granTotalColLetter = getColumnLetter(5 + numTecnicos)
    totalRow.getCell(colIndex).value = { formula: `SUM(${granTotalColLetter}5:${granTotalColLetter}${reporteFiltrado.length + 4})` }
    totalRow.getCell(colIndex).font = { bold: true, size: 11 }
    totalRow.getCell(colIndex).alignment = { horizontal: 'center' }
    totalRow.getCell(colIndex).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFED7AA' }
    }

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
      if (index === 0) column.width = 12
      else if (index === 1) column.width = 35
      else column.width = 15
    })

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Retornar archivo Excel
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte_${sede.nombre}_${new Date().toISOString().split('T')[0]}.xlsx"`
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
