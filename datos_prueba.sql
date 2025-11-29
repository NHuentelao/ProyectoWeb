-- Script para insertar datos de prueba en la base de datos reservas_lebu
-- Ejecutar este script después de crear las tablas

USE `reservas_lebu`;

-- Insertar usuarios de prueba
INSERT INTO `usuarios` (`nombre`, `email`, `password`, `telefono`, `rol`) VALUES
('Administrador Sistema', 'admin@lebu.cl', 'admin123', '+56 9 1234 5678', 'admin'),
('Juan Pérez', 'juan@email.com', '123456', '+56 9 2345 6789', 'user'),
('María González', 'maria@email.com', '123456', '+56 9 3456 7890', 'user'),
('Carlos Silva', 'carlos@email.com', '123456', '+56 9 4567 8901', 'user');

-- Insertar lugares de prueba
INSERT INTO `lugares` (`nombre`, `direccion`, `lat`, `lng`, `capacidad`, `precio_base`, `precio_por_persona`, `status`) VALUES
('Centro Cultural de Lebu', 'Av. Arturo Prat 123, Lebu', -37.6083, -73.6472, 200, 50000.00, 2500.00, 'available'),
('Salón Municipal', 'Plaza de Armas s/n, Lebu', -37.6100, -73.6450, 150, 40000.00, 2000.00, 'available'),
('Club Social Lebu', 'Calle O\'Higgins 456, Lebu', -37.6050, -73.6500, 100, 30000.00, 1500.00, 'available'),
('Gimnasio Municipal', 'Av. Costanera 789, Lebu', -37.6120, -73.6400, 300, 60000.00, 3000.00, 'maintenance'),
('Restaurant El Puerto', 'Calle Puerto 321, Lebu', -37.6070, -73.6480, 80, 25000.00, 1200.00, 'available');

-- Insertar algunas solicitudes de prueba
INSERT INTO `solicitudes` (`id_usuario`, `id_lugar`, `tipo_evento`, `fecha_evento`, `hora_evento`, `invitados`, `precio_total_estimado`, `solicitudes_especiales`, `status`) VALUES
(2, 1, 'Boda', '2024-02-15', '18:00:00', 80, 250000.00, 'Necesitamos decoración floral especial', 'pending'),
(3, 2, 'Cumpleaños', '2024-02-20', '16:00:00', 50, 140000.00, 'Mesa de dulces para niños', 'approved'),
(4, 3, 'Conferencia', '2024-02-25', '09:00:00', 30, 75000.00, 'Equipo de sonido profesional', 'rejected');

-- Insertar algunas notificaciones de prueba
INSERT INTO `notificaciones` (`id_usuario`, `mensaje`, `tipo`, `leido`) VALUES
(2, 'Tu solicitud para "Boda" en "Centro Cultural de Lebu" está siendo revisada.', 'request_pending', 0),
(3, 'Tu solicitud para "Cumpleaños" en "Salón Municipal" ha sido APROBADA.', 'request_approved', 0),
(4, 'Tu solicitud para "Conferencia" en "Club Social Lebu" ha sido RECHAZADA.', 'request_rejected', 0);

-- Insertar algunos reportes de prueba
INSERT INTO `reportes` (`id_usuario`, `tipo`, `mensaje`, `status`) VALUES
(2, 'reserva', 'No puedo acceder al sistema de reservas desde mi móvil', 'pending'),
(3, 'lugar', 'El Salón Municipal necesita mantenimiento en el sistema de calefacción', 'resolved'),
(4, 'tecnico', 'La página se carga muy lento', 'pending');

-- Mostrar resumen de datos insertados
SELECT 'Usuarios creados:' as Tipo, COUNT(*) as Cantidad FROM usuarios
UNION ALL
SELECT 'Lugares creados:', COUNT(*) FROM lugares
UNION ALL
SELECT 'Solicitudes creadas:', COUNT(*) FROM solicitudes
UNION ALL
SELECT 'Notificaciones creadas:', COUNT(*) FROM notificaciones
UNION ALL
SELECT 'Reportes creados:', COUNT(*) FROM reportes;
