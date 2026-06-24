const API_URL = 'http://127.0.0.1:5000';

let selectedLat = null;
let selectedLng = null;
let tempMarker = null;
let tempFeatureLayer = null;
let selectedGeometryPoints = [];
let featureMarkers = [];
let themes = [];
let features = [];
let themeVisibility = {};
let themeLayers = {};
let queryMarker = null;
let queryCircle = null;

const availableThemeIcons = [
    'marker',
    'circle',
    'square',
    'triangle',
    'star',
    'tree'
];

const map = L.map('map').setView([41.69, -8.83], 13);

const openStreetMap = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution: '&copy; OpenStreetMap'
    }
);

const openTopoMap = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 17,
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
    }
);

openStreetMap.addTo(map);

const baseMaps = {
    'OpenStreetMap': openStreetMap,
    'OpenTopoMap': openTopoMap
};

const geoserverFeaturesWms = L.tileLayer.wms(
    'http://127.0.0.1:8080/geoserver/geoportal/wms',
    {
        layers: 'geoportal:features',
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        attribution: 'GeoServer WMS'
    }
);

geoserverFeaturesWms.addTo(map);

const geoserverAreaEstudoWms = L.tileLayer.wms(
    'http://127.0.0.1:8080/geoserver/geoportal/wms',
    {
        layers: 'geoportal:areas_estudo',
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        attribution: 'GeoServer WMS'
    }
);

geoserverAreaEstudoWms.addTo(map);

const overlayMaps = {
    'GeoServer WMS - Elementos': geoserverFeaturesWms,
    'GeoServer WMS - Area de Estudo': geoserverAreaEstudoWms
};

L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);

function getActiveModal() {
    return document.querySelector('.modal-card:not([hidden])');
}

function openModal(modalId) {
    const modalLayer = document.getElementById('modal-layer');
    const modal = document.getElementById(modalId);

    document.querySelectorAll('.modal-card').forEach(card => {
        card.hidden = true;
    });

    modalLayer.hidden = false;
    modal.hidden = false;
}

function closeModal() {
    const activeModal = getActiveModal();
    const wasFeatureModal = activeModal && activeModal.id === 'feature-modal';

    document.querySelectorAll('.modal-card').forEach(card => {
        card.hidden = true;
    });

    document.getElementById('modal-layer').hidden = true;

    if (wasFeatureModal) {
        clearSelectedGeometry();
    }
}

function isFeatureModalOpen() {
    return !document.getElementById('feature-modal').hidden;
}

function getGeometryLabel(geometryType) {
    if (geometryType === 'LineString') {
        return 'Linha';
    }

    if (geometryType === 'Polygon') {
        return 'Poligono';
    }

    return 'Ponto';
}

