/**
 * index.js
 * Lógica principal para la página de inicio (Landing Page)
 */

// --- 1. Verificación de Sesión ---
// Se ejecuta inmediatamente para determinar redirecciones
fetch('api/api.php?action=get_current_user_full')
    .then(response => {
        if (response.ok) return response.json();
        throw new Error('Not logged in');
    })
    .then(user => {
        if (user.rol === 'admin') {
            window.location.href = 'administrador.html';
        } else {
            window.location.href = 'formulario.html';
        }
    })
    .catch(() => {
        // No logueado, mostrar contenido
        document.body.classList.remove('hidden-body');
    });

// --- 2. Lógica General (Login, UI, Menú) ---
document.addEventListener('DOMContentLoaded', function() {
    // Cabecera Fija
    const header = document.querySelector('.site-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });

    // Menú Móvil
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const nav = document.getElementById('mainNav');
    if(mobileBtn && nav) {
        mobileBtn.addEventListener('click', () => nav.classList.toggle('active'));
    }

    // Alternar Contraseña
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if(togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // Alternar Login en Cabecera
    const headerBtn = document.getElementById('headerLoginBtn');
    headerBtn && headerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const inicioSection = document.getElementById('inicio');
        if (inicioSection && !inicioSection.classList.contains('active')) {
            const homeLink = document.querySelector('a[href="#inicio"]');
            if (homeLink) homeLink.click();
            document.body.classList.add('login-open');
            document.body.classList.remove('login-closed');
        } else {
            document.body.classList.toggle('login-open');
            document.body.classList.toggle('login-closed');
        }
        if (document.body.classList.contains('login-open')) {
            setTimeout(() => {
                const email = document.getElementById('email');
                if (email) email.focus();
            }, 250);
        }
    });

    // Abrir Login Automáticamente vía Hash/Param
    (function autoOpenLogin(){
        const shouldOpenHash = window.location.hash === '#login';
        const urlParams = new URLSearchParams(window.location.search);
        const shouldOpenParam = urlParams.get('login') === '1';
        if (shouldOpenHash || shouldOpenParam) {
            document.body.classList.add('login-open');
            document.body.classList.remove('login-closed');
            setTimeout(() => {
                const email = document.getElementById('email');
                if (email) email.focus();
            }, 250);
            try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e){}
        }
    })();

    // Lógica del Formulario de Login
    const form = document.getElementById('loginForm');
    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');
    const msg = document.getElementById('msg');
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        const btnText = loginBtn.querySelector('.btn-text');
        const spinner = loginBtn.querySelector('.spinner');

        emailEl.addEventListener('input', validateEmail);
        passwordEl.addEventListener('input', validatePassword);

        function validateEmail() {
            const email = emailEl.value.trim();
            const isValid = /^[^\s@]+@[^\s@]+$/.test(email);
            emailEl.classList.toggle('invalid', !isValid && email !== '');
            emailEl.classList.toggle('valid', isValid);
            return isValid;
        }

        function validatePassword() {
            const password = passwordEl.value;
            const isValid = password.length >= 6;
            passwordEl.classList.toggle('invalid', !isValid && password !== '');
            passwordEl.classList.toggle('valid', isValid);
            return isValid;
        }

        form.addEventListener('submit', async function(e){
            e.preventDefault();
            msg.style.color = 'red';
            msg.textContent = '';

            if (!validateEmail()) {
                msg.textContent = 'Correo inválido.';
                emailEl.focus(); return;
            }
            if (!validatePassword()) {
                msg.textContent = 'Contraseña muy corta.';
                passwordEl.focus(); return;
            }

            loginBtn.disabled = true;
            btnText.textContent = 'Verificando...';
            spinner.classList.remove('hidden');

            try {
                const response = await fetch('api/api.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailEl.value.trim(), password: passwordEl.value.trim() })
                });
                const result = await response.json();

                if (result.success) {
                    if (result.needs_2fa) {
                        document.querySelector('.login-box').style.display = 'none';
                        document.getElementById('twoFactorModal').classList.remove('hidden');
                        await sendTwoFactorCode();
                    } else {
                        msg.style.color = 'green';
                        msg.textContent = '¡Éxito! Redirigiendo...';
                        let redirect = result.redirect;
                        if (redirect.endsWith('.php')) redirect = redirect.replace('.php', '.html');
                        window.location.href = redirect; 
                    }
                } else {
                    msg.textContent = result.message || 'Error desconocido.';
                    loginBtn.disabled = false;
                    btnText.textContent = 'Iniciar sesión';
                    spinner.classList.add('hidden');
                }
            } catch (error) {
                console.error(error);
                msg.textContent = 'Error de conexión.';
                loginBtn.disabled = false;
                btnText.textContent = 'Iniciar sesión';
                spinner.classList.add('hidden');
            }
        });
    }

    // Lógica de 2FA
    const twoFactorModal = document.getElementById('twoFactorModal');
    const verificationCodeInput = document.getElementById('verificationCode');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const resendCodeBtn = document.getElementById('resendCodeBtn');
    const twoFactorMsg = document.getElementById('twoFactorMsg');
    const cancelTwoFactor = document.getElementById('cancelTwoFactor');

    window.sendTwoFactorCode = async function() {
        twoFactorMsg.textContent = 'Enviando código...';
        twoFactorMsg.style.color = 'blue';
        try {
            const response = await fetch('api/api.php?action=send_2fa_code', { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                twoFactorMsg.style.color = 'green';
                twoFactorMsg.textContent = result.message;
                verificationCodeInput.focus();
            } else {
                twoFactorMsg.style.color = 'red';
                twoFactorMsg.textContent = result.message;
            }
        } catch (error) {
            twoFactorMsg.style.color = 'red';
            twoFactorMsg.textContent = 'Error de conexión.';
        }
    };

    if (verifyCodeBtn) {
        verifyCodeBtn.addEventListener('click', async function() {
            const code = verificationCodeInput.value.trim();
            if (code.length !== 6) {
                twoFactorMsg.style.color = 'red';
                twoFactorMsg.textContent = 'Código inválido.'; return;
            }
            
            verifyCodeBtn.disabled = true;
            verifyCodeBtn.querySelector('.spinner').classList.remove('hidden');

            try {
                const response = await fetch('api/api.php?action=verify_2fa_code', {
                    method: 'POST',
                    body: JSON.stringify({ code: code })
                });
                const result = await response.json();

                if (result.success) {
                    twoFactorMsg.style.color = 'green';
                    twoFactorMsg.textContent = '¡Éxito!';
                    setTimeout(() => {
                        let redirect = result.redirect;
                        if (redirect.endsWith('.php')) redirect = redirect.replace('.php', '.html');
                        window.location.href = redirect;
                    }, 500);
                } else {
                    twoFactorMsg.style.color = 'red';
                    twoFactorMsg.textContent = result.message;
                    verifyCodeBtn.disabled = false;
                    verifyCodeBtn.querySelector('.spinner').classList.add('hidden');
                }
            } catch (error) {
                twoFactorMsg.style.color = 'red';
                twoFactorMsg.textContent = 'Error de conexión.';
                verifyCodeBtn.disabled = false;
                verifyCodeBtn.querySelector('.spinner').classList.add('hidden');
            }
        });
    }

    if (resendCodeBtn) {
        resendCodeBtn.addEventListener('click', async function() {
            resendCodeBtn.disabled = true;
            await sendTwoFactorCode();
            setTimeout(() => resendCodeBtn.disabled = false, 3000);
        });
    }

    if (cancelTwoFactor) {
        cancelTwoFactor.addEventListener('click', function(e) {
            e.preventDefault();
            twoFactorModal.classList.add('hidden');
            document.querySelector('.login-box').style.display = 'block';
            verificationCodeInput.value = '';
            twoFactorMsg.textContent = '';
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.querySelector('.btn-text').textContent = 'Iniciar sesión';
                loginBtn.querySelector('.spinner').classList.add('hidden');
            }
        });
    }
    
    // Permitir pegar código y auto-verificar
    if (verificationCodeInput) {
        verificationCodeInput.addEventListener('paste', function(e) {
            setTimeout(() => {
            if (verificationCodeInput.value.length === 6) {
                verifyCodeBtn.click();
            }
            }, 100);
        });

        // Permitir Enter para verificar
        verificationCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && verificationCodeInput.value.length === 6) {
            verifyCodeBtn.click();
            }
        });
    }
});

