// Script de registro
(function(){
    const form = document.getElementById('form');
    const nameEl = document.getElementById('name');
    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');
    const confirmEl = document.getElementById('confirm');
    const phoneEl = document.getElementById('phone');
    const msg = document.getElementById('msg');
    const button = form.querySelector('button');

    // Formatear teléfono
    phoneEl.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 8) value = value.slice(0, 8);
        if (value.length >= 4) {
            value = value.slice(0, 4) + ' ' + value.slice(4);
        }
        e.target.value = value;
    });

    form.addEventListener('submit', async function(e){
        e.preventDefault();
        msg.style.color = 'red'; msg.textContent = '';
        button.disabled = true;
        button.textContent = 'Registrando...';

        // Validaciones
        if (!nameEl.value.trim()) { msg.textContent = 'Introduce tu nombre.'; nameEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }
        if (!emailEl.checkValidity()) { msg.textContent = 'Introduce un correo válido.'; emailEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }
        if (passwordEl.value.length < 6) { msg.textContent = 'La contraseña debe tener al menos 6 caracteres.'; passwordEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }
        if (passwordEl.value !== confirmEl.value) { msg.textContent = 'Las contraseñas no coinciden.'; confirmEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }
        if (phoneEl.value.replace(' ', '').length < 8) { msg.textContent = 'El número debe tener 8 dígitos (ej: 1234 5678).'; phoneEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }

        const userData = {
            name: nameEl.value.trim(),
            email: emailEl.value.trim().toLowerCase(),
            password: passwordEl.value,
            phone: '+56 9 ' + phoneEl.value.trim()
        };

        try {
            // LLAMADA A LA API EN LA CARPETA 'api'
            const response = await fetch('api/api.php?action=register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (result.success) {
                msg.style.color = 'green';
                msg.textContent = '¡Registro exitoso! Redirigiendo...';
                setTimeout(() => {
                    window.location.href = 'index.html#login';
                }, 1500);
            } else {
                msg.textContent = result.message || 'Error al registrarse.';
                button.disabled = false;
                button.textContent = 'Registrarse';
            }
        } catch (error) {
            console.error('Error en registro:', error);
            msg.textContent = 'Error de conexión. Intenta de nuevo.';
            button.disabled = false;
            button.textContent = 'Registrarse';
        }
    });
})();