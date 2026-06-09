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

// Mock Data Generator
// Generates random mock dengue case data for districts
function generateMockData(districtName) {
    // Generate a random number of cases between 0 and 150
    const cases = Math.floor(Math.random() * 150);
    
    let riskLevel = 'Low';
    let riskColor = '#22c55e'; // Green
    
    if (cases > 100) {
        riskLevel = 'Extreme';
        riskColor = '#ef4444'; // Red
    } else if (cases > 50) {
        riskLevel = 'High';
        riskColor = '#f97316'; // Orange
    } else if (cases > 20) {
        riskLevel = 'Medium';
        riskColor = '#eab308'; // Yellow
    }

    return {
        cases: cases,
        riskLevel: riskLevel,
        riskColor: riskColor
    };
}

// Global variable to store mock data mapped by district name
const districtData = {};
let totalCasesCounter = 0;
let extremeHotspotsCounter = 0;

// Style function for GeoJSON layer
function styleFeature(feature) {
    const data = districtData[feature.properties.NAME_2 || feature.properties.KABKOT || feature.properties.Kabupaten || "Unknown"];
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
    const districtName = feature.properties.NAME_2 || feature.properties.KABKOT || feature.properties.Kabupaten || "Unknown District";
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
}

function clearDistrictStats() {
    const districtNameEl = document.getElementById('districtName');
    const districtStatsEl = document.getElementById('districtStats');
    
    districtNameEl.textContent = 'Hover over a district';
    districtStatsEl.classList.remove('active');
}

// Add event listeners to each feature
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
    });

    const districtName = feature.properties.NAME_2 || feature.properties.KABKOT || feature.properties.Kabupaten || "Unknown";
    
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

        // Initialize mock data for each district
        kalbarFeatures.forEach(f => {
            const districtName = f.properties.NAME_2 || f.properties.KABKOT || f.properties.Kabupaten || "Unknown";
            const mock = generateMockData(districtName);
            districtData[districtName] = mock;
            
            totalCasesCounter += mock.cases;
            if (mock.riskLevel === 'Extreme' || mock.riskLevel === 'High') {
                extremeHotspotsCounter++;
            }
        });

        // Update overall stats panel
        document.getElementById('totalCases').textContent = totalCasesCounter;
        document.getElementById('activeHotspots').textContent = extremeHotspotsCounter;

        // Add to map
        geojsonLayer = L.geoJSON(kalbarGeoJSON, {
            style: styleFeature,
            onEachFeature: onEachFeature
        }).addTo(map);

        // Fit map bounds to the geojson layer and set max bounds
        map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
        map.setMaxBounds(geojsonLayer.getBounds());

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
