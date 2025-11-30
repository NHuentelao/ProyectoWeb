<?php
// promote_admin.php
// Herramienta temporal para promover usuarios a Administrador
require 'api/db.php';

$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'] ?? '';
    $secret = $_POST['secret'] ?? '';

    // Protección simple para que no cualquiera pueda usarlo
    if ($secret !== 'lebu123') { 
        $message = "Clave secreta incorrecta.";
    } else {
        try {
            // Verificar si el usuario existe
            $stmt = $pdo->prepare("SELECT id, nombre FROM usuarios WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if ($user) {
                // Actualizar rol
                $update = $pdo->prepare("UPDATE usuarios SET rol = 'admin' WHERE email = ?");
                $update->execute([$email]);
                $message = "¡Éxito! El usuario <b>" . htmlspecialchars($user['nombre']) . "</b> ($email) ahora es Administrador.";
            } else {
                $message = "Error: No se encontró ningún usuario registrado con el correo $email.";
            }
        } catch (PDOException $e) {
            $message = "Error de base de datos: " . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Promover Admin</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; padding-top: 50px; background: #f4f4f4; }
        .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        .msg { padding: 10px; margin-bottom: 15px; border-radius: 4px; background: #e8f5e9; color: #2e7d32; text-align: center; }
        .error { background: #ffebee; color: #c62828; }
    </style>
</head>
<body>
    <div class="card">
        <h2 style="text-align: center; margin-top: 0;">Asignar Administrador</h2>
        
        <?php if ($message): ?>
            <div class="msg <?php echo strpos($message, 'Error') !== false || strpos($message, 'incorrecta') !== false ? 'error' : ''; ?>">
                <?php echo $message; ?>
            </div>
        <?php endif; ?>

        <p style="font-size: 14px; color: #666;">Ingresa el correo de un usuario <b>ya registrado</b> para darle permisos de administrador.</p>

        <form method="POST">
            <label>Correo del Usuario:</label>
            <input type="email" name="email" placeholder="ejemplo@correo.com" required>
            
            <label>Clave de Seguridad:</label>
            <input type="text" name="secret" placeholder="Escribe: lebu123" required>
            
            <button type="submit">Convertir en Admin</button>
        </form>
        
        <div style="margin-top: 20px; text-align: center;">
            <a href="index.html" style="color: #666; text-decoration: none;">&larr; Volver al inicio</a>
        </div>
    </div>
</body>
</html>
