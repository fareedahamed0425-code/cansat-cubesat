/**
 * CanSat Ground Control Software - System Configuration
 * Professional Aerospace-Grade Telemetry Parameters
 */

export const CONFIG = {
  // Ground Station Settings (Satish Dhawan Space Centre, Sriharikota - ISRO)
  GROUND_STATION: {
    LATITUDE: 13.7259,
    LONGITUDE: 80.2266,
    ALTITUDE: 15.0, // meters above sea level
    NAME: "SHAR-GROUND-STATION-A"
  },

  // Telemetry Frequency (Hz)
  TELEMETRY_RATE_HZ: 5, // 5 packets per second
  MAX_HISTORY_LENGTH: 300, // Maximum datapoints kept in memory for charts

  // System Thresholds for Fault Detection
  THRESHOLDS: {
    MAX_DESCENT_RATE: 15.0,  // m/s (Failure above this during descent)
    MIN_VOLTAGE: 3.5,        // V (Battery warning threshold)
    MAX_VOLTAGE: 4.3,        // V (Over-voltage protection)
    MIN_TEMPERATURE: -5.0,   // °C
    MAX_TEMPERATURE: 50.0,   // °C
    GPS_LOCK_ACCURACY: 4,    // Standard required GPS satellites (simulation threshold)
    SIGNAL_LOSS_PCT: 15.0    // Signal strength below this is critical
  },

  // 4-Digit Aerospace Fault Codes
  FAULT_CODES: {
    DESCENT_RATE_FAULT:   0b1000, // Digit 1 -> Descent Rate Fault
    GPS_AVAILABILITY_FAULT: 0b0100, // Digit 2 -> GPS Availability Fault
    PAYLOAD_SEPAR_FAULT:  0b0010, // Digit 3 -> Payload Separation Failure
    EMERGENCY_PARA_ACTIVE: 0b0001  // Digit 4 -> Emergency Parachute Active
  },

  // Aerospace Instrument Configuration
  ARTIFICIAL_HORIZON: {
    GRID_DIVISIONS: 10,
    COLOR_SKY: 0x071224,
    COLOR_GROUND: 0x1f1406,
    COLOR_CANSAT: 0x0ea5e9
  },

  // Chart Styling Properties (Canvas Custom Theme)
  CHARTS: {
    FONT_FAMILY: "'IBM Plex Mono', monospace",
    GRID_COLOR: "rgba(34, 43, 59, 0.5)",
    TICK_COLOR: "#94a3b8",
    LINE_TENSION: 0.15,
    POINT_RADIUS: 0
  }
};
