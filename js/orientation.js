/**
 * CanSat Ground Control Software - 3D Orientation Visualizer
 * Renders spatial telemetry rotations in high-performance WebGL using Three.js
 */

import { CONFIG } from './config.js';

class SpatialOrientation {
  constructor() {
    this.container = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.modelGroup = null; // Cylinder + solar arrays + antenna group
    this.horizonGrid = null;
    
    // Animation target rotations (for smoothing)
    this.target = { roll: 0, pitch: 0, yaw: 0 };
    this.current = { roll: 0, pitch: 0, yaw: 0 };
    
    this.animationId = null;
  }

  /**
   * Initializes WebGL scene, lighting systems, and geometric structures
   */
  initialize() {
    this.container = document.getElementById('three-canvas-container');
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Setup Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.ARTIFICIAL_HORIZON.COLOR_SKY);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 8); // Look directly at center

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 2. Add Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 7);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x0ea5e9, 0.35); // Cyan color reflection
    dirLight2.position.set(-5, -5, -2);
    this.scene.add(dirLight2);

    // 3. Create Aerospace Horizon Grid System (Instruments feeling)
    this.horizonGrid = new THREE.Group();
    
    // Pitch rings (circles on sphere)
    const ringMat = new THREE.LineBasicMaterial({ color: 0x222b3b, transparent: true, opacity: 0.5 });
    
    for (let r = -60; r <= 60; r += 20) {
      if (r === 0) continue;
      const radius = 3.5 * Math.cos((r * Math.PI) / 180);
      const y = 3.5 * Math.sin((r * Math.PI) / 180);
      const ringGeom = new THREE.RingGeometry(radius - 0.02, radius + 0.02, 64);
      const lineRing = new THREE.LineSegments(new THREE.EdgesGeometry(ringGeom), ringMat);
      lineRing.rotation.x = Math.PI / 2;
      lineRing.position.y = y;
      this.horizonGrid.add(lineRing);
    }

    // Main horizon ring (Equator)
    const eqGeom = new THREE.RingGeometry(3.48, 3.52, 64);
    const eqMat = new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.7 });
    const equator = new THREE.LineSegments(new THREE.EdgesGeometry(eqGeom), eqMat);
    equator.rotation.x = Math.PI / 2;
    this.horizonGrid.add(equator);

    // Subtle polar grid
    const polarGrid = new THREE.GridHelper(7, 14, 0x1e2633, 0x111620);
    polarGrid.position.y = -3.5;
    this.scene.add(polarGrid);
    this.scene.add(this.horizonGrid);

    // 4. Construct 3D Engineering CanSat Cylinder Model
    this.modelGroup = new THREE.Group();

    // Body Cylinder (Aerospace dark metal CAD design)
    const bodyGeom = new THREE.CylinderGeometry(1.2, 1.2, 3.2, 32);
    const bodyMat = new THREE.MeshPhongMaterial({
      color: 0x1a2333,
      emissive: 0x070b12,
      specular: 0x0ea5e9,
      shininess: 30,
      flatShading: true
    });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    this.modelGroup.add(bodyMesh);

    // Wireframe Overlay (for premium engineering feel)
    const wireGeom = new THREE.CylinderGeometry(1.205, 1.205, 3.205, 16, 4);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });
    const wireMesh = new THREE.Mesh(wireGeom, wireMat);
    this.modelGroup.add(wireMesh);

    // Top/Bottom Plates (Muted metal caps)
    const capGeom = new THREE.CylinderGeometry(1.25, 1.25, 0.15, 32);
    const capMat = new THREE.MeshPhongMaterial({ color: 0x2d3c54, shininess: 50 });
    
    const topCap = new THREE.Mesh(capGeom, capMat);
    topCap.position.y = 1.6;
    this.modelGroup.add(topCap);

    const bottomCap = new THREE.Mesh(capGeom, capMat);
    bottomCap.position.y = -1.6;
    this.modelGroup.add(bottomCap);

    // Solar Panel Arrays (Planted on side flanks)
    const panelGeom = new THREE.BoxGeometry(0.1, 2.2, 0.7);
    const panelMat = new THREE.MeshPhongMaterial({
      color: 0x064e3b, // Deep Emerald
      specular: 0x10b981,
      shininess: 60
    });
    const panelWireMat = new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true, transparent: true, opacity: 0.3 });

    // Panel Left
    const panelLeft = new THREE.Mesh(panelGeom, panelMat);
    panelLeft.position.set(-1.25, 0, 0);
    const panelLeftWire = new THREE.Mesh(panelGeom.clone().scale(1.02, 1.02, 1.02), panelWireMat);
    panelLeft.add(panelLeftWire);
    this.modelGroup.add(panelLeft);

    // Panel Right
    const panelRight = new THREE.Mesh(panelGeom, panelMat);
    panelRight.position.set(1.25, 0, 0);
    const panelRightWire = new THREE.Mesh(panelGeom.clone().scale(1.02, 1.02, 1.02), panelWireMat);
    panelRight.add(panelRightWire);
    this.modelGroup.add(panelRight);

    // Communication Antenna on top plate
    const antGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8);
    const antMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const antenna = new THREE.Mesh(antGeom, antMat);
    antenna.position.set(0, 2.15, 0);
    this.modelGroup.add(antenna);

    this.scene.add(this.modelGroup);

    // 5. Start stable 60 FPS Render animation loop
    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.animate();

    // 6. Handle viewport re-sizing
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Smoothly interpolates and rotates WebGL objects based on Pitch, Roll, and Yaw angles
   * @param {Object} state - Telemetry state packet
   */
  update(state) {
    // Save target rotations (Converting degrees to Euler Radians)
    // Pitch = X axis, Yaw = Y axis, Roll = Z axis
    this.target.pitch = (state.pitch * Math.PI) / 180;
    this.target.roll = (state.roll * Math.PI) / 180;
    this.target.yaw = (state.yaw * Math.PI) / 180;

    // Update overlay instrumentation readouts
    document.getElementById('fd-pitch').textContent = `${state.pitch.toFixed(1)}°`;
    document.getElementById('fd-roll').textContent = `${state.roll.toFixed(1)}°`;
    document.getElementById('fd-yaw').textContent = `${state.yaw.toFixed(1)}°`;
    document.getElementById('fd-alt').textContent = `${state.altitude.toFixed(0)}m`;
  }

  /**
   * Resets orientation back to initial stable flat vertical status
   */
  reset() {
    this.target.roll = 0;
    this.target.pitch = 0;
    this.target.yaw = Math.PI; // Look South
    
    document.getElementById('fd-pitch').textContent = `0.0°`;
    document.getElementById('fd-roll').textContent = `0.0°`;
    document.getElementById('fd-yaw').textContent = `0.0°`;
    document.getElementById('fd-alt').textContent = `0m`;
  }

  /**
   * Standard WebGL animation frame re-paint
   */
  animate() {
    this.animationId = requestAnimationFrame(this.animate);

    // Linear interpolation (Lerp) smoothing constants for realistic movement inertia
    const lerpFactor = 0.085;
    this.current.roll += (this.target.roll - this.current.roll) * lerpFactor;
    this.current.pitch += (this.target.pitch - this.current.pitch) * lerpFactor;
    
    // Yaw handles angles wrap-arounds cleanly
    let diffYaw = this.target.yaw - this.current.yaw;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    this.current.yaw += diffYaw * lerpFactor;

    // Apply Euler rotations in standard aeronautic YXZ sequence
    if (this.modelGroup) {
      this.modelGroup.rotation.set(
        this.current.pitch,
        this.current.yaw,
        this.current.roll,
        'YXZ'
      );
    }

    // Rotate subtle horizon grid opposite to sway to feel like real aircraft HUD
    if (this.horizonGrid) {
      this.horizonGrid.rotation.set(
        -this.current.pitch * 0.15,
        0,
        -this.current.roll * 0.15
      );
    }

    // Render pass
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Resizes viewport when main sidebar expands
   */
  handleResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Cleanup Three instances when system stops
   */
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    window.removeEventListener('resize', this.handleResize);
  }
}

export const spatialOrientation = new SpatialOrientation();
export default spatialOrientation;
