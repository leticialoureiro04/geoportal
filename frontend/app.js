const API_URL = 'http://127.0.0.1:5000';

let selectedLat = null;
let selectedLng = null;
let tempMarker = null;
let featureMarkers = [];
let themes = [];
let features = [];
let themeVisibility = {};
let themeLayers = {};

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

        const marker = L.marker([feature.lat, feature.lng])
            .bindPopup(
                `<b>${feature.name}</b><br>${feature.description}`
            );

        marker.addTo(layer);
        featureMarkers.push(marker);
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

map.on('click', function (event) {
    selectedLat = event.latlng.lat;
    selectedLng = event.latlng.lng;

    document.getElementById('selected-coordinates').innerText =
        `Localiza\u00e7\u00e3o selecionada: ${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`;

    if (tempMarker !== null) {
        map.removeLayer(tempMarker);
    }

    tempMarker = L.marker([selectedLat, selectedLng]).addTo(map);

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

        if (selectedLat === null || selectedLng === null) {
            alert('Primeiro clique no mapa para escolher a localiza\u00e7\u00e3o.');
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
                lat: selectedLat,
                lng: selectedLng
            })
        });

        document.getElementById('feature-form').reset();

        document.getElementById('selected-coordinates').innerText =
            'Clique no mapa para escolher a localiza\u00e7\u00e3o.';

        selectedLat = null;
        selectedLng = null;

        if (tempMarker !== null) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }

        await loadFeatures();
    });

loadThemes();
loadFeatures();
