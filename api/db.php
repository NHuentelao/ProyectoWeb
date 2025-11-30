<?php
// Configuración de la base de datos
// Intenta obtener variables de entorno (Render), si no existen usa valores por defecto (Local/XAMPP)
// Updated: Fix JSON response issues

$host = getenv('DB_HOST') ?: 'localhost';
$db   = getenv('DB_NAME') ?: 'reservas_lebu';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';
$port = getenv('DB_PORT') ?: '5432'; 

// Determinar el driver: si hay variables de entorno de Render, asumimos pgsql, si no, mysql (para compatibilidad local)
// O puedes forzarlo con una variable DB_DRIVER
$driver = getenv('DB_DRIVER') ?: 'pgsql'; 

// Si estamos en local con XAMPP y no hemos configurado variables, probablemente queramos mysql
if ($host === 'localhost' && $user === 'root' && !getenv('DB_DRIVER')) {
    $driver = 'mysql';
}

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    if ($driver === 'pgsql') {
        // Conexión PostgreSQL
        $dsn = "pgsql:host=$host;port=$port;dbname=$db";
    } else {
        // Conexión MySQL (Legacy/Local)
        $dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
    }

    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    // Log del error real para el servidor (error_log)
    error_log("Error de conexión a BD: " . $e->getMessage());
    
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos.']);
    exit;
}
