Para actualizar **solo 2 archivos específicos** desde tu PC local (sin afectar cambios locales en AWS), usa SCP (copia segura por SSH). Es directo, rápido y no toca Git

## Método 1: SCP (Recomendado - 1 min)
1. **Desde tu PC** (con key.pem):
   ```
   # Copia archivo1 (ej: src/app/page.tsx)
   scp -i tu-key.pem /ruta/local/archivo1.tsx ubuntu@18.119.125.228:/home/ubuntu/herramientas/src/app/

   # Copia archivo2
   scp -i tu-key.pem /ruta/local/archivo2.ts ubuntu@18.119.125.228:/home/ubuntu/herramientas/src/components/
   ```

2. **En AWS** (SSH):
   ```
   cd /home/ubuntu/herramientas  # Ruta de tu app "herramientas"
   bun run build  # Rebuild (solo si cambiaste código fuente)
   pm2 reload herramientas  # Reinicia sin downtime
   pm2 status
   ```

## Método 2: Git Selectivo (Si Insistes)
**¡Advertencia**: Riesgo de sobrescribir cambios AWS no commiteados.
```
# En AWS:
cd /home/ubuntu/herramientas
git status  # Ve cambios locales
git stash   # Guarda cambios AWS temporalmente

git pull origin main  # Solo deltas GitHub
git stash pop  # Restaura cambios AWS

bun run build
pm2 reload herramientas
```

## Método 3: Descarga/Edita/Sube (Si Archivos Pequeños)
1. **En AWS**: `pm2 show herramientas` → ve ruta exacta (ej: `/home/ubuntu/herramientas`).
2. **Backup**: `cp archivo1 archivo1.backup`.
3. **Desde PC**: Edita local → SCP como Método 1.

## Verificar Ruta Proyecto
En AWS:
```
pm2 show herramientas  # Muestra "pm_cwd" = ruta app
ls -la /home/ubuntu/herramientas  # Confirma archivos
```

**Ejemplo Completo** (suponiendo archivos):
```
# PC:
scp -i key.pem ./src/app/dashboard.tsx ubuntu@18.119.125.228:/home/ubuntu/herramientas/src/app/
scp -i key.pem ./src/lib/api.ts ubuntu@18.119.125.228:/home/ubuntu/herramientas/src/lib/

# AWS:
cd /home/ubuntu/herramientas
bun run build
pm2 reload herramientas
curl localhost:3000  # Test
```

**¡SCP es perfecto para 2 archivos!** No Git, no riesgos. Di nombres archivos/ruta si necesitas comando exacto. 




**¡Perfecto!** Para un archivo **nuevo** (`herramienta-combobox.tsx`), **SCP lo crea automáticamente** en la carpeta destino. Solo asegúrate que la ruta padre exista en AWS.

## Comando Exacto (Git Bash en Windows)
```bash
scp -i "C:/ruta-a-tu-key.pem" "F:/Desarrollo2026/control-herramientas/src/components/ui/herramienta-combobox.tsx" ubuntu@18.119.125.228:/home/ubuntu/herramientas/src/components/ui/
```

## Si la Carpeta `ui/` NO Existe en AWS
**SCP falla**. Primero **crea la estructura**:

1. **SSH a AWS**:
   ```bash
   ssh -i "tu-key.pem" ubuntu@18.119.125.228
   cd /home/ubuntu/herramientas
   mkdir -p src/components/ui  # Crea toda la estructura si no existe
   ```

2. **Desde Windows (Git Bash)**:
   ```bash
   scp -i "tu-key.pem" "F:/Desarrollo2026/control-herramientas/src/components/ui/herramienta-combobox.tsx" ubuntu@18.119.125.228:/home/ubuntu/herramientas/src/components/ui/
   ```

