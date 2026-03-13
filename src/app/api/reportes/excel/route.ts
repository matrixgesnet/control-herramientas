import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/utils-server'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

// GET - Exportar reportes a Excel
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const sedeId = searchParams.get('sedeId')

    const workbook = new ExcelJS.Workbook()
    const borderStyle = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }
    const headerFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF97316' }
    }
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }

    switch (tipo) {
      case 'stock-total': {
        const worksheet = workbook.addWorksheet('Stock Total')

        // Título
        worksheet.mergeCells('A1:F1')
        worksheet.getCell('A1').value = 'Stock Total de Herramientas'
        worksheet.getCell('A1').font = { bold: true, size: 16 }
        worksheet.getRow(1).height = 30

        // Fecha
        worksheet.mergeCells('A2:F2')
        worksheet.getCell('A2').value = `Generado: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
        worksheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }

        // Obtener datos
        const herramientas = await db.herramienta.findMany({
          where: { activo: true, controlaStock: true },
          include: { categoria: true, stocks: true },
          orderBy: { codigo: 'asc' }
        })

        const reporte = herramientas.map(h => {
          const stockTotal = h.stocks.reduce((sum, s) => sum + s.cantidad, 0)
          const valorTotal = h.stocks.reduce((sum, s) => sum + (s.cantidad * s.costoPromedio), 0)
          return {
            codigo: h.codigo,
            nombre: h.nombre,
            categoria: h.categoria?.nombre || '-',
            stockTotal,
            costoPromedio: h.costoPromedio,
            valorTotal
          }
        })

        // Encabezados
        const headers = ['Código', 'Nombre', 'Categoría', 'Stock Total', 'Costo Prom.', 'Valor Total']
        const headerRow = worksheet.getRow(4)
        headers.forEach((header, index) => {
          const cell = headerRow.getCell(index + 1)
          cell.value = header
          cell.fill = headerFill
          cell.font = headerFont
          cell.alignment = { horizontal: 'center' }
          cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle }
        })

        // Datos
        reporte.forEach((item, rowIndex) => {
          const row = worksheet.getRow(rowIndex + 5)
          row.getCell(1).value = item.codigo
          row.getCell(2).value = item.nombre
          row.getCell(3).value = item.categoria
          row.getCell(4).value = item.stockTotal
          row.getCell(4).alignment = { horizontal: 'right' }
          row.getCell(5).value = item.costoPromedio
          row.getCell(5).numFmt = '"S/" #,##0.00'
          row.getCell(5).alignment = { horizontal: 'right' }
          row.getCell(6).value = item.valorTotal
          row.getCell(6).numFmt = '"S/" #,##0.00'
          row.getCell(6).alignment = { horizontal: 'right' }

          for (let i = 1; i <= 6; i++) {
            row.getCell(i).border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle }
          }
        })

        // Totales
        const totalRow = worksheet.getRow(reporte.length + 5)
        totalRow.getCell(1).value = 'TOTALES'
        totalRow.getCell(1).font = { bold: true }
        totalRow.getCell(4).value = { formula: `SUM(D5:D${reporte.length + 4})` }
        totalRow.getCell(4).font = { bold: true }
        totalRow.getCell(4).alignment = { horizontal: 'right' }
        totalRow.getCell(6).value = { formula: `SUM(F5:F${reporte.length + 4})` }
        totalRow.getCell(6).numFmt = '"S/" #,##0.00'
        totalRow.getCell(6).font = { bold: true }
        totalRow.getCell(6).alignment = { horizontal: 'right' }

        // Ajustar columnas
        worksheet.columns = [
          { width: 12 }, { width: 35 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 12 }
        ]

        break
      }

      case 'stock-sede': {
        if (!sedeId) {
          return NextResponse.json({ error: 'sedeId es requerido' }, { status: 400 })
        }

        const stock = await db.stock.findMany({
          where: { sedeId },
          include: { herramienta: { include: { categoria: true } }, sede: true },
          orderBy: { herramienta: { codigo: 'asc' } }
        })

        const nombreSede = stock[0]?.sede.nombre || 'Sede'

        const worksheet = workbook.addWorksheet('Stock por Sede')

        // Título
        worksheet.mergeCells('A1:G1')
        worksheet.getCell('A1').value = `Stock - ${nombreSede}`
        worksheet.getCell('A1').font = { bold: true, size: 16 }
        worksheet.getRow(1).height = 30

        // Fecha
        worksheet.mergeCells('A2:G2')
        worksheet.getCell('A2').value = `Generado: ${new Date().toLocaleDateString('es-ES')}`
        worksheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }

        // Encabezados
        const headers = ['Código', 'Nombre', 'Categoría', 'Cantidad', 'Costo Prom.', 'Valor', 'Estado']
        const headerRow = worksheet.getRow(4)
        headers.forEach((header, index) => {
          const cell = headerRow.getCell(index + 1)
          cell.value = header
          cell.fill = headerFill
          cell.font = headerFont
          cell.alignment = { horizontal: 'center' }
          cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle }
        })

        // Datos
        stock.forEach((item, rowIndex) => {
          const row = worksheet.getRow(rowIndex + 5)
          const valorTotal = item.cantidad * item.costoPromedio
          const estadoStock = item.herramienta.stockMinimo && item.cantidad < item.herramienta.stockMinimo
            ? 'BAJO'
            : item.herramienta.stockMaximo && item.cantidad > item.herramienta.stockMaximo
              ? 'ALTO'
              : 'NORMAL'

          row.getCell(1).value = item.herramienta.codigo
          row.getCell(2).value = item.herramienta.nombre
          row.getCell(3).value = item.herramienta.categoria?.nombre || '-'
          row.getCell(4).value = item.cantidad
          row.getCell(4).alignment = { horizontal: 'right' }
          row.getCell(5).value = item.costoPromedio
          row.getCell(5).numFmt = '"S/" #,##0.00'
          row.getCell(5).alignment = { horizontal: 'right' }
          row.getCell(6).value = valorTotal
          row.getCell(6).numFmt = '"S/" #,##0.00'
          row.getCell(6).alignment = { horizontal: 'right' }
          row.getCell(7).value = estadoStock
          row.getCell(7).alignment = { horizontal: 'center' }

          for (let i = 1; i <= 7; i++) {
            row.getCell(i).border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle }
          }
        })

        // Ajustar columnas
        worksheet.columns = [
          { width: 12 }, { width: 35 }, { width: 15 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 10 }
        ]

        break
      }

      case 'tecnicos-asignaciones': {
        const worksheet = workbook.addWorksheet('Técnicos')

        // Título
        worksheet.mergeCells('A1:F1')
        worksheet.getCell('A1').value = 'Herramientas Asignadas a Técnicos'
        worksheet.getCell('A1').font = { bold: true, size: 16 }
        worksheet.getRow(1).height = 30

        // Fecha
        worksheet.mergeCells('A2:F2')
        worksheet.getCell('A2').value = `Generado: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
        worksheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }

        // Obtener datos
        const where: Record<string, unknown> = { activo: true }
        if (sedeId) where.sedeId = sedeId

        const tecnicos = await db.tecnico.findMany({
          where,
          include: {
            sede: true,
            asignaciones: {
              where: { estado: 'asignado' },
              include: { herramienta: true }
            }
          },
          orderBy: [{ nombre: 'asc' }]
        })

        // Encabezados
        const headers = ['DNI', 'Nombre', 'Sede', 'Cuadrilla', 'Total Items', 'Herramientas']
        const headerRow = worksheet.getRow(4)
        headers.forEach((header, index) => {
          const cell = headerRow.getCell(index + 1)
          cell.value = header
          cell.fill = headerFill
          cell.font = headerFont
          cell.alignment = { horizontal: 'center' }
          cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle }
        })

        // Datos
        tecnicos.forEach((t, rowIndex) => {
          const row = worksheet.getRow(rowIndex + 5)
          const herramientasStr = t.asignaciones.map(a => `${a.herramienta.codigo} (${a.cantidad})`).join(', ')

          row.getCell(1).value = t.dni
          row.getCell(2).value = `${t.nombre} ${t.apellido || ''}`.trim()
          row.getCell(3).value = t.sede.nombre
          row.getCell(4).value = t.numeroCuadrilla || '-'
          row.getCell(5).value = t.asignaciones.reduce((sum, a) => sum + a.cantidad, 0)
          row.getCell(5).alignment = { horizontal: 'center' }
          row.getCell(6).value = herramientasStr || 'Sin asignaciones'

          for (let i = 1; i <= 6; i++) {
            row.getCell(i).border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle }
          }
        })

        // Ajustar columnas
        worksheet.columns = [
          { width: 12 }, { width: 30 }, { width: 15 }, { width: 10 }, { width: 12 }, { width: 60 }
        ]

        break
      }

      default:
        return NextResponse.json({ error: 'Tipo de reporte no válido' }, { status: 400 })
    }

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte_${tipo}_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
  } catch (error) {
    console.error('Error al generar Excel:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
