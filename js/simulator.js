/**
 * CanSat Ground Control Software - High-Fidelity Physics Telemetry Simulator
 * Models atmospheric parameters, 3-dimensional trajectory profiles,
 * battery discharge cycles, and multi-phase mission transitions.
 */

import { CONFIG } from './config.js';

class TelemetrySimulator {
  constructor() {
    this.packetNumber = 0;
    this.phase = 'LAUNCH'; // 'LAUNCH', 'ASCENT', 'DEPLOYMENT', 'DESCENT', 'LANDING'
    this.phaseElapsedSec = 0.0;
    
    // Core parameters (internal simulated state tracker)
    this.altitude = 0.0;
    this.descentRate = 0.0;
    this.pressure = 1013.25;
    this.temperature = 28.5; // Starts at Sriharikota ambient temp
    this.voltage = 4.20;
    this.rssi = -42;
    this.satellites = 12;
    this.latitude = CONFIG.GROUND_STATION.LATITUDE;
    this.longitude = CONFIG.GROUND_STATION.LONGITUDE;
    this.roll = 0.0;
    this.pitch = 0.0;
    this.yaw = 0.0;

    // Simulation triggers
    this.apogeeReached = false;
    this.parachuteDeployed = false;
    this.separationExecuted = false;
    this.auxBatteryEngaged = false;
    this.emergencyParachuteTriggered = false;

    // Target coordinates drift vector (Ascent & Descent wind drift)
    this.driftLat = 0.00002;
    this.driftLon = 0.000045;
  }

  /**
   * Reset simulator state
   */
  reset() {
    this.packetNumber = 0;
    this.phase = 'LAUNCH';
    this.phaseElapsedSec = 0.0;
    this.altitude = 0.0;
    this.descentRate = 0.0;
    this.pressure = 1013.25;
    this.temperature = 28.5;
    this.voltage = 4.20;
    this.rssi = -42;
    this.satellites = 12;
    this.latitude = CONFIG.GROUND_STATION.LATITUDE;
    this.longitude = CONFIG.GROUND_STATION.LONGITUDE;
    this.roll = 0.0;
    this.pitch = 0.0;
    this.yaw = 0.0;
    this.apogeeReached = false;
    this.parachuteDeployed = false;
    this.separationExecuted = false;
    this.auxBatteryEngaged = false;
    this.emergencyParachuteTriggered = false;
  }

  /**
   * Triggers manual override separation
   */
  triggerSeparation() {
    this.separationExecuted = true;
    if (this.phase === 'ASCENT' || this.phase === 'DEPLOYMENT') {
      this.phase = 'DEPLOYMENT';
      this.phaseElapsedSec = 0;
    }
  }

  /**
   * Triggers emergency backup parachute deployment
   */
  triggerEmergencyParachute() {
    this.emergencyParachuteTriggered = true;
    this.parachuteDeployed = true;
  }

  /**
   * Engages auxiliary backup battery systems
   */
  triggerAuxBattery() {
    this.auxBatteryEngaged = true;
    // Voltage instantly recovers back to healthy 3.95V minimum
    this.voltage = Math.max(this.voltage, 3.98);
  }