## Comandos Completos (Ambos Archivos)
**Git Bash en Windows**:
```bash
# 1. Primer archivo
scp -i "tu-key.pem" "F:/Desarrollo2026/control-herramientas/src/components/modules/movimientos-page.tsx" ubuntu@18.119.125.228:/home/ubuntu/herramientas/src/components/modules/

# 2. Segundo archivo (nuevo)
scp -i "tu-key.pem" "F:/Desarrollo2026/control-herramientas/src/components/ui/herramienta-combobox.tsx" ubuntu@18.119.125.228:/home/ubuntu/herramientas/src/components/ui/
```

## Después de Copiar (AWS)
```bash
cd /home/ubuntu/herramientas
bun run build
pm2 reload herramientas
pm2 status  # herramientas → online ✓
```

## Verificar Rutas Antes
**En AWS** (SSH):
```bash
pm2 show herramientas  # Ruta exacta (pm_cwd)
ls -la src/components/  # ¿Existe ui/ o modules/?
```

**Si tu proyecto está en `/home/ubuntu/control-herramientas`** (no herramientas):
```bash
# Cambia todos los comandos:
ubuntu@18.119.125.228:/home/ubuntu/control-herramientas/src/components/ui/
```

## Resumen 30 Segundos
1. **Git Bash**: Copia/pega comandos ↑ (ajusta `tu-key.pem`).
2. **SSH AWS**: `bun run build && pm2 reload herramientas`.
3. **Test**: `curl http://18.119.125.228` o navegador.

**¡SCP crea carpetas/archivos nuevos sin problemas!** Solo necesita ruta padre.



**¡Perfecto!** Ya confirmaste que tu proyecto está en `/home/ubuntu/control-herramientas/` (no `herramientas`). Ese era el problema.

## Comando CORRECTO (Git Bash - Windows)
```bash
scp -i "tu-key.pem" "F:/Desarrollo2026/control-herramientas/src/components/ui/herramienta-combobox.tsx" ubuntu@18.119.125.228:/home/ubuntu/control-herramientas/src/components/ui/
```

## Los 2 comandos completos (ruta correcta):
```bash
# 1. Primer archivo
scp -i "tu-key.pem" "F:/Desarrollo2026/control-herramientas/src/components/modules/movimientos-page.tsx" ubuntu@18.119.125.228:/home/ubuntu/control-herramientas/src/components/modules/
######Ejemplo con rutas exactas
scp -i 'C:/Users/Matrix/Downloads/herramientas-vps-nodejs-key.pem' "F:/Desarrollo2026/control-herramientas/src/components/modules/movimientos-page.tsx" ubuntu@18.119.125.228:/home/ubuntu/control-herramientas/src/components/modules/
#####################
scp -i 'C:/Users/Matrix/Downloads/herramientas-vps-nodejs-key.pem' "F:/Desarrollo2026/control-herramientas/src/app/api/corregir-asignaciones/route.ts" ubuntu@18.119.125.228:/home/ubuntu/control-herramientas/src/app/api/corregir-asignaciones/

src/app/api/movimientos/route.ts
scp -i 'C:/Users/Matrix/Downloads/herramientas-vps-nodejs-key.pem' "F:/Desarrollo2026/control-herramientas/src/app/api/movimientos/route.ts" ubuntu@18.119.125.228:/home/ubuntu/control-herramientas/src/app/api/movimientos/

# 2. Segundo archivo (nuevo)
scp -i "tu-key.pem" "F:/Desarrollo2026/control-herramientas/src/components/ui/herramienta-combobox.tsx" ubuntu@18.119.125.228:/home/ubuntu/control-herramientas/src/components/ui/
```

## Después de copiar (SSH):
```bash
ssh -i "tu-key.pem" ubuntu@18.119.125.228
cd /home/ubuntu/control-herramientas
bun run build
pm2 restart herramientas  # O el nombre de tu PM2 process
pm2 status
```

## Verificar PM2
```bash
pm2 show herramientas  # Confirma ruta: /home/ubuntu/control-herramientas ✓
```

**¡Error solucionado!** Solo era la ruta del proyecto (`control-herramientas` vs `herramientas`). Ahora funciona perfecto. [perplexity](https://www.perplexity.ai/search/d325e37c-bd9d-47ba-bc2e-e35600bbacbe)