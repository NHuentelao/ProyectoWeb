<?php
// Desactivar la visualización de errores en la salida (para no romper el JSON)
ini_set('display_errors', 0);
error_reporting(E_ALL); // Aún registrar errores en el log

// Iniciar la sesión en CADA solicitud de API
session_start();

// Incluir la conexión a la base de datos
// 'db.php' está en la MISMA carpeta 'api'
require 'db.php'; 
require 'mail_config.php';

// Establecer el tipo de contenido a JSON
header('Content-Type: application/json');

// --- Funciones de Ayuda ---

// Función para enviar una respuesta JSON y terminar el script
function send_json($data) {
    echo json_encode($data);
    exit;
}

// Función para obtener el ID del usuario de la sesión de forma segura
function get_session_user_id() {
    if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
        http_response_code(401); // No autorizado
        send_json(['success' => false, 'message' => 'No autorizado. Por favor, inicia sesión.']);
    }
    return $_SESSION['user']['id'];
}

// Función para obtener el ROL del usuario de la sesión de forma segura
function get_session_user_role() {
    if (!isset($_SESSION['user']) || !isset($_SESSION['user']['role'])) {
        http_response_code(401);
        send_json(['success' => false, 'message' => 'No autorizado. Rol desconocido.']);
    }
    return $_SESSION['user']['role'];
}

// Función para verificar si el usuario es Admin
function check_admin() {
    if (get_session_user_role() !== 'admin') {
        http_response_code(403); // Prohibido
        send_json(['success' => false, 'message' => 'Acción no autorizada. Se requiere ser administrador.']);
    }
}

// Función interna para crear notificaciones (llamada por otras funciones)
function create_notification_internal($pdo, $user_id, $message, $type) {
    try {
        $stmt = $pdo->prepare("INSERT INTO notificaciones (id_usuario, mensaje, tipo) VALUES (?, ?, ?)");
        $stmt->execute([$user_id, $message, $type]);
        return true;
    } catch (PDOException $e) {
        // No enviar error JSON aquí, solo registrar en el log del servidor
        error_log("Error al crear notificación: " . $e->getMessage());
        return false;
    }
}

// Nueva función auxiliar para enviar correos de solicitudes (reutiliza lógica de mail existente)
function send_request_notification_email($user_email, $user_name, $subject, $message_body) {
    $full_message = "Hola $user_name,<br><br>" . nl2br($message_body) . "<br><br>Saludos,<br>ReservaNoble<br><br>---<br>Este es un mensaje automático. No responder.";
    
    if (!send_email($user_email, $subject, $full_message)) {
        error_log("Error al enviar correo a $user_email: send_email() falló");
        // No bloquear la operación; solo loguear el error
    }
}


// --- Manejador de Acciones ---

// Obtener la acción solicitada (ej: api/api.php?action=login)
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// Obtener datos enviados por POST (usado por fetch)
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    $data = $_POST;
}

