<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Verificar si existe el autoloader (Composer)
$autoloadPath = __DIR__ . '/../vendor/autoload.php';

if (!file_exists($autoloadPath)) {
    // Si no existe, definimos una función dummy para evitar Fatal Error
    // y permitir que la API responda JSON válido (aunque con error de envío)
    if (!function_exists('send_email')) {
        function send_email($to, $subject, $body) {
            error_log("CRITICAL: PHPMailer no instalado. Falta ejecutar 'composer install' o la carpeta vendor.");
            return false;
        }
    }
} else {
    require $autoloadPath;

    if (!function_exists('send_email')) {
        function send_email($to, $subject, $body) {
            $mail = new PHPMailer(true);

            try {
                // Configuración del Servidor SMTP
                $mail->isSMTP();
                $mail->Host       = 'smtp.gmail.com';
                $mail->SMTPAuth   = true;
                $mail->Username   = getenv('SMTP_USER'); // Variable de entorno
                $mail->Password   = getenv('SMTP_PASS'); // Variable de entorno
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port       = 587;

                // Configuración del Remitente y Destinatario
                $mail->setFrom(getenv('SMTP_USER'), 'ReservaNoble Lebu');
                $mail->addAddress($to);

                // Contenido
                $mail->isHTML(true);
                $mail->CharSet = 'UTF-8';
                $mail->Subject = $subject;
                $mail->Body    = $body;

                $mail->send();
                return true;
            } catch (Exception $e) {
                error_log("Error al enviar correo: {$mail->ErrorInfo}");
                return false;
            }
        }
    }
}
?>