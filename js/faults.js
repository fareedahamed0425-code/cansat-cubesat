/**
 * CanSat Ground Control Software - Hex Fault Register & Health Coordinator
 * Implements real-time analysis of the 4-digit aerospace fault code (0000 - 1111)
 */

import { CONFIG } from './config.js';
import { missionControls } from './controls.js';

class FaultMonitor {
  constructor() {
    this.currentRegister = 0x0000;
    this.previousState = {
      descentRate: false,
      gpsAvailability: false,
      payloadSeparation: false,
      parachuteActive: false
    };
  }

  /**
   * Refreshes digit boxes, health cards, and alert registers
   * @param {Object} state - TelemetryManager state
   */
  update(state) {
    const reg = state.faultRegister;
    this.currentRegister = reg;

    // 1. Bitwise extraction of the 4-digit fault states
    const bitDescent = (reg & CONFIG.FAULT_CODES.DESCENT_RATE_FAULT) !== 0;
    const bitGps     = (reg & CONFIG.FAULT_CODES.GPS_AVAILABILITY_FAULT) !== 0;
    const bitSepar   = (reg & CONFIG.FAULT_CODES.PAYLOAD_SEPAR_FAULT) !== 0;
    const bitPara    = (reg & CONFIG.FAULT_CODES.EMERGENCY_PARA_ACTIVE) !== 0;

    // 2. Animate the 4 HTML Digit nodes
    this.updateDigitNode('fd-d1', bitDescent ? '1' : '0', bitDescent);
    this.updateDigitNode('fd-d2', bitGps ? '1' : '0', bitGps);
    this.updateDigitNode('fd-d3', bitSepar ? '1' : '0', bitSepar);
    this.updateDigitNode('fd-d4', bitPara ? '1' : '0', bitPara);

    // Update bottom hex register subtitle
    const hexString = `0x${reg.toString(16).padStart(4, '0').toUpperCase()}`;
    const registerLabel = document.getElementById('fault-register-lbl');
    
    if (reg === 0) {
      registerLabel.textContent = `REGISTER FLAG: ${hexString} (SYS_NOMINAL)`;
      registerLabel.className = "fault-status-subtitle font-mono text-success text-center";
    } else {
      registerLabel.textContent = `REGISTER FLAG: ${hexString} (SYS_FAULT_ALERT)`;
      registerLabel.className = "fault-status-subtitle font-mono text-danger text-center animate-pulse";
    }

    // 3. Update Health-Light Card visual classes
    this.updateHealthLightCard('hl-descent', bitDescent ? 'red' : 'green');
    this.updateHealthLightCard('hl-gps', bitGps ? 'red' : 'green');
    
    // Separation system shows red if fault, green if successfully executed, or green/muted when launching
    if (bitSepar) {
      this.updateHealthLightCard('hl-separation', 'red');
    } else if (state.separationExecuted) {
      this.updateHealthLightCard('hl-separation', 'green');
    } else {
      this.updateHealthLightCard('hl-separation', 'green'); // Nominal standby
    }

    // Emergency Parachute Indicator
    if (bitPara) {
      // Emergency parachute deployed is amber/warning (indicating abnormal primary deploy but safe auxiliary backup)
      this.updateHealthLightCard('hl-parachute', 'amber');
      document.getElementById('metric-parachute').textContent = "AUX ACTIVE";
      document.getElementById('metric-parachute').className = "font-mono text-warning";
    } else if (state.parachuteDeployed) {
      this.updateHealthLightCard('hl-parachute', 'green');
      document.getElementById('metric-parachute').textContent = "NOMINAL";
      document.getElementById('metric-parachute').className = "font-mono text-success";
    } else {
      this.updateHealthLightCard('hl-parachute', 'green');
      document.getElementById('metric-parachute').textContent = "ARMED";
      document.getElementById('metric-parachute').className = "font-mono text-muted";
    }

    // 4. Calculate overall Mission Health Banner
    const healthHeader = document.getElementById('health-overall');
    if (reg === 0) {
      healthHeader.textContent = "NOMINAL";
      healthHeader.className = "health-status-value font-mono text-success";
    } else if (reg === CONFIG.FAULT_CODES.EMERGENCY_PARA_ACTIVE) {
      // Just emergency parachute is an attention/warning state
      healthHeader.textContent = "ATTENTION";
      healthHeader.className = "health-status-value font-mono text-warning animate-pulse";
    } else {
      // Multiple faults or separation failures are critical
      healthHeader.textContent = "SYS CRITICAL";
      healthHeader.className = "health-status-value font-mono text-danger animate-pulse";
    }

    // 5. Track state transitions to log alert messages exactly ONCE
    this.checkTransitionLogs(bitDescent, bitGps, bitSepar, bitPara);
  }

