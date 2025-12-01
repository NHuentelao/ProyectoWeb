# 🎉 ReservaNoble — Sistema de Reservas de Eventos

Bienvenido a **ReservaNoble**, una plataforma moderna y responsiva para la gestión y reserva de espacios para eventos en Lebu. Este sistema permite a los usuarios explorar lugares, realizar reservas y recibir notificaciones, mientras que los administradores pueden gestionar todo el flujo desde un panel de control centralizado.

---

## 🛠️ Tecnologías y APIs Utilizadas

Este proyecto integra múltiples servicios y tecnologías para ofrecer una experiencia completa:

### Backend & Base de Datos
- **PHP 8.x:** Lógica del servidor y API REST (`api/api.php`).
- **PostgreSQL:** Base de datos principal (compatible con despliegue en Render).
- **MySQL:** Soporte legacy para entornos locales.

### Frontend
- **HTML5 / CSS3:** Diseño moderno, responsivo y con efectos visuales (Glassmorphism).
- **JavaScript (ES6+):** Lógica del cliente, manejo de estado y consumo de API (Fetch).

### APIs Externas
1.  **🗺️ Google Maps JavaScript API:**
    - Visualización interactiva de lugares.
    - Marcadores personalizados y clustering.
2.  **🔑 Google Identity Services (OAuth 2.0):**
    - Inicio de sesión rápido y seguro con cuentas de Google.
3.  **📧 Brevo API (anteriormente Sendinblue):**
    - Envío transaccional de correos electrónicos (Confirmaciones, Recuperación de contraseña, Notificaciones).

---

## 📋 Instrucciones de Instalación

### 1. Requisitos Previos
- Servidor Web (Apache/Nginx) con PHP 8.0+.
- Base de datos PostgreSQL (Recomendado) o MySQL.
- Cuenta en Google Cloud Platform (para Maps y Login).
- Cuenta en Brevo (para correos).

### 2. Configuración de la Base de Datos
1.  Crea una base de datos llamada `reservas_lebu`.
2.  Ejecuta el script `schema_postgres.sql` para crear las tablas.
3.  (Opcional) Ejecuta `datos_prueba.sql` para poblar con datos iniciales.

### 3. Variables de Entorno
Para que el sistema funcione correctamente (especialmente en producción/Render), configura las siguientes variables de entorno:

| Variable | Descripción |
| :--- | :--- |
| `DB_HOST` | Host de la base de datos (ej. `dpg-xxx.render.com`) |
| `DB_NAME` | Nombre de la base de datos (`reservas_lebu`) |
| `DB_USER` | Usuario de la base de datos |
| `DB_PASSWORD` | Contraseña de la base de datos |
| `DB_PORT` | Puerto (por defecto `5432` para PgSQL) |
| `BREVO_API_KEY` | Tu API Key de Brevo para envío de correos |

> **Nota:** En entorno local sin variables de entorno, el sistema intentará conectar a `localhost` con credenciales por defecto (revisar `api/db.php`).

---

## 🚀 Cómo Usar el Sistema

### Acceso
- **URL Local:** `http://localhost/ProyectoWeb/index.html`
- **URL Producción:** (Tu URL de Render)

### Usuarios de Prueba (Datos por defecto)

#### 👨‍💼 Administrador
- **Email:** `admin@lebu.cl`
- **Contraseña:** `admin123`
- **Acceso:** `administrador.html` (Gestión total)

#### 👥 Usuario Regular
- **Email:** `juan@email.com`
- **Contraseña:** `123456`
- **Acceso:** `formulario.html` (Reservas)

---

## 🌟 Funcionalidades Principales

### Para Usuarios (`index.html`, `formulario.html`)
- **Exploración:** Ver lugares en lista o mapa interactivo.
- **Filtros:** Buscar por capacidad, precio y nombre.
- **Reservas:** Formulario dinámico con cálculo de costos en tiempo real.
- **Estado:** Seguimiento de solicitudes (Pendiente, Aprobada, Rechazada).
- **Notificaciones:** Alertas en tiempo real sobre el estado de la reserva.
- **Perfil:** Gestión de datos personales y cambio de contraseña.

### Para Administradores (`administrador.html`)
- **Dashboard:** Vista general de reservas y métricas.
- **Gestión de Reservas:** Aprobar, rechazar o archivar solicitudes.
- **Gestión de Lugares:** Crear, editar y eliminar espacios (incluyendo ubicación en mapa).
- **Gestión de Usuarios:** Ver usuarios registrados y suspender cuentas.
- **Reportes:** Ver incidencias reportadas por usuarios.

---

## 📂 Estructura del Proyecto

```text
ProyectoWeb/
├── api/                  # Backend
│   ├── api.php           # Controlador principal (API REST)
│   ├── db.php            # Conexión a Base de Datos
│   └── mail_config.php   # Configuración de Brevo (Email)
├── css/                  # Estilos (inicio.css, formulario.css, etc.)
├── js/                   # Lógica Frontend
│   ├── index.js          # Lógica de Landing Page y Login
│   ├── formulario.js     # Lógica de Usuario (Reservas)
│   └── administrador.js  # Lógica de Admin
├── index.html            # Landing Page (Login/Registro)
├── formulario.html       # Panel de Usuario
├── administrador.html    # Panel de Administración
├── registrar.html        # Registro de nuevos usuarios
└── schema_postgres.sql   # Esquema de Base de Datos
```

---

## ❓ Solución de Problemas Frecuentes

**1. El mapa no carga:**
- Verifica que tu API Key de Google Maps tenga habilitados los servicios "Maps JavaScript API" y "Places API".
- Revisa la consola del navegador (F12) para ver errores de cuota o referer.

**2. No llegan los correos:**
- Asegúrate de haber configurado la `BREVO_API_KEY` correctamente.
- Verifica que el remitente configurado en `api/mail_config.php` esté validado en tu cuenta de Brevo.

**3. Error de conexión a Base de Datos:**
- Si estás en local, revisa que tu servidor PostgreSQL/MySQL esté corriendo.
- Si estás en Render, verifica las variables de entorno en el dashboard.

---

© 2025 ReservaNoble. Todos los derechos reservados.
