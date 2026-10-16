/**
 * CanSat Ground Control Software - Safety Critical Controls Coordinator
 * Manages dual-action confirmation sliders, modal overlays,
 * and maintains the command uplink interactive logs.
 */

import { telemetrySimulator } from './simulator.js';

class MissionControls {
  constructor() {
    this.logsContainer = null;
    
    // Sliders state
    this.sliders = {
      separation: { el: null, handle: null, active: false, currentX: 0, maxX: 0 },
      parachute: { el: null, handle: null, active: false, currentX: 0, maxX: 0 }
    };

    // Callback when command is authorized
    this.onCommandUplink = null;
    
    // Confirmation Modal variables
    this.activeCommandType = null; // 'SEPARATION' | 'PARACHUTE'
  }

  /**
   * Initializes PointerEvents on confirmation handles, slides, and logs
   */
  initialize() {
    this.logsContainer = document.getElementById('command-log');

    // Load Sliders DOM Elements
    this.initSlider('separation', 'slider-separation');
    this.initSlider('parachute', 'slider-parachute');

    // Aux Switch Button
    const btnAux = document.getElementById('btn-redundant-active');
    btnAux.addEventListener('click', () => this.toggleAuxCircuit(btnAux));

    // Modal buttons bindings
    document.getElementById('dialog-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('dialog-confirm').addEventListener('click', () => this.confirmUplinkCommand());
  }

  /**
   * Configures mouse/touch pointer events for slide-to-unlock tracks
   */
  initSlider(key, containerId) {
    const slider = this.sliders[key];
    slider.el = document.getElementById(containerId);
    slider.handle = slider.el.querySelector('.safety-handle');
    const track = slider.el.querySelector('.safety-track');

    // Pointer Down
    slider.handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      slider.active = true;
      slider.handle.setPointerCapture(e.pointerId);
      track.classList.add('active-lock');
      
      // Calculate tracks widths
      const containerWidth = slider.el.clientWidth;
      const handleWidth = slider.handle.clientWidth;
      slider.maxX = containerWidth - handleWidth - 4; // subtle padding offsets
    });

    // Pointer Move
    slider.handle.addEventListener('pointermove', (e) => {
      if (!slider.active) return;
      e.preventDefault();

      // Track relative horizontal coordinates
      const rect = slider.el.getBoundingClientRect();
      const pointerX = e.clientX - rect.left - (slider.handle.clientWidth / 2);
      
      // Clamp bounds
      slider.currentX = Math.min(slider.maxX, Math.max(0, pointerX));
      slider.handle.style.left = `${slider.currentX}px`;

      // Visual progress feedback
      const pct = Math.round((slider.currentX / slider.maxX) * 100);
      const text = track.querySelector('.safety-track-text');
      text.textContent = `UNLOCK SECURITY: ${pct}%`;
      text.style.color = `rgba(239, 68, 68, ${0.3 + (pct/150)})`;
    });

    // Pointer Up / Cancel
    const endDrag = (e) => {
      if (!slider.active) return;
      slider.active = false;
      track.classList.remove('active-lock');

      // Check if unlocked (reached 96% of the track range)
      if (slider.currentX >= slider.maxX * 0.95) {
        slider.handle.style.left = `${slider.maxX}px`;
        this.openUplinkModal(key);
      } else {
        // Slide back smoothly to zero
        slider.handle.style.transition = 'left 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        slider.handle.style.left = '1px';
        
        // Reset text
        const text = track.querySelector('.safety-track-text');
        text.textContent = key === 'separation' ? 'SLIDE TO DISENGAGE RESTRAINT' : 'SLIDE TO FIRE DETONATOR';
        text.style.color = '';
        
        setTimeout(() => {
          slider.handle.style.transition = '';
          slider.currentX = 0;
        }, 250);
      }
    };