function setThemeGeometry(geometryType) {
    const geometrySelect = document.getElementById('theme-geometry');
    const geometryLabel = document.getElementById('field-geometry-label');

    geometrySelect.value = geometryType;

    if (geometryLabel) {
        geometryLabel.textContent = getGeometryLabel(geometryType);
    }

    document.querySelectorAll('.geometry-option').forEach(button => {
        const isSelected = button.dataset.geometry === geometryType;

        button.classList.toggle('is-selected', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
    });
}

function setThemeColor(color) {
    const colorInput = document.getElementById('theme-color');
    const iconPicker = document.querySelector('.presentation-icon-picker');

    colorInput.value = color;

    if (iconPicker) {
        iconPicker.style.setProperty('--theme-color', color);
    }
}

function normalizeThemeIcon(icon) {
    if (availableThemeIcons.includes(icon)) {
        return icon;
    }

    return 'marker';
}

function setThemeIcon(icon) {
    const normalizedIcon = normalizeThemeIcon(icon);
    const iconInput = document.getElementById('theme-icon');

    iconInput.value = normalizedIcon;

    document.querySelectorAll('.presentation-icon-option').forEach(button => {
        const isSelected = button.dataset.icon === normalizedIcon;

        button.classList.toggle('is-selected', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
    });
}

function createThemeIconElement(icon, color, className) {
    const wrapper = document.createElement('span');
    const shape = document.createElement('span');

    wrapper.className = className;
    wrapper.style.setProperty('--theme-color', color || '#2563eb');
    shape.className = `icon-shape icon-${normalizeThemeIcon(icon)}`;

    wrapper.appendChild(shape);

    return wrapper;
}

function createLeafletThemeIcon(icon, color) {
    const normalizedIcon = normalizeThemeIcon(icon);
    const iconColor = color || '#2563eb';

    return L.divIcon({
        className: 'leaflet-theme-icon-wrapper',
        html: `<span class="leaflet-theme-icon" style="--theme-color: ${iconColor}"><span class="icon-shape icon-${normalizedIcon}"></span></span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 30],
        popupAnchor: [0, -28]
    });
}

function resetQueryMode() {
    const queryMode = document.getElementById('query-mode');

    if (!queryMode.checked) {
        return;
    }

    queryMode.checked = false;
    clearQueryLayers();
    document.getElementById('query-results').innerHTML = '';
    document.getElementById('query-status').textContent =
        'Ative a consulta e clique no mapa.';
}

function isThemeVisible(themeId) {
    return themeVisibility[themeId] !== false;
}

function ensureThemeLayer(themeId) {
    if (!themeLayers[themeId]) {
        themeLayers[themeId] = L.layerGroup();
    }

    return themeLayers[themeId];
}

function clearFeatureLayers() {
    Object.values(themeLayers).forEach(layer => {
        layer.clearLayers();

        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });

    themeLayers = {};
    featureMarkers = [];
}

function syncThemeLayerVisibility(themeId) {
    const layer = themeLayers[themeId];

    if (!layer) {
        return;
    }

    if (isThemeVisible(themeId)) {
        layer.addTo(map);
    } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
    }
}

function syncAllThemeLayerVisibility() {
    themes.forEach(theme => {
        syncThemeLayerVisibility(theme.id);
    });
}

function setThemeVisibility(themeId, visible) {
    themeVisibility[themeId] = visible;
    syncThemeLayerVisibility(themeId);
}

function renderFeatureLayers() {
    clearFeatureLayers();

    features.forEach(feature => {
        const layer = ensureThemeLayer(feature.theme_id);
        const color = feature.color || '#2563eb';

        const featureLayer = L.geoJSON(feature.geometry, {
            pointToLayer: function (geoJsonFeature, latlng) {
                return L.marker(latlng, {
                    icon: createLeafletThemeIcon(feature.icon, color)
                });
            },
            style: function () {
                return {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.25,
                    weight: 3
                };
            }
        }).bindPopup(
            `<b>${feature.name}</b><br>${feature.description}`
        );

        featureLayer.addTo(layer);
        featureMarkers.push(featureLayer);
    });

    syncAllThemeLayerVisibility();
}

async function loadThemes() {
    const response = await fetch(`${API_URL}/themes`);
    themes = await response.json();

    const list = document.getElementById('theme-list');
    const featureThemeSelect = document.getElementById('feature-theme');

    list.innerHTML = '';
    featureThemeSelect.innerHTML = '';

    themes.forEach(theme => {
        if (themeVisibility[theme.id] === undefined) {
            themeVisibility[theme.id] = true;
        }

        const li = document.createElement('li');
        li.className = 'theme-item';

        const label = document.createElement('label');
        label.className = 'theme-toggle';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isThemeVisible(theme.id);
        checkbox.addEventListener('change', function () {
            setThemeVisibility(theme.id, checkbox.checked);
        });

        const icon = createThemeIconElement(theme.icon, theme.color, 'theme-symbol');

        const name = document.createElement('span');
        name.textContent = `${theme.name} (${theme.geometry_type})`;

        label.appendChild(checkbox);
        label.appendChild(icon);
        label.appendChild(name);
        li.appendChild(label);
        list.appendChild(li);

        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = theme.name;
        featureThemeSelect.appendChild(option);
    });

    syncAllThemeLayerVisibility();
}

async function loadFeatures() {
    const response = await fetch(`${API_URL}/features`);
    features = await response.json();

    renderFeatureLayers();
}

function generateFeatureName() {
    const themeSelect = document.getElementById('feature-theme');

    if (themeSelect.selectedIndex < 0) {
        return `Elemento ${features.length + 1}`;
    }

    const themeName = themeSelect.options[themeSelect.selectedIndex].text;

    return `${themeName} ${features.length + 1}`;
}

function getSelectedTheme() {
    const themeSelect = document.getElementById('feature-theme');
    const themeId = parseInt(themeSelect.value);

    return themes.find(theme => theme.id === themeId);
}

function getSelectedGeometryType() {
    const theme = getSelectedTheme();

    if (!theme) {
        return 'Point';
    }

    return theme.geometry_type;
}

function clearSelectedGeometry() {
    selectedLat = null;
    selectedLng = null;
    selectedGeometryPoints = [];

    if (tempMarker !== null) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }

    if (tempFeatureLayer !== null) {
        map.removeLayer(tempFeatureLayer);
        tempFeatureLayer = null;
    }

    document.getElementById('selected-coordinates').innerText =
        'Clique no mapa para escolher a localizacao.';
}

function updateSelectedGeometryPreview() {
    const geometryType = getSelectedGeometryType();
    const selectedCoordinates = document.getElementById('selected-coordinates');

    if (tempMarker !== null) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }

    if (tempFeatureLayer !== null) {
        map.removeLayer(tempFeatureLayer);
        tempFeatureLayer = null;
    }

    if (selectedGeometryPoints.length === 0) {
        selectedCoordinates.innerText = 'Clique no mapa para escolher a localizacao.';
        return;
    }

    if (geometryType === 'Point') {
        const point = selectedGeometryPoints[0];
        selectedLat = point.lat;
        selectedLng = point.lng;
        tempMarker = L.marker([point.lat, point.lng]).addTo(map);
        tempMarker.setIcon(createLeafletThemeIcon(getSelectedTheme()?.icon, getSelectedTheme()?.color));
        selectedCoordinates.innerText =
            `Localizacao selecionada: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
        return;
    }

    const latLngs = selectedGeometryPoints.map(point => [point.lat, point.lng]);
    const color = getSelectedTheme()?.color || '#2563eb';

    if (geometryType === 'Polygon' && latLngs.length >= 3) {
        tempFeatureLayer = L.polygon(latLngs, {
            color: color,
            fillColor: color,
            fillOpacity: 0.2
        }).addTo(map);
    } else {
        tempFeatureLayer = L.polyline(latLngs, {
            color: color,
            weight: 3
        }).addTo(map);
    }

    const label = geometryType === 'Polygon' ? 'vertice(s)' : 'ponto(s)';
    selectedCoordinates.innerText =
        `${selectedGeometryPoints.length} ${label} selecionado(s). Clique no mapa para adicionar mais.`;
}

function buildSelectedGeometry() {
    const geometryType = getSelectedGeometryType();
    const coordinates = selectedGeometryPoints.map(point => [point.lng, point.lat]);

    if (geometryType === 'Point') {
        return {
            type: 'Point',
            coordinates: coordinates[0]
        };
    }

    if (geometryType === 'LineString') {
        return {
            type: 'LineString',
            coordinates: coordinates
        };
    }

    const polygonCoordinates = coordinates.slice();
    const firstPoint = polygonCoordinates[0];
    const lastPoint = polygonCoordinates[polygonCoordinates.length - 1];

    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        polygonCoordinates.push(firstPoint);
    }

    return {
        type: 'Polygon',
        coordinates: [polygonCoordinates]
    };
}

function clearQueryLayers() {
    if (queryMarker !== null) {
        map.removeLayer(queryMarker);
        queryMarker = null;
    }

    if (queryCircle !== null) {
        map.removeLayer(queryCircle);
        queryCircle = null;
    }
}

function renderNearbyResults(data) {
    const status = document.getElementById('query-status');
    const results = document.getElementById('query-results');

    results.innerHTML = '';

    if (data.count === 0) {
        status.textContent = `Nenhum elemento encontrado num raio de ${data.radius} m.`;
        return;
    }

    status.textContent =
        `${data.count} elemento(s) encontrado(s) num raio de ${data.radius} m.`;

    data.features.forEach(feature => {
        const li = document.createElement('li');
        li.className = 'query-result-item';

        const distance = Math.round(feature.distance_m);

        const name = document.createElement('strong');
        name.textContent = feature.name;

        const details = document.createElement('span');
        details.textContent = `${feature.theme_name} - ${distance} m`;

        li.appendChild(name);
        li.appendChild(document.createElement('br'));
        li.appendChild(details);

        results.appendChild(li);
    });
}

async function searchNearbyFeatures(latlng) {
    const radiusInput = document.getElementById('query-radius');
    const radius = parseFloat(radiusInput.value) || 500;

    document.getElementById('query-status').textContent =
        'A procurar elementos no raio definido...';

    clearQueryLayers();

    queryMarker = L.marker([latlng.lat, latlng.lng]).addTo(map);
    queryCircle = L.circle([latlng.lat, latlng.lng], {
        radius: radius,
        color: '#2563eb',
        weight: 2,
        fillColor: '#93c5fd',
        fillOpacity: 0.15
    }).addTo(map);

    const params = new URLSearchParams({
        lat: latlng.lat,
        lng: latlng.lng,
        radius: radius
    });

    const response = await fetch(`${API_URL}/features/nearby?${params}`);
    const data = await response.json();

    renderNearbyResults(data);
}

map.on('click', function (event) {
    const queryMode = document.getElementById('query-mode');

    if (queryMode.checked) {
        searchNearbyFeatures(event.latlng);
        return;
    }

    if (!isFeatureModalOpen()) {
        return;
    }

    if (getSelectedGeometryType() === 'Point') {
        selectedGeometryPoints = [event.latlng];
    } else {
        selectedGeometryPoints.push(event.latlng);
    }

    updateSelectedGeometryPreview();

    const nameInput = document.getElementById('feature-name');

    if (nameInput.value.trim() === '') {
        nameInput.value = generateFeatureName();
    }
});

document
    .getElementById('feature-theme')
    .addEventListener('change', function () {
        const nameInput = document.getElementById('feature-name');

        nameInput.value = generateFeatureName();
        clearSelectedGeometry();
    });

document
    .getElementById('clear-geometry')
    .addEventListener('click', function () {
        clearSelectedGeometry();
    });

document
    .getElementById('open-theme-modal')
    .addEventListener('click', function () {
        setThemeGeometry(document.getElementById('theme-geometry').value);
        setThemeColor(document.getElementById('theme-color').value);
        setThemeIcon(document.getElementById('theme-icon').value);
        openModal('theme-modal');
    });

document
    .getElementById('open-feature-modal')
    .addEventListener('click', function () {
        if (themes.length === 0) {
            alert('Crie primeiro um tema para inserir elementos.');
            openModal('theme-modal');
            return;
        }

        resetQueryMode();
        clearSelectedGeometry();

        const nameInput = document.getElementById('feature-name');

        if (nameInput.value.trim() === '') {
            nameInput.value = generateFeatureName();
        }

        openModal('feature-modal');
    });

document
    .querySelectorAll('[data-close-modal]')
    .forEach(button => {
        button.addEventListener('click', function () {
            closeModal();
        });
    });

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !document.getElementById('modal-layer').hidden) {
        closeModal();
    }
});

