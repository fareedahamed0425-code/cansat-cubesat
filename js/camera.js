/**
 * CanSat Ground Control Software - Live Surveillance Camera & Overlay HUD
 * Captures user MediaDevices video streams and watermarks live telemetry details.
 */

import { missionControls } from './controls.js';

class LiveCamera {
  constructor() {
    this.videoElement = null;
    this.deviceSelect = null;
    this.activeStream = null;
    
    // FPS tracking variables
    this.fpsCounter = null;
    this.frameCount = 0;
    this.lastFpsUpdate = 0;
    this.fpsAnimationId = null;
    
    // Overlay HUD DOM Nodes
    this.hudNodes = {
      alt: null,
      descent: null,
      azimuth: null,
      voltage: null,
      state: null,
      timestamp: null
    };
  }

  /**
   * Initialize DOM elements and queries camera source enumerations
   */
  initialize() {
    this.videoElement = document.getElementById('webcam-video');
    this.deviceSelect = document.getElementById('camera-select');
    this.fpsCounter = document.getElementById('live-fps');

    // Select Overlay DOM Nodes
    this.hudNodes.alt = document.getElementById('hud-alt');
    this.hudNodes.descent = document.getElementById('hud-descent');
    this.hudNodes.azimuth = document.getElementById('hud-azimuth');
    this.hudNodes.voltage = document.getElementById('hud-voltage');
    this.hudNodes.state = document.getElementById('hud-sim-state');
    this.hudNodes.timestamp = document.getElementById('hud-timestamp');

    // Register selection change binds
    this.deviceSelect.addEventListener('change', () => this.handleDeviceChange());

    // Pre-bind animation handlers for zero-allocation performance
    this.trackFps = this.trackFps.bind(this);

    // Query available video sources
    this.enumerateCameras();
  }

  /**
   * Scans system for video input hardware and populates camera select box
   */
  async enumerateCameras() {
    try {
      // Trigger temporary permission handshake to gain label authorization
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      // Clear existing options
      this.deviceSelect.innerHTML = '<option value="">CAMERA FEED [OFF]</option>';

      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `OPTICAL CAMERA FEED ${index + 1}`;
        this.deviceSelect.appendChild(option);
      });

      // Release temporary stream
      if (tempStream) {
        tempStream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      missionControls.log("CAMERA: Media enumerations bypassed (permission denied or no camera).", "text-muted");
    }
  }

  /**
   * Action selector when user changes camera source dropdown option
   */
  async handleDeviceChange() {
    const deviceId = this.deviceSelect.value;

    // Shut down existing camera stream
    this.stopStream();

    if (!deviceId) {
      this.setRecordingIcon(false);
      missionControls.log("CAMERA: Optical surveillance stream closed.", "text-muted");
      return;
    }

    // Try starting new selected video source stream
    try {
      const constraints = {
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      };

      this.activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.activeStream;
      
      // Start FPS counter loops
      this.setRecordingIcon(true);
      this.lastFpsUpdate = performance.now();
      this.frameCount = 0;
      this.trackFps();

      missionControls.log("CAMERA: Optical downlink feed successfully established.", "text-success");
    } catch (err) {
      missionControls.log(`CAMERA: Failed to capture camera stream: ${err.message}`, 'text-danger');
      this.deviceSelect.value = ""; // revert dropdown
      this.setRecordingIcon(false);
    }
  }

  /**
   * Stops active camera feed stream
   */
  stopStream() {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(track => track.stop());
      this.activeStream = null;
    }
    
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    if (this.fpsAnimationId) {
      cancelAnimationFrame(this.fpsAnimationId);
      this.fpsAnimationId = null;
    }

    if (this.fpsCounter) {
      this.fpsCounter.textContent = "0";
    }

    this.setRecordingIcon(false);
  }

  /**
   * Recursive requestAnimationFrame to calculate live frame rendering frequency
   */
  trackFps() {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;

    if (elapsed >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / elapsed);
      this.fpsCounter.textContent = fps.toString();
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.fpsAnimationId = requestAnimationFrame(this.trackFps);
  }

  /**
   * Toggles red recording blinker icon
   */
  setRecordingIcon(isActive) {
    const icon = document.getElementById('stream-rec-icon');
    if (!icon) return;

    if (isActive) {
      icon.classList.remove('inactive');
      icon.innerHTML = `<span class="rec-dot"></span> LIVE`;
    } else {
      icon.classList.add('inactive');
      icon.innerHTML = `<span class="rec-dot"></span> STBY`;
    }
  }

  /**
   * Watermarks dynamic telemetry readings directly inside HUD layout overlays
   * @param {Object} state - TelemetryManager state
   */
  updateHUD(state) {
    // 1. Update text fields
    if (this.hudNodes.alt) this.hudNodes.alt.textContent = state.altitude.toFixed(1);
    if (this.hudNodes.descent) this.hudNodes.descent.textContent = state.descentRate.toFixed(1);
    if (this.hudNodes.azimuth) this.hudNodes.azimuth.textContent = `${state.azimuth.toFixed(1)}° N`;
    if (this.hudNodes.voltage) this.hudNodes.voltage.textContent = `${state.voltage.toFixed(2)} V`;
    
    // Phase HUD class indicator mapping
    if (this.hudNodes.state) {
      this.hudNodes.state.textContent = `SIM: ${state.phase}`;
      if (state.phase === 'LAUNCH' || state.phase === 'LANDING') {
        this.hudNodes.state.className = "text-success";
      } else if (state.phase === 'DEPLOYMENT') {
        this.hudNodes.state.className = "text-warning animate-pulse";
      } else {
        this.hudNodes.state.className = "text-cyan";
      }
    }

    // 2. Local PC UTC chronometer watermark
    if (this.hudNodes.timestamp) {
      const utcStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      this.hudNodes.timestamp.textContent = utcStr;
    }
  }
}

export const liveCamera = new LiveCamera();
export default liveCamera;
