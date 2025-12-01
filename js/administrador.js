let adminMap;
let markers = [];
let selectedVenueIndex = null; // Índice en el array 'allVenues'
let editingUserIndex = null;   // Índice en el array 'allUsers'

// Cachés de datos globales
let allVenues = [];
let allUsers = [];
let allRequests = [];
let allReports = [];
let allMessages = [];

/**
 * Función central para todas las llamadas a la API
 * @param {string} action - El endpoint de la API (ej: 'get_venues')
 * @param {object} options - Opciones de Fetch (method, body)
 */
async function apiFetch(action, options = {}) {
    const { method = 'GET', body = null } = options;
    
    // La URL ahora apunta a la carpeta 'api'
    const url = `api/api.php?action=${action}`;
    
    const fetchOptions = {
        method,
        headers: {},
    };

    if (body instanceof FormData) {
        fetchOptions.body = body;
        // No establecer Content-Type explícitamente para FormData, el navegador lo hace con el boundary correcto
    } else {
        fetchOptions.headers['Content-Type'] = 'application/json';
        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showToast('Tu sesión ha expirado o no tienes permisos.', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Error HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error(`Error en apiFetch(${action}):`, error);
        // Evitar mostrar toast si ya se manejó el error 401/403
        if (!error.message.includes('HTTP 401') && !error.message.includes('HTTP 403')) {
             showToast(`Error: ${error.message}`, 'error');
        }
        throw error;
    }
}

// Inicializar el mapa de administración
let PulsingMarker; // Variable global para la clase

function initAdminMap() {
    const lebu = { lat: -37.6083, lng: -73.6472 };
    adminMap = new google.maps.Map(document.getElementById('adminMap'), {
        zoom: 14, center: lebu, gestureHandling: 'greedy',
        scrollwheel: true, fullscreenControl: true, zoomControl: true,
        styles: [ // Estilo de mapa más limpio
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
    });

    // Definir la clase PulsingMarker una vez que la API de Google Maps esté lista
    PulsingMarker = class extends google.maps.OverlayView {
        constructor(position, color, map, title, onClick) {
            super();
            this.position = position;
            this.color = color;
            this.title = title;
            this.onClick = onClick;
            this.div = null;
            this.setMap(map);
        }

        onAdd() {
            const div = document.createElement('div');
            div.className = 'pulsing-marker';
            div.title = this.title;
            div.style.setProperty('--marker-color', this.color);
            
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onClick) this.onClick();
            });

            this.div = div;
            const panes = this.getPanes();
            panes.overlayMouseTarget.appendChild(div);
        }

        draw() {
            const overlayProjection = this.getProjection();
            const point = overlayProjection.fromLatLngToDivPixel(this.position);
            if (this.div) {
                this.div.style.left = point.x + 'px';
                this.div.style.top = point.y + 'px';
            }
        }

        onRemove() {
            if (this.div) {
                this.div.parentNode.removeChild(this.div);
                this.div = null;
            }
        }
    };

    loadVenues(); // Carga los lugares en el mapa

    adminMap.addListener('click', function(e) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        
        document.getElementById('venue-lat').value = lat.toFixed(6);
        document.getElementById('venue-lng').value = lng.toFixed(6);
        
        // Si estamos en modo creación (selectedVenueIndex es null), no reseteamos el formulario
        // Si estamos en modo edición, tampoco. Solo actualizamos coordenadas.
        // El reset se hace al abrir el modal.
    });
}

// Función para abrir el modal de gestión de lugar (Crear o Editar)
function openVenueModal(index = null) {
    const modal = document.getElementById('venueModal');
    const form = document.getElementById('venueForm');
    const title = document.getElementById('venueModalTitle');
    const galleryContainer = document.getElementById('gallery-preview-container');
    const galleryPreview = document.getElementById('gallery-preview');

    modal.classList.remove('hidden');
    
    // Resetear formulario y estado
    form.reset();
    galleryPreview.innerHTML = '';
    galleryContainer.style.display = 'none';
    document.getElementById('venueMsg').textContent = '';
    document.getElementById('venueMsg').className = 'msg';

    if (index !== null) {
        // MODO EDICIÓN
        selectedVenueIndex = index;
        const venue = allVenues[index];
        title.innerHTML = '<i class="fas fa-edit"></i> Editar Lugar';
        
        // Llenar campos
        document.getElementById('venue-name').value = venue.nombre;
        document.getElementById('venue-address').value = venue.direccion;
        document.getElementById('venue-description').value = venue.descripcion || '';
        document.getElementById('owner-name').value = venue.owner_nombre || '';
        
        // Procesar teléfono para quitar prefijo +56 9
        let phone = venue.owner_telefono || '';
        phone = phone.replace(/^\+56\s*9\s*/, '');
        document.getElementById('owner-phone').value = phone;

        document.getElementById('owner-email').value = venue.owner_email || '';
        document.getElementById('venue-services').value = venue.servicios || '';
        document.getElementById('venue-lat').value = venue.lat;
        document.getElementById('venue-lng').value = venue.lng;
        document.getElementById('venue-capacity').value = venue.capacidad || '';
        document.getElementById('venue-base-price').value = venue.precio_base || '';
        document.getElementById('venue-price-per-guest').value = venue.precio_por_persona || '';

        // Galería
        if (venue.galeria && venue.galeria.length > 0) {
            galleryContainer.style.display = 'block';
            venue.galeria.forEach(img => {
                const div = document.createElement('div');
                div.style.position = 'relative';
                div.innerHTML = `
                    <img src="${img.imagen_url}" onclick="openLightbox('${img.imagen_url}')" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid #ddd;" title="Ver imagen completa">
                    <button type="button" onclick="deleteVenueImage(${img.id}, ${index})" style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px;">&times;</button>
                `;
                galleryPreview.appendChild(div);
            });
        } else if (venue.imagen_url) {
            galleryContainer.style.display = 'block';
            galleryPreview.innerHTML = `
                <div style="position: relative;">
                    <img src="${venue.imagen_url}" onclick="openLightbox('${venue.imagen_url}')" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid #ddd;" title="Ver imagen completa">
                </div>`;
        }

        // Centrar mapa en el lugar
        if (adminMap) {
            const pos = { lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) };
            adminMap.setCenter(pos);
            adminMap.setZoom(16);
        }

    } else {
        // MODO CREACIÓN
        selectedVenueIndex = null;
        title.innerHTML = '<i class="fas fa-plus-circle"></i> Nuevo Lugar';
        
        // Campo de teléfono vacío (el prefijo es estático en HTML)
        document.getElementById('owner-phone').value = '';
        
        // Centrar mapa en Lebu por defecto
        if (adminMap) {
            adminMap.setCenter({ lat: -37.6083, lng: -73.6472 });
            adminMap.setZoom(14);
        }
    }

    // IMPORTANTE: Redimensionar mapa al mostrar modal
    if (adminMap) {
        setTimeout(() => {
            google.maps.event.trigger(adminMap, 'resize');
            if (index !== null) {
                const venue = allVenues[index];
                adminMap.setCenter({ lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) });
            } else {
                adminMap.setCenter({ lat: -37.6083, lng: -73.6472 });
            }
        }, 100);
    }
}
window.openVenueModal = openVenueModal;

