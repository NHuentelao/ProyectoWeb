<?php
// test_mail.php
// Script actualizado para probar el envío vía API (Brevo)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "<h1>Diagnóstico de Envío de Correos (Vía API)</h1>";

// Incluir la configuración de correo actualizada
require_once __DIR__ . '/api/mail_config.php';

// 1. Verificar Variables de Entorno
$apiKey = getenv('EMAIL_API_KEY');
$user = getenv('SMTP_USER');

echo "<h3>Verificación de Configuración:</h3>";

if ($apiKey) {
    // Mostrar solo los primeros caracteres de la API Key por seguridad
    $maskedKey = substr($apiKey, 0, 4) . '...' . substr($apiKey, -4);
    echo "<p style='color:green'>&#10004; API Key detectada: $maskedKey</p>";
} else {
    echo "<p style='color:red'>&#10008; ERROR: La variable <b>EMAIL_API_KEY</b> está vacía.</p>";
}

if ($user) {
    echo "<p style='color:green'>&#10004; Remitente detectado: " . htmlspecialchars($user) . "</p>";
} else {
    echo "<p style='color:red'>&#10008; ERROR: La variable <b>SMTP_USER</b> está vacía.</p>";
}

if ($apiKey && $user) {
    echo "<h3>Intentando enviar correo de prueba...</h3>";
    
    $to = $user; // Enviarse a sí mismo para probar
    $subject = "Prueba de API Brevo - " . date('Y-m-d H:i:s');
    $body = "<h1>¡Funciona!</h1><p>Este correo fue enviado usando la API de Brevo, evitando los puertos SMTP bloqueados.</p>";

    echo "<p>Enviando a: $to ...</p>";

    $result = send_email($to, $subject, $body);

    if ($result) {
        echo "<h2 style='color:green'>¡ÉXITO! La API aceptó el mensaje.</h2>";
        echo "<p>Revisa tu bandeja de entrada ($to). Si no llega, revisa los logs en el panel de Brevo.</p>";
    } else {
        echo "<h2 style='color:red'>FALLÓ EL ENVÍO</h2>";
        echo "<p>Revisa los logs de la aplicación (o la salida de error_log) para ver el detalle del error devuelto por la API.</p>";
    }
} else {
    echo "<div style='background:#ffebee; padding:15px; border:1px solid red;'>
        <strong>Faltan Variables</strong><br>
        Asegúrate de configurar <code>EMAIL_API_KEY</code> y <code>SMTP_USER</code> en el panel de Render.
    </div>";
}
?>