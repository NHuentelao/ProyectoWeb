<?php
// update_images_column.php
// Script para actualizar la columna imagen_url a TEXT para soportar Base64

// Configuración para mostrar errores en pantalla si se ejecuta desde navegador
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if (php_sapi_name() !== 'cli') {
    echo "<pre>";
}

echo "--- Actualizando Esquema de Base de Datos ---\n";

// Usar la misma lógica de conexión que db.php
$host = getenv('DB_HOST') ?: 'localhost';
$db   = getenv('DB_NAME') ?: 'reservas_lebu';
$user = getenv('DB_USER') ?: 'postgres';
$pass = getenv('DB_PASSWORD') ?: '';
$port = getenv('DB_PORT') ?: '5432'; 

echo "Conectando a: $host:$port DB: $db User: $user\n";

$dsn = "pgsql:host=$host;port=$port;dbname=$db";

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "Conexión exitosa.\n";
    
    // Alterar tabla lugares
    echo "Actualizando tabla 'lugares'...\n";
    try {
        $pdo->exec("ALTER TABLE lugares ALTER COLUMN imagen_url TYPE TEXT");
        echo " - Tabla 'lugares' actualizada.\n";
    } catch (PDOException $e) {
        echo " - Nota: " . $e->getMessage() . "\n";
    }
    
    // Alterar tabla galeria_lugares
    echo "Actualizando tabla 'galeria_lugares'...\n";
    try {
        $pdo->exec("ALTER TABLE galeria_lugares ALTER COLUMN imagen_url TYPE TEXT");
        echo " - Tabla 'galeria_lugares' actualizada.\n";
    } catch (PDOException $e) {
        echo " - Nota: " . $e->getMessage() . "\n";
    }
    
    echo "\n¡ÉXITO! Las columnas han sido actualizadas a TEXT.\n";
    echo "Ahora puedes subir imágenes que se guardarán directamente en la base de datos.\n";
    
} catch (PDOException $e) {
    echo "\nERROR FATAL DE CONEXIÓN: " . $e->getMessage() . "\n";
    echo "Verifica tus credenciales de base de datos.\n";
}
?>