// --- 3. Google Login (Global) ---
window.handleGoogleSignIn = function(response) {
    const credential = response.credential;
    const msg = document.getElementById('msg');
    msg.style.color = 'blue';
    msg.textContent = 'Verificando con Google...';

    fetch('api/api.php?action=google_login', {
        method: 'POST',
        body: JSON.stringify({ credential: credential })
    })
    .then(res => res.json())
    .then(result => {
        if (result.success) {
            msg.style.color = 'green';
            msg.textContent = '¡Éxito!';
            let redirect = result.redirect;
            if (redirect.endsWith('.php')) redirect = redirect.replace('.php', '.html');
            window.location.href = redirect;
        } else {
            msg.textContent = result.message;
        }
    })
    .catch(error => {
        console.error(error);
        msg.textContent = 'Error de conexión con Google.';
    });
};

// --- 4. Mapas y Lugares ---
let allVenues = [];
let map;
let markers = [];
let PulsingMarker;

function statusLabel(status) {
    switch ((status || '').toString().trim().toLowerCase()) {
        case 'maintenance': return 'Mantenimiento';
        case 'reserved': return 'Reservado';
        default: return 'Disponible';
    }
}

function renderVenues(venuesToRender) {
    const list = document.getElementById('venuesList');
    if (!list) return;
    list.innerHTML = '';
    
    const sortedVenues = [...venuesToRender].sort((a, b) => {
        const statusA = (a.status || 'available').toString().toLowerCase();
        const statusB = (b.status || 'available').toString().toLowerCase();
        const isAvailableA = statusA !== 'maintenance' && statusA !== 'reserved';
        const isAvailableB = statusB !== 'maintenance' && statusB !== 'reserved';
        if (isAvailableA && !isAvailableB) return -1;
        if (!isAvailableA && isAvailableB) return 1;
        return 0;
    });

    if (sortedVenues.length === 0) {
        list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: white;">No se encontraron lugares.</p>';
        return;
    }

    sortedVenues.forEach(v => {
        const status = (v.status || 'available').toString().toLowerCase();
        const card = document.createElement('div');
        card.className = 'venue-card-index';
        card.innerHTML = `
            <h4>${v.nombre}</h4>
            <p><i class="fas fa-map-marker-alt"></i> ${v.direccion || 'Sin dirección'}</p>
            <p><i class="fas fa-users"></i> Capacidad: ${v.capacidad || 'N/A'}</p>
            <p><i class="fas fa-tag"></i> Base: <span class="price-tag">$${v.precio_base || 0}</span></p>
            <p><i class="fas fa-user"></i> p/P: <span class="price-tag">$${v.precio_por_persona || 0}</span></p>
            <span class="status-badge status-${status}">${statusLabel(status)}</span>
            <div style="margin-top: 15px;">
                <button onclick="openDetailsModal(${v.id})" class="btn secondary" style="width: 100%; padding: 8px;">
                    <i class="fas fa-eye"></i> Ver Detalles
                </button>
            </div>
        `;
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            if(map && v.lat && v.lng) {
                map.panTo({lat: parseFloat(v.lat), lng: parseFloat(v.lng)});
                map.setZoom(16);
                document.getElementById('map').scrollIntoView({behavior: 'smooth'});
            }
        });
        list.appendChild(card);
    });
}