// Cargar y mostrar lugares (Venues)
async function loadVenues() {
    try {
        allVenues = await apiFetch('get_venues'); // Cargar y guardar en caché
        
        const table = document.getElementById('venuesTable');
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';
        clearMarkers();

        allVenues.forEach((venue, index) => {
            const marker = addMarker(venue); // 'venue' usa nombres de BD (ej: 'precio_base')

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${venue.nombre}</td>
                <td>${venue.direccion}</td>
                <td>${venue.capacidad || 'N/A'}</td>
                <td>${venue.precio_base ? '$' + venue.precio_base : 'N/A'}</td>
                <td>${venue.precio_por_persona ? '$' + venue.precio_por_persona : 'N/A'}</td>
                <td><span class="venue-status" value="${venue.status}">
                    ${venue.status === 'available' ? 'Disponible' :
                      venue.status === 'maintenance' ? 'Mantenimiento' :
                      'Reservado'}
                </span></td>
                <td>
                    <button onclick="showOwnerInfo(${index})" class="btn secondary small" style="margin-right: 5px; background: #6366f1;" title="Ver Dueño">
                        <i class="fas fa-user-tie"></i>
                    </button>
                    <button onclick="openVenueModal(${index})" class="btn secondary small" style="margin-right: 5px; background: var(--blue);" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="openStatusModal(${index})" class="btn secondary small" style="margin-right: 5px; background: var(--warning);" title="Cambiar Estado">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                    <button onclick="deleteVenue(${index})" class="delete-btn btn small" title="Eliminar">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);

            if (marker && typeof marker.addListener === 'function') {
                marker.addListener('click', () => openVenueModal(index));
            }
        });
    } catch (error) {
        console.error("Error cargando lugares:", error);
        document.getElementById('venuesTable').querySelector('tbody').innerHTML = '<tr><td colspan="7" style="color:red;">Error al cargar lugares.</td></tr>';
    }
}

// Agregar marcador al mapa
function addMarker(venue) {
    const lat = parseFloat(venue.lat);
    const lng = parseFloat(venue.lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;

    const position = new google.maps.LatLng(lat, lng);
    
    let color = '#10b981'; // disponible (success)
    switch(venue.status) {
        case 'maintenance': color = '#f59e0b'; break; // warning
        case 'reserved': color = '#ef4444'; break; // error
    }

    // Determinar imagen a mostrar (prioridad: primera de galería > imagen_url)
    let displayImage = null;
    if (venue.galeria && venue.galeria.length > 0) {
        displayImage = venue.galeria[0].imagen_url;
    } else {
        displayImage = venue.imagen_url;
    }

    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: 10px; color: #333; max-width: 200px;">
                ${displayImage ? `<img src="${displayImage}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" alt="${venue.nombre}">` : ''}
                <h3 style="margin: 0 0 5px; color: #000;">${venue.nombre}</h3>
                <p style="margin: 0; color: #333;">${venue.direccion}</p>
                <p style="margin: 5px 0 0">Capacidad: ${venue.capacidad || 'N/A'}</p>
                <p style="margin: 5px 0 0">Precio Base: ${venue.precio_base ? '$' + venue.precio_base : 'N/A'}</p>
                <p style="margin: 5px 0 0">Precio p/P: ${venue.precio_por_persona ? '$' + venue.precio_por_persona : 'N/A'}</p>
                <p style="margin: 5px 0 0">Estado: ${venue.status}</p>
            </div>
        `
    });

    const onMarkerClick = () => {
        infoWindow.open(adminMap, marker); // Note: marker variable needs to be accessible or passed
    };

    // Usar PulsingMarker si está definido
    let marker;
    if (typeof PulsingMarker !== 'undefined') {
        // PulsingMarker maneja su propio click
        marker = new PulsingMarker(position, color, adminMap, venue.nombre, () => {
             infoWindow.setPosition(position);
             infoWindow.open(adminMap);
        });
    } else {
        marker = new google.maps.Marker({
            position, map: adminMap,
            icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeWeight: 0, scale: 10 },
            title: venue.nombre
        });
        marker.addListener('click', () => infoWindow.open(adminMap, marker));
    }

    markers.push(marker);
    return marker;
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

// Eliminar un lugar
async function deleteVenue(index) {
    showConfirm('¿Estás seguro de eliminar este lugar?', async () => {
        try {
            const venue = allVenues[index];
            // Mostrar loading en el botón
            const btn = document.querySelector(`#venuesTable tbody tr:nth-child(${index + 1}) .delete-btn`);
            if(btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            await apiFetch('delete_venue', { method: 'POST', body: { id: venue.id } });
            showToast('Lugar eliminado correctamente', 'success');
            await loadVenues(); // Recargar
        } catch (error) {
            // Error manejado en apiFetch
        }
    });
}

// Abrir modal de cambio de estado
function openStatusModal(index) {
    const venue = allVenues[index];
    if (!venue) return;
    
    document.getElementById('venueStatusIndex').value = index;
    document.getElementById('venueStatusName').textContent = `Lugar: ${venue.nombre}`;
    document.getElementById('venueStatusModal').classList.remove('hidden');
}
window.openStatusModal = openStatusModal;

// Mostrar información del dueño
function showOwnerInfo(index) {
    const venue = allVenues[index];
    if (!venue) return;

    const content = document.getElementById('ownerInfoContent');
    const hasOwner = venue.owner_nombre || venue.owner_telefono || venue.owner_email;

    if (hasOwner) {
        content.innerHTML = `
            <div style="margin-bottom: 15px;">
                <label style="display:block; color:#64748b; font-size:0.85rem; margin-bottom:4px;">Nombre</label>
                <div style="font-size:1.1rem; font-weight:600; color:#1e293b;">${venue.owner_nombre || '<span style="color:#94a3b8; font-style:italic;">No registrado</span>'}</div>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block; color:#64748b; font-size:0.85rem; margin-bottom:4px;">Teléfono</label>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.1rem; color:#1e293b;">${venue.owner_telefono || '<span style="color:#94a3b8; font-style:italic;">No registrado</span>'}</span>
                </div>
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display:block; color:#64748b; font-size:0.85rem; margin-bottom:4px;">Email</label>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.1rem; color:#1e293b;">${venue.owner_email || '<span style="color:#94a3b8; font-style:italic;">No registrado</span>'}</span>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div style="text-align:center; padding: 20px; color: #64748b;">
                <i class="fas fa-user-slash" style="font-size: 3rem; margin-bottom: 10px; color: #cbd5e1;"></i>
                <p>Este lugar no tiene datos de dueño registrados.</p>
                <button onclick="document.getElementById('ownerInfoModal').classList.add('hidden'); editVenue(${index})" class="btn small" style="margin-top:10px; background:var(--primary-color);">
                    <i class="fas fa-plus"></i> Agregar Datos
                </button>
            </div>
        `;
    }

    document.getElementById('ownerInfoModal').classList.remove('hidden');
}
window.showOwnerInfo = showOwnerInfo;

