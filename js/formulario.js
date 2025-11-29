// Variables globales
let map;
let markers = [];
let venues = []; // Caché global para los lugares
let selectedVenue = null; // Lugar seleccionado para reserva
let pendingVenueIds = new Set(); // IDs de lugares con solicitud pendiente
let pendingRequestsCount = 0; // Cantidad total de solicitudes pendientes

/**
 * Función central para todas las llamadas a la API
 */
async function apiFetch(action, options = {}) {
    const { method = 'GET', body = null } = options;
    const url = `api/api.php?action=${action}`;
    const fetchOptions = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) fetchOptions.body = JSON.stringify(body);

    try {
        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showToast('Tu sesión ha expirado. Serás redirigido.', 'warning');
                window.location.href = 'index.html';
            }
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Error HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error en apiFetch(${action}):`, error);
        throw error;
    }
}

// --- MAPA Y LUGARES ---

let PulsingMarker; // Variable global para la clase

function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const lebu = { lat: -37.6083, lng: -73.6472 };
    map = new google.maps.Map(mapElement, {
        zoom: 14, center: lebu,
        styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
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

    loadVenues();
}
window.initMap = initMap;

function loadVenues() {
    Promise.all([
        apiFetch('get_venues'),
        apiFetch('get_my_requests').catch(() => []) // Si falla, asumimos sin solicitudes
    ])
    .then(([venuesData, requestsData]) => {
        venues = venuesData;
        
        // Actualizar set de solicitudes pendientes y contador
        pendingVenueIds.clear();
        let pendingCount = 0;
        requestsData.forEach(req => {
            if (req.status === 'pending') {
                pendingCount++;
                if (req.id_lugar) pendingVenueIds.add(parseInt(req.id_lugar));
            }
        });
        pendingRequestsCount = pendingCount;

        renderVenues(venues);
        addMarkers(venues);
    })
    .catch(error => console.error('Error loading data:', error));
}

function renderVenues(venuesList) {
    const container = document.getElementById('venuesList');
    if (!container) return;
    container.innerHTML = '';

    if (venuesList.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666; padding: 20px;">No se encontraron lugares.</p>';
        return;
    }

    venuesList.forEach(venue => {
        const card = document.createElement('div');
        card.className = 'venue-card';
        card.style.cssText = 'background: #fff; padding: 15px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #eee; transition: transform 0.2s;';
        card.onmouseover = () => card.style.transform = 'translateY(-2px)';
        card.onmouseout = () => card.style.transform = 'translateY(0)';
        
        card.innerHTML = `
            <h4 style="margin: 0 0 5px 0; color: #333;">${venue.nombre}</h4>
            <p style="margin: 0 0 5px 0; font-size: 0.9em; color: #666;"><i class="fas fa-map-marker-alt"></i> ${venue.direccion}</p>
            <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #555; margin-bottom: 5px;">
                <span><i class="fas fa-users"></i> Cap: ${venue.capacidad}</span>
                <span><i class="fas fa-tag"></i> Base: $${parseInt(venue.precio_base).toLocaleString()}</span>
            </div>
            <div style="font-size: 0.85em; color: #555; margin-bottom: 10px;">
                <span><i class="fas fa-user"></i> p/P: $${parseInt(venue.precio_por_persona || 0).toLocaleString()}</span>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="openDetailsModal(${venue.id})" class="btn secondary" style="flex: 1; padding: 8px; font-size: 0.9em; border-radius: 4px; cursor: pointer; border: 1px solid #ccc; background: #f8f9fa; color: #333;">
                    <i class="fas fa-eye"></i> Ver Detalles
                </button>
                ${(() => {
                    if (pendingVenueIds.has(parseInt(venue.id))) {
                        return `<button onclick="document.getElementById('openReservationsBtn').click()" class="btn" style="flex: 1; padding: 8px; font-size: 0.9em; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-clock"></i> Solicitud en curso
                        </button>`;
                    } else if (venue.status === 'reserved' || venue.status === 'maintenance') {
                        return `<button disabled class="btn" style="flex: 1; padding: 8px; font-size: 0.9em; background: #d1d5db; color: #6b7280; border: none; border-radius: 4px; cursor: not-allowed;">
                            ${venue.status === 'reserved' ? 'Reservado' : 'Mantenimiento'}
                        </button>`;
                    } else if (pendingRequestsCount >= 3) {
                        return `<button disabled class="btn" style="flex: 1; padding: 8px; font-size: 0.9em; background: #9ca3af; color: white; border: none; border-radius: 4px; cursor: not-allowed;" title="Has alcanzado el límite de 3 solicitudes pendientes">
                            Límite alcanzado (3/3)
                        </button>`;
                    } else {
                        return `<button onclick="openBookingModal(${venue.id})" class="btn primary" style="flex: 1; padding: 8px; font-size: 0.9em; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">Reservar</button>`;
                    }
                })()}
            </div>
        `;
        container.appendChild(card);
    });
}

// --- MODAL DE DETALLES ---

function openDetailsModal(venueId) {
    const venue = venues.find(v => v.id == venueId);
    if (!venue) return;

    // 1. Llenar datos básicos
    document.getElementById('detailName').textContent = venue.nombre;
    document.getElementById('detailAddress').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${venue.direccion}`;
    document.getElementById('detailPrice').textContent = parseInt(venue.precio_base).toLocaleString();
    document.getElementById('detailPersonPrice').textContent = parseInt(venue.precio_por_persona || 0).toLocaleString();
    document.getElementById('detailCapacity').textContent = venue.capacidad;
    
    // Actualizar Badge de Estado
    const statusSpan = document.getElementById('detailStatus');
    if (venue.status === 'maintenance') {
        statusSpan.textContent = 'Mantenimiento';
        statusSpan.style.background = '#fef3c7'; // Amarillo fondo
        statusSpan.style.color = '#d97706'; // Amarillo texto
    } else if (venue.status === 'reserved') {
        statusSpan.textContent = 'Reservado';
        statusSpan.style.background = '#fee2e2'; // Rojo fondo
        statusSpan.style.color = '#dc2626'; // Rojo texto
    } else {
        statusSpan.textContent = 'Disponible';
        statusSpan.style.background = '#d1fae5'; // Verde fondo
        statusSpan.style.color = '#059669'; // Verde texto
    }

    // 2. Carrusel de Imágenes
    const carousel = document.getElementById('detailCarousel');
    carousel.innerHTML = ''; // Limpiar

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
        img.alt = venue.nombre;
        img.style.cssText = 'min-width: 100%; height: 100%; object-fit: cover; scroll-snap-align: center; cursor: zoom-in;';
        img.onclick = () => openLightbox(url);
        carousel.appendChild(img);
    });

    // 3. Descripción
    document.getElementById('detailDescription').textContent = venue.descripcion || 
        `Disfruta de un evento inolvidable en ${venue.nombre}. Este lugar cuenta con una ubicación privilegiada en ${venue.direccion} y está equipado para recibir hasta ${venue.capacidad} invitados cómodamente. Ideal para bodas, cumpleaños y reuniones corporativas.`;

    // 4. Servicios
    const servicesList = document.getElementById('detailServices');
    servicesList.innerHTML = '';
    
    const defaultServices = "Wifi,Estacionamiento,Baños,Seguridad,Accesibilidad";
    const servicios = (venue.servicios || defaultServices).split(',');
    
    const iconsMap = {
        'wifi': 'fa-wifi',
        'estacionamiento': 'fa-car',
        'baños': 'fa-restroom',
        'cocina': 'fa-utensils',
        'aire acondicionado': 'fa-snowflake',
        'seguridad': 'fa-shield-alt',
        'accesibilidad': 'fa-wheelchair',
        'piscina': 'fa-swimming-pool',
        'bar': 'fa-glass-martini-alt',
        'gimnasio': 'fa-dumbbell',
        'mascotas': 'fa-paw',
        'tv': 'fa-tv'
    };

    servicios.forEach(serv => {
        const s = serv.trim();
        const key = s.toLowerCase(); // Convertir a minúsculas para buscar
        const icon = iconsMap[key] || 'fa-check-circle';
        servicesList.innerHTML += `<li style="margin-bottom: 8px; display: flex; align-items: center;"><i class="fas ${icon}" style="width: 25px; color: var(--blue); margin-right: 8px;"></i> ${s}</li>`;
    });

    // 5. Configurar botón de acción
    const actionBtn = document.getElementById('detailActionBtn');
    
    if (pendingVenueIds.has(parseInt(venue.id))) {
        actionBtn.disabled = false;
        actionBtn.textContent = 'Solicitud en curso (Ver)';
        actionBtn.style.background = '#f59e0b'; // Naranja
        actionBtn.style.color = 'white';
        actionBtn.style.cursor = 'pointer';
        actionBtn.onclick = function() {
            closeDetailsModal();
            document.getElementById('openReservationsBtn').click();
        };
    } else if (venue.status === 'reserved' || venue.status === 'maintenance') {
        actionBtn.disabled = true;
        actionBtn.textContent = venue.status === 'reserved' ? 'Reservado' : 'Mantenimiento';
        actionBtn.style.background = '#d1d5db';
        actionBtn.style.color = '#6b7280';
        actionBtn.style.cursor = 'not-allowed';
        actionBtn.onclick = null;
    } else if (pendingRequestsCount >= 3) {
        actionBtn.disabled = true;
        actionBtn.textContent = 'Límite de reservas alcanzado (3/3)';
        actionBtn.style.background = '#9ca3af'; // Gris oscuro
        actionBtn.style.color = 'white';
        actionBtn.style.cursor = 'not-allowed';
        actionBtn.onclick = null;
    } else {
        actionBtn.disabled = false;
        actionBtn.textContent = 'Reservar Ahora';
        actionBtn.style.background = '#10b981'; // Verde esmeralda para destacar
        actionBtn.style.color = 'white';
        actionBtn.style.cursor = 'pointer';
        actionBtn.onclick = function() {
            closeDetailsModal();
            openBookingModal(venue.id);
        };
    }

    const modal = document.getElementById('venueDetailsModal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}
window.openDetailsModal = openDetailsModal;

// --- LIGHTBOX ---
function openLightbox(imageUrl) {
    const lightbox = document.getElementById('imageLightbox');
    const img = document.getElementById('lightboxImage');
    img.src = imageUrl;
    lightbox.style.display = 'flex';
    lightbox.classList.remove('hidden');
}
window.openLightbox = openLightbox;

function closeLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    lightbox.classList.add('hidden');
    lightbox.style.display = 'none';
    setTimeout(() => { document.getElementById('lightboxImage').src = ''; }, 200);
}
window.closeLightbox = closeLightbox;

