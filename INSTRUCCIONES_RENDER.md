# Guía de Migración y Despliegue en Render (PHP + PostgreSQL)

Esta guía te ayudará a subir tu proyecto PHP a Render y migrar tu base de datos de MySQL a PostgreSQL.

## 1. Preparación del Proyecto (Ya realizado)

Hemos creado los siguientes archivos necesarios:
- `Dockerfile`: Configura el entorno PHP con Apache y los drivers para PostgreSQL.
- `schema_postgres.sql`: Versión de tu base de datos adaptada para PostgreSQL.
- `api/db.php`: Actualizado para detectar automáticamente si está en Render (PostgreSQL) o en local (MySQL).

## 2. Subir el código a GitHub

Render necesita que tu código esté en un repositorio de GitHub (o GitLab).
1. Crea un nuevo repositorio en GitHub.
2. Sube todos los archivos de tu carpeta `ProyectoWeb` a ese repositorio.

## 3. Crear la Base de Datos en Render

1. Inicia sesión en [Render.com](https://render.com).
2. Haz clic en **New +** y selecciona **PostgreSQL**.
3. Dale un nombre (ej. `reservas-db`).
4. Selecciona la región más cercana.
5. Elige el plan **Free**.
6. Haz clic en **Create Database**.
7. Espera a que se cree. Una vez lista, busca la sección **Connections** y copia la **Internal Database URL** (la usaremos luego).

## 4. Crear el Web Service en Render

1. En el Dashboard de Render, haz clic en **New +** y selecciona **Web Service**.
2. Conecta tu cuenta de GitHub y selecciona el repositorio que creaste.
3. Configura lo siguiente:
   - **Name**: El nombre de tu app (ej. `reservas-lebu`).
   - **Runtime**: Selecciona **Docker**.
   - **Region**: La misma que tu base de datos.
   - **Plan**: Free.
4. **Variables de Entorno (Environment Variables)**:
   Haz clic en "Advanced" o "Environment Variables" y añade las siguientes claves y valores. Usa los datos de conexión de tu base de datos PostgreSQL (los puedes ver en el dashboard de la DB creada en el paso 3).

   | Key | Value |
   | --- | --- |
   | `DB_HOST` | El `Hostname` de tu base de datos (ej. `dpg-xxxx-a`) |
   | `DB_NAME` | El `Database` name (ej. `reservas_db`) |
   | `DB_USER` | El `Username` (ej. `reservas_user`) |
   | `DB_PASSWORD` | La `Password` de la base de datos |
   | `DB_PORT` | `5432` |
   | `DB_DRIVER` | `pgsql` |

   *Nota: Alternativamente, puedes usar la `Internal Database URL` si modificas el código para parsearla, pero usar las variables individuales es más claro.*

5. Haz clic en **Create Web Service**.

## 5. Importar la Base de Datos (Método Fácil)

Una vez que tu Web Service esté desplegado (verás un check verde en Render), sigue estos pasos para crear las tablas automáticamente:

1. En el dashboard de Render, ve a tu **Web Service**.
2. Haz clic en la pestaña **Shell** (a la izquierda, debajo de "Logs").
3. Espera a que aparezca la terminal y escribe el siguiente comando:
   ```bash
   php setup_db.php
   ```
4. Si todo sale bien, verás un mensaje de "¡ÉXITO!".

*Nota: Este script (`setup_db.php`) lee el archivo `schema_postgres.sql` y crea las tablas por ti, ahorrándote tener que instalar programas externos.*

## 6. Verificar

Visita la URL que te da Render (ej. `https://reservas-lebu.onrender.com`). Debería cargar tu página de inicio. Intenta registrarte o iniciar sesión para probar la conexión a la base de datos.

## Notas Importantes

- **Datos:** Esta migración crea una base de datos vacía. Si tenías datos en MySQL, tendrás que exportarlos e importarlos manualmente o empezar de cero.
- **Archivos:** Las subidas de imágenes (si las hay) en el plan gratuito de Render se perderán cada vez que se reinicie el servidor (el sistema de archivos es efímero). Para producción real, deberías usar un servicio como AWS S3 o Cloudinary para guardar imágenes.