// Establecer nuevo estado (desde el modal)
async function setVenueStatus(newStatus) {
    const index = document.getElementById('venueStatusIndex').value;
    const venue = allVenues[index];
    if (!venue) return;

    try {
        // Cerrar modal
        document.getElementById('venueStatusModal').classList.add('hidden');
        
        // Mostrar loading en el botón de la tabla (opcional, pero buena UX)
        const btn = document.querySelector(`#venuesTable tbody tr:nth-child(${parseInt(index) + 1}) button[onclick*="openStatusModal"]`);
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        await apiFetch('toggle_venue_status', { 
            method: 'POST', 
            body: { id: venue.id, status: newStatus } 
        });
        
        showToast(`Estado actualizado a: ${newStatus}`, 'success');
        await loadVenues(); // Recargar
    } catch (error) {
        // Error manejado en apiFetch
        await loadVenues(); // Restaurar botón si falla
    }
}
window.setVenueStatus = setVenueStatus;

// Cargar y mostrar usuarios
async function loadUsers() {
    try {
        allUsers = await apiFetch('get_users');
        const currentUser = APP_ADMIN_USER; // Usar la variable de sesión
        const tbody = document.getElementById('usersTable').querySelector('tbody');
        tbody.innerHTML = '';

        // Actualizar encabezado de tabla si no tiene la columna Estado
        const thead = document.getElementById('usersTable').querySelector('thead tr');
        if (thead.children.length === 6) {
             const th = document.createElement('th');
             th.textContent = 'Estado';
             thead.insertBefore(th, thead.children[5]); // Insertar antes de Acciones
        }

        allUsers.forEach((user, index) => {
            const row = tbody.insertRow(-1);
            const isAdminActual = currentUser && user.email === currentUser.email;
            const isSuspended = user.estado === 'suspendido';
            const isOtherAdmin = user.rol === 'admin' && !isAdminActual;

            row.innerHTML = `
                <td>${user.nombre}</td>
                <td>${user.email}</td>
                <td>${user.telefono || 'N/A'}</td>
                <td>${user.rol}</td>
                <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <span class="badge badge-status" style="background: ${isSuspended ? '#ef4444' : '#10b981'};">
                        ${isSuspended ? 'Suspendido' : 'Activo'}
                    </span>
                </td>
                <td>
                    ${!isOtherAdmin ? `
                    <button onclick="editUser(${index})" class="btn secondary small" style="margin-right: 5px; background: var(--blue);" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ` : `
                    <button class="btn secondary small" style="margin-right: 5px; background: #94a3b8; cursor: not-allowed;" title="No puedes editar a otro admin" disabled>
                        <i class="fas fa-edit"></i>
                    </button>
                    `}
                    ${!isAdminActual ? `
                        <button onclick="toggleUserStatus(${index})" class="btn secondary small" style="margin-right: 5px; background: ${isSuspended ? '#10b981' : '#f59e0b'};" title="${isSuspended ? 'Activar' : 'Suspender'}">
                            <i class="fas ${isSuspended ? 'fa-check' : 'fa-ban'}"></i>
                        </button>
                        <button onclick="openEmailModal(${index})" class="btn secondary small" style="margin-right: 5px; background: #8b5cf6;" title="Enviar Correo">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button onclick="deleteUser(${index})" class="delete-btn btn small" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : '<span style="color: #999; font-size: 0.85rem;">(Usuario actual)</span>'}
                </td>
            `;
        });
    } catch (error) {
        console.error("Error cargando usuarios:", error);
        document.getElementById('usersTable').querySelector('tbody').innerHTML = '<tr><td colspan="7" style="color:red;">Error al cargar usuarios.</td></tr>';
    }
}

// Eliminar usuario
async function deleteUser(index) {
    showConfirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.', async () => {
        try {
            const user = allUsers[index];
            // Doble chequeo (aunque la API también lo hace)
            if (user.email === APP_ADMIN_USER.email) {
                showToast('No puedes eliminar tu propia cuenta.', 'error');
                return;
            }
            
            // Mostrar loading en el botón
            const btn = document.querySelector(`#usersTable tbody tr:nth-child(${index + 1}) .delete-btn`);
            if(btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            await apiFetch('delete_user', { method: 'POST', body: { id: user.id } });
            showToast('Usuario eliminado correctamente', 'success');
            await loadUsers(); // Recargar
            
        } catch (error) {
            // Error manejado en apiFetch
        }
    });
}

// Abrir modal para editar usuario (Usa caché 'allUsers')
function editUser(index) {
    editingUserIndex = index;
    const user = allUsers[index];
    if (!user) return;

    document.getElementById('editUserName').value = user.nombre;
    document.getElementById('editUserEmail').value = user.email;
    
    let userPhone = user.telefono || '';
    userPhone = userPhone.replace(/^\+56\s*9\s*/, '');
    document.getElementById('editUserPhone').value = userPhone;

    document.getElementById('editUserPassword').value = ''; // Clear password field
    document.getElementById('editUserRole').value = user.rol;
    
    // Ocultar campo de contraseña si no es el usuario actual
    const passInput = document.getElementById('editUserPassword');
    const passGroup = passInput.closest('.form-group');
    if (APP_ADMIN_USER && user.email === APP_ADMIN_USER.email) {
        passGroup.style.display = 'block';
    } else {
        passGroup.style.display = 'none';
    }

    document.getElementById('editUserMsg').textContent = '';
    document.getElementById('editUserMsg').className = 'msg';
    document.getElementById('editUserModal').classList.remove('hidden');
}

