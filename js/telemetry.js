/**
 * CanSat Ground Control Software - Telemetry State Manager
 * Centralized data bus and historical logging coordinator.
 */

import { CONFIG } from './config.js';

class TelemetryManager {
  constructor() {
    this.history = [];
    this.subscribers = [];
    
    // Central active state
    this.state = {
      isReceiving: false,
      packetNumber: 0,
      missionTimeSec: 0.0,
      timeOffsetMs: 0, // Offset between local PC time and telemetry clock
      
      // Sensor Data
      altitude: 0.0,
      descentRate: 0.0,
      pressure: 1013.25,
      temperature: 25.0,
      voltage: 4.20,
      rssi: -50,
      satellites: 0,
      latitude: CONFIG.GROUND_STATION.LATITUDE,
      longitude: CONFIG.GROUND_STATION.LONGITUDE,
      roll: 0.0,
      pitch: 0.0,
      yaw: 0.0,
      
      // Fault System Status Flags (4-bit binary register)
      faultRegister: 0x0000,
      
      // Boolean Flags
      apogeeReached: false,
      parachuteDeployed: false,
      separationExecuted: false,
      redundantBatteryActive: false,
      
      // Computed Navigation Metrics
      groundRange: 0.0, // meters from ground station
      azimuth: 0.0 // bearing from ground station
    };

    // Tracks Peak Metrics (Min/Max counters for engineering displays)
    this.peaks = {
      maxAltitude: 0.0,
      maxDescentRate: 0.0,
      minPressure: 1013.25,
      maxTemperature: 25.0,
      minVoltage: 4.20,
      totalExpectedPackets: 0,
      lostPackets: 0
    };

    this.startTime = null;
  }

  /**
   * Register a module callback to receive telemetry broadcasts
   * @param {Function} callback - Telemetry processor callback
   */
  subscribe(callback) {
    this.subscribers.push(callback);
  }

  /**
   * Distributes the current packet state to all subscribed visual elements
   */
  broadcast() {
    this.subscribers.forEach(cb => cb(this.state, this.peaks));
  }

  /**
   * Resets the entire telemetry history and calibrates parameters
   */
  reset() {
    this.history = [];
    this.state.packetNumber = 0;
    this.state.missionTimeSec = 0.0;
    this.state.altitude = 0.0;
    this.state.descentRate = 0.0;
    this.state.pressure = 1013.25;
    this.state.temperature = 25.0;
    this.state.voltage = 4.20;
    this.state.rssi = -50;
    this.state.satellites = 0;
    this.state.latitude = CONFIG.GROUND_STATION.LATITUDE;
    this.state.longitude = CONFIG.GROUND_STATION.LONGITUDE;
    this.state.roll = 0.0;
    this.state.pitch = 0.0;
    this.state.yaw = 0.0;
    this.state.faultRegister = 0x0000;
    this.state.apogeeReached = false;
    this.state.parachuteDeployed = false;
    this.state.separationExecuted = false;
    this.state.redundantBatteryActive = false;
    this.state.groundRange = 0.0;
    this.state.azimuth = 0.0;

    this.peaks = {
      maxAltitude: 0.0,
      maxDescentRate: 0.0,
      minPressure: 1013.25,
      maxTemperature: 25.0,
      minVoltage: 4.20,
      totalExpectedPackets: 0,
      lostPackets: 0
    };
    
    this.startTime = this.state.isReceiving ? Date.now() : null;
    this.broadcast();
  }

  /**
   * Start telemetry aggregation clock
   */
  start() {
    this.state.isReceiving = true;
    this.startTime = Date.now() - (this.state.missionTimeSec * 1000);
  }

  /**
   * Stop telemetry aggregation clock
   */
  stop() {
    this.state.isReceiving = false;
  }

  /**
   * Syncs telemetry clocks with ground station local time
   */
  syncTime() {
    const pcTime = Date.now();
    this.state.timeOffsetMs = 0; // In simulation, we reset difference offset to nominal alignment
    return pcTime;
  }

