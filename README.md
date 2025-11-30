# 🎉 ReservaNoble — Sistema de Reservas de Eventos

## 📋 Instrucciones de Instalación y Uso

### 1. Configuración de la Base de Datos

1. **Iniciar servidor web y base de datos**
2. **Abrir gestor de base de datos** (ej. pgAdmin o phpMyAdmin)
3. **Crear la base de datos** `reservas_lebu`
4. **Ejecutar el script de creación de tablas** (el que proporcionaste)
5. **Ejecutar el script de datos de prueba** (`datos_prueba.sql`)

### 2. Acceso al Sistema

**URL del sistema:** `http://localhost/ProyectoWeb/`

### 3. Usuarios de Prueba

#### 👨‍💼 Administrador
- **Email:** `admin@lebu.cl`
- **Contraseña:** `admin123`
- **Acceso:** Panel de administración completo

#### 👥 Usuarios Regulares
- **Email:** `juan@email.com` | **Contraseña:** `123456`
- **Email:** `maria@email.com` | **Contraseña:** `123456`
- **Email:** `carlos@email.com` | **Contraseña:** `123456`

### 4. Cómo Usar el Sistema

#### 🔹 Como Usuario Regular:

1. **Iniciar sesión** con cualquier usuario regular
2. **Completar el formulario de reserva:**
   - Seleccionar tipo de evento
   - Elegir fecha y hora
   - Seleccionar lugar del mapa
   - Indicar cantidad de invitados
   - Agregar solicitudes especiales
3. **Enviar la solicitud**
4. **Ver el estado** en "Ver mis reservas"
5. **Recibir notificaciones** cuando el admin apruebe/rechace

#### 🔹 Como Administrador:

1. **Iniciar sesión** como admin
2. **Ir a la sección "Reservas"**
3. **Ver todas las solicitudes pendientes**
4. **Aprobar o rechazar** cada solicitud
5. **Los usuarios recibirán notificaciones automáticamente**

### 5. Funcionalidades del Sistema

#### ✅ Formulario de Reservas
- Validación de fechas (no permite fechas pasadas)
- Cálculo automático de precios
- Selección de lugares desde el mapa
- Indicadores de carga durante el envío

#### ✅ Panel de Administración
- Gestión de usuarios
- Gestión de lugares
- Aprobación/rechazo de reservas
- Gestión de reportes
- Visualización mejorada con colores y estados

#### ✅ Sistema de Notificaciones
- Badge parpadeante para notificaciones nuevas
- Notificaciones automáticas al aprobar/rechazar
- Diferentes tipos de notificaciones con colores
- Historial de notificaciones

#### ✅ Gestión de Lugares
- Crear/editar/eliminar lugares
- Cambiar estado (disponible/mantenimiento/reservado)
- Mapa interactivo para ubicación
- Precios base y por persona

### 6. Estados de las Reservas

- 🟡 **PENDIENTE:** Esperando aprobación del administrador
- 🟢 **APROBADA:** Reserva confirmada, lugar marcado como reservado
- 🔴 **RECHAZADA:** Reserva no aprobada

### 7. Tipos de Notificaciones

- 📧 **request_approved:** Solicitud aprobada
- ❌ **request_rejected:** Solicitud rechazada
- ✅ **report_resolved:** Reporte resuelto

### 8. Solución de Problemas

#### Si el formulario no funciona:
1. Verificar que el servidor esté ejecutándose
2. Verificar la conexión a la base de datos
3. Revisar la consola del navegador para errores

#### Si no aparecen lugares en el mapa:
1. Verificar que la API de Google Maps esté funcionando
2. Verificar que haya lugares en la base de datos
3. Revisar la consola para errores de JavaScript

#### Si las notificaciones no aparecen:
1. Verificar que el usuario esté logueado
2. Verificar que haya notificaciones en la base de datos
3. Recargar la página

### 9. Archivos del Sistema

- `inicio.php` - Página de login/registro
- `formulario.php` - Formulario de reservas para usuarios
- `administrador.php` - Panel de administración
- `api/api.php` - API REST para todas las operaciones
- `api/db.php` - Configuración de base de datos
- `datos_prueba.sql` - Datos de ejemplo

### 10. Características Técnicas

- **Backend:** PHP con PDO
- **Frontend:** HTML5, CSS3, JavaScript ES6+
- **Base de Datos:** PostgreSQL / MySQL
- **Mapas:** Google Maps API
- **Iconos:** Font Awesome
- **Diseño:** Responsive y moderno

---

## 🚀 ¡El sistema está listo para usar!

Con estos datos de prueba podrás probar todas las funcionalidades inmediatamente. El sistema maneja automáticamente:

- ✅ Envío de solicitudes de reserva
- ✅ Aprobación/rechazo por parte del administrador  
- ✅ Notificaciones automáticas a los usuarios
- ✅ Gestión completa de lugares y usuarios
- ✅ Sistema de reportes

¡Disfruta usando tu sistema de reservas! 🎉
