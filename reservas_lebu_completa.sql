-- Base de datos completa: reservas_lebu
-- Fecha: 25 Nov 2025

CREATE DATABASE IF NOT EXISTS `reservas_lebu`;
USE `reservas_lebu`;

-- Desactivar chequeo de claves foráneas para evitar errores al borrar tablas
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `notificaciones`;
DROP TABLE IF EXISTS `reportes`;
DROP TABLE IF EXISTS `solicitudes`;
DROP TABLE IF EXISTS `lugares`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `contact_messages`;

SET FOREIGN_KEY_CHECKS = 1;

-- 
-- 1. Tabla `usuarios`
-- 
CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `rol` enum('user','admin') NOT NULL DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 
-- 2. Tabla `lugares`
-- 
CREATE TABLE `lugares` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  `lng` decimal(11,8) DEFAULT NULL,
  `capacidad` int(11) DEFAULT NULL,
  `precio_base` decimal(10,2) DEFAULT 0.00,
  `precio_por_persona` decimal(10,2) DEFAULT 0.00,
  `status` enum('available','maintenance','reserved') NOT NULL DEFAULT 'available',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 
-- 3. Tabla `solicitudes`
-- 
CREATE TABLE `solicitudes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `id_lugar` int(11) NOT NULL,
  `tipo_evento` varchar(100) DEFAULT NULL,
  `fecha_evento` date DEFAULT NULL,
  `hora_evento` time DEFAULT NULL,
  `invitados` int(11) DEFAULT NULL,
  `precio_total_estimado` decimal(10,2) DEFAULT NULL,
  `solicitudes_especiales` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `leido_por_usuario` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `id_usuario` (`id_usuario`),
  KEY `id_lugar` (`id_lugar`),
  CONSTRAINT `solicitudes_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `solicitudes_ibfk_2` FOREIGN KEY (`id_lugar`) REFERENCES `lugares` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 
-- 4. Tabla `reportes`
-- 
CREATE TABLE `reportes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `tipo` enum('reserva','tecnico','lugar','otro') NOT NULL,
  `mensaje` text DEFAULT NULL,
  `status` enum('pending','resolved') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `reportes_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 
-- 5. Tabla `notificaciones`
-- 
CREATE TABLE `notificaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `mensaje` text NOT NULL,
  `tipo` varchar(50) DEFAULT NULL,
  `leido` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `notificaciones_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 
-- 6. Tabla `contact_messages`
-- 
CREATE TABLE `contact_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `asunto` varchar(255) DEFAULT NULL,
  `mensaje` text NOT NULL,
  `leido` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `email` (`email`),
  KEY `leido` (`leido`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 
-- DATOS DE PRUEBA
-- 

-- Insertar usuarios
INSERT INTO `usuarios` (`nombre`, `email`, `password`, `telefono`, `rol`) VALUES
('Administrador Sistema', 'admin@lebu.cl', 'admin123', '+56 9 1234 5678', 'admin'),
('Juan Pérez', 'juan@email.com', '123456', '+56 9 2345 6789', 'user'),
('María González', 'maria@email.com', '123456', '+56 9 3456 7890', 'user'),
('Carlos Silva', 'carlos@email.com', '123456', '+56 9 4567 8901', 'user');

-- Insertar lugares
INSERT INTO `lugares` (`nombre`, `direccion`, `lat`, `lng`, `capacidad`, `precio_base`, `precio_por_persona`, `status`) VALUES
('Centro Cultural de Lebu', 'Av. Arturo Prat 123, Lebu', -37.6083, -73.6472, 200, 50000.00, 2500.00, 'available'),
('Salón Municipal', 'Plaza de Armas s/n, Lebu', -37.6100, -73.6450, 150, 40000.00, 2000.00, 'available'),
('Club Social Lebu', 'Calle O\'Higgins 456, Lebu', -37.6050, -73.6500, 100, 30000.00, 1500.00, 'available'),
('Gimnasio Municipal', 'Av. Costanera 789, Lebu', -37.6120, -73.6400, 300, 60000.00, 3000.00, 'maintenance'),
('Restaurant El Puerto', 'Calle Puerto 321, Lebu', -37.6070, -73.6480, 80, 25000.00, 1200.00, 'available');

-- Insertar solicitudes
INSERT INTO `solicitudes` (`id_usuario`, `id_lugar`, `tipo_evento`, `fecha_evento`, `hora_evento`, `invitados`, `precio_total_estimado`, `solicitudes_especiales`, `status`) VALUES
(2, 1, 'Boda', '2024-02-15', '18:00:00', 80, 250000.00, 'Necesitamos decoración floral especial', 'pending'),
(3, 2, 'Cumpleaños', '2024-02-20', '16:00:00', 50, 140000.00, 'Mesa de dulces para niños', 'approved'),
(4, 3, 'Conferencia', '2024-02-25', '09:00:00', 30, 75000.00, 'Equipo de sonido profesional', 'rejected');

-- Insertar notificaciones
INSERT INTO `notificaciones` (`id_usuario`, `mensaje`, `tipo`, `leido`) VALUES
(2, 'Tu solicitud para "Boda" en "Centro Cultural de Lebu" está siendo revisada.', 'request_pending', 0),
(3, 'Tu solicitud para "Cumpleaños" en "Salón Municipal" ha sido APROBADA.', 'request_approved', 0),
(4, 'Tu solicitud para "Conferencia" en "Club Social Lebu" ha sido RECHAZADA.', 'request_rejected', 0);

-- Insertar reportes
INSERT INTO `reportes` (`id_usuario`, `tipo`, `mensaje`, `status`) VALUES
(2, 'reserva', 'No puedo acceder al sistema de reservas desde mi móvil', 'pending'),
(3, 'lugar', 'El Salón Municipal necesita mantenimiento en el sistema de calefacción', 'resolved'),
(4, 'tecnico', 'La página se carga muy lento', 'pending');