// Guardar cambios del usuario editado
async function saveUserEdit() {
    if (editingUserIndex === null) return;

    const msgEl = document.getElementById('editUserMsg');
    msgEl.textContent = '';
    msgEl.className = 'msg';

    let phone = document.getElementById('editUserPhone').value.trim();
    if (phone) {
        phone = '+56 9 ' + phone;
    }

    const updatedUserData = {
        name: document.getElementById('editUserName').value.trim(),
        email: document.getElementById('editUserEmail').value.trim().toLowerCase(),
        phone: phone,
        password: document.getElementById('editUserPassword').value.trim(),
        role: document.getElementById('editUserRole').value
    };
    
    const userId = allUsers[editingUserIndex].id;

    // Validaciones
    if (!updatedUserData.name || !updatedUserData.email || !updatedUserData.phone) {
        msgEl.textContent = 'Todos los campos son obligatorios.';
        msgEl.className = 'msg error'; return;
    }
    // Password validation removed

    try {
        const submitBtn = document.querySelector('#editUserForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const result = await apiFetch('update_user_admin', {
            method: 'POST',
            body: { user: updatedUserData, id: userId }
        });

        if (result.success) {
            showToast('Usuario actualizado correctamente', 'success');
            document.getElementById('editUserModal').classList.add('hidden');
            await loadUsers(); // Recargar la tabla
            editingUserIndex = null;
        } else {
            msgEl.textContent = result.message || 'Error desconocido.';
            msgEl.className = 'msg error';
        }
    } catch (error) {
         msgEl.textContent = `Error: ${error.message}`;
         msgEl.className = 'msg error';
    } finally {
        const submitBtn = document.querySelector('#editUserForm button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Cambios';
    }
}

// Variables para filtrado de reservas
let currentReservationTab = 'pending';
let reservationSearchQuery = '';

// Variables para filtrado de reportes y mensajes
let currentReportTab = 'pending';
let currentMessageTab = 'unread';

// Cargar y mostrar solicitudes (requests)
async function loadRequests() {
    try {
        allRequests = await apiFetch('get_requests'); // API ya hace los JOINs
        
        // Normalizar estados para evitar errores de mayúsculas/minúsculas
        if (allRequests && allRequests.length > 0) {
            allRequests.forEach(req => {
                if(req.status) req.status = req.status.toLowerCase();
            });
        }
        
        // Actualizar contadores de las pestañas
        updateReservationBadges();
        
        // Renderizar tabla según filtros actuales
        renderReservations();
        
    } catch (error) {
        console.error("Error cargando solicitudes:", error);
        const tbody = document.getElementById('reservationsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="11" style="color:red; text-align: center; padding: 20px;">Error al cargar solicitudes. Verifica la conexión.</td></tr>';
        }
    }
}

// Actualizar los badges de conteo en las pestañas
function updateReservationBadges() {
    const pendingCount = allRequests.filter(r => r.status === 'pending').length;
    const activeCount = allRequests.filter(r => r.status === 'approved').length;
    const rejectedCount = allRequests.filter(r => r.status === 'rejected').length;
    const historyCount = allRequests.length;

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        const onClickAttr = tab.getAttribute('onclick');
        if (!onClickAttr) return;
        
        const match = onClickAttr.match(/'([^']+)'/);
        if (!match) return;
        
        const tabName = match[1];
        const badge = tab.querySelector('.badge-count');
        
        if (badge) {
            if (tabName === 'pending') badge.textContent = pendingCount;
            if (tabName === 'active') badge.textContent = activeCount;
            if (tabName === 'rejected') badge.textContent = rejectedCount;
            if (tabName === 'history') badge.textContent = historyCount;
        }
    });
}

// Cambiar pestaña de reservas
function switchReservationTab(tabName) {
    currentReservationTab = tabName;
    
    // Actualizar clase active
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabName}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    renderReservations();
}
window.switchReservationTab = switchReservationTab;

// Filtrar reservas por búsqueda
function filterReservations() {
    const input = document.getElementById('searchReservationInput');
    if (input) {
        reservationSearchQuery = input.value.toLowerCase().trim();
        renderReservations();
    }
}
window.filterReservations = filterReservations;

