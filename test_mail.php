<?php
// test_mail.php
// Script de diagnóstico avanzado para Brevo API
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "<h1>Diagnóstico de Envío de Correos (Vía API)</h1>";

// 1. Obtener credenciales
$apiKey = getenv('EMAIL_API_KEY');
$user = getenv('SMTP_USER');

echo "<h3>1. Verificación de Credenciales:</h3>";

// Validar API Key
if ($apiKey) {
    $maskedKey = substr($apiKey, 0, 4) . '...' . substr($apiKey, -4);
    echo "<p>API Key detectada: <code>$maskedKey</code></p>";

    // CHECK: ¿Es una clave SMTP en lugar de API?
    if (strpos($apiKey, 'xsmt') === 0) {
        echo "<div style='background:#ffebee; color:#c62828; padding:15px; border:1px solid #ef9a9a; border-radius:4px;'>
            <strong>⚠ ALERTA CRÍTICA: CLAVE INCORRECTA DETECTADA</strong><br>
            Parece que has puesto tu <b>Clave SMTP</b> (empieza con 'xsmt') en la variable <code>EMAIL_API_KEY</code>.<br>
            La API de Brevo requiere una <b>API Key v3</b>, que usualmente empieza con <code>xkeysib-</code>.<br>
            <br>
            <b>Solución:</b>
            <ol>
                <li>Ve a Brevo -> SMTP & API -> Pestaña <b>Claves API</b> (NO SMTP).</li>
                <li>Genera una nueva clave.</li>
                <li>Actualiza la variable <code>EMAIL_API_KEY</code> en Render.</li>
            </ol>
        </div>";
    } elseif (strpos($apiKey, 'xkeysib-') !== 0) {
        echo "<p style='color:orange'>⚠ Advertencia: La clave no empieza con 'xkeysib-'. Asegúrate de que sea una API Key v3 válida.</p>";
    } else {
        echo "<p style='color:green'>✔ El formato de la clave parece correcto (API Key v3).</p>";
    }

} else {
    echo "<p style='color:red'>&#10008; ERROR: La variable <b>EMAIL_API_KEY</b> está vacía.</p>";
}

// Validar Usuario
if ($user) {
    echo "<p>Remitente: <code>$user</code></p>";
} else {
    echo "<p style='color:red'>&#10008; ERROR: La variable <b>SMTP_USER</b> está vacía.</p>";
}

if ($apiKey && $user) {
    echo "<h3>2. Prueba de Envío (Debug):</h3>";
    
    $url = 'https://api.brevo.com/v3/smtp/email';
    $data = [
        'sender' => ['name' => 'Test Debug', 'email' => $user],
        'to' => [['email' => $user]],
        'subject' => "Prueba de API Brevo - " . date('H:i:s'),
        'htmlContent' => "<h1>Prueba Exitosa</h1><p>Si ves esto, la configuración es correcta.</p>"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'accept: application/json',
        'api-key: ' . $apiKey,
        'content-type: application/json'
    ]);

    echo "<p>Enviando petición a Brevo...</p>";
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    echo "<div style='background:#f5f5f5; padding:10px; border:1px solid #ddd; font-family:monospace;'>";
    echo "<strong>HTTP Code:</strong> $httpCode<br>";
    
    if ($curlError) {
        echo "<strong>cURL Error:</strong> $curlError<br>";
    }
    
    echo "<strong>Respuesta API:</strong><br>";
    echo htmlspecialchars($response);
    echo "</div>";

    if ($httpCode >= 200 && $httpCode < 300) {
        echo "<h2 style='color:green'>¡ÉXITO! Correo enviado.</h2>";
    } else {
        echo "<h2 style='color:red'>FALLÓ EL ENVÍO</h2>";
        echo "<p>Revisa el código de error y el mensaje JSON arriba para saber qué pasó.</p>";
    }
}
?>