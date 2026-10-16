/**
 * CanSat Ground Control Software - Central Application Coordinator (Orchestrator)
 * Bootstraps system modules, handles uplink timer intervals,
 * and maintains reactive UI updates for high-performance displays.
 */

import { CONFIG } from './config.js';
import { telemetryManager } from './telemetry.js';
import { telemetrySimulator } from './simulator.js';
import { chartsBoard } from './charts.js';
import { flightMap } from './map.js';
import { spatialOrientation } from './orientation.js';
import { missionControls } from './controls.js';
import { faultMonitor } from './faults.js';
import { liveCamera } from './camera.js';

class GCSApplication {
  constructor() {
    this.uplinkIntervalId = null;
    this.lastTickTime = 0;
  }

  /**
   * Bootstrap Ground Control visual frameworks and bindings
   */
  initialize() {
    // 1. Initialize Lucide Icons library render
    lucide.createIcons();

    // 2. Initialize secondary UI visual modules
    chartsBoard.initialize();
    flightMap.initialize();
    spatialOrientation.initialize();
    missionControls.initialize();
    liveCamera.initialize();

    // 3. Subscribe central UI re-drawers to Telemetry state changes
    telemetryManager.subscribe((state, peaks) => this.renderUIDisplay(state, peaks));
    
    // Wire simulation controls
    missionControls.onCommandUplink = (cmd) => this.handleCommandUplink(cmd);

    // 4. Bind Top bar operation controls
    this.bindHeaderButtons();

    // Initial state re-draw (nominal standby values)
    telemetryManager.reset();
  }

