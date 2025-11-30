<?php
// setup_db.php
// Script auxiliar para crear las tablas en la base de datos de Render (PostgreSQL)
// Ejecutar desde la terminal (Shell) de Render con: php setup_db.php

// Desactivar salida JSON de errores para este script si es posible, 
// aunque api/db.php ya tiene su propio try/catch que hace exit().
// Si la conexión falla, api/db.php mostrará el mensaje de error JSON y saldrá.

require_once 'api/db.php';

if (php_sapi_name() !== 'cli') {
    echo "<pre>";
}

echo "--- Iniciando Configuración de Base de Datos ---\n";
echo "1. Conexión establecida.\n";

$sqlFile = 'schema_postgres.sql';
echo "2. Buscando archivo de esquema ($sqlFile)...\n";

if (!file_exists($sqlFile)) {
    die("ERROR: No se encuentra el archivo $sqlFile en la raíz.\n");
}

$sql = file_get_contents($sqlFile);
echo "3. Archivo leído. Ejecutando migración...\n";

try {
    // Ejecutar el script SQL completo
    $pdo->exec($sql);
    
    echo "\n---------------------------------------------------\n";
    echo " ¡ÉXITO! Las tablas se han creado correctamente.\n";
    echo "---------------------------------------------------\n";
    echo "Ya puedes usar tu aplicación.\n";
    
} catch (PDOException $e) {
    echo "ERROR SQL: " . $e->getMessage() . "\n";
}
?>
