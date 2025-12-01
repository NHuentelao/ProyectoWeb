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

    // Formatear teléfono (Solo permitir números y máximo 8 dígitos)
    phoneEl.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 8) value = value.slice(0, 8);
        e.target.value = value;
    });

    // Elementos del modal de verificación
    const verificationModal = document.getElementById('verificationModal');
    const verifyBtn = document.getElementById('verifyBtn');
    const cancelVerifyBtn = document.getElementById('cancelVerifyBtn');
    const verificationCodeInput = document.getElementById('verificationCode');
    const verifyMsg = document.getElementById('verifyMsg');

    form.addEventListener('submit', async function(e){
        e.preventDefault();
        msg.style.color = 'red'; msg.textContent = '';
        button.disabled = true;
        button.textContent = 'Procesando...';

        // Validaciones
        if (!nameEl.value.trim()) { msg.textContent = 'Introduce tu nombre.'; nameEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }
        if (!emailEl.checkValidity()) { msg.textContent = 'Introduce un correo válido.'; emailEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }
        if (passwordEl.value.length < 6) { msg.textContent = 'La contraseña debe tener al menos 6 caracteres.'; passwordEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }
        if (passwordEl.value !== confirmEl.value) { msg.textContent = 'Las contraseñas no coinciden.'; confirmEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }
        if (phoneEl.value.length < 8) { msg.textContent = 'El número debe tener 8 dígitos.'; phoneEl.focus(); button.disabled = false; button.textContent = 'Registrarse'; return }

        const userData = {
            name: nameEl.value.trim(),
            email: emailEl.value.trim().toLowerCase(),
            password: passwordEl.value,
            phone: '+569' + phoneEl.value.trim()
        };

        try {
            // Paso 1: Enviar datos y solicitar código de verificación
            const response = await fetch('api/api.php?action=send_verification_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (result.success) {
                // Mostrar modal de verificación
                verificationModal.style.display = 'flex';
                verificationModal.classList.remove('hidden');
                msg.textContent = '';
                button.textContent = 'Registrarse'; // Restaurar botón
            } else {
                msg.textContent = result.message || 'Error al iniciar registro.';
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

    // Manejar verificación de código
    verifyBtn.addEventListener('click', async function() {
        const code = verificationCodeInput.value.trim();
        if (code.length !== 6) {
            verifyMsg.style.color = 'red';
            verifyMsg.textContent = 'El código debe tener 6 dígitos.';
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verificando...';
        verifyMsg.textContent = '';

        try {
            const response = await fetch('api/api.php?action=verify_registration_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });

            const result = await response.json();

            if (result.success) {
                verifyMsg.style.color = 'green';
                verifyMsg.textContent = '¡Verificación exitosa! Creando cuenta...';
                
                setTimeout(() => {
                    window.location.href = 'index.html#login';
                }, 1500);
            } else {
                verifyMsg.style.color = 'red';
                verifyMsg.textContent = result.message || 'Código incorrecto.';
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verificar';
            }
        } catch (error) {
            console.error('Error en verificación:', error);
            verifyMsg.style.color = 'red';
            verifyMsg.textContent = 'Error de conexión.';
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verificar';
        }
    });

    // Cancelar verificación
    cancelVerifyBtn.addEventListener('click', function() {
        verificationModal.style.display = 'none';
        verificationModal.classList.add('hidden');
        button.disabled = false;
        button.textContent = 'Registrarse';
        verificationCodeInput.value = '';
        verifyMsg.textContent = '';
    });
})();