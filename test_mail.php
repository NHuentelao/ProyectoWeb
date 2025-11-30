<?php
// test_mail.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "<h1>Diagnóstico de Envío de Correos</h1>";

// 1. Verificar si existe la carpeta vendor (Composer)
if (!file_exists(__DIR__ . '/vendor/autoload.php')) {
    die("<h3 style='color:red'>ERROR CRÍTICO: No se encuentra la carpeta 'vendor'.</h3>
    <p>Si estás en <b>XAMPP (Local)</b>: Debes instalar Composer y ejecutar <code>composer install</code> en la terminal de esta carpeta.</p>
    <p>Si estás en <b>Render</b>: Algo falló en el despliegue. Revisa los logs de 'Build'.</p>");
}

require __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// 2. Verificar Variables de Entorno
$user = getenv('SMTP_USER');
$pass = getenv('SMTP_PASS');

echo "<h3>Verificación de Credenciales:</h3>";
if ($user) {
    echo "<p style='color:green'>&#10004; Usuario SMTP detectado: " . htmlspecialchars($user) . "</p>";
} else {
    echo "<p style='color:red'>&#10008; ERROR: La variable <b>SMTP_USER</b> está vacía.</p>";
}

if ($pass) {
    echo "<p style='color:green'>&#10004; Contraseña SMTP detectada (Oculta por seguridad)</p>";
} else {
    echo "<p style='color:red'>&#10008; ERROR: La variable <b>SMTP_PASS</b> está vacía.</p>";
}

if (!$user || !$pass) {
    echo "<div style='background:#ffebee; padding:15px; border:1px solid red;'>
        <strong>¿Estás probando en XAMPP?</strong><br>
        Las variables de entorno de Render NO existen en tu PC local automáticamente.<br>
        Para probar en local, debes editar el archivo <code>api/mail_config.php</code> y poner tu correo y contraseña manualmente (¡pero no subas eso a GitHub!).
    </div>";
    // Intentar usar valores hardcodeados SOLO PARA PRUEBA si el usuario quiere editar este archivo
    // $user = 'tu_correo@gmail.com';
    // $pass = 'tu_contraseña_de_aplicacion';
}

if ($user && $pass) {
    echo "<h3>Intentando conectar con Gmail...</h3>";
    echo "<pre style='background:#f4f4f4; padding:10px; border:1px solid #ccc;'>";
    
    $mail = new PHPMailer(true);

    try {
        // Configuración del Servidor SMTP
        $mail->SMTPDebug = SMTP::DEBUG_CONNECTION; // Mostrar todo el log de conexión
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = $user;
        $mail->Password   = $pass;
        
        // CAMBIO: Usar SSL en puerto 465 (A veces el 587 da problemas de red en contenedores)
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = 465;

        // Destinatarios
        $mail->setFrom($user, 'Test Debug');
        $mail->addAddress($user); // Enviarse a sí mismo

        // Contenido
        $mail->isHTML(true);
        $mail->Subject = 'Prueba de Correo Exitosa';
        $mail->Body    = 'Si lees esto, el sistema de correos funciona correctamente.';

        $mail->send();
        echo "</pre>";
        echo "<h2 style='color:green'>¡ÉXITO! El correo se envió correctamente.</h2>";
        echo "<p>Revisa tu bandeja de entrada ($user).</p>";
    } catch (Exception $e) {
        echo "</pre>";
        echo "<h2 style='color:red'>FALLÓ EL ENVÍO</h2>";
        echo "<p>Error: " . htmlspecialchars($mail->ErrorInfo) . "</p>";
        echo "<p><strong>Posibles causas:</strong><br>
        1. La contraseña de aplicación es incorrecta.<br>
        2. El usuario no es un correo de Gmail válido.<br>
        3. Google bloqueó el intento (revisa tu correo por alertas de seguridad).
        </p>";
    }
}
?>