  /**
   * Ingests a raw sensor telemetry packet from the simulation layer or receiver
   * @param {Object} rawPacket - Telemetry structure
   */
  ingest(rawPacket) {
    if (!this.state.isReceiving) return;

    // Calculate Mission Elapsed Time (MET) based on start timestamp
    if (this.startTime) {
      this.state.missionTimeSec = (Date.now() - this.startTime) / 1000;
    }

    this.state.packetNumber = rawPacket.packetNumber;
    this.state.altitude = rawPacket.altitude;
    this.state.descentRate = rawPacket.descentRate;
    this.state.pressure = rawPacket.pressure;
    this.state.temperature = rawPacket.temperature;
    this.state.voltage = rawPacket.voltage;
    this.state.rssi = rawPacket.rssi;
    this.state.satellites = rawPacket.satellites;
    this.state.latitude = rawPacket.latitude;
    this.state.longitude = rawPacket.longitude;
    this.state.roll = rawPacket.roll;
    this.state.pitch = rawPacket.pitch;
    this.state.yaw = rawPacket.yaw;
    this.state.faultRegister = rawPacket.faultRegister;
    
    this.state.apogeeReached = rawPacket.apogeeReached;
    this.state.parachuteDeployed = rawPacket.parachuteDeployed;
    this.state.separationExecuted = rawPacket.separationExecuted;
    
    // Auxiliary circuit engagement tracks overrides
    if (this.state.redundantBatteryActive) {
      // In auxiliary mode, we clamp voltage to redundant battery level (slightly boosted/redundant)
      this.state.voltage = Math.max(this.state.voltage, 3.95);
    }

    // Peak tracking aggregations
    this.peaks.maxAltitude = Math.max(this.peaks.maxAltitude, this.state.altitude);
    this.peaks.maxDescentRate = Math.max(this.peaks.maxDescentRate, this.state.descentRate);
    this.peaks.minPressure = Math.min(this.peaks.minPressure, this.state.pressure);
    this.peaks.maxTemperature = Math.max(this.peaks.maxTemperature, this.state.temperature);
    this.peaks.minVoltage = Math.min(this.peaks.minVoltage, this.state.voltage);

    // Compute ground relative metrics
    const rangeAzimuth = this.calculateRangeAndAzimuth(
      CONFIG.GROUND_STATION.LATITUDE,
      CONFIG.GROUND_STATION.LONGITUDE,
      this.state.latitude,
      this.state.longitude
    );
    this.state.groundRange = rangeAzimuth.range;
    this.state.azimuth = rangeAzimuth.azimuth;

    // Buffer to historical database (cap capacity to save memory footprint)
    const clonedSnapshot = { ...this.state, timestamp: Date.now() };
    this.history.push(clonedSnapshot);
    if (this.history.length > CONFIG.MAX_HISTORY_LENGTH) {
      this.history.shift();
    }

    // Packet loss simulation metrics
    this.peaks.totalExpectedPackets++;
    if (rawPacket.isLost) {
      this.peaks.lostPackets++;
    }

    // Trigger visual interface updates
    this.broadcast();
  }

  /**
   * Helper utilizing Haversine formulas to compute distance and bearing between coordinates
   */
  calculateRangeAndAzimuth(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    // Distance calculation (Haversine)
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const range = R * c;

    // Bearing calculation (Azimuth)
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    const azimuth = ((theta * 180) / Math.PI + 360) % 360;

    return { range, azimuth };
  }

  /**
   * Compile current memory state buffer into formatted, downloadable Excel-friendly CSV
   */
  exportToCSV() {
    if (this.history.length === 0) {
      return null;
    }

    const headers = [
      "PACKET_NUM", "MET_SEC", "ALTITUDE_M", "DESCENT_RATE_M_S", "PRESSURE_HPA",
      "TEMP_C", "BATTERY_V", "LATITUDE", "LONGITUDE", "ROLL_DEG", "PITCH_DEG",
      "YAW_DEG", "FAULT_HEX", "APOGEE", "PARACHUTE", "SEPARATION"
    ];

    const rows = this.history.map(p => [
      p.packetNumber,
      p.missionTimeSec.toFixed(2),
      p.altitude.toFixed(2),
      p.descentRate.toFixed(2),
      p.pressure.toFixed(2),
      p.temperature.toFixed(2),
      p.voltage.toFixed(2),
      p.latitude.toFixed(6),
      p.longitude.toFixed(6),
      p.roll.toFixed(1),
      p.pitch.toFixed(1),
      p.yaw.toFixed(1),
      `0x${p.faultRegister.toString(16).padStart(4, '0').toUpperCase()}`,
      p.apogeeReached ? 1 : 0,
      p.parachuteDeployed ? 1 : 0,
      p.separationExecuted ? 1 : 0
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    return csvContent;
  }
}

export const telemetryManager = new TelemetryManager();
export default telemetryManager;