  /**
   * Generates the next physics tick based on elapsed time step (dt)
   * @param {number} dt - delta time in seconds
   * @returns {Object} compiled telemetry packet
   */
  generateTick(dt) {
    this.packetNumber++;
    this.phaseElapsedSec += dt;

    // 1. Process Flight Phase State Machine
    switch (this.phase) {
      case 'LAUNCH':
        this.runLaunchPhase(dt);
        break;
      case 'ASCENT':
        this.runAscentPhase(dt);
        break;
      case 'DEPLOYMENT':
        this.runDeploymentPhase(dt);
        break;
      case 'DESCENT':
        this.runDescentPhase(dt);
        break;
      case 'LANDING':
        this.runLandingPhase(dt);
        break;
    }

    // 2. Apply Atmospheric Relationships & Physical Sensings
    // Temperature drops by ~6.5°C per 1000m altitude (Standard Lapse Rate)
    const idealTemp = 28.5 - (6.5 * (this.altitude / 1000.0));
    // Apply slight noise to temperature (+- 0.15°C)
    this.temperature = idealTemp + (Math.random() - 0.5) * 0.3;

    // Pressure drops exponentially with altitude: P = P0 * exp(-h / H)
    const scaleHeight = 8500; // meters
    const idealPressure = 1013.25 * Math.exp(-this.altitude / scaleHeight);
    // Apply pressure sensor noise
    this.pressure = idealPressure + (Math.random() - 0.5) * 0.25;

    // 3. Battery Discharge Cycle simulation
    // Active sensors consume battery steadily. RF signal strength adds drain.
    if (!this.auxBatteryEngaged) {
      const baseDrain = 0.0005 * dt; // Normal operation drain
      const rssiDrain = Math.max(0, -this.rssi / 100.0) * 0.0002 * dt;
      this.voltage = Math.max(3.2, this.voltage - (baseDrain + rssiDrain));
    } else {
      // Aux battery discharges much slower
      this.voltage = Math.max(3.6, this.voltage - 0.00015 * dt);
    }

    // 4. GPS Geolocation Trajectory Math
    // Coordinates drift according to wind currents and launcher speed vectors
    if (this.phase !== 'LAUNCH') {
      const latOffset = (this.driftLat * dt * (this.phase === 'ASCENT' ? 1.5 : 0.85)) + (Math.random() - 0.5) * 0.000002;
      const lonOffset = (this.driftLon * dt * (this.phase === 'ASCENT' ? 1.2 : 0.95)) + (Math.random() - 0.5) * 0.000002;
      this.latitude += latOffset;
      this.longitude += lonOffset;
    }

    // GPS satellites lock fluctuation
    if (this.phase === 'ASCENT' && this.altitude > 800) {
      // Temporary GPS atmospheric multipathing / lock degradation
      this.satellites = Math.max(2, Math.round(12 - (Math.random() * 5)));
    } else if (this.phase === 'LANDING') {
      // Ground shading locks
      this.satellites = 8;
    } else {
      this.satellites = Math.round(11 + (Math.random() * 2));
    }

    // RF Telemetry Signal RSSI attenuation (weakens with range from ground station)
    const range = this.calculateGroundRange(this.latitude, this.longitude);
    const calculatedRssi = -40 - (range / 35.0) - (Math.random() * 4);
    this.rssi = Math.min(-30, Math.max(-120, Math.round(calculatedRssi)));

    // 5. 4-Digit Aerospace Hex Fault Register computation
    let faultRegister = 0x0000;

    // Digit 1: Descent Rate Fault (Descent phase starts, but speed exceeds threshold)
    const descentRateFault = (this.phase === 'DESCENT' && this.descentRate > CONFIG.THRESHOLDS.MAX_DESCENT_RATE);
    if (descentRateFault) {
      faultRegister |= CONFIG.FAULT_CODES.DESCENT_RATE_FAULT;
    }

    // Digit 2: GPS Lock Fault
    const gpsLockFault = (this.satellites < CONFIG.THRESHOLDS.GPS_LOCK_ACCURACY);
    if (gpsLockFault) {
      faultRegister |= CONFIG.FAULT_CODES.GPS_AVAILABILITY_FAULT;
    }

    // Digit 3: Payload Separation Fault (Passed apogee, but manual command was NOT executed)
    const separationFault = (this.phase === 'DEPLOYMENT' && !this.separationExecuted && this.phaseElapsedSec > 5.0);
    if (separationFault) {
      faultRegister |= CONFIG.FAULT_CODES.PAYLOAD_SEPAR_FAULT;
    }

    // Digit 4: Emergency Parachute Active indicator
    if (this.emergencyParachuteTriggered) {
      faultRegister |= CONFIG.FAULT_CODES.EMERGENCY_PARA_ACTIVE;
    }

    return {
      packetNumber: this.packetNumber,
      phase: this.phase,
      altitude: Math.max(0.0, this.altitude),
      descentRate: this.descentRate,
      pressure: this.pressure,
      temperature: this.temperature,
      voltage: this.voltage,
      rssi: this.rssi,
      satellites: this.satellites,
      latitude: this.latitude,
      longitude: this.longitude,
      roll: this.roll,
      pitch: this.pitch,
      yaw: this.yaw,
      faultRegister: faultRegister,
      
      apogeeReached: this.apogeeReached,
      parachuteDeployed: this.parachuteDeployed,
      separationExecuted: this.separationExecuted
    };
  }

  // Phase Execution Helpers
  
  runLaunchPhase(dt) {
    this.altitude = 0.0;
    this.descentRate = 0.0;
    
    // Stabilized on launch pad
    this.pitch = (Math.random() - 0.5) * 0.4;
    this.roll = (Math.random() - 0.5) * 0.4;
    this.yaw = 180.0; // Pointing South (Default Launch Orientation)

    // Self check holds for 6 seconds on start, then launches
    if (this.phaseElapsedSec > 6.0) {
      this.phase = 'ASCENT';
      this.phaseElapsedSec = 0;
    }
  }