  /**
   * Binds user triggers on the top control bar
   */
  bindHeaderButtons() {
    const btnStart = document.getElementById('btn-start');
    const btnStop  = document.getElementById('btn-stop');
    const btnSync  = document.getElementById('btn-sync');
    const btnReset = document.getElementById('btn-reset');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    
    const exportCsv = document.getElementById('export-csv');
    const exportGraphs = document.getElementById('export-graphs');

    // Fullscreen operations console
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        this.toggleFullscreen(btnFullscreen);
      });
    }

    // Dynamic state listener for escaping fullscreen
    document.addEventListener('fullscreenchange', () => {
      const isFullscreen = !!document.fullscreenElement;
      if (btnFullscreen) {
        btnFullscreen.querySelector('span').textContent = isFullscreen ? "EXIT SCREEN" : "FULLSCREEN";
        btnFullscreen.querySelector('i').setAttribute('data-lucide', isFullscreen ? 'minimize' : 'maximize');
        lucide.createIcons();
      }
    });

    // Start Uplink
    btnStart.addEventListener('click', () => {
      if (this.uplinkIntervalId) return;

      this.startTelemetryLoop();
      
      btnStart.classList.add('disabled');
      btnStart.disabled = true;
      btnStop.classList.remove('disabled');
      btnStop.disabled = false;
    });

    // Stop Uplink
    btnStop.addEventListener('click', () => {
      if (!this.uplinkIntervalId) return;

      this.stopTelemetryLoop();
      
      btnStop.classList.add('disabled');
      btnStop.disabled = true;
      btnStart.classList.remove('disabled');
      btnStart.disabled = false;
    });

    // Reset buffer
    btnReset.addEventListener('click', () => {
      this.resetGCSSystem();
      missionControls.log("GROUND: Commands packet buffers flushed. Visual registries reset.", "text-muted");
    });

    // Sync clocks
    btnSync.addEventListener('click', () => {
      const pcTime = telemetryManager.syncTime();
      const timeStr = new Date(pcTime).toLocaleTimeString();
      missionControls.log(`GROUND: Avionics internal chronometer synched to PC Time [${timeStr}].`, "text-cyan");
    });

    // CSV Log download trigger
    exportCsv.addEventListener('click', (e) => {
      e.preventDefault();
      const csvData = telemetryManager.exportToCSV();
      if (!csvData) {
        missionControls.log("EXPORT: Cannot compile CSV logs. Aggregated history is empty.", "text-warning");
        return;
      }

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `CANSAT_TELEMETRY_LOG_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      missionControls.log("EXPORT: Telemetry log (.CSV) compiled and downloaded.", "text-success");
    });

    // Graphs captures trigger
    exportGraphs.addEventListener('click', (e) => {
      e.preventDefault();
      missionControls.log("EXPORT: Capturing real-time plot boards...", "text-white");
      chartsBoard.exportGraphImages();
      missionControls.log("EXPORT: Graphs capture PNGs dispatched.", "text-success");
    });
  }

  /**
   * Setup interval timer running at configuration Hz rates
   */
  startTelemetryLoop() {
    telemetrySimulator.reset();
    telemetryManager.start();
    
    this.lastTickTime = performance.now();
    const tickMs = 1000 / CONFIG.TELEMETRY_RATE_HZ;

    this.uplinkIntervalId = setInterval(() => {
      const now = performance.now();
      const dt = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;

      // Generate simulated sensors reading packet
      const packet = telemetrySimulator.generateTick(dt);
      
      // Feed packet into state aggregations manager
      telemetryManager.ingest(packet);
    }, tickMs);

    missionControls.log("GROUND: Ground uplink sequence active on 433.5 MHz carrier.", "text-success");
    missionControls.log("ALERTS: Ingesting active CanSat telemetry packets...", "text-cyan");
  }

  /**
   * Clear telemetry generation loops
   */
  stopTelemetryLoop() {
    if (this.uplinkIntervalId) {
      clearInterval(this.uplinkIntervalId);
      this.uplinkIntervalId = null;
    }
    telemetryManager.stop();
    missionControls.log("GROUND: Telemetry downlink halted. Communications link STANDBY.", "text-warning");
  }

  /**
   * Resets all visual parameters back to pre-launch defaults
   */
  resetGCSSystem() {
    this.stopTelemetryLoop();

    // Reset Simulator & State Manager
    telemetrySimulator.reset();
    telemetryManager.reset();

    // Reset Components
    chartsBoard.reset();
    flightMap.reset();
    spatialOrientation.reset();
    faultMonitor.reset();
    missionControls.resetSliders();

    // Re-enable start buttons
    const btnStart = document.getElementById('btn-start');
    const btnStop  = document.getElementById('btn-stop');
    btnStart.classList.remove('disabled');
    btnStart.disabled = false;
    btnStop.classList.add('disabled');
    btnStop.disabled = true;

    // Reset Auxiliary switch in controls
    const btnAux = document.getElementById('btn-redundant-active');
    btnAux.className = "cmd-action-btn font-mono";
    btnAux.querySelector('span').textContent = "ENGAGE AUX CIRCUIT";
  }

  /**
   * Safe HTML5 Fullscreen API wrapper for console immersion
   */
  toggleFullscreen(btn) {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        missionControls.log("GROUND: Fullscreen command console enabled.", "text-cyan");
      }).catch(err => {
        missionControls.log(`GROUND: Fullscreen trigger rejected: ${err.message}`, "text-warning");
      });
    } else {
      document.exitFullscreen().then(() => {
        missionControls.log("GROUND: Fullscreen command console closed.", "text-muted");
      });
    }
  }

  /**
   * Updates state trackers when commands successfully execute
   */
  handleCommandUplink(command) {
    if (command === 'separation') {
      telemetryManager.state.separationExecuted = true;
    }
  }

  /**
   * Main DOM Renderer mapping central data state into HTML cards
   */
  renderUIDisplay(state, peaks) {
    // 1. Top bar time & flight phase status updates
    document.getElementById('mission-time').textContent = this.formatMET(state.missionTimeSec);
    document.getElementById('packet-count').textContent = state.packetNumber.toString().padStart(6, '0');
    document.getElementById('current-phase').textContent = state.phase;

    // Phase color categorization style triggers
    const phaseLabel = document.getElementById('current-phase');
    if (state.phase === 'ASCENT') {
      phaseLabel.className = 'counter-val text-cyan animate-pulse';
    } else if (state.phase === 'DEPLOYMENT') {
      phaseLabel.className = 'counter-val text-warning animate-pulse';
    } else if (state.phase === 'DESCENT') {
      phaseLabel.className = 'counter-val text-orange';
    } else if (state.phase === 'LANDING') {
      phaseLabel.className = 'counter-val text-success';
    } else {
      phaseLabel.className = 'counter-val text-muted';
    }

    // Comm Health Indicator (fades RSSI signal quality)
    const commHealth = document.getElementById('comm-health-indicator');
    const commHealthText = commHealth.querySelector('.status-text');
    const commHealthDot = commHealth.querySelector('.status-dot');

    if (!state.isReceiving) {
      commHealth.className = "mission-status-pill connection-status";
      commHealthText.textContent = "COMM LINK STANDBY (0%)";
      commHealthDot.className = "status-dot red";
    } else if (state.rssi < -100) {
      commHealth.className = "mission-status-pill connection-status active";
      commHealthText.textContent = "COMM LINK CRITICAL (12%)";
      commHealthDot.className = "status-dot red animate-pulse";
    } else if (state.rssi < -78) {
      commHealth.className = "mission-status-pill connection-status active";
      commHealthText.textContent = "COMM LINK DEGRADED (55%)";
      commHealthDot.className = "status-dot amber";
    } else {
      commHealth.className = "mission-status-pill connection-status active";
      commHealthText.textContent = "COMM LINK STABLE (100%)";
      commHealthDot.className = "status-dot green";
    }

    // 2. Numerical Readouts Card Updates (Flashing pulse animation updates)
    this.updateCardText('telem-altitude', state.altitude.toFixed(1));
    this.updateCardText('telem-descent-rate', state.descentRate.toFixed(1));
    this.updateCardText('telem-pressure', state.pressure.toFixed(2));
    this.updateCardText('telem-temp', state.temperature.toFixed(1));
    this.updateCardText('telem-voltage', state.voltage.toFixed(2));
    this.updateCardText('telem-rssi', `${state.rssi}`);
    
    this.updateCardText('max-altitude', peaks.maxAltitude.toFixed(1));
    this.updateCardText('max-descent', peaks.maxDescentRate.toFixed(1));
    this.updateCardText('min-pressure', peaks.minPressure.toFixed(1));
    this.updateCardText('max-temp', peaks.maxTemperature.toFixed(1));
    this.updateCardText('min-voltage', peaks.minVoltage.toFixed(2));

    const packetLossPct = peaks.totalExpectedPackets > 0 
      ? ((peaks.lostPackets / peaks.totalExpectedPackets) * 100).toFixed(0) 
      : "0";
    this.updateCardText('packet-loss', `${packetLossPct}%`);

    // Payload Cards Updates
    this.updateCardText('telem-pitch', state.pitch.toFixed(1));
    this.updateCardText('telem-roll', state.roll.toFixed(1));
    this.updateCardText('telem-yaw', state.yaw.toFixed(1));
    this.updateCardText('telem-lat', `${state.latitude.toFixed(6)}° N`);
    this.updateCardText('telem-lon', `${state.longitude.toFixed(6)}° E`);
    this.updateCardText('telem-satellites', state.satellites.toString());

    // Navigation and Flight Metrics displays
    this.updateCardText('metric-range', `${state.groundRange.toFixed(2)} m`);
    this.updateCardText('metric-azimuth', `${state.azimuth.toFixed(1)}° N`);
    this.updateCardText('metric-apogee', state.apogeeReached ? "YES (1000m)" : "NO");

    // Container / Payload Uplink pill pulses
    const containerStatus = document.getElementById('container-status');
    const payloadStatus = document.getElementById('payload-status');
    
    if (state.isReceiving) {
      containerStatus.className = "status-pulse-pill";
      if (state.separationExecuted) {
        payloadStatus.className = "status-pulse-pill";
        payloadStatus.querySelector('span:last-child').textContent = "SEPARATED";
      } else {
        payloadStatus.className = "status-pulse-pill";
        payloadStatus.querySelector('span:last-child').textContent = "DOCKED";
      }
    } else {
      containerStatus.className = "status-pulse-pill inactive";
      payloadStatus.className = "status-pulse-pill inactive";
      payloadStatus.querySelector('span:last-child').textContent = "DOCKED";
    }

    // 3. Delegate state packets to nested drawing elements
    chartsBoard.update(state);
    flightMap.update(state);
    spatialOrientation.update(state);
    faultMonitor.update(state);
    liveCamera.updateHUD(state);
  }

  /**
   * Helper that updates a DOM node text and triggers a brief visual scale flash pulse
   */
  updateCardText(id, newText) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const prevText = el.textContent;
    if (prevText !== newText) {
      el.textContent = newText;
      
      // Trigger card pulse flash animation (only when telemetry loop is actively running)
      if (telemetryManager.state.isReceiving) {
        const card = el.closest('.telemetry-card');
        if (card) {
          card.classList.add('flash-update');
          setTimeout(() => card.classList.remove('flash-update'), 150);
        }
      }
    }
  }

  /**
   * Formats raw decimal seconds into standardized H:M:S.d chronometer string
   */
  formatMET(sec) {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = Math.floor(sec % 60);
    const tenths = Math.floor((sec % 1) * 10);

    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    
    return `${hh}:${mm}:${ss}.${tenths}`;
  }
}

// Bootstrap on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  const app = new GCSApplication();
  app.initialize();
});
