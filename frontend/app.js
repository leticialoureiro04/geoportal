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

const overlayMaps = {
    'GeoServer WMS - Elementos': geoserverFeaturesWms
};

L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);

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
                return L.marker(latlng);
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

        const color = document.createElement('span');
        color.className = 'theme-color';
        color.style.backgroundColor = theme.color;

        const name = document.createElement('span');
        name.textContent = `${theme.name} (${theme.geometry_type})`;

        label.appendChild(checkbox);
        label.appendChild(color);
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

        await fetch(`${API_URL}/themes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                geometry_type: geometryType,
                color: color
            })
        });

        document.getElementById('theme-form').reset();

        await loadThemes();
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
    });

loadThemes();
loadFeatures();