document
    .querySelectorAll('.geometry-option')
    .forEach(button => {
        button.addEventListener('click', function () {
            setThemeGeometry(button.dataset.geometry);
        });
    });

document
    .getElementById('theme-color')
    .addEventListener('input', function (event) {
        setThemeColor(event.target.value);
    });

document
    .querySelectorAll('.presentation-icon-option')
    .forEach(button => {
        button.addEventListener('click', function () {
            setThemeIcon(button.dataset.icon);
        });
    });

document
    .getElementById('query-mode')
    .addEventListener('change', function (event) {
        if (event.target.checked) {
            document.getElementById('query-status').textContent =
                'Clique no mapa para procurar elementos no raio definido.';
            return;
        }

        clearQueryLayers();
        document.getElementById('query-results').innerHTML = '';
        document.getElementById('query-status').textContent =
            'Ative a consulta e clique no mapa.';
    });

document
    .getElementById('theme-form')
    .addEventListener('submit', async function (event) {
        event.preventDefault();

        const name = document.getElementById('theme-name').value;
        const geometryType = document.getElementById('theme-geometry').value;
        const color = document.getElementById('theme-color').value;
        const icon = document.getElementById('theme-icon').value;

        await fetch(`${API_URL}/themes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                geometry_type: geometryType,
                color: color,
                icon: icon
            })
        });

        document.getElementById('theme-form').reset();
        setThemeGeometry('Point');
        setThemeColor('#2563eb');
        setThemeIcon('marker');

        await loadThemes();

        closeModal();
    });

document
    .getElementById('feature-form')
    .addEventListener('submit', async function (event) {
        event.preventDefault();

        const geometryType = getSelectedGeometryType();
        const minPoints = geometryType === 'Point' ? 1 : geometryType === 'LineString' ? 2 : 3;

        if (selectedGeometryPoints.length < minPoints) {
            alert(`Selecione pelo menos ${minPoints} ponto(s) no mapa para esta geometria.`);
            return;
        }

        const themeSelect = document.getElementById('feature-theme');
        const themeId = themeSelect.value;

        let name = document.getElementById('feature-name').value;
        let description = document.getElementById('feature-description').value;

        if (name.trim() === '') {
            name = generateFeatureName();
        }

        if (description.trim() === '') {
            description = 'Sem descri\u00e7\u00e3o';
        }

        await fetch(`${API_URL}/features`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                theme_id: parseInt(themeId),
                name: name,
                description: description,
                geometry: buildSelectedGeometry()
            })
        });

        document.getElementById('feature-form').reset();

        clearSelectedGeometry();

        await loadFeatures();

        closeModal();
    });

loadThemes();
loadFeatures();