try {
    switch ($action) {

        // --- AUTENTICACIÓN ---

        case 'login':
            $email = $data['email'] ?? '';
            $password = $data['password'] ?? '';
            
            $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            // Verificar contraseña: si la password en BD parece hasheada (empieza con $), usar password_verify, sino comparación directa
            $is_hashed = strpos($user['password'], '$') === 0;
            $password_valid = $is_hashed ? password_verify($password, $user['password']) : ($password === $user['password']);
            
            if ($user && $password_valid) {
                // Verificar si el usuario está suspendido
                if (isset($user['estado']) && $user['estado'] === 'suspendido') {
                    send_json([
                        'success' => false, 
                        'is_suspended' => true,
                        'message' => 'Tu cuenta ha sido suspendida. Contacta al administrador.'
                    ]);
                }

                // Iniciar sesión directamente (2FA eliminado)
                $_SESSION['user'] = [
                    'id'    => $user['id'],
                    'name'  => $user['nombre'],
                    'email' => $user['email'],
                    'phone' => $user['telefono'],
                    'role'  => $user['rol']
                ];
                
                send_json([
                    'success' => true,
                    'redirect' => $user['rol'] === 'admin' ? 'administrador.html' : 'formulario.html',
                    'message' => 'Inicio de sesión exitoso.'
                ]);
            } else {
                send_json(['success' => false, 'message' => 'Correo o contraseña incorrectos.']);
            }
            break;

        case 'send_2fa_code':
            // Verificar que hay usuario pendiente de 2FA
            if (!isset($_SESSION['pending_2fa_user'])) {
                send_json(['success' => false, 'message' => 'No hay sesión pendiente de verificación.']);
            }

            // Generar código aleatorio de 6 dígitos
            $code = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
            
            // Guardar código y timestamp en sesión (válido por 5 minutos)
            $_SESSION['2fa_code'] = $code;
            $_SESSION['2fa_timestamp'] = time();
            
            // Obtener email del usuario pendiente
            $email = $_SESSION['pending_2fa_user']['email'];
            $name = $_SESSION['pending_2fa_user']['name'];
            
            // Enviar correo usando mail() de PHP
            $subject = 'Código de verificación - ReservaNoble';
            $message = "Hola $name,<br><br>";
            $message .= "Tu código de verificación es: <b>$code</b><br><br>";
            $message .= "Este código es válido por 5 minutos.<br><br>";
            $message .= "Si no solicitaste este código, ignora este mensaje.<br><br>";
            $message .= "Saludos,<br>ReservaNoble";
            
            if (send_email($email, $subject, $message)) {
                send_json(['success' => true, 'message' => 'Código enviado a tu correo.']);
            } else {
                error_log("Error al enviar correo 2FA a $email: send_email() falló");
                send_json(['success' => false, 'message' => 'Error al enviar el código. Verifica tu configuración de email.']);
            }
            break;

        case 'verify_2fa_code':
            // Verificar que hay usuario pendiente y código guardado
            if (!isset($_SESSION['pending_2fa_user']) || !isset($_SESSION['2fa_code'])) {
                send_json(['success' => false, 'message' => 'Sesión expirada. Inicia sesión nuevamente.']);
            }

            $entered_code = $data['code'] ?? '';
            $stored_code = $_SESSION['2fa_code'];
            $timestamp = $_SESSION['2fa_timestamp'];
            
            // Verificar timeout (5 minutos = 300 segundos)
            if (time() - $timestamp > 300) {
                unset($_SESSION['2fa_code'], $_SESSION['2fa_timestamp']);
                send_json(['success' => false, 'message' => 'Código expirado. Solicita uno nuevo.']);
            }
            
            // Verificar código
            if ($entered_code === $stored_code) {
                // Código correcto: completar login
                $_SESSION['user'] = $_SESSION['pending_2fa_user'];
                
                // Limpiar datos temporales
                unset($_SESSION['pending_2fa_user'], $_SESSION['2fa_code'], $_SESSION['2fa_timestamp']);
                
                // Enviar respuesta de éxito
                send_json([
                    'success' => true,
                    'redirect' => $_SESSION['user']['role'] === 'admin' ? 'administrador.html' : 'formulario.html',
                    'message' => 'Verificación exitosa. Bienvenido.'
                ]);
            } else {
                send_json(['success' => false, 'message' => 'Código incorrecto. Intenta de nuevo.']);
            }
            break;

        case 'send_verification_code':
            $name = $data['name'] ?? '';
            $email = $data['email'] ?? '';
            $password = $data['password'] ?? '';
            $phone = $data['phone'] ?? '';

            // Validar formato de email
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                send_json(['success' => false, 'message' => 'El correo electrónico no es válido.']);
            }

            // Verificar si el email ya existe
            $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                send_json(['success' => false, 'message' => 'Ya existe una cuenta con ese correo.']);
            }

            // Generar código de verificación
            $code = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);

            // Guardar datos temporalmente en sesión
            $_SESSION['registration_data'] = [
                'name' => $name,
                'email' => $email,
                'password' => $password, // Se hasheará al verificar
                'phone' => $phone,
                'code' => $code,
                'timestamp' => time()
            ];

            // Enviar correo
            $subject = 'Código de Verificación - ReservaNoble';
            $message = "Hola $name,<br><br>";
            $message .= "Para completar tu registro, usa el siguiente código de verificación:<br><br>";
            $message .= "<h2 style='color: #2563eb; letter-spacing: 5px;'>$code</h2><br>";
            $message .= "Este código es válido por 10 minutos.<br><br>";
            $message .= "Si no solicitaste este registro, ignora este mensaje.<br><br>";
            $message .= "Saludos,<br>ReservaNoble";

            if (send_email($email, $subject, $message)) {
                send_json(['success' => true, 'message' => 'Código enviado a tu correo.']);
            } else {
                error_log("Error al enviar correo de registro a $email");
                send_json(['success' => false, 'message' => 'Error al enviar el código. Verifica tu correo.']);
            }
            break;

        case 'verify_registration_code':
            $code = $data['code'] ?? '';

            if (!isset($_SESSION['registration_data'])) {
                send_json(['success' => false, 'message' => 'Sesión expirada. Regístrate nuevamente.']);
            }

            $regData = $_SESSION['registration_data'];

            // Verificar tiempo (10 minutos)
            if (time() - $regData['timestamp'] > 600) {
                unset($_SESSION['registration_data']);
                send_json(['success' => false, 'message' => 'El código ha expirado.']);
            }

            if ($code !== $regData['code']) {
                send_json(['success' => false, 'message' => 'Código incorrecto.']);
            }

            // Código correcto: Crear usuario
            $hashed_password = password_hash($regData['password'], PASSWORD_DEFAULT);

            try {
                $stmt = $pdo->prepare("INSERT INTO usuarios (nombre, email, password, telefono, rol) VALUES (?, ?, ?, ?, 'user')");
                $stmt->execute([$regData['name'], $regData['email'], $hashed_password, $regData['phone']]);
                
                // Limpiar sesión
                unset($_SESSION['registration_data']);
                
                send_json(['success' => true, 'message' => 'Cuenta creada exitosamente.']);
            } catch (PDOException $e) {
                error_log("Error DB registro: " . $e->getMessage());
                send_json(['success' => false, 'message' => 'Error al crear la cuenta en base de datos.']);
            }
            break;

        case 'google_login':
            $credential = $data['credential'] ?? '';
            
            if (!$credential) {
                send_json(['success' => false, 'message' => 'Token de Google faltante.']);
            }
            
            // Verificar el ID token con Google
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            $response = curl_exec($ch);
            curl_close($ch);
            
            $tokenInfo = json_decode($response, true);
            
            if (!$tokenInfo || isset($tokenInfo['error'])) {
                send_json(['success' => false, 'message' => 'Token de Google inválido.']);
            }
            
            $email = $tokenInfo['email'];
            $name = $tokenInfo['name'];
            
            // Buscar usuario por email
            $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            
            if ($user) {
                // Verificar si el usuario está suspendido
                if (isset($user['estado']) && $user['estado'] === 'suspendido') {
                    send_json([
                        'success' => false, 
                        'is_suspended' => true,
                        'message' => 'Tu cuenta ha sido suspendida. Contacta al administrador.'
                    ]);
                }
            } else {
                // Crear nuevo usuario con Google
                $stmt = $pdo->prepare("INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, '', 'user')");
                $stmt->execute([$name, $email]);
                $user_id = $pdo->lastInsertId();
                $user = [
                    'id' => $user_id,
                    'nombre' => $name,
                    'email' => $email,
                    'telefono' => '',
                    'rol' => 'user'
                ];
            }
            
            // Iniciar sesión
            $_SESSION['user'] = [
                'id'    => $user['id'],
                'name'  => $user['nombre'],
                'email' => $user['email'],
                'phone' => $user['telefono'],
                'role'  => $user['rol']
            ];
            
            send_json([
                'success' => true,
                'redirect' => $user['rol'] === 'admin' ? 'administrador.html' : 'formulario.html'
            ]);
            break;

        case 'logout':
            session_destroy();
            send_json(['success' => true]);
            break;

        case 'forgot_password':
            $email = $data['email'] ?? '';
            
            if (empty($email)) {
                send_json(['success' => false, 'message' => 'Email requerido']);
            }
            
            // Verificar si el email existe
            $stmt = $pdo->prepare("SELECT id, nombre FROM usuarios WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            
            if (!$user) {
                // No revelar si el email existe o no por seguridad
                // Simulamos éxito para evitar enumeración de usuarios
                send_json(['success' => true, 'message' => 'Si el email existe, se ha enviado un código de verificación.']);
            }
            
            // Generar código de 6 dígitos
            $code = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
            
            // Guardar en sesión para verificación posterior
            $_SESSION['reset_email'] = $email;
            $_SESSION['reset_code'] = $code;
            $_SESSION['reset_timestamp'] = time();
            
            // Enviar el código por email
            $subject = 'Código de Recuperación - ReservaNoble';
            $message = "Hola {$user['nombre']},<br><br>Tu código de recuperación es: <b>$code</b><br><br>Este código es válido por 10 minutos.<br><br>Si no solicitaste esto, ignora este mensaje.<br><br>Saludos,<br>ReservaNoble";
            
            if (send_email($email, $subject, $message)) {
                send_json(['success' => true, 'message' => 'Código enviado a tu correo.']);
            } else {
                error_log("Error mail() forgot_password a $email");
                send_json(['success' => false, 'message' => 'Error al enviar el email.']);
            }
            break;

        case 'verify_reset_code':
            $code = $data['code'] ?? '';
            
            if (!isset($_SESSION['reset_code']) || !isset($_SESSION['reset_email'])) {
                send_json(['success' => false, 'message' => 'Sesión expirada. Solicita el código nuevamente.']);
            }
            
            // Verificar tiempo (10 minutos)
            if (time() - $_SESSION['reset_timestamp'] > 600) {
                unset($_SESSION['reset_code'], $_SESSION['reset_email'], $_SESSION['reset_timestamp']);
                send_json(['success' => false, 'message' => 'El código ha expirado.']);
            }
            
            if ($code === $_SESSION['reset_code']) {
                // Código correcto, marcamos como verificado en sesión
                $_SESSION['reset_verified'] = true;
                send_json(['success' => true, 'message' => 'Código verificado.']);
            } else {
                send_json(['success' => false, 'message' => 'Código incorrecto.']);
            }
            break;

        case 'reset_password_final':
            $newPassword = $data['password'] ?? '';
            
            if (!isset($_SESSION['reset_verified']) || !$_SESSION['reset_verified'] || !isset($_SESSION['reset_email'])) {
                send_json(['success' => false, 'message' => 'Acceso no autorizado.']);
            }
            
            if (strlen($newPassword) < 6) {
                send_json(['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres.']);
            }
            
            $email = $_SESSION['reset_email'];
            $hashed_password = password_hash($newPassword, PASSWORD_DEFAULT);
            
            $stmt = $pdo->prepare("UPDATE usuarios SET password = ? WHERE email = ?");
            $stmt->execute([$hashed_password, $email]);
            
            // Limpiar sesión de reset
            unset($_SESSION['reset_code'], $_SESSION['reset_email'], $_SESSION['reset_timestamp'], $_SESSION['reset_verified']);
            
            send_json(['success' => true, 'message' => 'Contraseña actualizada correctamente.']);
            break;

        // --- USUARIO (Formulario) ---

        case 'get_current_user_full':
            $user_id = get_session_user_id();
            $stmt = $pdo->prepare("SELECT id, nombre, email, password, telefono, rol FROM usuarios WHERE id = ?");
            $stmt->execute([$user_id]);
            $user = $stmt->fetch();
            
            if (!$user) {
                send_json(['success' => false, 'message' => 'Usuario no encontrado']);
            }
            
            send_json($user);
            break;

        case 'update_user_account':
            $user_id = get_session_user_id();
            
            // Los datos ya fueron leídos en la línea 66, usar $data directamente
            if (!$data) {
                send_json(['success' => false, 'message' => 'No se recibieron datos para actualizar.']);
            }
            
            // Validaciones básicas
            if (empty($data['name']) || empty($data['email']) || empty($data['password']) || empty($data['phone'])) {
                send_json(['success' => false, 'message' => 'Todos los campos son obligatorios.']);
            }
            
            // Verificar si el nuevo email ya está en uso por OTRO usuario
            $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? AND id != ?");
            $stmt->execute([$data['email'], $user_id]);
            if ($stmt->fetch()) {
                send_json(['success' => false, 'message' => 'Ese correo electrónico ya está en uso por otra cuenta.']);
            }

            $stmt = $pdo->prepare("UPDATE usuarios SET nombre = ?, email = ?, password = ?, telefono = ? WHERE id = ?");
            $hashed_password = password_hash($data['password'], PASSWORD_DEFAULT);
            $stmt->execute([$data['name'], $data['email'], $hashed_password, $data['phone'], $user_id]);
            
            // Actualizar la sesión
            $_SESSION['user']['name'] = $data['name'];
            $_SESSION['user']['email'] = $data['email'];
            $_SESSION['user']['phone'] = $data['phone'];

            send_json(['success' => true, 'user' => $_SESSION['user']]);
            break;

        // --- LUGARES (Venues) ---

        case 'get_venues':
            // Esta acción es pública
            $stmt = $pdo->query("SELECT * FROM lugares WHERE status != 'deleted'");
            $lugares = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $isAdmin = (isset($_SESSION['user']) && isset($_SESSION['user']['role']) && $_SESSION['user']['role'] === 'admin');

            // Obtener galería para cada lugar
            foreach ($lugares as &$lugar) {
                if (!$isAdmin) {
                    unset($lugar['owner_nombre']);
                    unset($lugar['owner_telefono']);
                    unset($lugar['owner_email']);
                }
                // Intentar obtener galería si la tabla existe (manejo de error silencioso si no existe aún)
                try {
                    $stmtImg = $pdo->prepare("SELECT id, imagen_url FROM galeria_lugares WHERE id_lugar = ?");
                    $stmtImg->execute([$lugar['id']]);
                    $lugar['galeria'] = $stmtImg->fetchAll(PDO::FETCH_ASSOC);
                    
                    // Si no tiene imagen principal pero tiene galería, usar la primera de la galería
                    if (empty($lugar['imagen_url']) && !empty($lugar['galeria'])) {
                        $lugar['imagen_url'] = $lugar['galeria'][0]['imagen_url'];
                    }
                } catch (Exception $e) {
                    $lugar['galeria'] = [];
                }
            }
            send_json($lugares);
            break;

        case 'save_venue': // (Admin)
            check_admin();
            
            // Normalizar datos
            $venue_id = $_POST['id'] ?? null;
            $name = $_POST['name'] ?? '';
            $address = $_POST['address'] ?? '';
            $lat = $_POST['lat'] ?? 0;
            $lng = $_POST['lng'] ?? 0;
            $capacity = $_POST['capacity'] ?? 0;
            $basePrice = $_POST['basePrice'] ?? 0;
            $pricePerGuest = $_POST['pricePerGuest'] ?? 0;
            $description = $_POST['description'] ?? '';
            $services = $_POST['services'] ?? '';
            $image_url = $_POST['image_url'] ?? '';

            // Campos de dueño
            $owner_name = $_POST['owner_name'] ?? '';
            $owner_phone = $_POST['owner_phone'] ?? '';
            $owner_email = $_POST['owner_email'] ?? '';

            // 1. Guardar/Actualizar Lugar
            if ($venue_id) {
                $stmt = $pdo->prepare("UPDATE lugares SET nombre = ?, direccion = ?, lat = ?, lng = ?, capacidad = ?, precio_base = ?, precio_por_persona = ?, descripcion = ?, servicios = ?, owner_nombre = ?, owner_telefono = ?, owner_email = ?, imagen_url = ? WHERE id = ?");
                $stmt->execute([$name, $address, $lat, $lng, $capacity, $basePrice, $pricePerGuest, $description, $services, $owner_name, $owner_phone, $owner_email, $image_url, $venue_id]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO lugares (nombre, direccion, lat, lng, capacidad, precio_base, precio_por_persona, descripcion, servicios, owner_nombre, owner_telefono, owner_email, imagen_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$name, $address, $lat, $lng, $capacity, $basePrice, $pricePerGuest, $description, $services, $owner_name, $owner_phone, $owner_email, $image_url]);
                $venue_id = $pdo->lastInsertId();
            }

            // 2. Manejo de Galería (Múltiples imágenes) - DESACTIVADO EN FAVOR DE URL EXTERNA
            /*
            if (isset($_FILES['images'])) {
                // ... (código anterior de subida de archivos) ...
            }
            */
            
            send_json(['success' => true]);
            break;

        case 'delete_venue_image': // (Admin)
            check_admin();
            $imgId = $data['id'] ?? 0;
            
            // Obtener ruta para borrar archivo
            $stmt = $pdo->prepare("SELECT imagen_url FROM galeria_lugares WHERE id = ?");
            $stmt->execute([$imgId]);
            $img = $stmt->fetch();
            
            if ($img) {
                // Borrar de BD
                $stmt = $pdo->prepare("DELETE FROM galeria_lugares WHERE id = ?");
                $stmt->execute([$imgId]);
                
                // Borrar archivo físico
                $filePath = '../' . $img['imagen_url'];
                if (file_exists($filePath)) {
                    unlink($filePath);
                }
            }
            send_json(['success' => true]);
            break;

        case 'delete_venue': // (Admin)
            check_admin();
            $id = $data['id'] ?? 0;
            // Soft delete para mantener historial de solicitudes
            $stmt = $pdo->prepare("UPDATE lugares SET status = 'deleted' WHERE id = ?");
            $stmt->execute([$id]);
            send_json(['success' => true]);
            break;

        case 'toggle_venue_status': // (Admin)
            check_admin();
            $id = $data['id'] ?? 0;
            $status = $data['status'] ?? 'available';
            
            // Actualizar estado del lugar
            $stmt = $pdo->prepare("UPDATE lugares SET status = ? WHERE id = ?");
            $stmt->execute([$status, $id]);

            // Se ha eliminado la cancelación automática de reservas al liberar el lugar
            // para evitar notificaciones confusas de "cancelación" cuando el evento simplemente ha terminado.
            // La consistencia se maneja ahora en create_request (limpieza de inconsistencias).

            send_json(['success' => true]);
            break;

        // --- USUARIOS (Admin) ---
        
        case 'get_users': // (Admin)
            check_admin();
            $stmt = $pdo->query("SELECT id, nombre, email, telefono, rol, estado, created_at FROM usuarios");
            send_json($stmt->fetchAll());
            break;

        case 'update_user_admin': // (Admin)
            check_admin();
            $user = $data['user'];
            $user_id = $data['id'];

            // Verificar si el usuario objetivo es otro administrador
            $stmt = $pdo->prepare("SELECT rol FROM usuarios WHERE id = ?");
            $stmt->execute([$user_id]);
            $target_user = $stmt->fetch();

            if ($target_user && $target_user['rol'] === 'admin' && $user_id != get_session_user_id()) {
                send_json(['success' => false, 'message' => 'No tienes permiso para editar a otros administradores.']);
            }

            // Verificar email duplicado
            $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? AND id != ?");
            $stmt->execute([$user['email'], $user_id]);
            if ($stmt->fetch()) {
                send_json(['success' => false, 'message' => 'Ese correo electrónico ya está en uso por otra cuenta.']);
            }
            
            // Actualizar datos básicos
            $stmt = $pdo->prepare("UPDATE usuarios SET nombre = ?, email = ?, telefono = ?, rol = ? WHERE id = ?");
            $stmt->execute([
                $user['name'], $user['email'], $user['phone'], $user['role'], $user_id
            ]);

            // Actualizar contraseña si se proporciona (solo para uno mismo)
            if (!empty($user['password'])) {
                // RESTRICCIÓN: Solo el propio usuario puede cambiar su contraseña
                if ($user_id != get_session_user_id()) {
                    // Si se intenta cambiar la contraseña de otro, se ignora o se envía error.
                    // En este caso, simplemente no hacemos nada con la contraseña.
                } else {
                    if (strlen($user['password']) < 6) {
                        send_json(['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres.']);
                    }
                    $hashed_password = password_hash($user['password'], PASSWORD_DEFAULT);
                    $stmt = $pdo->prepare("UPDATE usuarios SET password = ? WHERE id = ?");
                    $stmt->execute([$hashed_password, $user_id]);
                }
            }

            // Si el admin se edita a sí mismo, actualizar la sesión
            if ($user_id == get_session_user_id()) {
                 $_SESSION['user']['name'] = $user['name'];
                 $_SESSION['user']['email'] = $user['email'];
                 $_SESSION['user']['phone'] = $user['phone'];
                 $_SESSION['user']['role'] = $user['role'];
            }
            
            send_json(['success' => true]);
            break;

        case 'delete_user': // (Admin)
            check_admin();
            $id = $data['id'] ?? 0;
            
            // Verificar si el usuario objetivo es administrador
            $stmt = $pdo->prepare("SELECT rol FROM usuarios WHERE id = ?");
            $stmt->execute([$id]);
            $target_user = $stmt->fetch();

            if ($target_user && $target_user['rol'] === 'admin') {
                send_json(['success' => false, 'message' => 'No se puede eliminar una cuenta de administrador.']);
            }

            // Evitar que el admin se elimine a sí mismo (redundante con lo de arriba pero seguro)
            if ($id == get_session_user_id()) {
                send_json(['success' => false, 'message' => 'No puedes eliminar tu propia cuenta mientras estás en sesión.']);
            }
            // Eliminar registros relacionados primero para evitar violación de clave foránea
            $pdo->prepare("DELETE FROM notificaciones WHERE id_usuario = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM solicitudes WHERE id_usuario = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM reportes WHERE id_usuario = ?")->execute([$id]);
            // Ahora eliminar el usuario
            $stmt = $pdo->prepare("DELETE FROM usuarios WHERE id = ?");
            $stmt->execute([$id]);
            send_json(['success' => true]);
            break;

        case 'toggle_user_status': // (Admin)
            check_admin();
            $id = $data['id'] ?? 0;
            $status = $data['status'] ?? 'activo'; // 'activo' or 'suspendido'
            
            if ($id == get_session_user_id()) {
                send_json(['success' => false, 'message' => 'No puedes suspender tu propia cuenta.']);
            }

            $stmt = $pdo->prepare("UPDATE usuarios SET estado = ? WHERE id = ?");
            $stmt->execute([$status, $id]);
            send_json(['success' => true]);
            break;

        case 'send_direct_email': // (Admin)
            check_admin();
            $email = $data['email'] ?? '';
            $subject = $data['subject'] ?? '';
            $message = $data['message'] ?? '';

            if (empty($email) || empty($subject) || empty($message)) {
                send_json(['success' => false, 'message' => 'Todos los campos son obligatorios.']);
            }

            // Intentar obtener nombre del usuario por email
            $recipient_name = "Usuario";
            $stmt = $pdo->prepare("SELECT nombre FROM usuarios WHERE email = ?");
            $stmt->execute([$email]);
            $res = $stmt->fetch();
            if ($res && !empty($res['nombre'])) {
                $recipient_name = $res['nombre'];
            }

            $full_message = "Hola $recipient_name,<br><br>" . nl2br($message) . "<br><br>Saludos,<br>ReservaNoble";

            if (send_email($email, $subject, $full_message)) {
                send_json(['success' => true, 'message' => 'Correo enviado correctamente.']);
            } else {
                send_json(['success' => false, 'message' => 'Error al enviar el correo.']);
            }
            break;

        // --- SOLICITUDES (Requests) ---

        case 'get_requests': // (Admin)
            check_admin();
            // Unir con usuarios y lugares para obtener los nombres
            $sql = "SELECT r.*, u.nombre as \"userName\", u.email as \"userEmail\", u.telefono as \"userPhone\", l.nombre as \"venueName\" 
                    FROM solicitudes r
                    JOIN usuarios u ON r.id_usuario = u.id
                    JOIN lugares l ON r.id_lugar = l.id
                    ORDER BY r.created_at DESC";
            $stmt = $pdo->query($sql);
            send_json($stmt->fetchAll());
            break;

        case 'get_my_requests': // (User)
            $user_id = get_session_user_id();
            $sql = "SELECT r.*, l.nombre as \"venueName\" 
                    FROM solicitudes r
                    JOIN lugares l ON r.id_lugar = l.id
                    WHERE r.id_usuario = ?
                    ORDER BY r.created_at DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$user_id]);
            send_json($stmt->fetchAll());
            break;

        case 'create_request': // (User)
            $user_id = get_session_user_id();
            $req = $data;

            // --- 1. VALIDACIÓN DE SEGURIDAD (RATE LIMIT) ---

            // A. Límite de Tiempo: Verificar cuándo fue la última solicitud de este usuario
            $stmt = $pdo->prepare("SELECT created_at FROM solicitudes WHERE id_usuario = ? ORDER BY created_at DESC LIMIT 1");
            $stmt->execute([$user_id]);
            $last_request = $stmt->fetchColumn();

            if ($last_request) {
                $last_time = strtotime($last_request);
                $current_time = time();
                $minutes_diff = ($current_time - $last_time) / 60;

                if ($minutes_diff < 10) { // 10 minutos de espera
                    $wait_time = ceil(10 - $minutes_diff);
                    send_json(['success' => false, 'message' => "Por favor espera $wait_time minutos antes de enviar otra solicitud."]);
                }
            }

            // B. Límite de Cantidad: Verificar cuántas solicitudes pendientes tiene
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM solicitudes WHERE id_usuario = ? AND status = 'pending'");
            $stmt->execute([$user_id]);
            $pending_count = $stmt->fetchColumn();

            if ($pending_count >= 3) { // Máximo 3 solicitudes pendientes
                send_json(['success' => false, 'message' => 'Tienes demasiadas solicitudes pendientes (3). Espera a que el administrador las revise o cancela alguna antes de crear una nueva.']);
            }

            // C. Validación de Conflicto de Agenda: Verificar si ya tiene una reserva APROBADA para esa misma fecha y hora
            // --- VALIDACIÓN DE RANGOS ---
            $duration = intval($req['duration'] ?? 1);
            $startDate = $req['eventDate'];
            $endDate = date('Y-m-d', strtotime($startDate . " + " . ($duration - 1) . " days"));

            // PRIMERO: Limpieza de inconsistencias
            // Buscar reservas aprobadas del usuario en el rango, donde el lugar esté 'available'
            // Postgres syntax for date addition
            $sqlCleanup = "SELECT r.id FROM solicitudes r 
                           JOIN lugares l ON r.id_lugar = l.id 
                           WHERE r.id_usuario = ? 
                           AND r.status = 'approved' 
                           AND l.status = 'available'
                           AND (r.fecha_evento <= ? AND (r.fecha_evento + (r.duracion_dias - 1) * INTERVAL '1 day') >= ?)";
            
            $stmtCleanup = $pdo->prepare($sqlCleanup);
            $stmtCleanup->execute([$user_id, $endDate, $startDate]);
            $inconsistent_requests = $stmtCleanup->fetchAll(PDO::FETCH_COLUMN);
            
            if ($inconsistent_requests) {
                // Corregir inconsistencias: pasar a rejected
                $ids_str = implode(',', array_map('intval', $inconsistent_requests));
                $pdo->exec("UPDATE solicitudes SET status = 'rejected' WHERE id IN ($ids_str)");
            }

            // Verificar si el usuario ya tiene una reserva APROBADA que se solape con este rango
            // Lógica de solapamiento: (StartA <= EndB) and (EndA >= StartB)
            // Aquí StartA/EndA es el nuevo evento, StartB/EndB son los eventos existentes
            // Evento existente: fecha_evento (inicio), fecha_evento + duracion - 1 (fin)
            
            $sqlUserConflict = "SELECT COUNT(*) FROM solicitudes 
                                WHERE id_usuario = ? 
                                AND status = 'approved'
                                AND (fecha_evento <= ? AND (fecha_evento + (duracion_dias - 1) * INTERVAL '1 day') >= ?)";
            
            $stmt = $pdo->prepare($sqlUserConflict);
            $stmt->execute([$user_id, $endDate, $startDate]);
            
            if ($stmt->fetchColumn() > 0) {
                send_json(['success' => false, 'message' => 'Ya tienes un evento aprobado que coincide con las fechas seleccionadas.']);
            }

            // --- FIN VALIDACIÓN DE SEGURIDAD ---

            // Validaciones básicas
            if (empty($req['venue']) || empty($req['eventType']) || empty($req['eventDate']) || empty($req['eventTime'])) {
                send_json(['success' => false, 'message' => 'Todos los campos obligatorios deben completarse']);
            }

            // Validar fecha (no puede ser en el pasado)
            $eventDateObj = new DateTime($req['eventDate']);
            $today = new DateTime();
            $today->setTime(0, 0, 0); // Resetear hora para comparar solo fecha
            if ($eventDateObj < $today) {
                send_json(['success' => false, 'message' => 'La fecha del evento no puede ser en el pasado']);
            }

            // Encontrar el lugar por su nombre y obtener su capacidad
            $stmt = $pdo->prepare("SELECT id, capacidad FROM lugares WHERE nombre = ?");
            $stmt->execute([$req['venue']]);
            $lugar = $stmt->fetch();
            if (!$lugar) {
                // Intentar buscar por ID si se envió
                if (!empty($req['venue_id'])) {
                    $stmt = $pdo->prepare("SELECT id, capacidad FROM lugares WHERE id = ?");
                    $stmt->execute([$req['venue_id']]);
                    $lugar = $stmt->fetch();
                }
                if (!$lugar) {
                    send_json(['success' => false, 'message' => 'Lugar no encontrado']);
                }
            }
            $id_lugar = $lugar['id'];
            $capacidad_lugar = $lugar['capacidad'];

            // Validar capacidad de invitados
            $invitados = intval($req['guests']);
            if ($capacidad_lugar && $capacidad_lugar > 0 && $invitados > $capacidad_lugar) {
                send_json(['success' => false, 'message' => "El lugar tiene una capacidad máxima de {$capacidad_lugar} personas. Has solicitado {$invitados} personas."]);
            }

            // --- VALIDACIÓN DE DISPONIBILIDAD DEL LUGAR (RANGO) ---
            $sqlVenueConflict = "SELECT COUNT(*) FROM solicitudes 
                                 WHERE id_lugar = ? 
                                 AND status = 'approved'
                                 AND (fecha_evento <= ? AND (fecha_evento + (duracion_dias - 1) * INTERVAL '1 day') >= ?)";
            
            $stmt = $pdo->prepare($sqlVenueConflict);
            $stmt->execute([$id_lugar, $endDate, $startDate]);
            
            if ($stmt->fetchColumn() > 0) {
                send_json(['success' => false, 'message' => 'El lugar no está disponible para todo el rango de fechas seleccionado.']);
            }
            // --- FIN VALIDACIÓN ---

            // Limpiar el precio (quitar '$' y comas)
            $total_price_cleaned = preg_replace('/[$,]/', '', $req['totalPrice']);
            
            $sql = "INSERT INTO solicitudes (id_usuario, id_lugar, tipo_evento, fecha_evento, duracion_dias, hora_evento, invitados, precio_total_estimado, solicitudes_especiales) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $user_id, $id_lugar, $req['eventType'], $req['eventDate'], $duration, $req['eventTime'], 
                $req['guests'], $total_price_cleaned, $req['specialRequests']
            ]);
            
            // Obtener datos del usuario y lugar para el correo
            $stmt = $pdo->prepare("SELECT u.nombre, u.email, l.nombre as \"venueName\" FROM usuarios u, lugares l WHERE u.id = ? AND l.id = ?");
            $stmt->execute([$user_id, $id_lugar]);
            $user_data = $stmt->fetch();
            
            // Enviar correo de confirmación de solicitud pendiente
            $subject = "Solicitud de Reserva Recibida - ReservaNoble";
            $message_body = "Tu solicitud para \"{$req['eventType']}\" en \"{$user_data['venueName']}\" el {$req['eventDate']} a las {$req['eventTime']} ha sido recibida.\n\n" .
                            "Detalles:\n" .
                            "- Tipo de evento: {$req['eventType']}\n" .
                            "- Fecha: {$req['eventDate']}\n" .
                            "- Hora: {$req['eventTime']}\n" .
                            "- Lugar: {$user_data['venueName']}\n" .
                            "- Invitados: {$req['guests']}\n" .
                            "- Precio estimado: $" . number_format($total_price_cleaned, 0, ',', '.') . "\n\n" .
                            "El administrador revisará tu solicitud pronto. Recibirás una notificación cuando se apruebe o rechace.";
            send_request_notification_email($user_data['email'], $user_data['nombre'], $subject, $message_body);
            
            send_json(['success' => true, 'message' => 'Solicitud creada correctamente']);
            break;

        case 'update_request_status': // (Admin)
            check_admin();
            $id = $data['id'] ?? 0;
            $status = $data['status'] ?? 'pending';
            
            // 1. Obtener datos de la solicitud para la notificación
            $stmt = $pdo->prepare("SELECT r.*, u.id as user_id, u.nombre as \"userName\", u.email as \"userEmail\", l.nombre as \"venueName\" 
                                  FROM solicitudes r 
                                  JOIN usuarios u ON r.id_usuario = u.id
                                  JOIN lugares l ON r.id_lugar = l.id
                                  WHERE r.id = ?");
            $stmt->execute([$id]);
            $req = $stmt->fetch();
            
            if (!$req) {
                 send_json(['success' => false, 'message' => 'Solicitud no encontrada']);
            }

            // 2. Actualizar la solicitud
            $stmt = $pdo->prepare("UPDATE solicitudes SET status = ? WHERE id = ?");
            $stmt->execute([$status, $id]);

            // 3. Crear notificación
            if ($status === 'approved') {
                $msg = "Tu solicitud para \"{$req['tipo_evento']}\" en \"{$req['venueName']}\" ha sido APROBADA.";
                create_notification_internal($pdo, $req['user_id'], $msg, 'request_approved');
                
                // Enviar correo de aprobación
                $subject = "Solicitud de Reserva Aprobada - ReservaNoble";
                $message_body = "¡Buenas noticias! Tu solicitud ha sido APROBADA.\n\n" .
                                "Detalles de tu reserva:\n" .
                                "- Tipo de evento: {$req['tipo_evento']}\n" .
                                "- Fecha: {$req['fecha_evento']}\n" .
                                "- Hora: {$req['hora_evento']}\n" .
                                "- Lugar: {$req['venueName']}\n" .
                                "- Invitados: {$req['invitados']}\n" .
                                "- Precio estimado: $" . number_format($req['precio_total_estimado'], 0, ',', '.') . "\n\n" .
                                "El lugar ha sido reservado para ti. Contacta al administrador si necesitas más detalles.";
                
                // 4. (Opcional) Marcar lugar como reservado
                $stmt = $pdo->prepare("UPDATE lugares SET status = 'reserved' WHERE id = ?");
                $stmt->execute([$req['id_lugar']]);

                // --- CANCELACIÓN AUTOMÁTICA DE CONFLICTOS (PREPARACIÓN + EVENTO + LIMPIEZA) ---
                $fecha_inicio = $req['fecha_evento'];
                $duracion = intval($req['duracion_dias'] ?? 1);
                
                // 1. Definir rangos de bloqueo
                // Rango Preparación: 3 días antes
                $fecha_prep_inicio = date('Y-m-d', strtotime($fecha_inicio . ' -3 days'));
                $fecha_prep_fin = date('Y-m-d', strtotime($fecha_inicio . ' -1 day'));
                
                // Rango Evento: Fecha inicio a Fecha fin
                $fecha_evento_fin = date('Y-m-d', strtotime($fecha_inicio . " + " . ($duracion - 1) . " days"));
                
                // Rango Limpieza: 1 día después del evento
                $fecha_limpieza = date('Y-m-d', strtotime($fecha_inicio . " + $duracion days"));

                // Rango Total de Bloqueo para la Query
                $bloqueo_inicio = $fecha_prep_inicio;
                $bloqueo_fin = $fecha_limpieza;

                // Buscar solicitudes PENDIENTES que se solapen con el rango total de bloqueo
                // Condición de solape: (StartA <= EndB) and (EndA >= StartB)
                // A = Rango Bloqueado, B = Solicitud Pendiente
                
                $sqlConflict = "SELECT id, id_usuario, fecha_evento, duracion_dias FROM solicitudes 
                                WHERE id_lugar = ? 
                                AND status = 'pending' 
                                AND id != ?
                                AND (fecha_evento <= ? AND (fecha_evento + (duracion_dias - 1) * INTERVAL '1 day') >= ?)";

                $stmtConflict = $pdo->prepare($sqlConflict);
                $stmtConflict->execute([$req['id_lugar'], $id, $bloqueo_fin, $bloqueo_inicio]);
                $conflictos = $stmtConflict->fetchAll();

                foreach ($conflictos as $conflicto) {
                    // Calcular rango del conflicto
                    $conf_inicio = $conflicto['fecha_evento'];
                    $conf_duracion = intval($conflicto['duracion_dias'] ?? 1);
                    $conf_fin = date('Y-m-d', strtotime($conf_inicio . " + " . ($conf_duracion - 1) . " days"));

                    // Determinar razón específica
                    $razon = "";
                    
                    // Chequear solapamiento con Evento (Prioridad 1)
                    if ($conf_inicio <= $fecha_evento_fin && $conf_fin >= $fecha_inicio) {
                        $razon = "las fechas coinciden con otra reserva aprobada.";
                    }
                    // Chequear solapamiento con Limpieza (Prioridad 2)
                    else if ($conf_inicio <= $fecha_limpieza && $conf_fin >= $fecha_limpieza) {
                        $razon = "el lugar estará en mantenimiento/limpieza post-evento.";
                    }
                    // Chequear solapamiento con Preparación (Prioridad 3)
                    else if ($conf_inicio <= $fecha_prep_fin && $conf_fin >= $fecha_prep_inicio) {
                        $razon = "el lugar estará en preparación (3 días previos) para un evento aprobado.";
                    } else {
                        // Fallback por si acaso
                        $razon = "las fechas no están disponibles por bloqueo administrativo.";
                    }

                    // 1. Rechazar automáticamente
                    $stmtReject = $pdo->prepare("UPDATE solicitudes SET status = 'rejected' WHERE id = ?");
                    $stmtReject->execute([$conflicto['id']]);

                    // 2. Mensaje personalizado
                    $msgConflict = "Tu solicitud para \"{$req['venueName']}\" (del {$conflicto['fecha_evento']}) ha sido RECHAZADA automáticamente porque $razon";
                    
                    // 3. Notificar
                    create_notification_internal($pdo, $conflicto['id_usuario'], $msgConflict, 'request_rejected');
                    
                    // 4. Enviar correo
                    $stmtUser = $pdo->prepare("SELECT email, nombre FROM usuarios WHERE id = ?");
                    $stmtUser->execute([$conflicto['id_usuario']]);
                    $userConflict = $stmtUser->fetch();
                    
                    if ($userConflict) {
                        $subjectConflict = "Solicitud de Reserva Rechazada - ReservaNoble";
                        $bodyConflict = "Lamentablemente, tu solicitud para \"{$req['venueName']}\" ha sido RECHAZADA automáticamente.\n\n" .
                                        "Motivo: $razon\n\n" .
                                        "Te invitamos a buscar otras fechas disponibles.";
                        send_request_notification_email($userConflict['email'], $userConflict['nombre'], $subjectConflict, $bodyConflict);
                    }
                }
                // --- FIN CANCELACIÓN AUTOMÁTICA ---
                
            } elseif ($status === 'rejected') {
                $msg = "Tu solicitud para \"{$req['tipo_evento']}\" en \"{$req['venueName']}\" ha sido RECHAZADA.";
                create_notification_internal($pdo, $req['user_id'], $msg, 'request_rejected');
                
                // Enviar correo de rechazo
                $subject = "Solicitud de Reserva Rechazada - ReservaNoble";
                $message_body = "Lamentablemente, tu solicitud ha sido RECHAZADA.\n\n" .
                                "Detalles de la solicitud:\n" .
                                "- Tipo de evento: {$req['tipo_evento']}\n" .
                                "- Fecha: {$req['fecha_evento']}\n" .
                                "- Hora: {$req['hora_evento']}\n" .
                                "- Lugar: {$req['venueName']}\n" .
                                "- Invitados: {$req['invitados']}\n\n" .
                                "Puedes enviar una nueva solicitud o contactar al administrador para más información.";
            }
            
            // Enviar el correo correspondiente (solo si se construyó el asunto/mensaje)
            if (!empty($subject) && !empty($message_body)) {
                send_request_notification_email($req['userEmail'], $req['userName'], $subject, $message_body);
            } else {
                error_log("No se envió correo: asunto o mensaje vacío para solicitud id={$id}, status={$status}");
            }
            
            send_json(['success' => true]);
            break;

        case 'mark_request_read': // (User)
            $user_id = get_session_user_id();
            $id = $data['id'] ?? 0;
            $stmt = $pdo->prepare("UPDATE solicitudes SET leido_por_usuario = TRUE WHERE id = ? AND id_usuario = ?");
            $stmt->execute([$id, $user_id]);
            send_json(['success' => true]);
            break;

        // --- REPORTES ---

        case 'get_reports': // (Admin)
            check_admin();
            $sql = "SELECT r.*, u.nombre as \"userName\", u.email as \"userEmail\" 
                    FROM reportes r
                    JOIN usuarios u ON r.id_usuario = u.id
                    ORDER BY r.status ASC, r.created_at DESC";
            $stmt = $pdo->query($sql);
            send_json($stmt->fetchAll());
            break;

        case 'create_report': // (User)
            $user_id = get_session_user_id();
            $type = $data['type'] ?? 'otro';
            $message = $data['message'] ?? '';

            // --- VALIDACIÓN ANTI-SPAM ---
            
            // 1. Validar contenido mínimo (evitar mensajes vacíos o "hola")
            if (strlen(trim($message)) < 10) {
                send_json(['success' => false, 'message' => 'El mensaje es muy corto. Por favor detalla más el problema (mínimo 10 caracteres).']);
            }

            // 2. Límite de Tiempo (Cooldown): 5 minutos entre reportes
            $stmt = $pdo->prepare("SELECT created_at FROM reportes WHERE id_usuario = ? ORDER BY created_at DESC LIMIT 1");
            $stmt->execute([$user_id]);
            $last_report = $stmt->fetchColumn();

            if ($last_report) {
                $last_time = strtotime($last_report);
                $current_time = time();
                $minutes_diff = ($current_time - $last_time) / 60;

                if ($minutes_diff < 5) { // 5 minutos de espera
                    $wait_time = ceil(5 - $minutes_diff);
                    send_json(['success' => false, 'message' => "Por favor espera $wait_time minutos antes de enviar otro reporte."]);
                }
            }
            // --- FIN VALIDACIÓN ---
            
            $stmt = $pdo->prepare("INSERT INTO reportes (id_usuario, tipo, mensaje) VALUES (?, ?, ?)");
            $stmt->execute([$user_id, $type, $message]);
            send_json(['success' => true]);
            break;
            
        case 'update_report_status': // (Admin)
            check_admin();
            $id = $data['id'] ?? 0;
            $status = $data['status'] ?? 'pending';

            $stmt = $pdo->prepare("UPDATE reportes SET status = ? WHERE id = ?");
            $stmt->execute([$status, $id]);

            // Enviar notificación si se resolvió
            if ($status === 'resolved') {
                 // Obtener datos del reporte
                $stmt = $pdo->prepare("SELECT r.*, u.id as user_id FROM reportes r JOIN usuarios u ON r.id_usuario = u.id WHERE r.id = ?");
                $stmt->execute([$id]);
                $report = $stmt->fetch();
                
                if ($report) {
                    // Usar el 'tipo' de la BD
                    $tipo_label = $report['tipo']; 
                    $msg = "Tu reporte sobre \"$tipo_label\" ha sido RESUELTO.";
                    create_notification_internal($pdo, $report['user_id'], $msg, 'report_resolved');
                }
            }
            send_json(['success' => true]);
            break;

        case 'delete_report': // (Admin)
            check_admin();
            $id = $data['id'] ?? 0;
            $stmt = $pdo->prepare("DELETE FROM reportes WHERE id = ?");
            $stmt->execute([$id]);
            send_json(['success' => true]);
            break;

        // --- NOTIFICACIONES ---

        case 'get_notifications': // (User)
            $user_id = get_session_user_id();
            $stmt = $pdo->prepare("SELECT * FROM notificaciones WHERE id_usuario = ? ORDER BY created_at DESC");
            $stmt->execute([$user_id]);
            send_json($stmt->fetchAll());
            break;

        case 'mark_notification_read': // (User)
            $user_id = get_session_user_id();
            $id = $data['id'] ?? 0;
            $stmt = $pdo->prepare("UPDATE notificaciones SET leido = TRUE WHERE id = ? AND id_usuario = ?");
            $stmt->execute([$id, $user_id]);
            send_json(['success' => true]);
            break;

        case 'mark_all_notifications_read': // (User)
            $user_id = get_session_user_id();
            $stmt = $pdo->prepare("UPDATE notificaciones SET leido = TRUE WHERE id_usuario = ?");
            $stmt->execute([$user_id]);
            send_json(['success' => true]);
            break;

        case 'clear_all_notifications': // (User)
            $user_id = get_session_user_id();
            $stmt = $pdo->prepare("DELETE FROM notificaciones WHERE id_usuario = ?");
            $stmt->execute([$user_id]);
            send_json(['success' => true]);
            break;

        case 'contact':
            // Recibir datos del formulario de contacto
            $nombre = $_POST['nombre'] ?? '';
            $email = $_POST['email'] ?? '';
            $asunto = $_POST['asunto'] ?? '';
            $mensaje = $_POST['mensaje'] ?? '';

            if (empty($nombre) || empty($email) || empty($mensaje)) {
                send_json(['success' => false, 'message' => 'Por favor complete todos los campos obligatorios.']);
                exit;
            }

            // Rate Limit: Verificar sesión (1 minuto)
            if (isset($_SESSION['last_contact_time']) && (time() - $_SESSION['last_contact_time'] < 60)) {
                send_json(['success' => false, 'message' => 'Por favor espere 1 minuto antes de enviar otro mensaje.']);
                exit;
            }

            // Rate Limit: Verificar BD por email (5 minutos)
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM contact_messages WHERE email = ? AND created_at > (NOW() - INTERVAL '5 minutes')");
            $stmt->execute([$email]);
            if ($stmt->fetchColumn() > 0) {
                send_json(['success' => false, 'message' => 'Ya has enviado un mensaje recientemente. Por favor espera 5 minutos.']);
                exit;
            }

            // 1. Guardar en la base de datos
            $stmt = $pdo->prepare("INSERT INTO contact_messages (nombre, email, asunto, mensaje) VALUES (?, ?, ?, ?)");
            $stmt->execute([$nombre, $email, $asunto, $mensaje]);

            // 2. Enviar correo al administrador (simulado o real si hay servidor SMTP)
            $to = "admin@lebu.cl"; // Cambia esto al correo real del administrador
            $subject = "Nuevo mensaje de contacto: " . $asunto;
            $body = "Has recibido un nuevo mensaje de contacto.<br><br>";
            $body .= "Nombre: " . $nombre . "<br>";
            $body .= "Email: " . $email . "<br>";
            $body .= "Asunto: " . $asunto . "<br>";
            $body .= "Mensaje:<br>" . nl2br($mensaje) . "<br>";

            // Intentar enviar correo (puede fallar en localhost sin config SMTP)
            $mailSent = send_email($to, $subject, $body);

            // Actualizar tiempo de último contacto en sesión
            $_SESSION['last_contact_time'] = time();

            send_json(['success' => true, 'message' => 'Mensaje enviado correctamente.', 'mail_sent' => $mailSent]);
            break;

        case 'get_contacts':
            // Solo administrador
            check_admin();

            $stmt = $pdo->query("SELECT * FROM contact_messages ORDER BY created_at DESC");
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            send_json(['success' => true, 'data' => $messages]);
            break;

        case 'mark_message_read':
            check_admin();
            $id = $data['id'] ?? 0;
            $stmt = $pdo->prepare("UPDATE contact_messages SET leido = TRUE WHERE id = ?");
            $stmt->execute([$id]);
            send_json(['success' => true]);
            break;

        case 'send_reply':
            check_admin();
            $id = $data['id'] ?? null;
            $type = $data['type'] ?? 'contact'; // 'contact' or 'report'
            $email = $data['email'] ?? '';
            $subject = $data['subject'] ?? '';
            $message = $data['message'] ?? '';

            if (empty($email) || empty($message)) {
                send_json(['success' => false, 'message' => 'Email y mensaje son requeridos.']);
            }

            // Intentar obtener el nombre para personalizar el saludo
            $recipient_name = "Usuario";
            if ($id) {
                if ($type === 'contact') {
                    $stmt = $pdo->prepare("SELECT nombre FROM contact_messages WHERE id = ?");
                    $stmt->execute([$id]);
                    $res = $stmt->fetch();
                    if ($res && !empty($res['nombre'])) $recipient_name = $res['nombre'];
                } elseif ($type === 'report') {
                    $stmt = $pdo->prepare("SELECT u.nombre FROM reportes r JOIN usuarios u ON r.id_usuario = u.id WHERE r.id = ?");
                    $stmt->execute([$id]);
                    $res = $stmt->fetch();
                    if ($res && !empty($res['nombre'])) $recipient_name = $res['nombre'];
                }
            }

            // Construir mensaje con formato estándar
            $full_message = "Hola $recipient_name,<br><br>" . nl2br($message) . "<br><br>Saludos,<br>ReservaNoble";

            if (send_email($email, $subject, $full_message)) {
                // Marcar como leído/respondido si se proporcionó ID
                if ($id) {
                    if ($type === 'report') {
                        $stmt = $pdo->prepare("UPDATE reportes SET status = 'resolved' WHERE id = ?");
                        $stmt->execute([$id]);
                    } else {
                        $stmt = $pdo->prepare("UPDATE contact_messages SET leido = TRUE WHERE id = ?");
                        $stmt->execute([$id]);
                    }
                }
                send_json(['success' => true, 'message' => 'Respuesta enviada correctamente.']);
            } else {
                send_json(['success' => false, 'message' => 'Error al enviar el correo.']);
            }
            break;

        case 'update_own_profile':
            $user_id = get_session_user_id();
            $name = $data['nombre'] ?? '';
            $phone = $data['telefono'] ?? '';

            if (empty($name)) {
                send_json(['success' => false, 'message' => 'El nombre es obligatorio.']);
            }

            $stmt = $pdo->prepare("UPDATE usuarios SET nombre = ?, telefono = ? WHERE id = ?");
            $stmt->execute([$name, $phone, $user_id]);

            // Actualizar sesión
            $_SESSION['user']['name'] = $name;
            $_SESSION['user']['phone'] = $phone;

            send_json(['success' => true]);
            break;

        case 'change_own_password':
            $user_id = get_session_user_id();
            $newPass = $data['newPassword'] ?? '';

            if (empty($newPass)) {
                send_json(['success' => false, 'message' => 'La nueva contraseña es obligatoria.']);
            }

            $newHash = password_hash($newPass, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE usuarios SET password = ? WHERE id = ?");
            $stmt->execute([$newHash, $user_id]);
            send_json(['success' => true]);
            break;

        case 'cancel_my_request':
            $user_id = get_session_user_id();
            $request_id = $data['id'] ?? 0;

            // Verificar que la solicitud pertenezca al usuario y esté pendiente
            $stmt = $pdo->prepare("SELECT id FROM solicitudes WHERE id = ? AND id_usuario = ? AND status = 'pending'");
            $stmt->execute([$request_id, $user_id]);
            
            if ($stmt->fetch()) {
                $stmt = $pdo->prepare("DELETE FROM solicitudes WHERE id = ?");
                $stmt->execute([$request_id]);
                send_json(['success' => true]);
            } else {
                send_json(['success' => false, 'message' => 'No se puede cancelar esta solicitud.']);
            }
            break;

        default:
            http_response_code(404);
            send_json(['success' => false, 'message' => 'Acción no válida']);
            break;
    }

} catch (PDOException $e) {
    // Capturar errores de la base de datos
    http_response_code(500);
    send_json(['success' => false, 'message' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Exception $e) {
    // Capturar otros errores
    http_response_code(500);
    send_json(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>