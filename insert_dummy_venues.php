<?php
// insert_dummy_venues.php
// Script para insertar 6 lugares ficticios en Lebu (PostgreSQL/Render)
// Ejecutar visitando: https://tu-sitio.onrender.com/insert_dummy_venues.php

require_once 'api/db.php';

// Verificar si se está ejecutando desde línea de comandos o navegador
$is_cli = (php_sapi_name() === 'cli');
$newline = $is_cli ? "\n" : "<br>";

echo "Iniciando inserción de lugares ficticios en Lebu...$newline";

$lugares = [
    [
        'nombre' => 'Centro de Eventos "El Faro"',
        'direccion' => 'Costanera Norte 123, Lebu',
        'lat' => -37.6095,
        'lng' => -73.6620,
        'capacidad' => 200,
        'precio_base' => 150000,
        'precio_por_persona' => 5000,
        'descripcion' => 'Elegante salón con vista privilegiada al mar y al faro de Lebu. Ideal para matrimonios y cenas de gala. Cuenta con amplia pista de baile.',
        'servicios' => 'Wifi, Estacionamiento, Baños, Cocina, Seguridad',
        'owner_nombre' => 'Juan Pérez',
        'owner_telefono' => '912345678',
        'owner_email' => 'juan.perez@email.com',
        'status' => 'available'
    ],
    [
        'nombre' => 'Casona "Los Boldos"',
        'direccion' => 'Camino a Pehuén Km 2, Lebu',
        'lat' => -37.6150,
        'lng' => -73.6480,
        'capacidad' => 80,
        'precio_base' => 80000,
        'precio_por_persona' => 3500,
        'descripcion' => 'Ambiente rústico y acogedor rodeado de naturaleza. Perfecto para cumpleaños y reuniones familiares privadas.',
        'servicios' => 'Estacionamiento, Baños, Quincho, Áreas Verdes',
        'owner_nombre' => 'María González',
        'owner_telefono' => '987654321',
        'owner_email' => 'maria.gonzalez@email.com',
        'status' => 'available'
    ],
    [
        'nombre' => 'Salón "Boca Lebu"',
        'direccion' => 'Ribera del Río 45, Lebu',
        'lat' => -37.6050,
        'lng' => -73.6550,
        'capacidad' => 150,
        'precio_base' => 120000,
        'precio_por_persona' => 4500,
        'descripcion' => 'Espacio moderno y versátil ubicado cerca de la desembocadura del río. Equipado para conferencias y eventos corporativos.',
        'servicios' => 'Wifi, Proyector, Audio, Baños, Accesibilidad',
        'owner_nombre' => 'Carlos Ruiz',
        'owner_telefono' => '955556666',
        'owner_email' => 'carlos.ruiz@email.com',
        'status' => 'available'
    ],
    [
        'nombre' => 'Quincho "El Pescador"',
        'direccion' => 'Sector La Playa s/n, Lebu',
        'lat' => -37.6120,
        'lng' => -73.6580,
        'capacidad' => 50,
        'precio_base' => 60000,
        'precio_por_persona' => 2500,
        'descripcion' => 'Quincho tradicional para disfrutar de asados y celebraciones informales. Ambiente relajado cerca de la playa.',
        'servicios' => 'Parrilla, Baños, Agua Potable',
        'owner_nombre' => 'Ana López',
        'owner_telefono' => '944443333',
        'owner_email' => 'ana.lopez@email.com',
        'status' => 'available'
    ],
    [
        'nombre' => 'Hotel "Plaza Lebu"',
        'direccion' => 'Calle Central 789, Lebu',
        'lat' => -37.6100,
        'lng' => -73.6520,
        'capacidad' => 300,
        'precio_base' => 250000,
        'precio_por_persona' => 8000,
        'descripcion' => 'Salón de eventos premium en el corazón de la ciudad. Servicio completo de banquetería y alojamiento disponible.',
        'servicios' => 'Wifi, Aire Acondicionado, Alojamiento, Bar, Seguridad',
        'owner_nombre' => 'Roberto Díaz',
        'owner_telefono' => '999888777',
        'owner_email' => 'roberto.diaz@email.com',
        'status' => 'available'
    ],
    [
        'nombre' => 'Espacio "Cerro La Cruz"',
        'direccion' => 'Mirador Alto 55, Lebu',
        'lat' => -37.6180,
        'lng' => -73.6550,
        'capacidad' => 100,
        'precio_base' => 100000,
        'precio_por_persona' => 4000,
        'descripcion' => 'Lugar con la mejor vista panorámica de Lebu. Terrazas al aire libre y salón interior vidriado.',
        'servicios' => 'Estacionamiento, Baños, Terraza, Calefacción',
        'owner_nombre' => 'Elena Torres',
        'owner_telefono' => '922221111',
        'owner_email' => 'elena.torres@email.com',
        'status' => 'available'
    ]
];

$sql = "INSERT INTO lugares (nombre, direccion, lat, lng, capacidad, precio_base, precio_por_persona, descripcion, servicios, owner_nombre, owner_telefono, owner_email, status, imagen_url) 
        VALUES (:nombre, :direccion, :lat, :lng, :capacidad, :precio_base, :precio_por_persona, :descripcion, :servicios, :owner_nombre, :owner_telefono, :owner_email, :status, '')";

$stmt = $pdo->prepare($sql);

$count = 0;
foreach ($lugares as $lugar) {
    try {
        $stmt->execute([
            ':nombre' => $lugar['nombre'],
            ':direccion' => $lugar['direccion'],
            ':lat' => $lugar['lat'],
            ':lng' => $lugar['lng'],
            ':capacidad' => $lugar['capacidad'],
            ':precio_base' => $lugar['precio_base'],
            ':precio_por_persona' => $lugar['precio_por_persona'],
            ':descripcion' => $lugar['descripcion'],
            ':servicios' => $lugar['servicios'],
            ':owner_nombre' => $lugar['owner_nombre'],
            ':owner_telefono' => $lugar['owner_telefono'],
            ':owner_email' => $lugar['owner_email'],
            ':status' => $lugar['status']
        ]);
        echo "Insertado: " . $lugar['nombre'] . "$newline";
        $count++;
    } catch (PDOException $e) {
        echo "Error al insertar " . $lugar['nombre'] . ": " . $e->getMessage() . "$newline";
    }
}

echo "Proceso finalizado. Se insertaron $count lugares.$newline";
?>
