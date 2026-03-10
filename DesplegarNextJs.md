# Guía Completa: Desplegar Next.js en AWS EC2

## Resumen del Proyecto

- **Proyecto:** Sistema de Control de Herramientas
- **Tecnologías:** Next.js 16, React 19, TypeScript, Prisma, SQLite, NextAuth
- **Servidor:** AWS EC2 (t2.micro, Ubuntu 22.04)
- **IP Pública:** 18.119.125.228

---

## Paso 1: Crear Instancia EC2 en AWS

### En la consola de AWS:

1. Ir a **EC2** → **Launch Instance**
2. Configurar:

| Campo | Valor |
|-------|-------|
| Name | `control-herramientas` |
| AMI | Ubuntu 22.04 LTS |
| Instance type | `t2.micro` (gratis 12 meses) |
| Key pair | Crear nuevo y descargar `.pem` |
| Security Group | SSH (22), HTTP (80), HTTPS (443) |

3. Click **Launch Instance**

---

## Paso 2: Conectar a la Instancia

```bash
# Dar permisos al archivo .pem
chmod 400 tu-archivo.pem

# Conectar por SSH
ssh -i tu-archivo.pem ubuntu@18.119.125.228
```

---

## Paso 3: Configurar el Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Instalar PM2 (mantener app corriendo)
sudo npm install -g pm2

# Instalar nginx
sudo apt install -y nginx

# Instalar SQLite (para ver base de datos)
sudo apt install sqlite3 -y
```

---

## Paso 4: Crear Memoria SWAP

**Problema:** La instancia t2.micro tiene solo 1GB RAM, el build falla con error `Killed` (código 137).

**Solución:** Agregar 2GB de swap.

```bash
# Crear archivo swap de 2GB
sudo fallocate -l 2G /swapfile

# Permisos correctos
sudo chmod 600 /swapfile

# Formatear como swap
sudo mkswap /swapfile

# Activar swap
sudo swapon /swapfile

# Hacer permanente
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verificar
free -h
```

---

## Paso 5: Clonar y Configurar el Proyecto

```bash
# Clonar repositorio
cd ~
git clone https://github.com/matrixgesnet/control-herramientas.git
cd control-herramientas

# Crear archivo .env
nano .env
```

**Contenido del .env:**
```
DATABASE_URL="file:./prisma/db/herramientas.db"
NEXTAUTH_SECRET="tu-clave-secreta-muy-larga-y-segura-2024"
NEXTAUTH_URL="http://18.119.125.228"
```

Guardar con `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## Paso 6: Modificar package.json

**Problema:** El script de build original usa `standalone` que requiere copiar archivos que no existen.

**Original:**
```json
"build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/",
"start": "NODE_ENV=production bun .next/standalone/server.js 2>&1 | tee server.log"
```

**Solución:** Simplificar los scripts.

```bash
nano package.json
```

**Cambiar a:**
```json
"build": "next build",
"start": "next start"
```

---

## Paso 7: Modificar next.config.ts

**Problema:** La configuración `output: "standalone"` causa errores.

**Original:**
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  ...
};
```

**Solución:**

```bash
nano next.config.ts
```

**Cambiar a:**
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
```

---

## Paso 8: Instalar Dependencias y Construir

```bash
# Instalar dependencias
bun install

# Generar Prisma Client
bun run db:generate

# Crear tablas en la base de datos
bun run db:push

# Crear usuarios iniciales
bun run prisma/seed.ts

# Construir la aplicación
bun run build
```

---

## Paso 9: Iniciar con PM2

```bash
# Detener cualquier proceso anterior
pm2 stop all
pm2 delete all

# Iniciar la aplicación
pm2 start "bun run start" --name herramientas

# Guardar configuración
pm2 save

# Configurar inicio automático al reiniciar servidor
pm2 startup
```

**Comandos útiles de PM2:**

| Comando | Descripción |
|---------|-------------|
| `pm2 status` | Ver estado de la app |
| `pm2 logs herramientas` | Ver logs |
| `pm2 restart herramientas` | Reiniciar app |
| `pm2 stop herramientas` | Detener app |
| `pm2 delete herramientas` | Eliminar app de PM2 |

---

## Paso 10: Configurar Nginx

```bash
# Crear configuración
sudo nano /etc/nginx/sites-available/herramientas
```

**Contenido:**
```nginx
server {
    listen 80;
    server_name 18.119.125.228;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar configuración
sudo ln -s /etc/nginx/sites-available/herramientas /etc/nginx/sites-enabled/

# Eliminar configuración default
sudo rm /etc/nginx/sites-enabled/default

# Verificar configuración
sudo nginx -t

# Reiniciar nginx
sudo systemctl restart nginx
```

---