  runAscentPhase(dt) {
    // Rocket ascent has a parabolic curve peaking at ~1000m altitude
    // Standard trajectory ascent velocity: v(t) = v0 - g*t
    const ascentTimeLimit = 25.0; // Ascent duration (seconds)
    const initialVelocity = 75.0; // m/s
    const gravity = 9.80665;
    
    const time = this.phaseElapsedSec;
    // v = u - g*t
    const currentVelocity = initialVelocity - (gravity * time);
    
    // Position: s = s0 + u*t - 0.5*g*t^2
    this.altitude = (initialVelocity * time) - (0.5 * gravity * time * time);
    this.descentRate = 0.0; // Descent rate is zero during ascent

    // Rocket vibration tumbles CanSat slightly
    this.pitch = 5.0 + (Math.random() - 0.5) * 3.0;
    this.roll = 2.0 + (Math.random() - 0.5) * 3.0;
    this.yaw = (this.yaw + (15.0 * dt)) % 360; // Spinning up slowly

    // Triggers transition to Apogee/Deployment
    if (time >= (initialVelocity / gravity) || this.altitude >= 980.0) {
      this.apogeeReached = true;
      this.altitude = 1000.0; // clamp at target apogee
      this.phase = 'DEPLOYMENT';
      this.phaseElapsedSec = 0;
    }
  }

  runDeploymentPhase(dt) {
    this.altitude = 1000.0;
    this.descentRate = 0.0;

    // During separation window, CanSat goes into high angular tumbling
    this.pitch = (this.pitch + (120.0 * dt)) % 360;
    this.roll = (this.roll + (180.0 * dt)) % 360;
    this.yaw = (this.yaw + (60.0 * dt)) % 360;

    // Separation command executes -> moves to parachute descent phase
    // In simulation, if the user does not slide the separation slider, GCS waits at apogee.
    // If more than 10 seconds pass, auto-override triggers to simulate standard backup hardware timer
    if (this.separationExecuted || this.phaseElapsedSec > 10.0) {
      this.separationExecuted = true;
      this.phase = 'DESCENT';
      this.phaseElapsedSec = 0;
    }
  }

  runDescentPhase(dt) {
    // Parachute descent
    // If emergency parachute is active: steady slow descent of ~6 m/s
    // If standard separation parachute is active: steady descent of ~9.5 m/s
    // If separation failed or parachute didn't deploy: rapid descent of ~19 m/s (critical failure state)
    let targetDescentVelocity = 9.8; 
    
    if (this.emergencyParachuteTriggered) {
      targetDescentVelocity = 5.8;
      this.parachuteDeployed = true;
    } else if (!this.separationExecuted) {
      // No separation, descending like a brick inside secondary stage
      targetDescentVelocity = 19.5;
      this.parachuteDeployed = false;
    }

    // Approach terminal velocity smoothly
    this.descentRate = this.descentRate + (targetDescentVelocity - this.descentRate) * 0.15;
    
    // Decrement altitude
    this.altitude = Math.max(0.0, this.altitude - (this.descentRate * dt));

    // Stabilizing orientation back to gentle descent sway
    this.pitch = Math.sin(this.phaseElapsedSec * 1.5) * 8.0; // Swaying pitch
    this.roll = Math.cos(this.phaseElapsedSec * 1.5) * 8.0; // Swaying roll
    this.yaw = (this.yaw + (12.0 * dt)) % 360; // Steady spin rotation

    // Reach ground -> Landed phase
    if (this.altitude <= 0.2) {
      this.altitude = 0.0;
      this.descentRate = 0.0;
      this.phase = 'LANDING';
      this.phaseElapsedSec = 0;
    }
  }

  runLandingPhase(dt) {
    this.altitude = 0.0;
    this.descentRate = 0.0;
    
    // Settle flat on terrain
    this.pitch = 0.0;
    this.roll = 0.0;
    this.yaw = Math.round(this.yaw); // Holds final azimuth angle

    // Transmit final landing beacons
    this.rssi = -78 + (Math.random() - 0.5) * 2;
  }

  // Ground distance helper
  calculateGroundRange(lat2, lon2) {
    const lat1 = CONFIG.GROUND_STATION.LATITUDE;
    const lon1 = CONFIG.GROUND_STATION.LONGITUDE;
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export const telemetrySimulator = new TelemetrySimulator();
export default telemetrySimulator;