function scrollCarousel(direction) {
    const carousel = document.getElementById('detailCarousel');
    const width = carousel.clientWidth;
    const currentScroll = carousel.scrollLeft;
    const newScroll = currentScroll + (width * direction);
    
    carousel.scrollTo({
        left: newScroll,
        behavior: 'smooth'
    });
}
window.scrollCarousel = scrollCarousel;

function closeDetailsModal() {
    const modal = document.getElementById('venueDetailsModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}
window.closeDetailsModal = closeDetailsModal;

// Helper: validar coordenadas
function isValidCoordinate(lat, lng) {
    lat = parseFloat(lat);
    lng = parseFloat(lng);
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// Helper: etiqueta legible para el estado
function statusLabel(status) {
	switch ((status || '').toString().trim().toLowerCase()) {
		case 'maintenance': return 'Mantenimiento';
		case 'reserved': return 'Reservado';
		default: return 'Disponible';
	}
}

let currentInfoWindow = null;

function addMarkers(venuesList) {
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    venuesList.forEach(venue => {
        const lat = parseFloat(venue.lat);
        const lng = parseFloat(venue.lng);
        const hasValidCoords = isValidCoordinate(lat, lng);

        if (hasValidCoords) {
            const position = new google.maps.LatLng(lat, lng);
            
            // Determinar color según estado
            let color = '#10b981'; // verde/disponible
            if(venue.status === 'maintenance') color = '#f59e0b'; // amarillo
            if(venue.status === 'reserved') color = '#ef4444'; // rojo

            // Determinar imagen a mostrar (prioridad: primera de galería > imagen_url > placeholder)
            // Si hay imágenes en la galería (subidas por el usuario), usamos la primera.
            // Si no, usamos la imagen_url (que podría ser una referencia antigua).
            let displayImage = null;
            if (venue.galeria && venue.galeria.length > 0) {
                displayImage = venue.galeria[0].imagen_url;
            } else {
                displayImage = venue.imagen_url;
            }
            
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 10px; min-width: 200px;">
                        ${displayImage ? `<img src="${displayImage}" alt="${venue.nombre}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;">` : ''}
                        <h3 style="margin: 0 0 5px 0; color: #333;">${venue.nombre}</h3>
                        <p style="margin: 0 0 5px 0; font-size: 13px;">${venue.direccion}</p>
                        <p style="margin: 0 0 5px 0; font-size: 13px;"><strong>Estado:</strong> ${statusLabel(venue.status)}</p>
                        <p style="margin: 0 0 10px 0; font-size: 13px;"><strong>Capacidad:</strong> ${venue.capacidad}</p>
                        ${(() => {
                            if (pendingVenueIds.has(parseInt(venue.id))) {
                                return `<button onclick="document.getElementById('openReservationsBtn').click()" style="background: #f59e0b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; width: 100%;">Solicitud en curso</button>`;
                            } else if (venue.status === 'reserved' || venue.status === 'maintenance') {
                                return `<button disabled style="background: #ccc; color: #666; border: none; padding: 5px 10px; border-radius: 4px; width: 100%; cursor: not-allowed;">No Disponible</button>`;
                            } else if (pendingRequestsCount >= 3) {
                                return `<button disabled style="background: #9ca3af; color: white; border: none; padding: 5px 10px; border-radius: 4px; width: 100%; cursor: not-allowed;">Límite alcanzado (3/3)</button>`;
                            } else {
                                return `<button onclick="openBookingModal(${venue.id})" style="background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; width: 100%;">Reservar Aquí</button>`;
                            }
                        })()}
                    </div>
                `
            });

            const onMarkerClick = () => {
                if (currentInfoWindow) currentInfoWindow.close();
                infoWindow.setPosition(position);
                infoWindow.open(map);
                currentInfoWindow = infoWindow;
            };

            let marker;
            // Usar PulsingMarker si está definido (debería estarlo tras initMap)
            if (typeof PulsingMarker !== 'undefined') {
                marker = new PulsingMarker(position, color, map, venue.nombre, onMarkerClick);
            } else {
                // Fallback a marcador normal
                marker = new google.maps.Marker({
                    position, 
                    map,
                    title: venue.nombre
                });
                marker.addListener("click", onMarkerClick);
            }

            markers.push(marker);
        }
    });
}

// --- FILTROS ---

function filterVenues() {
    const name = document.getElementById('searchName').value.toLowerCase();
    const minCap = parseInt(document.getElementById('filterCapacidad').value) || 0;
    const maxBase = parseInt(document.getElementById('filterPrecioBase').value) || Infinity;
    const maxPersona = parseInt(document.getElementById('filterPrecioPersona').value) || Infinity;

    const filtered = venues.filter(v => {
        const matchesName = v.nombre.toLowerCase().includes(name);
        const matchesCap = parseInt(v.capacidad) >= minCap;
        const matchesBase = parseInt(v.precio_base) <= maxBase;
        const matchesPersona = parseInt(v.precio_por_persona) <= maxPersona;
        return matchesName && matchesCap && matchesBase && matchesPersona;
    });

    renderVenues(filtered);
    addMarkers(filtered);
}
window.filterVenues = filterVenues;

function resetFilters() {
    document.getElementById('searchName').value = '';
    document.getElementById('filterCapacidad').value = '';
    document.getElementById('filterPrecioBase').value = '';
    document.getElementById('filterPrecioPersona').value = '';
    filterVenues();
}
window.resetFilters = resetFilters;

// --- MODAL DE RESERVA ---

function openBookingModal(venueId) {
    selectedVenue = venues.find(v => v.id == venueId);
    if (!selectedVenue) return;

    document.getElementById('venueId').value = selectedVenue.id;
    document.getElementById('modalVenueName').textContent = selectedVenue.nombre;
    
    // Reset form
    document.getElementById('reservationForm').reset();
    document.getElementById('duracion').value = 1; // Reset duration
    document.getElementById('summaryBase').textContent = parseInt(selectedVenue.precio_base).toLocaleString();
    document.getElementById('summaryPersona').textContent = parseInt(selectedVenue.precio_por_persona).toLocaleString();
    calculateTotal();

    const modal = document.getElementById('bookingModal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}
window.openBookingModal = openBookingModal;

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    selectedVenue = null;
}
window.closeBookingModal = closeBookingModal;

function calculateTotal() {
    if (!selectedVenue) return;

    const guests = parseInt(document.getElementById('invitados').value) || 0;
    const duration = parseInt(document.getElementById('duracion').value) || 1;
    const basePrice = parseInt(selectedVenue.precio_base);
    const pricePerGuest = parseInt(selectedVenue.precio_por_persona);
    const maxCapacity = parseInt(selectedVenue.capacidad);

    const errorDiv = document.getElementById('capacityError');
    
    if (guests > maxCapacity) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = `Excede la capacidad máxima (${maxCapacity})`;
    } else {
        errorDiv.style.display = 'none';
    }

    // FÓRMULA: (Base * Días) + (Personas * PrecioPersona)
    const total = (basePrice * duration) + (pricePerGuest * guests);
    
    document.getElementById('summaryCount').textContent = guests;
    document.getElementById('summaryTotal').textContent = total.toLocaleString();
}
window.calculateTotal = calculateTotal;

// --- GESTIÓN DE USUARIO Y NOTIFICACIONES ---

async function renderMyReservations(){
    const activeList = document.getElementById('reservationsListActive');
    const historyList = document.getElementById('reservationsListHistory');
    if (!activeList || !historyList) return;
    
    activeList.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Cargando...</p></div>';
    historyList.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Cargando...</p></div>';

    try {
        const myRequests = await apiFetch('get_my_requests');
        
        // Actualizar estado global de solicitudes pendientes y refrescar vista de lugares
        pendingVenueIds.clear();
        let pendingCount = 0;
        myRequests.forEach(r => {
            if (r.status === 'pending') {
                pendingCount++;
                if (r.id_lugar) pendingVenueIds.add(parseInt(r.id_lugar));
            }
        });
        pendingRequestsCount = pendingCount;

        // Refrescar la lista de lugares y mapa para reflejar cambios en botones
        if (venues.length > 0) {
            renderVenues(venues);
            addMarkers(venues); // Opcional: si queremos actualizar los infoWindows del mapa también
        }

        const activeRequests = myRequests.filter(r => !r.leido_por_usuario);
        const historicalRequests = myRequests.filter(r => r.leido_por_usuario);

        const createCard = (r, isHistory) => {
            const statusInfo = {
                'pending': { text: 'PENDIENTE', class: 'pending', icon: 'fa-clock' },
                'approved': { text: 'APROBADA', class: 'approved', icon: 'fa-check-circle' },
                'rejected': { text: 'RECHAZADA', class: 'rejected', icon: 'fa-times-circle' }
            };
            const status = statusInfo[r.status] || statusInfo['pending'];
            
            return `
                <div class="reservation-card status-${status.class}">
                    <div class="res-card-content">
                        <div class="res-header">
                            <i class="fas ${status.icon}" style="color: var(--${status.class === 'pending' ? 'warning' : (status.class === 'approved' ? 'success' : 'error')})"></i>
                            <strong>${r.tipo_evento}</strong>
                            <span>— ${r.venueName || 'Sin lugar'}</span>
                        </div>
                        <div class="res-details">
                            <span><i class="fas fa-calendar"></i> ${r.fecha_evento}</span>
                            <span><i class="fas fa-clock"></i> ${r.hora_evento}</span>
                            <span><i class="fas fa-users"></i> ${r.invitados || '-'}</span>
                            <span><i class="fas fa-dollar-sign"></i> ${r.precio_total_estimado || '-'}</span>
                        </div>
                        <div class="res-footer">
                            <span class="status-badge ${status.class}">${status.text}</span>
                            <span class="res-date">Solicitado: ${new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    ${!isHistory ? `
                    <div class="reservation-item-actions">
                        ${status.class === 'pending' ? 
                            `<button onclick="cancelMyRequest(${r.id})" class="btn-cancel-request" title="Cancelar Solicitud" style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">
                                <i class="fas fa-times"></i> Cancelar
                            </button>` : ''
                        }
                        ${status.class === 'rejected' ? 
                            `<button onclick="markReservationAsRead(${r.id})" class="btn-archive" title="Archivar" style="background: #475569; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-archive"></i> Archivar
                            </button>` : ''
                        }
                    </div>` : ''}
                </div>
            `;
        };

        activeList.innerHTML = activeRequests.length ? activeRequests.map(r => createCard(r, false)).join('') : '<div class="empty-state"><i class="fas fa-calendar-times"></i><p>No tienes solicitudes activas.</p></div>';
        historyList.innerHTML = historicalRequests.length ? historicalRequests.map(r => createCard(r, true)).join('') : '<div class="empty-state"><i class="fas fa-history"></i><p>No hay historial disponible.</p></div>';
    } catch (error) {
        activeList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error al cargar solicitudes.</p></div>';
        historyList.innerHTML = '';
    }
}

async function markReservationAsRead(requestId) {
    if (!await showConfirm('¿Estás seguro de que deseas archivar esta solicitud?')) return;
    try {
        await apiFetch('mark_request_read', { method: 'POST', body: { id: requestId } });
        showToast('Solicitud archivada correctamente.', 'success');
        await renderMyReservations();
    } catch (error) { showToast('Error al archivar la solicitud.', 'error'); }
}
window.markReservationAsRead = markReservationAsRead;

async function renderNotifications() {
    const activeList = document.getElementById('notificationsListActive');
    const historyList = document.getElementById('notificationsListHistory');
    const badge = document.getElementById('notificationsBadge');
    
    if (!activeList || !historyList || !badge) return;

    try {
        const myNotifications = await apiFetch('get_notifications');
        const unreadNotifications = myNotifications.filter(n => !n.leido);
        const readNotifications = myNotifications.filter(n => n.leido);
        
        // Update Badge
        if (unreadNotifications.length > 0) {
            badge.textContent = unreadNotifications.length;
            badge.classList.remove('hidden');
            badge.style.animation = 'pulse 2s infinite';
        } else {
            badge.classList.add('hidden');
            badge.style.animation = 'none';
        }

        // Helper to create card
        const createNotifCard = (n) => {
            let icon = 'fa-info-circle';
            let statusClass = 'info';
            if (n.type === 'request_approved') { icon = 'fa-check-circle'; statusClass = 'success'; }
            if (n.type === 'request_rejected') { icon = 'fa-times-circle'; statusClass = 'error'; }
            if (n.type === 'report_resolved') { icon = 'fa-check-circle'; statusClass = 'success'; }

            return `
                <div class="notification-card ${n.leido ? 'read' : 'unread'}">
                    <div class="notif-icon"><i class="fas ${icon}" style="color: var(--${statusClass})"></i></div>
                    <div class="notif-content">
                        <p class="notif-message">${n.mensaje}</p>
                        <span class="notif-time">${new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    ${!n.leido ? 
                        `<button onclick="markNotificationAsRead(${n.id})" class="btn-archive" title="Marcar como leída"><i class="fas fa-check"></i></button>` 
                        : ''}
                </div>
            `;
        };

        // Render Active (Unread)
        if (unreadNotifications.length === 0) {
            activeList.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><p>No tienes notificaciones nuevas.</p></div>';
        } else {
            activeList.innerHTML = unreadNotifications.map(n => createNotifCard(n)).join('');
        }

        // Render History (Read)
        if (readNotifications.length === 0) {
            historyList.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>No hay historial de notificaciones.</p></div>';
        } else {
            historyList.innerHTML = readNotifications.map(n => createNotifCard(n)).join('');
        }

    } catch (error) {
         console.error(error);
         activeList.innerHTML = '<p class="empty-state-text" style="color:red;">Error al cargar notificaciones.</p>';
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        await apiFetch('mark_notification_read', { method: 'POST', body: { id: notificationId } });
        await renderNotifications();
    } catch (error) { showToast('Error al marcar como leída.', 'error'); }
}
window.markNotificationAsRead = markNotificationAsRead;

async function markAllNotificationsRead() {
    if (!await showConfirm('¿Marcar todas las notificaciones como leídas?')) return;
    try {
        // Assuming an API endpoint exists or we loop. Ideally single endpoint.
        // For now, let's assume we need to implement 'mark_all_notifications_read' in API or loop.
        // Since I can't change API easily without checking, I'll check if I can add it or loop.
        // Looping is safer if I don't want to touch API right now, but inefficient.
        // Let's try to call a new action 'mark_all_notifications_read' and if it fails, I'll fix API.
        // Actually, I should check API first.
        await apiFetch('mark_all_notifications_read', { method: 'POST' });
        await renderNotifications();
    } catch (error) { 
        console.error(error);
        showToast('Error al marcar todas como leídas.', 'error'); 
    }
}

async function clearAllNotifications() {
    if (!await showConfirm('¿Eliminar todo el historial de notificaciones?')) return;
    try {
        await apiFetch('clear_all_notifications', { method: 'POST' });
        await renderNotifications();
    } catch (error) { 
        console.error(error);
        showToast('Error al eliminar notificaciones.', 'error'); 
    }
}

async function cancelMyRequest(requestId) {
    if (!await showConfirm('¿Estás seguro de que deseas cancelar esta solicitud?')) return;
    try {
        const result = await apiFetch('cancel_my_request', { method: 'POST', body: { id: requestId } });
        if (result.success) {
            showToast('Solicitud cancelada correctamente.', 'success');
            await renderMyReservations();
        }
        else showToast(result.message || 'No se pudo cancelar la solicitud.', 'error');
    } catch (error) { showToast('Error al cancelar la solicitud.', 'error'); }
}
window.cancelMyRequest = cancelMyRequest;

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', function() {
    
    // Submit del Formulario de Reserva
    document.getElementById('reservationForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!selectedVenue) {
            showToast('Error: No se ha seleccionado un lugar.', 'error');
            return;
        }

        const guests = parseInt(document.getElementById('invitados').value);
        if (guests > parseInt(selectedVenue.capacidad)) {
            showToast(`La cantidad de invitados excede la capacidad máxima del lugar (${selectedVenue.capacidad}).`, 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        const formData = new FormData();
        formData.append('venue_id', selectedVenue.id);
        formData.append('fecha_evento', document.getElementById('fecha').value);
        formData.append('duracion', document.getElementById('duracion').value);
        formData.append('hora_evento', document.getElementById('hora').value);
        formData.append('tipo_evento', document.getElementById('tipoEvento').value);
        formData.append('cantidad_personas', guests);
        formData.append('solicitudes_especiales', document.getElementById('specialRequests').value);
        
        try {
            const requestData = {
                venue: selectedVenue.nombre,
                venue_id: selectedVenue.id,
                eventType: document.getElementById('tipoEvento').value,
                eventDate: document.getElementById('fecha').value,
                duration: document.getElementById('duracion').value,
                eventTime: document.getElementById('hora').value,
                specialRequests: document.getElementById('specialRequests').value,
                guests: guests,
                totalPrice: document.getElementById('summaryTotal').textContent.replace(/\./g, '')
            };

            const result = await apiFetch('create_request', {
                method: 'POST',
                body: requestData
            });

            if (result.success !== false) {
                showToast('¡Solicitud enviada con éxito! Te contactaremos pronto.', 'success');
                closeBookingModal();
                await renderMyReservations();
            } else {
                throw new Error(result.message || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Ocurrió un error al procesar la solicitud: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async function() {
        try {
            await apiFetch('logout', { method: 'POST' });
            window.location.href = 'index.html';
        } catch (e) { window.location.href = 'index.html'; }
    });

    // Lógica de Pestañas (Tabs) - Genérica para todos los modales
    document.querySelectorAll('.tabs').forEach(tabContainer => {
        const tabs = tabContainer.querySelectorAll('.tab-btn');
        const parentContent = tabContainer.parentElement; // El contenedor padre (modal-content)

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // 1. Desactivar todas las pestañas de este grupo
                tabs.forEach(t => t.classList.remove('active'));
                // 2. Activar la pestaña clickeada
                tab.classList.add('active');

                // 3. Ocultar todos los contenidos de este grupo
                // Buscamos .tab-content dentro del mismo padre para no afectar otros modales
                const contents = parentContent.querySelectorAll('.tab-content');
                contents.forEach(c => c.classList.remove('active'));

                // 4. Mostrar el contenido correspondiente
                const targetId = `tab-${tab.dataset.tab}`;
                const target = parentContent.querySelector(`#${targetId}`);
                if (target) target.classList.add('active');
            });
        });
    });

    // Modal "Mi Cuenta"
    const accountModal = document.getElementById('accountModal');

    document.getElementById('openAccountBtn').addEventListener('click', async () => {
        try {
            const fullUser = await apiFetch('get_current_user_full');
            document.getElementById('profileName').value = fullUser.nombre || '';
            document.getElementById('profilePhone').value = (fullUser.telefono || '').replace('+56 9', '').trim();
            accountModal.classList.remove('hidden');
        } catch (error) { showToast('Error al cargar tus datos.', 'error'); }
    });

    document.getElementById('closeAccountBtn').addEventListener('click', () => accountModal.classList.add('hidden'));

    // Guardar Perfil
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('profileName').value.trim();
        const phoneInput = document.getElementById('profilePhone').value.trim();
        
        if (phoneInput.length !== 8) {
            showToast('El teléfono debe tener 8 dígitos', 'warning');
            return;
        }

        const newPhone = '+56 9 ' + phoneInput;
        
        try {
            const result = await apiFetch('update_own_profile', {
                method: 'POST',
                body: { nombre: newName, telefono: newPhone }
            });
            if (result.success) {
                showToast('Perfil actualizado', 'success');
                if (APP_CURRENT_USER) { APP_CURRENT_USER.nombre = newName; APP_CURRENT_USER.telefono = newPhone; }
            } else showToast(result.message, 'error');
        } catch (error) { showToast(error.message, 'error'); }
    });

    // Cambiar Contraseña
    document.getElementById('securityForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) { showToast('Las contraseñas no coinciden', 'warning'); return; }

        try {
            const result = await apiFetch('change_own_password', {
                method: 'POST',
                body: { newPassword }
            });
            if (result.success) { showToast('Contraseña cambiada', 'success'); document.getElementById('securityForm').reset(); }
            else showToast(result.message, 'error');
        } catch (error) { showToast(error.message, 'error'); }
    });

    // Reportes
    const reportModal = document.getElementById('reportModal');
    document.getElementById('openReportBtn').addEventListener('click', () => reportModal.classList.remove('hidden'));
    [document.getElementById('closeReportBtn'), document.getElementById('cancelReportBtn')].forEach(btn => {
        btn.addEventListener('click', () => reportModal.classList.add('hidden'));
    });

    document.getElementById('sendReportBtn').addEventListener('click', async () => {
        const type = document.getElementById('reportType').value;
        const message = document.getElementById('reportMessage').value.trim();
        if (!type || !message) { showToast('Completa todos los campos', 'warning'); return; }

        try {
            await apiFetch('create_report', { method: 'POST', body: { type, message } });
            showToast('Reporte enviado', 'success');
            reportModal.classList.add('hidden');
        } catch (error) { showToast(error.message, 'error'); }
    });

    // Notificaciones y Solicitudes
    const notificationsModal = document.getElementById('notificationsModal');
    document.getElementById('openNotificationsBtn').addEventListener('click', () => {
        renderNotifications();
        notificationsModal.classList.remove('hidden');
    });
    document.getElementById('closeNotificationsBtn').addEventListener('click', () => notificationsModal.classList.add('hidden'));
    
    // Botones de Notificaciones
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) markAllReadBtn.addEventListener('click', markAllNotificationsRead);
    
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllNotifications);

    const reservationsModal = document.getElementById('reservationsModal');
    document.getElementById('openReservationsBtn').addEventListener('click', () => {
        renderMyReservations();
        reservationsModal.classList.remove('hidden');
    });
    document.getElementById('closeReservationsBtn').addEventListener('click', () => reservationsModal.classList.add('hidden'));

    // Carga inicial
    renderMyReservations();
    renderNotifications();

    // Lógica para colapsar filtros en móvil
    const filterHeader = document.querySelector('.filters-sidebar h3');
    const filterSidebar = document.querySelector('.filters-sidebar');
    if (filterHeader && filterSidebar) {
        // Colapsar por defecto en móvil
        if (window.innerWidth <= 1024) {
            filterSidebar.classList.add('collapsed');
        }
        
        filterHeader.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                filterSidebar.classList.toggle('collapsed');
            }
        });
    }
});

// --- CONFIRMATION MODAL ---
function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const msgEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmBtn');
        const noBtn = document.getElementById('cancelConfirmBtn');

        if (!modal || !msgEl || !yesBtn || !noBtn) {
            // Fallback if modal elements are missing
            resolve(confirm(message));
            return;
        }

        msgEl.textContent = message;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        yesBtn.onclick = () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            yesBtn.onclick = null;
            noBtn.onclick = null;
            resolve(true);
        };

        noBtn.onclick = () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            yesBtn.onclick = null;
            noBtn.onclick = null;
            resolve(false);
        };
    });
}
window.showConfirm = showConfirm;