window.filterVenues = function() {
    const nameQuery = (document.getElementById('searchName').value || '').toLowerCase().trim();
    const cap = parseInt(document.getElementById('filterCapacity').value) || 0;
    const base = parseInt(document.getElementById('filterBasePrice').value) || Infinity;
    const pp = parseInt(document.getElementById('filterPersonPrice').value) || Infinity;
    const maxBase = document.getElementById('filterBasePrice').value === '' ? Infinity : base;
    const maxPP = document.getElementById('filterPersonPrice').value === '' ? Infinity : pp;

    const filtered = allVenues.filter(v => {
        const vName = (v.nombre || '').toLowerCase();
        const vCap = parseInt(v.capacidad) || 0;
        const vBase = parseInt(v.precio_base) || 0;
        const vPP = parseInt(v.precio_por_persona) || 0;
        return vName.includes(nameQuery) && vCap >= cap && vBase <= maxBase && vPP <= maxPP;
    });
    renderVenues(filtered);
    updateMapMarkers(filtered);
};

window.resetFilters = function() {
    document.getElementById('searchName').value = '';
    document.getElementById('filterCapacity').value = '';
    document.getElementById('filterBasePrice').value = '';
    document.getElementById('filterPersonPrice').value = '';
    renderVenues(allVenues);
    updateMapMarkers(allVenues);
};

