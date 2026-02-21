# 🛠️ Sistema de Control de Herramientas

Sistema de gestión de inventario de herramientas y materiales para empresas con múltiples sedes.

## 📋 Requisitos

- Node.js 18+ o Bun
- npm, yarn, pnpm o bun

## 🚀 Instalación

### 1. Instalar dependencias

```bash
npm install
# o
bun install
```

### 2. Configurar base de datos

```bash
# Crear carpeta de base de datos
mkdir -p db

# Generar cliente Prisma
npx prisma generate

# Crear las tablas
npx prisma db push
```

### 3. Iniciar el servidor

```bash
npm run dev
# o
bun run dev
```

### 4. Inicializar datos de prueba

Abre en tu navegador:
```
http://localhost:3000/api/init
```

Esto creará:
- 3 usuarios de prueba
- 4 sedes
- 5 categorías
- 5 herramientas de ejemplo
- 3 técnicos de prueba

## 🔐 Usuarios de Prueba

| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@test.com | admin123 | Administrador |
| supervisor@test.com | super123 | Supervisor |
| almacen@test.com | almacen123 | Encargado Almacén |

## 📱 Módulos

- **Dashboard** - Resumen y estadísticas
- **Herramientas** - Catálogo de herramientas
- **Técnicos** - Gestión de técnicos
- **Sedes** - Almacenes de la empresa
- **Movimientos** - Compras, transferencias, salidas, devoluciones
- **Kardex** - Historial detallado por herramienta
- **Reportes** - Informes con exportación CSV

## 🏗️ Estructura del Proyecto

```
├── prisma/
│   └── schema.prisma    # Esquema de base de datos
├── src/
│   ├── app/
│   │   ├── api/         # APIs REST
│   │   └── page.tsx     # Página principal
│   ├── components/
│   │   ├── ui/          # Componentes shadcn/ui
│   │   ├── layout/      # Sidebar, Header
│   │   └── modules/     # Páginas del sistema
│   └── lib/
│       ├── auth.ts      # Configuración NextAuth
│       └── db.ts        # Cliente Prisma
└── package.json
```

## 📊 Tipos de Movimientos

1. **COMPRA** - Ingreso de herramientas por compra
2. **TRANSFERENCIA** - Movimiento entre sedes
3. **SALIDA** - Entrega a técnico
4. **DEVOLUCION_TECNICO** - Devolución de técnico
5. **BAJA** - Herramienta dañada o perdida

## 💰 Costo Promedio

El sistema calcula automáticamente el costo promedio ponderado con cada compra, siguiendo la fórmula:

```
Costo Promedio = (Stock Actual × Costo Promedio Actual + Cantidad Ingreso × Costo Unitario) / Nuevo Stock
```

## 📄 Licencia

MIT License
