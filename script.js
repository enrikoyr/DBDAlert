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
    // Set all cases to 0 for backend setup preparation
    const cases = 0;
    
    let riskLevel = 'Rendah';
    let riskColor = '#22c55e'; // Green
    
    if (cases > 100) {
        riskLevel = 'Ekstrem';
        riskColor = '#ef4444'; // Red
    } else if (cases > 50) {
        riskLevel = 'Tinggi';
        riskColor = '#f97316'; // Orange
    } else if (cases > 20) {
        riskLevel = 'Sedang';
        riskColor = '#eab308'; // Yellow
    }

    return {
        cases: cases,
        riskLevel: riskLevel,
        riskColor: riskColor
    };
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
            <span class="list-item-cases" style="color: ${data.riskColor}">${data.cases} kasus</span>
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

        // Initialize mock data for each district
        kalbarFeatures.forEach(f => {
            const districtName = getDistrictName(f.properties);
            const mock = generateMockData(districtName);
            districtData[districtName] = mock;
            
            totalCasesCounter += mock.cases;
            if (mock.riskLevel === 'Ekstrem' || mock.riskLevel === 'Tinggi') {
                extremeHotspotsCounter++;
            }
        });

        // Render the full district list
        renderDistrictList();

        // Update overall stats panel
        document.getElementById('totalCases').textContent = totalCasesCounter;
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

// Fetch and load rivers and lakes GeoJSON
async function loadWaterBodies() {
    try {
        // Fetching water bodies from a local GeoJSON. 
        // This is much faster than querying Overpass API from the browser.
        const response = await fetch('data/kalbar_water.geojson');
        if (!response.ok) throw new Error('Water bodies GeoJSON not found');
        
        const data = await response.json();
        
        L.geoJSON(data, {
            style: function(feature) {
                return {
                    color: '#3b82f6', // Bright blue for water
                    weight: feature.geometry.type === 'LineString' ? 2 : 1,
                    opacity: 0.8,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.4
                };
            },
            interactive: false // Don't trigger hover events on water
        }).addTo(map);

    } catch (error) {
        console.warn('Could not load water bodies:', error);
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    loadGeoJSON();
    loadWaterBodies();
});