## Paso 11: Configurar Security Group en AWS

**Problema:** No se podía acceder desde el navegador.

**Solución:** Abrir puertos en el Security Group.

En la consola de AWS:
1. Ir a **EC2** → **Instances**
2. Seleccionar la instancia
3. Click en **Security** tab
4. Click en el **Security Group**
5. **Edit inbound rules** → Agregar:

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | 0.0.0.0/0 |
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |
| Custom TCP | 3000 | 0.0.0.0/0 |

---

## Problemas Encontrados y Soluciones

### Problema 1: Build falla con "Killed" (código 137)

**Causa:** Memoria RAM insuficiente (1GB en t2.micro).

**Solución:** Agregar 2GB de memoria SWAP.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

### Problema 2: "Module not found .next/standalone/server.js"

**Causa:** El script de build usa modo `standalone` que requiere copiar carpetas que no existen.

**Solución:** 
1. Eliminar `output: "standalone"` de `next.config.ts`
2. Simplificar scripts en `package.json`:
   - `"build": "next build"`
   - `"start": "next start"`

---

### Problema 3: No se puede acceder desde el navegador

**Causa:** Puertos no abiertos en Security Group de AWS.

**Solución:** Agregar reglas de inbound para HTTP (80) y HTTPS (443) en el Security Group.

---

### Problema 4: Menú "Usuarios" no aparece

**Causa:** El rol del usuario en la base de datos era `Admin` (con mayúscula) pero el código compara con `admin` (minúscula).

**Solución:** Actualizar el rol en la base de datos.

```bash
sqlite3 prisma/db/herramientas.db "UPDATE User SET role='admin' WHERE email='admin@test.com';"
```

Cerrar sesión y volver a iniciar para actualizar el token JWT.

---

### Problema 5: Datos no aparecen en la aplicación

**Causa:** Existían dos bases de datos en rutas diferentes:
- `prisma/db/herramientas.db` (con datos)
- `prisma/prisma/db/herramientas.db` (vacía)

La aplicación usaba la base de datos vacía.

**Solución:** Verificar la variable `DATABASE_URL` en `.env` apunte a la base de datos correcta.

```bash
# Verificar rutas
find . -name "*.db" -type f

# Verificar .env
cat .env | grep DATABASE_URL
```

---

## Comandos para Administrar la Base de Datos

```bash
# Entrar a SQLite
sqlite3 prisma/db/herramientas.db

# Ver todas las tablas
.tables

# Ver estructura de una tabla
.schema User

# Ver usuarios
SELECT id, email, name, role, active FROM User;

# Ver técnicos
SELECT * FROM Tecnico;

# Actualizar rol de usuario
UPDATE User SET role='admin' WHERE email='admin@test.com';

# Salir
.quit
```

---

## Comandos para Actualizar la Aplicación

```bash
# Entrar al directorio del proyecto
cd ~/control-herramientas

# Descargar últimos cambios
git pull

# Instalar nuevas dependencias (si las hay)
bun install

# Regenerar Prisma (si hubo cambios en schema)
bun run db:generate
bun run db:push

# Reconstruir
bun run build

# Reiniciar la aplicación
pm2 restart herramientas
```

---

## Estructura Final del Proyecto en el VPS

```
/home/ubuntu/control-herramientas/
├── .env                          # Variables de entorno
├── .next/                        # Build de Next.js
├── node_modules/                 # Dependencias
├── prisma/
│   ├── db/
│   │   └── herramientas.db       # Base de datos SQLite
│   ├── schema.prisma             # Schema de Prisma
│   └── seed.ts                   # Script de usuarios iniciales
├── public/                       # Archivos estáticos
├── src/                          # Código fuente
├── package.json
├── next.config.ts
└── ...
```

---

## URLs de Acceso

| Descripción | URL |
|-------------|-----|
| Aplicación | http://18.119.125.228 |
| API Init | http://18.119.125.228/api/init |

---

## Credenciales de Prueba

| Email | Password | Rol |
|-------|----------|-----|
| admin@test.com | admin123 | admin |
| supervisor@test.com | super123 | supervisor |
| almacen@test.com | almacen123 | warehouse |

---

## Checklist Final

- [x] Instancia EC2 creada
- [x] Conexión SSH funcionando
- [x] Node.js, bun, PM2, nginx instalados
- [x] Memoria SWAP configurada (2GB)
- [x] Proyecto clonado desde GitHub
- [x] Variables de entorno configuradas
- [x] Base de datos creada con usuarios
- [x] Aplicación construida
- [x] PM2 ejecutando la aplicación
- [x] Nginx configurado como proxy reverso
- [x] Security Group con puertos abiertos
- [x] Aplicación accesible desde internet

---

**Fin de la guía** 🎉