// Renderizar la tabla de reservas
function renderReservations() {
    const tbody = document.getElementById('reservationsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    let filtered = allRequests.filter(req => {
        const status = req.status ? req.status.toLowerCase() : '';

        // Filtro por Pestaña
        if (currentReservationTab === 'pending' && status !== 'pending') return false;
        if (currentReservationTab === 'active' && status !== 'approved') return false;
        if (currentReservationTab === 'rejected' && status !== 'rejected') return false;
        
        // Historial: Mostrar todo EXCEPTO pendientes (ya que tienen su propia pestaña y no son "historia" aún)
        if (currentReservationTab === 'history' && status === 'pending') return false;
        
        // Filtro por Búsqueda
        if (reservationSearchQuery) {
            const searchStr = `${req.userName} ${req.userEmail} ${req.venueName} ${req.tipo_evento} ${req.fecha_evento}`.toLowerCase();
            if (!searchStr.includes(reservationSearchQuery)) return false;
        }
        
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #666; padding: 40px;">
            <i class="fas fa-inbox" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 10px;"></i><br>
            No hay solicitudes en esta sección.
        </td></tr>`;
        return;
    }

    filtered.forEach((req) => {
        // Encontrar índice original para las acciones
        const originalIndex = allRequests.findIndex(r => r.id === req.id);
        
        const tr = document.createElement('tr');
        const statusColor = {
            'pending': '#f59e0b',
            'approved': '#10b981', 
            'rejected': '#ef4444'
        };
        
        const statusText = {
            'pending': 'Pendiente',
            'approved': 'Aprobada',
            'rejected': 'Rechazada'
        };

        tr.innerHTML = `
            <td><strong>${req.userName || 'N/A'}</strong></td>
            <td>${req.userEmail || 'N/A'}</td>
            <td>${req.userPhone || 'N/A'}</td>
            <td><span class="badge badge-event">${req.tipo_evento || 'N/A'}</span></td>
            <td><strong>${req.fecha_evento || 'N/A'}</strong></td>
            <td>${req.duracion_dias || 1} día(s)</td>
            <td>${req.hora_evento || 'N/A'}</td>
            <td><span style="color: #2563eb; font-weight: 500;">${req.venueName || 'N/A'}</span></td>
            <td>${req.invitados || 'N/A'}</td>
            <td><strong style="color: #059669;">${req.precio_total_estimado ? '$' + req.precio_total_estimado : 'N/A'}</strong></td>
            <td>
                <span class="badge badge-status" style="background: ${statusColor[req.status] || '#6b7280'}; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">
                    ${statusText[req.status] || req.status}
                </span>
            </td>
            <td>
                ${req.status === 'pending' ? `
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        <button onclick="updateRequestStatus(${originalIndex}, 'approved', this)" class="btn small" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem;" title="Aprobar">
                            <i class="fas fa-check"></i>
                        </button>
                        <button onclick="updateRequestStatus(${originalIndex}, 'rejected', this)" class="btn small" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem;" title="Rechazar">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                ` : `
                    <span style="color: #6b7280; font-size: 0.85rem; font-style: italic;">
                        ${req.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                    </span>
                `}
            </td>
        `;
        
        if (req.status === 'pending') {
            tr.classList.add('pending-request');
        }
        
        tbody.appendChild(tr);
    });
}

// Aprobar/Rechazar solicitud
async function updateRequestStatus(index, newStatus, btnElement = null) {
    const req = allRequests[index];
    if (!req) return;
    
    const actionText = newStatus === 'approved' ? 'APROBAR' : 'RECHAZAR';
    const confirmMessage = `¿Estás seguro de ${actionText} esta solicitud de ${req.userName}?`;
    
    showConfirm(confirmMessage, async () => {
        try {
            // Mostrar indicador de carga
            if (btnElement) {
                const row = btnElement.closest('tr');
                const statusCell = row.querySelector('td:last-child');
                if (statusCell) {
                    statusCell.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
                }
            }

            await apiFetch('update_request_status', {
                method: 'POST',
                body: { id: req.id, status: newStatus }
            });
            
            showToast(`Solicitud ${actionText.toLowerCase()}da correctamente`, 'success');
            
            // La API ya crea la notificación y actualiza el lugar
            await loadRequests();
            if (newStatus === 'approved') {
                await loadVenues(); // Recargar lugares solo si se aprueba
            }
        } catch (error) {
            // El error ya se muestra en apiFetch
            await loadRequests(); // Restaurar estado
        }
    });
}

// Helper para traducir el 'tipo' de reporte
function getReportTypeLabel(type) {
    return type.charAt(0).toUpperCase() + type.slice(1);
}

// Cargar y mostrar reportes
async function loadReports() {
    try {
        allReports = await apiFetch('get_reports'); // API ya ordena
        
        // Normalizar estados
        if (allReports && allReports.length > 0) {
            allReports.forEach(rep => {
                if(rep.status) rep.status = rep.status.toLowerCase();
            });
        }

        updateReportBadges();
        renderReports();
        
    } catch (error) {
         console.error("Error cargando reportes:", error);
        const tbody = document.getElementById('reportsTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center; padding: 20px;">Error al cargar reportes.</td></tr>';
    }
}

// Actualizar badges de reportes
function updateReportBadges() {
    const pendingCount = allReports.filter(r => r.status === 'pending').length;
    const resolvedCount = allReports.filter(r => r.status === 'resolved').length;

    const tabs = document.querySelectorAll('#reportes .tab-btn');
    tabs.forEach(tab => {
        const onClickAttr = tab.getAttribute('onclick');
        if (!onClickAttr) return;
        
        const match = onClickAttr.match(/'([^']+)'/);
        if (!match) return;
        
        const tabName = match[1];
        const badge = tab.querySelector('.badge-count');
        
        if (badge) {
            if (tabName === 'pending') badge.textContent = pendingCount;
            if (tabName === 'resolved') badge.textContent = resolvedCount;
        }
    });
}

// Cambiar pestaña de reportes
function switchReportTab(tabName) {
    currentReportTab = tabName;
    
    // Actualizar clase active
    document.querySelectorAll('#reportes .tab-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabName}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    renderReports();
}
window.switchReportTab = switchReportTab;

// Renderizar tabla de reportes
function renderReports() {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    let filtered = allReports.filter(rep => {
        const status = rep.status ? rep.status.toLowerCase() : 'pending';
        return status === currentReportTab;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #666; padding: 40px;">
            <i class="fas fa-check-circle" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 10px;"></i><br>
            No hay reportes ${currentReportTab === 'pending' ? 'pendientes' : 'resueltos'}.
        </td></tr>`;
        return;
    }

    filtered.forEach((report) => {
        const originalIndex = allReports.findIndex(r => r.id === report.id);
        const tr = document.createElement('tr');
        const isResolved = report.status === 'resolved';
        
        tr.innerHTML = `
            <td>${report.userName}</td>
            <td>${report.userEmail}</td>
            <td><strong>${getReportTypeLabel(report.tipo)}</strong></td>
            <td style="vertical-align: middle;">
                <button onclick="viewMessage(${originalIndex}, 'report')" class="btn" style="background-color: #3b82f6; color: white; padding: 6px 12px; border-radius: 4px; font-size: 0.9rem;">
                    <i class="fas fa-eye"></i> Ver Contenido
                </button>
            </td>
            <td>
                ${isResolved ? 
                    '<span class="badge badge-status" style="background: var(--success-color);">Resuelto</span>' : 
                    `<button onclick="openReplyModal(${originalIndex}, 'report')" class="btn small" style="background: #3b82f6; color: white;">
                        <i class="fas fa-reply"></i> Responder
                    </button>`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Cambiar estado de un reporte
async function toggleReportStatus(index) {
    try {
        const report = allReports[index];
        const newStatus = report.status === 'resolved' ? 'pending' : 'resolved';
        
        // Mostrar loading en el botón
        const btn = document.querySelector(`#reportsTable tbody tr:nth-child(${index + 1}) button[onclick*="toggleReportStatus"]`);
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        await apiFetch('update_report_status', {
            method: 'POST',
            body: { id: report.id, status: newStatus }
        });
        
        showToast('Estado del reporte actualizado', 'success');
        await loadReports();
    } catch (error) {
        // Error manejado en apiFetch
    }
}
window.toggleReportStatus = toggleReportStatus; // Exponer globalmente

// Eliminar un reporte
async function deleteReport(index) {
    showConfirm('¿Eliminar permanentemente este reporte?', async () => {
        try {
            const report = allReports[index];
            // Mostrar loading en el botón
            const btn = document.querySelector(`#reportsTable tbody tr:nth-child(${index + 1}) .delete-btn`);
            if(btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            await apiFetch('delete_report', { method: 'POST', body: { id: report.id } });
            showToast('Reporte eliminado', 'success');
            await loadReports();
        } catch (error) {
            // Error manejado en apiFetch
        }
    });
}
window.deleteReport = deleteReport;

// Cargar mensajes de contacto
async function loadMessages() {
    try {
        const response = await apiFetch('get_contacts');
        allMessages = response.data || [];
        
        updateMessageBadges();
        renderMessages();
        
    } catch (error) {
        console.error('Error cargando mensajes:', error);
        const tbody = document.getElementById('messagesTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center; padding: 20px;">Error al cargar mensajes.</td></tr>';
    }
}

// Actualizar badges de mensajes
function updateMessageBadges() {
    // Asumimos que 'leido' es 0 o 1
    const unreadCount = allMessages.filter(m => m.leido == 0).length;
    const readCount = allMessages.filter(m => m.leido == 1).length;

    const tabs = document.querySelectorAll('#mensajes .tab-btn');
    tabs.forEach(tab => {
        const onClickAttr = tab.getAttribute('onclick');
        if (!onClickAttr) return;
        
        const match = onClickAttr.match(/'([^']+)'/);
        if (!match) return;
        
        const tabName = match[1];
        const badge = tab.querySelector('.badge-count');
        
        if (badge) {
            if (tabName === 'unread') badge.textContent = unreadCount;
            if (tabName === 'read') badge.textContent = readCount;
        }
    });
}

// Cambiar pestaña de mensajes
function switchMessageTab(tabName) {
    currentMessageTab = tabName;
    
    // Actualizar clase active
    document.querySelectorAll('#mensajes .tab-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabName}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    renderMessages();
}
window.switchMessageTab = switchMessageTab;

// Renderizar tabla de mensajes
function renderMessages() {
    const tbody = document.getElementById('messagesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    let filtered = allMessages.filter(msg => {
        const isRead = msg.leido == 1;
        if (currentMessageTab === 'unread') return !isRead;
        if (currentMessageTab === 'read') return isRead;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #666; padding: 40px;">
            <i class="fas fa-envelope-open" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 10px;"></i><br>
            No hay mensajes ${currentMessageTab === 'unread' ? 'sin leer' : 'leídos'}.
        </td></tr>`;
        return;
    }

    filtered.forEach((msg) => {
        const originalIndex = allMessages.findIndex(m => m.id === msg.id);
        const tr = document.createElement('tr');
        const isReplied = msg.leido == 1;
        
        tr.innerHTML = `
            <td>${msg.created_at}</td>
            <td>${msg.nombre}</td>
            <td>${msg.email}</td>
            <td>${msg.asunto}</td>
            <td style="vertical-align: middle;">
                <button onclick="viewMessage(${originalIndex}, 'contact')" class="btn" style="background-color: #3b82f6; color: white; padding: 6px 12px; border-radius: 4px; font-size: 0.9rem;">
                    <i class="fas fa-eye"></i> Ver Contenido
                </button>
            </td>
            <td>
                ${isReplied ? 
                    '<span class="badge badge-status" style="background: var(--success-color);">Leído/Respondido</span>' : 
                    `<button onclick="openReplyModal(${originalIndex}, 'contact')" class="btn small" style="background: #3b82f6; color: white;">
                        <i class="fas fa-reply"></i> Responder
                    </button>`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Marcar mensaje como leído (sin responder)
async function markMessageAsRead(index) {
    const msg = allMessages[index];
    if (!msg) return;

    try {
        await apiFetch('mark_message_read', {
            method: 'POST',
            body: { id: msg.id }
        });
        showToast('Mensaje marcado como leído', 'success');
        await loadMessages();
    } catch (error) {
        // Error manejado
    }
}
window.markMessageAsRead = markMessageAsRead;

// Función para actualizar todo (ASÍNCRONA)
async function adminRefreshAll() {
    await loadUsers();
    await loadVenues();
    await loadRequests();
    await loadReports();
    await loadMessages();
}
window.adminRefreshAll = adminRefreshAll;

// Función para editar un lugar (Usa caché 'allVenues')
function editVenue(index) {
    const venue = allVenues[index];
    if (!venue) return;
    
    selectedVenueIndex = index; // Guardar el índice del array

    document.getElementById('venue-name').value = venue.nombre;
    document.getElementById('venue-address').value = venue.direccion;
    document.getElementById('venue-description').value = venue.descripcion || '';
    
    // Cargar datos del dueño
    document.getElementById('owner-name').value = venue.owner_nombre || '';
    
    let ownerPhone = venue.owner_telefono || '';
    // Quitar prefijo +56 9 para mostrar en el input
    ownerPhone = ownerPhone.replace(/^\+56\s*9\s*/, '');
    document.getElementById('owner-phone').value = ownerPhone;

    document.getElementById('owner-email').value = venue.owner_email || '';

    document.getElementById('venue-services').value = venue.servicios || '';
    
    // Establecer URL de imagen
    document.getElementById('venue-images').value = venue.imagen_url || ''; 
    
    document.getElementById('venue-lat').value = venue.lat;
    document.getElementById('venue-lng').value = venue.lng;
    document.getElementById('venue-capacity').value = venue.capacidad || '';
    document.getElementById('venue-base-price').value = venue.precio_base || '';
    document.getElementById('venue-price-per-guest').value = venue.precio_por_persona || '';
    
    // Trigger input event to show preview
    const imageInput = document.getElementById('venue-images');
    if (imageInput) {
        imageInput.dispatchEvent(new Event('input'));
    }

    adminMap.setCenter({ lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) });
    document.getElementById('venueForm').scrollIntoView({ behavior: 'smooth' });
}
window.editVenue = editVenue;

// Eliminar imagen de galería
async function deleteVenueImage(imgId, venueIndex) {
    if (!confirm('¿Eliminar esta imagen?')) return;
    try {
        await apiFetch('delete_venue_image', { method: 'POST', body: { id: imgId } });
        // Recargar datos y refrescar formulario
        await loadVenues();
        editVenue(venueIndex); // Volver a cargar el formulario con datos actualizados
    } catch (error) {
        console.error(error);
    }
}
window.deleteVenueImage = deleteVenueImage;

window.deleteVenue = deleteVenue;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.updateRequestStatus = updateRequestStatus;


// Función para abrir el modal de respuesta
function openReplyModal(index, type = 'contact') {
    let data;
    if (type === 'contact') {
        data = allMessages[index];
    } else if (type === 'report') {
        data = allReports[index];
        // Mapear campos de reporte a formato de mensaje si es necesario
        data.email = data.userEmail;
        data.asunto = 'Reporte: ' + getReportTypeLabel(data.tipo);
    }

    if (!data) return;

    document.getElementById('replyMessageId').value = data.id;
    document.getElementById('replyMessageType').value = type;
    document.getElementById('replyMessageEmail').value = data.email;
    document.getElementById('replyMessageSubject').value = 'Re: ' + (data.asunto || 'Consulta');
    document.getElementById('replyMessageBody').value = '';
    
    document.getElementById('replyMessageModal').classList.remove('hidden');
}
window.openReplyModal = openReplyModal;

// Suspender/Activar usuario
async function toggleUserStatus(index) {
    const user = allUsers[index];
    if (!user) return;

    const isSuspended = user.estado === 'suspendido';
    const newStatus = isSuspended ? 'activo' : 'suspendido';
    const actionText = isSuspended ? 'ACTIVAR' : 'SUSPENDER';
    
    showConfirm(`¿Estás seguro de ${actionText} al usuario ${user.nombre}?`, async () => {
        try {
            await apiFetch('toggle_user_status', {
                method: 'POST',
                body: { id: user.id, status: newStatus }
            });
            showToast(`Usuario ${newStatus === 'activo' ? 'activado' : 'suspendido'} correctamente`, 'success');
            await loadUsers();
        } catch (error) {
            // Error manejado en apiFetch
        }
    });
}
window.toggleUserStatus = toggleUserStatus;

// Abrir modal de correo directo
function openEmailModal(index) {
    const user = allUsers[index];
    if (!user) return;

    document.getElementById('emailUserTo').value = `${user.nombre} <${user.email}>`;
    document.getElementById('emailUserEmail').value = user.email;
    document.getElementById('emailUserSubject').value = '';
    document.getElementById('emailUserMessage').value = '';
    
    document.getElementById('emailUserModal').classList.remove('hidden');
}
window.openEmailModal = openEmailModal;



// --- SISTEMA DE CONFIRMACIÓN ---
let confirmCallback = null;

function showConfirm(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    const btn = document.getElementById('confirmBtn');
    
    if (!modal || !msgEl || !btn) {
        // Fallback si no existe el modal
        if(confirm(message)) onConfirm();
        return;
    }

    msgEl.textContent = message;
    confirmCallback = onConfirm;
    modal.classList.remove('hidden');
    
    // Limpiar listeners anteriores para evitar duplicados
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (confirmCallback) confirmCallback();
        confirmCallback = null;
    });

    // Listener para cancelar
    const cancelBtn = document.getElementById('cancelConfirmBtn');
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        confirmCallback = null;
    });
}

// Función para ver mensaje completo
function viewMessage(index, type) {
    let content = '';
    let title = '';
    
    if (type === 'report') {
        const report = allReports[index];
        content = `<strong>Tipo:</strong> ${getReportTypeLabel(report.tipo)}\n\n${report.mensaje}`;
        title = `Reporte de ${report.userName}`;
    } else {
        const msg = allMessages[index];
        content = `<strong>Asunto:</strong> ${msg.asunto}\n\n${msg.mensaje}`;
        title = `Mensaje de ${msg.nombre}`;
    }

    const modalTitle = document.querySelector('#viewMessageModal h3');
    if (modalTitle) {
        modalTitle.innerHTML = `<i class="fas fa-comment-alt"></i> ${title}`;
    }
    
    document.getElementById('viewMessageContent').innerHTML = content.replace(/\n/g, '<br>');
    document.getElementById('viewMessageModal').classList.remove('hidden');
}

// Hacer la función global
window.viewMessage = viewMessage;

// Cerrar modal al hacer clic fuera
document.getElementById('viewMessageModal').addEventListener('click', (e) => {
    if (e.target.id === 'viewMessageModal') {
        e.target.classList.add('hidden');
    }
});

// Función para abrir Lightbox
function openLightbox(src) {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImage');
    if (modal && img) {
        img.src = src;
        modal.classList.remove('hidden');
    }
}
window.openLightbox = openLightbox;

// Cerrar lightbox al hacer clic fuera de la imagen
document.getElementById('lightboxModal').addEventListener('click', (e) => {
    if (e.target.id === 'lightboxModal') {
        e.target.classList.add('hidden');
    }
});

// Event listener para el DOM listo
document.addEventListener('DOMContentLoaded', function() {
    
    // Listener del formulario de VENUES (Lugares)
    const venueForm = document.getElementById('venueForm');
    if (venueForm) {
        // Manejo de vista previa de imagen (URL y Archivo)
        const imageInput = document.getElementById('venue-images');
        const fileInput = document.getElementById('venue-image-file');
        const galleryContainer = document.getElementById('gallery-preview-container');
        const galleryPreview = document.getElementById('gallery-preview');

        // Vista previa de Archivo (Base64)
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                const files = this.files;
                if (files && files.length > 0) {
                    galleryPreview.innerHTML = ''; // Limpiar vista previa anterior
                    galleryContainer.style.display = 'block';
                    
                    // Limpiar URL si se selecciona archivo
                    if(imageInput) imageInput.value = '';

                    Array.from(files).forEach((file, index) => {
                        // Validar tamaño (ej: max 2MB para no saturar BD)
                        if (file.size > 2 * 1024 * 1024) {
                            alert(`La imagen "${file.name}" es muy pesada (Máx 2MB). Fue omitida.`);
                            return;
                        }

                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const div = document.createElement('div');
                            div.style.position = 'relative';
                            div.innerHTML = `
                                <img src="${e.target.result}" onclick="openLightbox('${e.target.result}')" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; border: 2px solid #10b981; cursor: pointer;" title="Ver imagen completa">
                                <span style="position: absolute; bottom: -20px; left: 0; width: 100%; text-align: center; font-size: 10px; color: #10b981;">Archivo ${index + 1}</span>
                            `;
                            galleryPreview.appendChild(div);
                        };
                        reader.readAsDataURL(file);
                    });
                }
            });
        }

        // Vista previa de URL
        if (imageInput) {
            imageInput.addEventListener('input', function() {
                const url = this.value.trim();
                // Si hay archivo, ignorar URL o limpiar archivo (aquí priorizamos lo último tocado)
                if (fileInput && fileInput.files.length > 0 && url) {
                    fileInput.value = ''; // Limpiar archivo si usuario escribe URL
                }

                galleryPreview.innerHTML = '';
                
                if (url) {
                    galleryContainer.style.display = 'block';
                    const div = document.createElement('div');
                    div.style.position = 'relative';
                    div.innerHTML = `
                        <img src="${url}" onclick="openLightbox('${url}')" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; border: 2px solid #3b82f6; cursor: pointer;" onerror="this.src='https://via.placeholder.com/100?text=Error'">
                        <span style="position: absolute; bottom: -20px; left: 0; width: 100%; text-align: center; font-size: 10px; color: #3b82f6;">URL</span>
                    `;
                    galleryPreview.appendChild(div);
                } else {
                    // Si no hay URL y no hay archivo, ocultar
                    if (!fileInput || !fileInput.files.length) {
                        galleryContainer.style.display = 'none';
                    }
                }
            });
        }

        venueForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const venueMsg = document.getElementById('venueMsg');
            venueMsg.textContent = '';
            venueMsg.className = 'msg';

            const name = document.getElementById('venue-name').value.trim();
            const address = document.getElementById('venue-address').value.trim();
            const description = document.getElementById('venue-description').value.trim();
            
            // Obtener datos del dueño
            const ownerName = document.getElementById('owner-name').value.trim();
            let ownerPhone = document.getElementById('owner-phone').value.trim();
            if (ownerPhone) {
                ownerPhone = '+56 9 ' + ownerPhone;
            }
            const ownerEmail = document.getElementById('owner-email').value.trim();

            const services = document.getElementById('venue-services').value.trim();
            const lat = parseFloat(document.getElementById('venue-lat').value);
            const lng = parseFloat(document.getElementById('venue-lng').value);
            const capacity = document.getElementById('venue-capacity').value.trim();
            const basePrice = document.getElementById('venue-base-price').value.trim();
            const pricePerGuest = document.getElementById('venue-price-per-guest').value.trim();
            
            // PROCESAR IMAGENES (URL o ARCHIVOS)
            let imageUrl = document.getElementById('venue-images').value.trim();
            const fileInput = document.getElementById('venue-image-file');
            let newImages = [];

            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                try {
                    // Convertir archivos a Base64
                    const filePromises = Array.from(fileInput.files).map(file => {
                        if (file.size > 2 * 1024 * 1024) return null; // Skip large files
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = (e) => resolve(e.target.result);
                            reader.onerror = (e) => reject(e);
                            reader.readAsDataURL(file);
                        });
                    });
                    
                    const results = await Promise.all(filePromises);
                    newImages = results.filter(img => img !== null);
                    
                    // Si hay imágenes nuevas, usamos la primera como principal si no hay URL
                    if (newImages.length > 0 && !imageUrl) {
                        imageUrl = newImages[0];
                    }

                } catch (err) {
                    venueMsg.textContent = 'Error al procesar las imágenes.';
                    venueMsg.className = 'msg error'; return;
                }
            }

            if (!name || !address || !isFinite(lat) || !isFinite(lng)) {
                venueMsg.textContent = 'Nombre, Dirección y Ubicación en mapa son requeridos.';
                venueMsg.className = 'msg error'; return;
            }

            let venue_id = null;
            if (selectedVenueIndex !== null && allVenues[selectedVenueIndex]) {
                venue_id = allVenues[selectedVenueIndex].id;
            }

            const formData = new FormData();
            formData.append('name', name);
            formData.append('address', address);
            formData.append('description', description);
            
            // Adjuntar datos del dueño
            formData.append('owner_name', ownerName);
            formData.append('owner_phone', ownerPhone);
            formData.append('owner_email', ownerEmail);

            formData.append('services', services);
            formData.append('lat', lat);
            formData.append('lng', lng);
            formData.append('capacity', capacity);
            formData.append('basePrice', basePrice);
            formData.append('pricePerGuest', pricePerGuest);
            formData.append('image_url', imageUrl); // Enviamos la principal (URL o primera Base64)
            
            // Enviar array de nuevas imágenes para la galería
            if (newImages.length > 0) {
                newImages.forEach((img, index) => {
                    formData.append(`gallery_images[${index}]`, img);
                });
            }
            
            if (venue_id) {
                formData.append('id', venue_id);
            }

            try {
                const submitBtn = venueForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

                await apiFetch('save_venue', {
                    method: 'POST',
                    body: formData
                });

                venueForm.reset();
                selectedVenueIndex = null;
                document.getElementById('venue-lat').value = '';
                document.getElementById('venue-lng').value = '';
                if (galleryContainer) galleryContainer.style.display = 'none';
                
                showToast('Lugar guardado correctamente', 'success');
                venueMsg.textContent = ''; 
                
                // Cerrar modal
                document.getElementById('venueModal').classList.add('hidden');

                await loadVenues(); 
                
            } catch (error) {
                venueMsg.textContent = `Error al guardar: ${error.message}`;
                venueMsg.className = 'msg error';
            } finally {
                const submitBtn = venueForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar Lugar';
            }
        });

        venueForm.addEventListener('reset', function() {
            selectedVenueIndex = null;
            document.getElementById('venue-lat').value = '';
            document.getElementById('venue-lng').value = '';
            document.getElementById('venueMsg').textContent = '';
            document.getElementById('venueMsg').className = 'msg';
            if (galleryContainer) galleryContainer.style.display = 'none';
        });
    }

    // Listeners para el MODAL DE USUARIO
    const editUserModal = document.getElementById('editUserModal');
    const editUserForm = document.getElementById('editUserForm');
    const closeEditUserBtn = document.getElementById('closeEditUserBtn');
    const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');

    if (editUserForm) {
        editUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveUserEdit(); // Llamar a la función de guardado
        });
    }

    [closeEditUserBtn, cancelEditUserBtn].forEach(btn => {
        if (btn && editUserModal) {
            btn.addEventListener('click', () => {
                editUserModal.classList.add('hidden');
                editingUserIndex = null;
            });
        }
    });

    // Listeners para el MODAL DE RESPUESTA
    const replyMessageModal = document.getElementById('replyMessageModal');
    const replyMessageForm = document.getElementById('replyMessageForm');
    const closeReplyModalBtn = document.getElementById('closeReplyModalBtn');
    const cancelReplyModalBtn = document.getElementById('cancelReplyModalBtn');

    if (replyMessageForm) {
        replyMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('replyMessageId').value;
            const type = document.getElementById('replyMessageType').value;
            const email = document.getElementById('replyMessageEmail').value;
            const subject = document.getElementById('replyMessageSubject').value;
            const message = document.getElementById('replyMessageBody').value;
            const btn = replyMessageForm.querySelector('button[type="submit"]');
            
            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
                
                await apiFetch('send_reply', {
                    method: 'POST',
                    body: { id, type, email, subject, message }
                });
                
                showToast('Respuesta enviada correctamente', 'success');
                replyMessageModal.classList.add('hidden');
                replyMessageForm.reset();
                
                if (type === 'report') {
                    await loadReports();
                } else {
                    await loadMessages();
                }
                
            } catch (error) {
                // Error manejado en apiFetch
            } finally {
                btn.disabled = false;
                btn.textContent = 'Enviar Respuesta';
            }
        });
    }

    [closeReplyModalBtn, cancelReplyModalBtn].forEach(btn => {
        if (btn && replyMessageModal) {
            btn.addEventListener('click', () => {
                replyMessageModal.classList.add('hidden');
            });
        }
    });

    // Listeners para el MODAL DE CORREO DIRECTO
    const emailUserModal = document.getElementById('emailUserModal');
    const emailUserForm = document.getElementById('emailUserForm');
    const closeEmailUserBtn = document.getElementById('closeEmailUserBtn');
    const cancelEmailUserBtn = document.getElementById('cancelEmailUserBtn');

    if (emailUserForm) {
        emailUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('emailUserEmail').value;
            const subject = document.getElementById('emailUserSubject').value;
            const message = document.getElementById('emailUserMessage').value;
            const btn = emailUserForm.querySelector('button[type="submit"]');
            
            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
                
                await apiFetch('send_direct_email', {
                    method: 'POST',
                    body: { email, subject, message }
                });
                
                showToast('Correo enviado correctamente', 'success');
                emailUserModal.classList.add('hidden');
                emailUserForm.reset();
                
            } catch (error) {
                // Error manejado en apiFetch
            } finally {
                btn.disabled = false;
                btn.textContent = 'Enviar Correo';
            }
        });
    }

    [closeEmailUserBtn, cancelEmailUserBtn].forEach(btn => {
        if (btn && emailUserModal) {
            btn.addEventListener('click', () => {
                emailUserModal.classList.add('hidden');
            });
        }
    });

    // Carga inicial (ya se llama desde el HTML inline)
    // if (window.adminRefreshAll) window.adminRefreshAll();
});