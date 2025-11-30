<?php
// api/mail_config.php
// Configuración para envío de correos vía API (Brevo/Sendinblue)
// Esto evita los bloqueos de puertos SMTP (587/465) en Render.

function send_email($to, $subject, $body) {
    // 1. Obtener credenciales de variables de entorno
    $apiKey = getenv('EMAIL_API_KEY'); // La clave API de Brevo
    $senderEmail = getenv('SMTP_USER'); // El correo remitente (debe estar verificado en Brevo)
    $senderName = 'ReservaNoble Lebu';

    // Validación básica
    if (!$apiKey || !$senderEmail) {
        error_log("Error Email: Faltan variables EMAIL_API_KEY o SMTP_USER");
        return false;
    }

    // 2. Configurar la petición a la API de Brevo
    $url = 'https://api.brevo.com/v3/smtp/email';
    
    $data = [
        'sender' => [
            'name' => $senderName,
            'email' => $senderEmail
        ],
        'to' => [
            ['email' => $to]
        ],
        'subject' => $subject,
        'htmlContent' => $body
    ];

    // 3. Enviar usando cURL (Estándar en PHP, no requiere instalación extra)
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

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    // 4. Verificar resultado
    if ($httpCode >= 200 && $httpCode < 300) {
        return true;
    } else {
        // Registrar el error exacto para depuración
        error_log("Error al enviar correo API ($httpCode): $response - Curl Error: $curlError");
        return false;
    }
}
?>