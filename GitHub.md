# 1. Verifica que tengas Git instalado
git --version

# 2. Abre la terminal en tu carpeta
Navega hasta tu carpeta control-herramientas.
Truco rápido: Entra a la carpeta en tu explorador de archivos, haz clic en la barra de dirección de arriba, escribe cmd (o powershell) y presiona Enter. La terminal se abrirá directamente en esa ruta.

# 3. Inicializa el repositorio local
git init

# 4. Selecciona los archivos a subir
git add .

# 5. Guarda los cambios (Commit)
git commit -m "Mi primer commit: subiendo proyecto inicial"

# 6. Conecta con GitHub (Remote)
Ve a tu repositorio en GitHub en el navegador.
Busca el botón que dice <> Code (verde).
Asegúrate de que esté seleccionada la pestaña HTTPS.
Copia la URL (se ve como https://github.com/tu-usuario/control-herramientas.git).
Vuelve a la terminal y pega este comando (reemplaza la URL con la tuya):

git remote add origin https://github.com/TU_USUARIO/control-herramientas.git

# 7. Asegura el nombre de la rama
GitHub ahora usa main por defecto (antes era master). Para evitar errores, renombra tu rama local:

git branch -M main

# 8. Sube los archivos a GitHub (Push)
git push -u origin main

# Consejos Importantes
Archivo .gitignore: 
Antes de subir nada, asegúrate de tener un archivo llamado .gitignore en tu carpeta. Este archivo le dice a Git qué NO subir (como contraseñas, carpetas pesadas como node_modules, archivos temporales, etc.). 
Si no lo tienes, puedes crear uno en:
gitignore.io seleccionando tu lenguaje de programación.

# Consejos adicionales para tu flujo de trabajo

# 1. Revisa antes de subir (git status)
Antes de hacer el git add ., te recomiendo ejecutar:

bash
    git status

Este comando te muestra una lista de qué archivos cambiaron, cuáles son nuevos y cuáles están listos para subir. Es muy útil para asegurarte de no estar subiendo algo por error (como archivos basura o contraseñas).

# 2. Cuidado con los nuevos archivos .env
Mencionaste que creaste otros archivos. Si entre los nuevos archivos hay algún otro archivo de configuración (como .env, .env.local, config.json con claves), revisa bien su contenido.
Si tienen contraseñas o claves privadas, no los subas.
Asegúrate de que estén listados en tu archivo .gitignore.
Si ya los subiste por error, avísame, porque hay que borrarlos del historial de GitHub por seguridad.

# 3. ¿Qué pasa si git push falla?
En muy raras ocasiones, si editaste algo directamente en la página de GitHub (por ejemplo, editaste el README desde el navegador) y también lo editaste en tu PC, Git te dirá que hay conflictos o que tu rama está desactualizada.
Si eso pasa, ejecuta esto antes del push:

bash
  git pull

Esto descarga los cambios de GitHub a tu PC, los fusiona y luego ya puedes hacer el git push.
¡Mucho éxito con tu proyecto control-herramientas!