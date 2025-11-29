/**
 * Sistema de Notificaciones Toast
 * Muestra notificaciones no bloqueantes al usuario.
 */

/**
 * Muestra una notificación toast.
 * @param {string} message El mensaje a mostrar.
 * @param {string} type El tipo de notificación ('success', 'error', 'warning', 'info'). Por defecto es 'info'.
 * @param {number} duration Duración en milisegundos antes de que el toast desaparezca. Por defecto es 3000ms.
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('¡No se encontró el contenedor de Toast! Asegúrate de que <div id="toast-container"></div> esté en tu HTML.');
        // Alternativa a alert si falta el contenedor, para que el usuario aún vea el mensaje
        alert(message);
        return;
    }

    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Mapeo de iconos
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';

    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span>${message}</span>
    `;

    // Añadir al contenedor
    container.appendChild(toast);

    // Activar animación
    // Pequeño retraso para permitir la inserción en el DOM antes de añadir la clase para la transición
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Eliminar después de la duración
    setTimeout(() => {
        toast.classList.remove('show');
        // Esperar a que termine la animación de desvanecimiento antes de eliminar del DOM
        setTimeout(() => {
            if (toast.parentElement) {
                container.removeChild(toast);
            }
        }, 300); // Coincide con la duración de la transición CSS
    }, duration);
}

// Exponer globalmente
window.showToast = showToast;