    slider.handle.addEventListener('pointerup', endDrag);
    slider.handle.addEventListener('pointercancel', endDrag);
  }

  /**
   * Resets slider coordinate sliders to zero
   */
  resetSliders() {
    Object.entries(this.sliders).forEach(([key, slider]) => {
      if (slider.handle) {
        slider.handle.style.left = '1px';
        slider.currentX = 0;
        const track = slider.el.querySelector('.safety-track');
        const text = track.querySelector('.safety-track-text');
        text.textContent = key === 'separation' ? 'SLIDE TO DISENGAGE RESTRAINT' : 'SLIDE TO FIRE DETONATOR';
        text.style.color = '';
      }
    });
  }

  /**
   * Displays the aerospace modal dialog for safe locks
   * @param {string} commandType - 'separation' or 'parachute'
   */
  openUplinkModal(commandType) {
    this.activeCommandType = commandType;
    const dialog = document.getElementById('confirmation-dialog');
    const desc = document.getElementById('dialog-desc');
    
    if (commandType === 'separation') {
      desc.innerHTML = `COMMAND OVERRIDE: <span class="text-danger">UPLINK_MANUAL_SEPARATION_V2</span><br>IMPACT: Sever container physical linkages immediately.`;
    } else {
      desc.innerHTML = `COMMAND OVERRIDE: <span class="text-warning">UPLINK_EMERGENCY_PARACHUTE_FIRE</span><br>IMPACT: Ignites pyrotechnic backup parachute charges immediately.`;
    }

    dialog.classList.remove('hidden');
    this.log(`GROUND: Safety verification requested for [${commandType.toUpperCase()}] lock.`, 'text-warning');
  }

  /**
   * Hide the modal dialog overlay
   */
  closeModal() {
    document.getElementById('confirmation-dialog').classList.add('hidden');
    this.log(`GROUND: Command uplink aborted by operators. System re-armed.`, 'text-muted');
    this.resetSliders();
  }

  /**
   * Transmit approved override command and trigger physics simulator
   */
  confirmUplinkCommand() {
    document.getElementById('confirmation-dialog').classList.add('hidden');
    
    const key = this.activeCommandType;
    this.log(`GROUND: Transmitting telemetry uplink sequence...`, 'text-white');
    
    setTimeout(() => {
      if (key === 'separation') {
        telemetrySimulator.triggerSeparation();
        this.log(`UPLINK: [MANUAL_SEPARATION] executed successfully.`, 'text-success');
        this.log(`SYS-MON: Separation switches registered OPEN.`, 'text-cyan');
      } else if (key === 'parachute') {
        telemetrySimulator.triggerEmergencyParachute();
        this.log(`UPLINK: [EMERGENCY_PARACHUTE_FIRE] deployed.`, 'text-danger');
        this.log(`SYS-MON: Backup canopy charges detonated.`, 'text-cyan');
      }
      
      if (this.onCommandUplink) {
        this.onCommandUplink(key);
      }
      
      this.resetSliders();
    }, 600); // 600ms latency simulated
  }

  /**
   * Engage Aux Redundant battery circuits
   */
  toggleAuxCircuit(btn) {
    if (telemetrySimulator.auxBatteryEngaged) {
      this.log("GROUND: Auxiliary backup power system already engaged.", "text-muted");
      return;
    }

    btn.classList.add('active');
    btn.querySelector('span').textContent = "AUX CIRCUIT ENGAGED";
    telemetrySimulator.triggerAuxBattery();
    this.log("UPLINK: Engaging Auxiliary Avionics Redundant Battery.", "text-white");
    
    setTimeout(() => {
      this.log("SYS-MON: Redundant bus relay toggled CLOSED. Input voltage: 3.98V.", "text-success");
      this.log("ALERTS: Battery cells backup nominal.", "text-cyan");
    }, 400);
  }

  /**
   * Logs a clinical timestamped event line to the operational terminal logs
   * @param {string} message - event details
   * @param {string} cssClass - color category selector
   */
  log(message, cssClass = 'text-white') {
    if (!this.logsContainer) return;
    
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const line = document.createElement('div');
    line.className = `terminal-line ${cssClass}`;
    line.innerHTML = `<span class="text-muted">[${timestamp}]</span> ${message}`;
    
    this.logsContainer.appendChild(line);
    // Scroll automatically to bottom
    this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
  }
}

export const missionControls = new MissionControls();
export default missionControls;
