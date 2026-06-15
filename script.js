// Initialize Map centered on West Borneo (Kalimantan Barat)
// Coordinates roughly: 0.2787° S, 111.4753° E
const map = L.map('map', {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false
}).setView([-0.2787, 111.4753], 7);

// Add Dark Theme Tile Layer (CartoDB Dark Matter)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

function formatDistrictId(name) {
    const isKota = name.toLowerCase().includes("pontianak") || name.toLowerCase().includes("singkawang");
    const prefix = isKota ? "kota" : "kabupaten";
    return `${prefix}-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

// Fetch real prediction from our Cloudflare Edge API
async function fetchPrediction(districtName) {
    const districtId = formatDistrictId(districtName);
    try {
        const res = await fetch(`/api/predict?district=${districtId}`);
        if (!res.ok) throw new Error("API failed");
        const data = await res.json();
        
        let riskLevel = 'Rendah';
        let riskColor = '#22c55e'; // Green
        let riskPercentage = data.prediction?.confidence || 0;
        
        if (data.prediction?.risk_level === 'High') {
            if (riskPercentage >= 80) {
                riskLevel = 'Ekstrem';
                riskColor = '#ef4444'; // Red
            } else {
                riskLevel = 'Tinggi';
                riskColor = '#f97316'; // Orange
            }
        } else if (data.prediction?.risk_level === 'Medium') {
            riskLevel = 'Sedang';
            riskColor = '#eab308'; // Yellow
        }

        return {
            cases: `${riskPercentage}% Risiko`, 
            riskLevel: riskLevel,
            riskColor: riskColor
        };
    } catch (e) {
        console.error("Prediction failed for", districtId, e);
        return {
            cases: "?",
            riskLevel: "Loading/Error",
            riskColor: "#6b7280"
        };
    }
}

// Clean up district name from GeoJSON properties
function getDistrictName(properties) {
    let name = properties.NAME_2 || properties.KABKOT || properties.Kabupaten || "Tidak Diketahui";
    // Remove "Kota " or "Kabupaten " from the beginning (case insensitive)
    return name.replace(/^(Kota|Kabupaten)\s+/i, '').trim();
}

// Global variable to store mock data mapped by district name
const districtData = {};
let totalCasesCounter = 0;
let extremeHotspotsCounter = 0;

// Style function for GeoJSON layer
function styleFeature(feature) {
    const data = districtData[getDistrictName(feature.properties)];
    const fillColor = data ? data.riskColor : '#3b82f6';

    return {
        fillColor: fillColor,
        weight: 2,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.3
    };
}

// Highlight feature on hover
function highlightFeature(e) {
    const layer = e.target;

    layer.setStyle({
        weight: 3,
        color: '#fff',
        fillOpacity: 0.8
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    // Update UI panels
    updateDistrictStats(layer.feature);
}

// Reset highlight on mouseout
function resetHighlight(e) {
    geojsonLayer.resetStyle(e.target);
    clearDistrictStats();
}

// Update the side panel with district stats
function updateDistrictStats(feature) {
    const districtName = getDistrictName(feature.properties);
    const data = districtData[districtName];

    const districtNameEl = document.getElementById('districtName');
    const districtStatsEl = document.getElementById('districtStats');
    const riskLevelEl = document.getElementById('riskLevel');
    const recentCasesEl = document.getElementById('recentCases');

    districtNameEl.textContent = districtName;
    
    if (data) {
        riskLevelEl.textContent = data.riskLevel;
        riskLevelEl.style.color = data.riskColor;
        recentCasesEl.textContent = data.cases;
        districtStatsEl.classList.add('active');
    }

    // Highlight in list
    document.querySelectorAll('.list-item').forEach(item => {
        if (item.dataset.district === districtName) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

function clearDistrictStats() {
    const districtNameEl = document.getElementById('districtName');
    const districtStatsEl = document.getElementById('districtStats');
    
    districtNameEl.textContent = 'Arahkan kursor ke area peta';
    districtStatsEl.classList.remove('active');

    // Remove list highlight
    document.querySelectorAll('.list-item').forEach(item => {
        item.classList.remove('active');
    });
}

function renderDistrictList() {
    const listEl = document.getElementById('districtList');
    listEl.innerHTML = ''; // clear

    // Sort alphabetically
    const sortedDistricts = Object.keys(districtData).sort();

    sortedDistricts.forEach(name => {
        const data = districtData[name];
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.district = name;
        const isKota = name.toLowerCase().includes("pontianak") || name.toLowerCase().includes("singkawang");
        const typeText = isKota ? "Kota" : "Kabupaten";
        const badgeClass = isKota ? "badge-kota" : "badge-kab";

        item.innerHTML = `
            <div class="list-item-info">
                <span class="district-badge ${badgeClass}">${typeText}</span>
                <span class="list-item-name">${name}</span>
            </div>
            <span class="list-item-cases" style="color: ${data.riskColor}">${data.cases}</span>
        `;
        listEl.appendChild(item);
    });
}

// Add event listeners to each feature
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
    });

    const districtName = getDistrictName(feature.properties);
    
    // Create permanent label
    layer.bindTooltip(districtName, {
        className: 'district-label',
        direction: 'center',
        permanent: true,
        interactive: false
    });
}

// GeoJSON layer reference
let geojsonLayer;

// Fetch and load GeoJSON data
async function loadGeoJSON() {
    try {
        // Using a reliable raw github url for Indonesia Kabupaten level map
        const response = await fetch('https://raw.githubusercontent.com/TheMaggieSimpson/IndonesiaGeoJSON/master/kota-kabupaten.json');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        // Filter for Kalimantan Barat features
        // Look for property that indicates West Borneo. Usually ID_1=14 or PROVINSI="KALIMANTAN BARAT"
        const kalbarFeatures = data.features.filter(f => {
            const props = f.properties;
            // Convert all property values to uppercase string to search for kalimantan barat
            const values = Object.values(props).map(v => String(v).toUpperCase());
            return values.some(v => v.includes('KALIMANTAN BARAT'));
        });

        const kalbarGeoJSON = {
            type: "FeatureCollection",
            features: kalbarFeatures
        };

        // Fetch live predictions for all districts concurrently
        document.getElementById('districtName').textContent = "Loading Predictions...";
        
        const fetchPromises = kalbarFeatures.map(async f => {
            const districtName = getDistrictName(f.properties);
            const prediction = await fetchPrediction(districtName);
            districtData[districtName] = prediction;
            
            if (prediction.riskLevel === 'Ekstrem' || prediction.riskLevel === 'Tinggi') {
                extremeHotspotsCounter++;
            }
        });

        await Promise.all(fetchPromises);
        document.getElementById('districtName').textContent = "Arahkan kursor ke area peta";

        // Render the full district list
        renderDistrictList();

        // Update overall stats panel
        document.getElementById('totalCases').textContent = "14"; // 14 districts tracking
        document.getElementById('activeHotspots').textContent = extremeHotspotsCounter;

        // Add to map
        geojsonLayer = L.geoJSON(kalbarGeoJSON, {
            style: styleFeature,
            onEachFeature: onEachFeature
        }).addTo(map);

        // Fit map bounds with padding adjusted for desktop (left panel) vs mobile (split screen)
        const isMobile = window.innerWidth <= 768;
        map.fitBounds(geojsonLayer.getBounds(), {
            paddingTopLeft: isMobile ? [10, 10] : [330, 10], // Shift right on desktop
            paddingBottomRight: isMobile ? [10, 10] : [10, 10] // Normal padding on mobile
        });

    } catch (error) {
        console.error('Error loading GeoJSON:', error);
        
        // Fallback or error state
        document.getElementById('districtName').textContent = "Error loading map data.";
        document.getElementById('districtName').style.color = "var(--risk-extreme)";
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    loadGeoJSON();
});