function updateMapMarkers(venuesToShow) {
    markers.forEach(m => m.setMap(null));
    markers = [];
    if (!map || !PulsingMarker) return;
    const bounds = new google.maps.LatLngBounds();
    let currentInfoWindow = null;

    venuesToShow.forEach(v => {
        const lat = parseFloat(v.lat);
        const lng = parseFloat(v.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        const pos = new google.maps.LatLng(lat, lng);
        
        let color = '#10b981'; 
        if(v.status === 'maintenance') color = '#f59e0b'; 
        if(v.status === 'reserved') color = '#ef4444'; 
        
        bounds.extend(pos);
        
        let displayImage = null;
        if (v.galeria && v.galeria.length > 0) {
            displayImage = v.galeria[0].imagen_url;
        } else {
            displayImage = v.imagen_url;
        }

        const content = `<div style="min-width:180px; padding: 5px; color: #333; max-width: 200px;">
            ${displayImage ? `<img src="${displayImage}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;">` : ''}
            <h3 style="margin:0 0 5px; font-size:1.1rem; color: #000;">${v.nombre}</h3>
            <div style="color:#666; margin-bottom:8px;">${v.direccion || ''}</div>
            <div style="margin-top:6px">
                <button onclick="openDetailsModal(${v.id})" class="btn small" style="background:#2563eb; color:white; padding:6px 12px; border-radius:4px; display:inline-block; border:none; cursor:pointer; width:100%;">Ver Detalles</button>
            </div>
        </div>`;
        
        const info = new google.maps.InfoWindow({ content });
        const onMarkerClick = () => {
            if (currentInfoWindow) currentInfoWindow.close();
            info.setPosition(pos);
            info.open(map);
            currentInfoWindow = info;
        };
        markers.push(new PulsingMarker(pos, color, map, v.nombre, onMarkerClick));
    });
    // if (venuesToShow.length > 0) map.fitBounds(bounds); // Desactivado para evitar zoom automático
}

// --- 5. Modal Detalles y Lightbox ---
window.openDetailsModal = function(venueId) {
    const venue = allVenues.find(v => v.id == venueId);
    if (!venue) return;

    document.getElementById('detailName').textContent = venue.nombre;
    document.getElementById('detailAddress').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${venue.direccion}`;
    document.getElementById('detailPrice').textContent = parseInt(venue.precio_base).toLocaleString();
    document.getElementById('detailPersonPrice').textContent = parseInt(venue.precio_por_persona || 0).toLocaleString();
    document.getElementById('detailCapacity').textContent = venue.capacidad;
    
    // Actualizar Badge de Estado
    const statusSpan = document.getElementById('detailStatus');
    if (venue.status === 'maintenance') {
        statusSpan.textContent = 'Mantenimiento';
        statusSpan.style.background = '#fef3c7'; 
        statusSpan.style.color = '#d97706'; 
    } else if (venue.status === 'reserved') {
        statusSpan.textContent = 'Reservado';
        statusSpan.style.background = '#fee2e2'; 
        statusSpan.style.color = '#dc2626'; 
    } else {
        statusSpan.textContent = 'Disponible';
        statusSpan.style.background = '#d1fae5'; 
        statusSpan.style.color = '#059669'; 
    }

    document.getElementById('detailDescription').textContent = venue.descripcion || "Descripción no disponible.";

    const carousel = document.getElementById('detailCarousel');
    carousel.innerHTML = '';
    let images = [];
    if (venue.galeria && venue.galeria.length > 0) {
        images = venue.galeria.map(g => g.imagen_url);
    } else if (venue.imagen_url) {
        images = [venue.imagen_url];
    } else {
        images = ['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80'];
    }
    
    images.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'min-width: 100%; height: 100%; object-fit: cover; scroll-snap-align: center; cursor: zoom-in;';
        img.onclick = () => openLightbox(url);
        carousel.appendChild(img);
    });

    const servicesList = document.getElementById('detailServices');
    servicesList.innerHTML = '';
    const defaultServices = "Wifi,Estacionamiento,Baños,Seguridad,Accesibilidad";
    const servicios = (venue.servicios || defaultServices).split(',');
    const iconsMap = { 'wifi': 'fa-wifi', 'estacionamiento': 'fa-car', 'baños': 'fa-restroom', 'cocina': 'fa-utensils', 'aire acondicionado': 'fa-snowflake', 'seguridad': 'fa-shield-alt', 'accesibilidad': 'fa-wheelchair', 'piscina': 'fa-swimming-pool', 'bar': 'fa-glass-martini-alt', 'gimnasio': 'fa-dumbbell', 'mascotas': 'fa-paw', 'tv': 'fa-tv' };

    servicios.forEach(serv => {
        const s = serv.trim();
        const icon = iconsMap[s.toLowerCase()] || 'fa-check-circle';
        servicesList.innerHTML += `<li style="margin-bottom: 8px; display: flex; align-items: center;"><i class="fas ${icon}" style="width: 25px; color: var(--blue); margin-right: 8px;"></i> ${s}</li>`;
    });

    // document.getElementById('detailActionBtn').onclick = function() {
    //     closeDetailsModal();
    //     document.getElementById('headerLoginBtn').click();
    // };
    document.getElementById('venueDetailsModal').classList.remove('hidden');
    document.getElementById('venueDetailsModal').style.display = 'block';
};

window.closeDetailsModal = function() {
    const modal = document.getElementById('venueDetailsModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
};

window.scrollCarousel = function(direction) {
    const carousel = document.getElementById('detailCarousel');
    carousel.scrollTo({ left: carousel.scrollLeft + (carousel.clientWidth * direction), behavior: 'smooth' });
};

window.openLightbox = function(url) {
    document.getElementById('lightboxImage').src = url;
    document.getElementById('imageLightbox').classList.remove('hidden');
    document.getElementById('imageLightbox').style.display = 'flex';
};

window.closeLightbox = function() {
    document.getElementById('imageLightbox').classList.add('hidden');
    document.getElementById('imageLightbox').style.display = 'none';
};

// --- 6. Inicialización Mapa (Global) ---
window.initMap = async function() {
    try {
        const resp = await fetch('api/api.php?action=get_venues');
        allVenues = await resp.json();
        
        const center = { lat: -37.6095, lng: -73.6500 }; // Centro ajustado de Lebu
        map = new google.maps.Map(document.getElementById('map'), { 
            center, zoom: 14, gestureHandling: 'greedy', scrollwheel: true, fullscreenControl: true, zoomControl: true,
            styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
        });
        
        PulsingMarker = class extends google.maps.OverlayView {
            constructor(position, color, map, title, onClick) {
                super();
                this.position = position; this.color = color; this.title = title; this.onClick = onClick; this.div = null; this.setMap(map);
            }
            onAdd() {
                const div = document.createElement('div');
                div.className = 'pulsing-marker';
                div.title = this.title;
                div.style.setProperty('--marker-color', this.color);
                div.addEventListener('click', (e) => { e.stopPropagation(); if (this.onClick) this.onClick(); });
                this.div = div;
                this.getPanes().overlayMouseTarget.appendChild(div);
            }
            draw() {
                const overlayProjection = this.getProjection();
                const point = overlayProjection.fromLatLngToDivPixel(this.position);
                if (this.div) { this.div.style.left = point.x + 'px'; this.div.style.top = point.y + 'px'; }
            }
            onRemove() { if (this.div) { this.div.parentNode.removeChild(this.div); this.div = null; } }
        }
        renderVenues(allVenues);
        updateMapMarkers(allVenues);
    } catch (e) { console.error('Error inicializando mapa', e); }
};

// --- 7. Contacto ---
window.submitContactForm = async function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    formData.append('action', 'contact');
    try {
        const response = await fetch('api/api.php', { method: 'POST', body: formData });
        const result = await response.json();
        if (result.success) { showToast('Mensaje enviado.', 'success'); e.target.reset(); }
        else showToast('Error: ' + result.message, 'error');
    } catch (error) { showToast('Error al enviar.', 'error'); }
};

// --- 8. SPA Navigation ---
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.main-nav a');
    const sections = document.querySelectorAll('.spa-section');

    function showSection(targetId) {
        sections.forEach(section => section.classList.remove('active'));
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('active');
        navLinks.forEach(link => {
            if (link.getAttribute('href').substring(1) === targetId) link.classList.add('active');
            else link.classList.remove('active');
        });
        window.scrollTo(0, 0);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            showSection(targetId);
            history.pushState(null, null, `#${targetId}`);

            // Cerrar menú móvil si está abierto
            const nav = document.getElementById('mainNav');
            if (nav && nav.classList.contains('active')) {
                nav.classList.remove('active');
            }
        });
    });

    const initialHash = window.location.hash.substring(1);
    if (initialHash && document.getElementById(initialHash)) showSection(initialHash);
    else showSection('inicio');

    window.addEventListener('popstate', () => {
        const hash = window.location.hash.substring(1);
        if (hash && document.getElementById(hash)) showSection(hash);
        else showSection('inicio');
    });
});

// --- 9. Cargar Google Maps ---
(function addMaps(){
    const apiKey = 'AIzaSyC59R63rSWzCG9hIV3chuKsprNPZSODL1U'; 
    if (!apiKey) return;
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) + '&callback=initMap';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
})();