  /**
   * Safe UI updater for DOM digits
   */
  updateDigitNode(id, char, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = char;
    if (isActive) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  }

  /**
   * Sets color status classes (green / amber / red) on health light blocks
   */
  updateHealthLightCard(id, color) {
    const card = document.getElementById(id);
    if (!card) return;
    const dot = card.querySelector('.hl-dot');
    
    dot.className = `hl-dot ${color}`;
  }

  /**
   * Log alert statements only when values transition to prevent flooding logs
   */
  checkTransitionLogs(bitDescent, bitGps, bitSepar, bitPara) {
    // Descent Rate Alert transitions
    if (bitDescent && !this.previousState.descentRate) {
      missionControls.log(`CRITICAL: CanSat descent velocity exceeded safety limits! Rate: 19.5 m/s.`, 'text-danger');
      missionControls.log(`ALERTS: Descent rate unsafe. Check secondary parachute canopy.`, 'text-danger');
    } else if (!bitDescent && this.previousState.descentRate) {
      missionControls.log(`RESOLVED: CanSat descent velocity back within nominal limits.`, 'text-success');
    }

    // GPS Lock Alert transitions
    if (bitGps && !this.previousState.gpsAvailability) {
      missionControls.log(`WARNING: GPS tracking signal degraded below lock constraints!`, 'text-warning');
    } else if (!bitGps && this.previousState.gpsAvailability) {
      missionControls.log(`RESOLVED: GPS satellite locks restored. Tracking active.`, 'text-success');
    }

    // Separation Alert transitions
    if (bitSepar && !this.previousState.payloadSeparation) {
      missionControls.log(`CRITICAL: Apogee separation explosive locks failed to disengage!`, 'text-danger');
      missionControls.log(`ALERTS: Deploy primary chute or fire manual override separation slider.`, 'text-danger');
    } else if (!bitSepar && this.previousState.payloadSeparation) {
      missionControls.log(`RESOLVED: Apogee separation release handshake verified.`, 'text-success');
    }

    // Emergency Parachute Active transitions
    if (bitPara && !this.previousState.parachuteActive) {
      missionControls.log(`ALERTS: Redundant auxiliary parachute circuit triggered active.`, 'text-warning');
    }

    // Save current states for next loop comparisons
    this.previousState.descentRate = bitDescent;
    this.previousState.gpsAvailability = bitGps;
    this.previousState.payloadSeparation = bitSepar;
    this.previousState.parachuteActive = bitPara;
  }

  /**
   * Resets internal alarm states
   */
  reset() {
    this.previousState = {
      descentRate: false,
      gpsAvailability: false,
      payloadSeparation: false,
      parachuteActive: false
    };
    
    // Clear elements
    this.updateDigitNode('fd-d1', '0', false);
    this.updateDigitNode('fd-d2', '0', false);
    this.updateDigitNode('fd-d3', '0', false);
    this.updateDigitNode('fd-d4', '0', false);
    
    this.updateHealthLightCard('hl-descent', 'green');
    this.updateHealthLightCard('hl-gps', 'green');
    this.updateHealthLightCard('hl-separation', 'green');
    this.updateHealthLightCard('hl-parachute', 'green');
    
    const healthHeader = document.getElementById('health-overall');
    healthHeader.textContent = "NOMINAL";
    healthHeader.className = "health-status-value font-mono text-success";
    
    const registerLabel = document.getElementById('fault-register-lbl');
    registerLabel.textContent = "REGISTER FLAG: 0x0000 (SYS_NORMAL)";
    registerLabel.className = "fault-status-subtitle font-mono text-muted text-center";
  }
}

export const faultMonitor = new FaultMonitor();
export default faultMonitor;
