<?php
// setup_db.php
// Script auxiliar para crear las tablas en la base de datos de Render (PostgreSQL)
// Ejecutar desde la terminal (Shell) de Render con: php setup_db.php

// NO requerimos api/db.php para poder controlar el manejo de errores nosotros mismos
// y mostrar detalles que api/db.php oculta por seguridad.

if (php_sapi_name() !== 'cli') {
    echo "<pre>";
}

echo "--- Iniciando Configuración de Base de Datos (Modo Depuración) ---\n";

// 1. Obtener credenciales
$host = getenv('DB_HOST');
$db   = getenv('DB_NAME');
$user = getenv('DB_USER');
$pass = getenv('DB_PASSWORD');
$port = getenv('DB_PORT') ?: '5432'; 

echo "1. Verificando Variables de Entorno:\n";
echo "   DB_HOST: " . ($host ? $host : "NO DEFINIDO (Error)") . "\n";
echo "   DB_NAME: " . ($db ? $db : "NO DEFINIDO (Error)") . "\n";
echo "   DB_USER: " . ($user ? $user : "NO DEFINIDO (Error)") . "\n";
echo "   DB_PORT: " . $port . "\n";
echo "   DB_PASSWORD: " . ($pass ? "**** (Definido)" : "NO DEFINIDO (Error)") . "\n";

if (!$host || !$db || !$user || !$pass) {
    die("\nERROR CRÍTICO: Faltan variables de entorno. Revisa la configuración en Render.\n");
}

// 2. Intentar conectar
echo "\n2. Intentando conectar a PostgreSQL...\n";
$dsn = "pgsql:host=$host;port=$port;dbname=$db";

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "   ¡Conexión exitosa!\n";
} catch (PDOException $e) {
    die("\nERROR DE CONEXIÓN: " . $e->getMessage() . "\n\nRevisa que el Hostname y la Contraseña sean correctos.\n");
}

// 3. Leer SQL
$sqlFile = 'schema_postgres.sql';
echo "\n3. Buscando archivo de esquema ($sqlFile)...\n";

if (!file_exists($sqlFile)) {
    die("ERROR: No se encuentra el archivo $sqlFile en la raíz.\n");
}

$sql = file_get_contents($sqlFile);
echo "   Archivo leído. Ejecutando migración...\n";

try {
    // Ejecutar el script SQL completo
    $pdo->exec($sql);
    
    echo "\n---------------------------------------------------\n";
    echo " ¡ÉXITO! Las tablas se han creado correctamente.\n";
    echo "---------------------------------------------------\n";
    echo "Ya puedes usar tu aplicación.\n";
    
} catch (PDOException $e) {
    echo "ERROR SQL al crear tablas: " . $e->getMessage() . "\n";
}
?>
