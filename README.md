# 🚀 Ground Control Software (GCS) - CanSat / CubeSat Flight Operations Command

An aerospace-grade, high-performance Single Page Application (SPA) designed to act as a real-time Ground Control System for CanSat / CubeSat mission simulations. Modeled directly after clinical NASA, ESA, and ISRO telemetry dashboards, this system features premium styling, a dark command-center aesthetic, real-time physics-based simulations, and safety-critical mechanical uplinks.

---

## 📸 Key Features

* **Top Mission Control Bar:** Centralized elapsed timer, real-time communication health indices, dynamic flight phase registers, and system sync-reset controls.
* **Primary Instrumentation Suite:** Dual-column data matrix displaying Container vs. Payload telemetries (Altitude, Descent Rate, Pressure, Temp, Battery, RSSI, GPS coordinates, compass headings).
* **3D Spatial Orientation Visualizer:** Smooth WebGL rendering of a cylindrical CanSat model using **Three.js** and aerospace LERP interpolation of Roll, Pitch, and Yaw angles. Includes a flight director hud indicator.
* **Live Camera Multicast Feed:** Integrated webcam control utilizing browser **HTML5 MediaDevices APIs** with telemetry data HUD overlay metrics and frame-processing FPS calculators.
* **Interactive Scientific Plotting:** Dynamic Chart.js dashboard plotting Altitude, Pressure, Temperature, Battery, and Descent Rate concurrently on an optimized 2x2 grid.
* **Leaflet Trajectory Mapping:** Custom satellite-styled Leaflet dark mapping tracking live coordinates path lines, distance ground ranges, and azimuth headings from ground station launcher.
* **Safety Critical Uplinks:** Custom pointer-based Slide-to-Unlock rails protecting dangerous commands (Manual separation, backup parachute fire) with simulated latency handshakes and operations logs.
* **4-Digit Binary Fault Monitoring:** Real-time bit-register display (`0000` to `1111`) tracking descent rate safety violations, GPS locks dropouts, and separation failures.

---

## 🛠️ Technology Stack & Dependencies

The system is constructed with a highly performant, serverless modular architecture requiring zero compilations, zero npm configurations, and running entirely at a steady **60 FPS** client-side:

* **Markup & Structure:** HTML5 (Semantic containers)
* **Styling & Themes:** Vanilla CSS3 (Custom properties grid systems, micro-animations, Custom Scrollbars)
* **Core Logic:** Vanilla ES6+ JavaScript (Native ES Modules, asynchronous event dispatchers)
* **3D WebGL Library:** Three.js (vR128) via CDN
* **Plotting Library:** Chart.js (v4.x) via CDN
* **Mapping Library:** Leaflet.js (v1.9.4) via CDN
* **Iconography:** Lucide Icons (Web release) via CDN

---

## 📁 Repository Directory Structure

```text
├── index.html         # Main GCS dashboard layout container
├── css/
│   └── style.css      # Core theme, CSS custom properties, grid layouts, animations
└── js/
    ├── app.js         # Central application orchestrator (bootstrapper glue)
    ├── config.js      # Global aerospace calibration indices, thresholds, GS coordinates
    ├── telemetry.js   # Central state manager data-bus (min/max peaks, distance calculations)
    ├── simulator.js   # Physics-based multi-phase flight trajectory simulator engine
    ├── charts.js      # Streaming plots controller (Chart.js wrapper)
    ├── map.js         # Leaflet.js path trajectory mapping coordinator
    ├── orientation.js # Three.js WebGL spatial orientation model scene
    ├── camera.js      # Live camera capture feed & telemetry watermark overlay HUD
    ├── controls.js    # Safety-critical Pointer-based sliders & operational terminal logs
    └── faults.js      # 4-Digit binary aerospace fault registers monitor system
```

---

## 🚀 Quick Setup & Local Launch

WebGL, Leaflet, and WebRTC Camera APIs require a secure origin (`localhost`, local server, or `https`). Follow any of the options below to get started:

### 1. Clone Repository
```bash
git clone https://github.com/fareedahamed0425-code/cansat-cubesat.git
cd cansat-cubesat
```

### 2. Start Local Server

#### Option A: Python (Fastest — No installation needed if Python is installed)
```bash
python -m http.server 8000
```
Open **`http://localhost:8000`** in your browser.

#### Option B: Node.js with `npx` (No global install required)
```bash
npx http-server -p 8000
```
*or*
```bash
npx serve .
```
Open **`http://localhost:8000`** (or the port displayed in terminal) in your browser.

#### Option C: VS Code Live Server
1. Open the project folder in VS Code.
2. Right-click `index.html` and select **Open with Live Server** (or click **Go Live** on the bottom status bar).
3. The dashboard opens automatically at `http://127.0.0.1:5500`.

> **Note:** If running `http-server` directly returns `'http-server' is not recognized`, use `npx http-server -p 8000` instead, which runs it without needing global installation.

---

## 📖 Simulated Flight Manual & Walkthrough

To perform a complete mock flight mission simulation and test all features:

1. **Self-Check & Calibration:** 
   * Hit **SYNC TIME** on the top bar to synchronize avionics clocks with ground station local chronometers.
   * Observe the logs terminal document: `Avionics internal chronometer synched`.
2. **Launch Ignition:**
   * Hit **START TELEMETRY** on the top bar.
   * Ground station binds a connection at 5Hz. The system moves to `LAUNCH` phase.
   * Self-tests run for 6 seconds, and then the launcher rockets up, transitioning to `ASCENT` phase.
3. **Ascent Phase:**
   * Altitude climbs rapidly towards 1000 meters.
   * Pressure drops exponentially, battery voltage drains steadily, and temperatures decay according to atmospheric lapse rates.
   * Real-time plots plot thin, crisp telemetry lines. Map draws a vector drift path drift. Three.js cylinder rolls, pitches, and spins.
4. **Apogee & Separation Window:**
   * At ~1000m, CanSat reaches apogee. The simulator enters `DEPLOYMENT` phase, mimicking physical separation tumbling.
   * **Payload Separation Failure (Digit 3 -> `0010`)** will trigger if you wait more than 5 seconds without manual separation.
   * To release restraints safely: Drag the **PAYLOAD SEPARATION** slider handle all the way to the right. Confirm the critical pop-up overlay.
   * Downlink registers `UPLINK: [MANUAL_SEPARATION] executed`. CanSat enters `DESCENT` phase.
5. **Controlled Descent & Failures:**
   * CanSat begins steady descent.
   * *Emergency parachute test:* If you want to simulate a parachute deployment failure, you can let it fall at ~19 m/s. This triggers the **Descent Rate Fault (Digit 1 -> `1000`)** in crimson.
   * To resolve: Drag the **EMERGENCY PARACHUTE** slider and authorize transmission. Descent velocity recovers to a slow, safe ~6 m/s. The fault register returns to normal.
6. **Aux Redundant Power Cells:**
   * Voltage will decay below 3.5V over long flights.
   * Click **ENGAGE AUX CIRCUIT** on the right column. Secondary battery cell layers engage, recovering voltage levels to a healthy 3.98V.
7. **Landing:**
   * At 0m, the simulator enters `LANDING` phase.
   * Descent rate drops to 0, three-axis orientation settles flat, and standard recovery beacons fire.
8. **Operations Data Export:**
   * Under the **EXPORT DATA** dropdown on the top bar, you can click:
     * **Telemetry Log (.CSV)** to compile and download Excel-formatted database logs.
     * **Graph Canvas Capture** to capture high-res graphical PNG outputs of all active plots.
