-- Script de migración a PostgreSQL (Completo basado en uso de API)

-- Tabla usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    rol VARCHAR(20) DEFAULT 'user' CHECK (rol IN ('user', 'admin')),
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla lugares
CREATE TABLE IF NOT EXISTS lugares (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    direccion VARCHAR(255),
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    capacidad INTEGER,
    precio_base DECIMAL(10,2) DEFAULT 0.00,
    precio_por_persona DECIMAL(10,2) DEFAULT 0.00,
    descripcion TEXT,
    servicios TEXT,
    owner_nombre VARCHAR(255),
    owner_telefono VARCHAR(50),
    owner_email VARCHAR(255),
    imagen_url TEXT,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'reserved', 'deleted'))
);

-- Tabla galeria_lugares
CREATE TABLE IF NOT EXISTS galeria_lugares (
    id SERIAL PRIMARY KEY,
    id_lugar INTEGER NOT NULL,
    imagen_url TEXT NOT NULL,
    FOREIGN KEY (id_lugar) REFERENCES lugares(id) ON DELETE CASCADE
);

-- Tabla solicitudes
CREATE TABLE IF NOT EXISTS solicitudes (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    id_lugar INTEGER NOT NULL,
    tipo_evento VARCHAR(100),
    fecha_evento DATE NOT NULL,
    duracion_dias INTEGER DEFAULT 1,
    hora_evento TIME,
    invitados INTEGER,
    precio_total_estimado DECIMAL(10,2),
    solicitudes_especiales TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    leido_por_usuario BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (id_lugar) REFERENCES lugares(id) ON DELETE CASCADE
);

-- Tabla reportes
CREATE TABLE IF NOT EXISTS reportes (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    mensaje TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(50),
    leido BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla contact_messages
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  asunto VARCHAR(255) DEFAULT NULL,
  mensaje TEXT NOT NULL,
  leido BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices adicionales
CREATE INDEX idx_contact_messages_email ON contact_messages(email);
CREATE INDEX idx_contact_messages_leido ON contact_messages(leido);
CREATE INDEX idx_solicitudes_usuario ON solicitudes(id_usuario);
CREATE INDEX idx_solicitudes_lugar ON solicitudes(id_lugar);
