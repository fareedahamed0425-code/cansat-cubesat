/**
 * CanSat Ground Control Software - GPS Trajectory Tracker Map
 * Visualizes orbital flight path trajectories using Leaflet.js
 */

import { CONFIG } from './config.js';

class FlightMap {
  constructor() {
    this.map = null;
    this.marker = null;
    this.groundStationMarker = null;
    this.trajectoryPath = null;
    this.pathCoordinates = [];
    this.autoCenter = true;
  }

  /**
   * Initialize Map container, load dark operational tiling layers
   */
  initialize() {
    // Center initially on Ground Station coordinates (Sriharikota)
    this.map = L.map('map-container', {
      center: [CONFIG.GROUND_STATION.LATITUDE, CONFIG.GROUND_STATION.LONGITUDE],
      zoom: 16,
      zoomControl: true,
      attributionControl: false
    });

    // Base map tile layers for rich lookability and high accessibility
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    // Default to Satellite View which offers magnificent geographic details for the aerospace base
    satelliteLayer.addTo(this.map);

    // Group the layers for toggle control
    const baseLayers = {
      "Satellite View": satelliteLayer,
      "Dark Tactical": darkLayer,
      "Standard Street": streetLayer
    };

    // Add Layer selector at top right to switch dynamically
    L.control.layers(baseLayers, null, {
      position: 'topright',
      collapsed: true
    }).addTo(this.map);

    // Custom SVG Marker icon representing CanSat Beacon
    const cansatIconSvg = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="rgba(14, 165, 233, 0.15)" stroke="#0ea5e9" stroke-width="1"/>
        <circle cx="12" cy="12" r="4" fill="#0ea5e9"/>
        <circle cx="12" cy="12" r="10" stroke="#0ea5e9" stroke-dasharray="2,2" class="marker-pulse-ring"/>
      </svg>
    `;

    const cansatIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: cansatIconSvg,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    // Ground Station Icon SVG
    const gsIconSvg = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="2" width="8" height="14" rx="1" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="1.5"/>
        <line x1="12" y1="16" x2="12" y2="22" stroke="#10b981" stroke-width="2"/>
        <line x1="8" y1="22" x2="16" y2="22" stroke="#10b981" stroke-width="2"/>
        <circle cx="12" cy="7" r="2" fill="#10b981"/>
      </svg>
    `;

    const gsIcon = L.divIcon({
      className: 'custom-gs-marker',
      html: gsIconSvg,
      iconSize: [24, 24],
      iconAnchor: [12, 22]
    });

    // Plant Ground Station
    this.groundStationMarker = L.marker([CONFIG.GROUND_STATION.LATITUDE, CONFIG.GROUND_STATION.LONGITUDE], {
      icon: gsIcon
    }).addTo(this.map).bindPopup(`
      <div style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #f1f5f9; background: #0e121a; border: 1px solid #1e2633; padding: 6px;">
        <strong>GS ID: ${CONFIG.GROUND_STATION.NAME}</strong><br>
        LAT: ${CONFIG.GROUND_STATION.LATITUDE.toFixed(5)}<br>
        LON: ${CONFIG.GROUND_STATION.LONGITUDE.toFixed(5)}
      </div>
    `);

    // Plant initially docked CanSat Marker
    this.marker = L.marker([CONFIG.GROUND_STATION.LATITUDE, CONFIG.GROUND_STATION.LONGITUDE], {
      icon: cansatIcon
    }).addTo(this.map);

    // Setup trajectory vector path line (solid cyan with aerospace look)
    this.trajectoryPath = L.polyline([], {
      color: '#0ea5e9',
      weight: 2,
      opacity: 0.85,
      dashArray: '3, 4'
    }).addTo(this.map);
  }

  /**
   * Ingests GPS telemetry updates, moving beacons and drawing trajectory path history
   * @param {Object} state - TelemetryManager state structure
   */
  update(state) {
    const lat = state.latitude;
    const lon = state.longitude;

    const newPosition = [lat, lon];
    
    // Move marker
    this.marker.setLatLng(newPosition);

    // Save path history and extend polyline
    if (state.isReceiving && state.packetNumber > 0) {
      this.pathCoordinates.push(newPosition);
      this.trajectoryPath.setLatLngs(this.pathCoordinates);
    }

    // Auto-center map viewport on payload
    if (this.autoCenter && state.isReceiving) {
      this.map.panTo(newPosition, { animate: true, duration: 0.2 });
    }

    // Update bottom map coordinate headers
    document.getElementById('map-telem-coords').textContent = `${lat.toFixed(6)}° N, ${lon.toFixed(6)}° E`;
    document.getElementById('map-sat-count').textContent = `${state.satellites} LOCK`;
    
    const satIndicator = document.getElementById('map-sat-count');
    if (state.satellites < CONFIG.THRESHOLDS.GPS_LOCK_ACCURACY) {
      satIndicator.className = "text-danger animate-pulse";
    } else {
      satIndicator.className = "text-white";
    }
  }

  /**
   * Toggle auto-centering flag
   */
  toggleAutoCenter() {
    this.autoCenter = !this.autoCenter;
    return this.autoCenter;
  }

  /**
   * Resets trajectory routes and moves beacons back to Ground Station launcher
   */
  reset() {
    this.pathCoordinates = [];
    if (this.trajectoryPath) {
      this.trajectoryPath.setLatLngs([]);
    }
    
    const launchPad = [CONFIG.GROUND_STATION.LATITUDE, CONFIG.GROUND_STATION.LONGITUDE];
    if (this.marker) {
      this.marker.setLatLng(launchPad);
    }
    if (this.map) {
      this.map.setView(launchPad, 16, { animate: true });
    }
    
    document.getElementById('map-telem-coords').textContent = `0.0000° N, 0.0000° E`;
    document.getElementById('map-sat-count').textContent = `0 LOCK`;
  }
}

export const flightMap = new FlightMap();
export default flightMap;
