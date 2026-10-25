import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TelemetryRecord } from '../../types';
import { Maximize2, Minimize2, Eye, RotateCw, Wind, Flame, Layers } from 'lucide-react';

interface SaveBoxTwinProps {
  telemetry: TelemetryRecord;
  exploded?: boolean;
  lidOpen?: boolean;
  wireframe?: boolean;
  interactive?: boolean;
}

export const SaveBoxTwin: React.FC<SaveBoxTwinProps> = ({
  telemetry,
  exploded: initialExploded = false,
  lidOpen: initialLidOpen = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // UI Dock Controls
  const [explodedVal, setExplodedVal] = useState<number>(initialExploded ? 1 : 0);
  const [lidOpenVal, setLidOpenVal] = useState<number>(initialLidOpen ? 1 : 0);
  const [isXray, setIsXray] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showThermalAirflow, setShowThermalAirflow] = useState<boolean>(true);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<'ISOMETRIC' | 'CORE' | 'VIALS' | 'FAN'>('ISOMETRIC');

  // Mutable refs for animation loop
  const sceneRef = useRef<{
    fanImpeller?: THREE.Group;
    lidGroup?: THREE.Group;
    chassisGroup?: THREE.Group;
    vialTrayGroup?: THREE.Group;
    peltierGroup?: THREE.Group;
    hotParticles?: THREE.Points;
    coldParticles?: THREE.Points;
    oledCanvas?: HTMLCanvasElement;
    oledTexture?: THREE.CanvasTexture;
    statusLedMat?: THREE.MeshStandardMaterial;
    bodyMaterials: THREE.Material[];
    transparentMaterials: THREE.Material[];
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    targetCameraPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
  }>({
    bodyMaterials: [],
    transparentMaterials: [],
    targetCameraPos: new THREE.Vector3(4.5, 3.8, 4.5),
    targetLookAt: new THREE.Vector3(0, 0.4, 0),
  });

  // Track latest props in refs for animation loop without tearing down WebGL
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  const explodedTargetRef = useRef(explodedVal);
  explodedTargetRef.current = explodedVal;

  const lidOpenTargetRef = useRef(lidOpenVal);
  lidOpenTargetRef.current = lidOpenVal;

  const isXrayRef = useRef(isXray);
  isXrayRef.current = isXray;

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const showThermalAirflowRef = useRef(showThermalAirflow);
  showThermalAirflowRef.current = showThermalAirflow;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.04);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(4.5, 3.8, 4.5);
    sceneRef.current.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // prevent going below ground
    controls.minDistance = 2.0;
    controls.maxDistance = 12.0;
    controls.target.set(0, 0.4, 0);
    sceneRef.current.controls = controls;

    // Studio Environment map via PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Studio 3-Point Lighting
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.2);
    keyLight.position.set(5, 8, 4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0x38bdf8, 0x0284c7, 0.85);
    fillLight.position.set(0, 10, 0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.2);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    // Soft Ground Grid & Radial Contact Shadow
    const groundGeo = new THREE.PlaneGeometry(14, 14);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0b1120,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = !isSoftwareGl;
    scene.add(ground);

    // Procedural Grid Texture on Ground
    const gridHelper = new THREE.GridHelper(10, 20, 0x0284c7, 0x1e293b);
    gridHelper.position.y = 0.005;
    scene.add(gridHelper);

    // Contact shadow beneath cold box
    const shadowGeo = new THREE.PlaneGeometry(3.6, 2.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.01;
    scene.add(contactShadow);

    // ==========================================
    // PROCEDURAL SAVE BOX 3D MODEL ASSEMBLY
    // ==========================================
    const rootBoxGroup = new THREE.Group();
    scene.add(rootBoxGroup);

    // Track materials for X-Ray toggling
    const bodyMaterials: THREE.Material[] = [];
    const transparentMaterials: THREE.Material[] = [];
    sceneRef.current.bodyMaterials = bodyMaterials;
    sceneRef.current.transparentMaterials = transparentMaterials;

    // 1. Chassis Outer Shell (Medical Teal / Slate Polypropylene)
    const chassisGroup = new THREE.Group();
    rootBoxGroup.add(chassisGroup);
    sceneRef.current.chassisGroup = chassisGroup;

    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0891b2, // Medical teal/cyan
      roughness: 0.28,
      metalness: 0.15,
    });
    bodyMaterials.push(chassisMat);

    // Main box body (beveled procedural box)
    const boxOuterGeo = new THREE.BoxGeometry(2.4, 1.4, 1.8);
    const boxOuter = new THREE.Mesh(boxOuterGeo, chassisMat);
    boxOuter.position.y = 0.7;
    boxOuter.castShadow = !isSoftwareGl;
    boxOuter.receiveShadow = !isSoftwareGl;
    chassisGroup.add(boxOuter);

    // Dark Rugged Corner Bumpers (4 vertical corner pillars)
    const bumperMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.05,
    });
    bodyMaterials.push(bumperMat);

    const cornerPositions = [
      [-1.2, 0.7, -0.9],
      [1.2, 0.7, -0.9],
      [-1.2, 0.7, 0.9],
      [1.2, 0.7, 0.9],
    ];
    cornerPositions.forEach(([cx, cy, cz]) => {
      const bumperGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.45, 12);
      const bumper = new THREE.Mesh(bumperGeo, bumperMat);
      bumper.position.set(cx, cy, cz);
      bumper.castShadow = !isSoftwareGl;
      chassisGroup.add(bumper);
    });

    // Ergonomic Carry Handles (Left & Right)
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.7,
    });
    bodyMaterials.push(handleMat);

    [-1.24, 1.24].forEach((hx) => {
      const handleGroup = new THREE.Group();
      handleGroup.position.set(hx, 0.7, 0);

      const gripGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 16);
      const grip = new THREE.Mesh(gripGeo, handleMat);
      grip.rotation.x = Math.PI / 2;
      grip.position.x = hx > 0 ? 0.08 : -0.08;
      handleGroup.add(grip);

      // Stems
      [-0.25, 0.25].forEach((sz) => {
        const stemGeo = new THREE.BoxGeometry(0.12, 0.04, 0.04);
        const stem = new THREE.Mesh(stemGeo, handleMat);
        stem.position.set(hx > 0 ? 0.04 : -0.04, 0, sz);
        handleGroup.add(stem);
      });

      chassisGroup.add(handleGroup);
    });

    // 2. Interior Insulated Cold Chamber (Inner Cavity)
    const innerCavityMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // Brushed aluminum interior liner
      roughness: 0.25,
      metalness: 0.6,
      side: THREE.BackSide,
    });
    const innerCavityGeo = new THREE.BoxGeometry(1.6, 1.1, 1.2);
    const innerCavity = new THREE.Mesh(innerCavityGeo, innerCavityMat);
    innerCavity.position.set(-0.2, 0.8, 0);
    chassisGroup.add(innerCavity);

    // 3. Vaccine Vial Tray & Precision Glass Vials
    const vialTrayGroup = new THREE.Group();
    vialTrayGroup.position.set(-0.2, 0.35, 0);
    chassisGroup.add(vialTrayGroup);
    sceneRef.current.vialTrayGroup = vialTrayGroup;

    // Stainless steel rack with vial holder holes
    const rackMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.2,
      metalness: 0.85,
    });
    const rackGeo = new THREE.BoxGeometry(1.4, 0.08, 1.0);
    const rack = new THREE.Mesh(rackGeo, rackMat);
    rack.castShadow = !isSoftwareGl;
    vialTrayGroup.add(rack);

    // 6 Glass Vaccine Vials (2 rows of 3)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.88,
      transparent: true,
      opacity: isSoftwareGl ? 0.45 : 1.0,
      ior: 1.5,
      thickness: 0.4,
    });
    transparentMaterials.push(glassMat);

    const liquidColors = [0x06b6d4, 0x3b82f6, 0x10b981, 0x06b6d4, 0x8b5cf6, 0x38bdf8];
    const vialPositions = [
      [-0.45, -0.3],
      [0.0, -0.3],
      [0.45, -0.3],
      [-0.45, 0.3],
      [0.0, 0.3],
      [0.45, 0.3],
    ];

    vialPositions.forEach(([vx, vz], idx) => {
      const vialGroup = new THREE.Group();
      vialGroup.position.set(vx, 0.04, vz);

      // Glass cylinder body
      const vialGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.42, 16);
      const vial = new THREE.Mesh(vialGeo, glassMat);
      vial.position.y = 0.21;
      vialGroup.add(vial);

      // Vaccine liquid inside
      const liquidGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.26, 16);
      const liquidMat = new THREE.MeshStandardMaterial({
        color: liquidColors[idx % liquidColors.length],
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.75,
      });
      const liquid = new THREE.Mesh(liquidGeo, liquidMat);
      liquid.position.y = 0.15;
      vialGroup.add(liquid);

      // Rubber stopper & aluminum crimp cap
      const capMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? 0x0284c7 : 0x0d9488,
        roughness: 0.3,
        metalness: 0.8,
      });
      const capGeo = new THREE.CylinderGeometry(0.125, 0.125, 0.08, 16);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.44;
      vialGroup.add(cap);

      vialTrayGroup.add(vialGroup);
    });

    // 4. DS18B20 Temperature Probe placed in vial chamber
    const probeGroup = new THREE.Group();
    probeGroup.position.set(-0.2, 0.45, 0.42);
    chassisGroup.add(probeGroup);

    // Stainless steel probe tube
    const probeTipMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.15,
      metalness: 0.95,
    });
    const probeTipGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 12);
    const probeTip = new THREE.Mesh(probeTipGeo, probeTipMat);
    probeTip.rotation.x = Math.PI / 4;
    probeGroup.add(probeTip);

    // Coiled probe signal cable (black rubber)
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const cableGeo = new THREE.TorusGeometry(0.15, 0.02, 8, 24);
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.set(0.1, 0.1, -0.05);
    probeGroup.add(cable);

    // 5. Peltier Cooling Core & Heatsink (Right flank)
    const peltierGroup = new THREE.Group();
    peltierGroup.position.set(0.9, 0.7, 0);
    chassisGroup.add(peltierGroup);
    sceneRef.current.peltierGroup = peltierGroup;

    // Ceramic Peltier Module plate (TEC1-12706)
    const peltierCeramicMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
      metalness: 0.1,
    });
    const peltierCeramicGeo = new THREE.BoxGeometry(0.06, 0.45, 0.45);
    const peltierCeramic = new THREE.Mesh(peltierCeramicGeo, peltierCeramicMat);
    peltierGroup.add(peltierCeramic);

    // Extruded Aluminum Finned Heatsink (Hot Side)
    const heatsinkGroup = new THREE.Group();
    heatsinkGroup.position.set(0.15, 0, 0);
    peltierGroup.add(heatsinkGroup);

    const heatsinkMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.25,
      metalness: 0.85,
    });
    // Base plate
    const basePlateGeo = new THREE.BoxGeometry(0.08, 0.7, 0.7);
    const basePlate = new THREE.Mesh(basePlateGeo, heatsinkMat);
    heatsinkGroup.add(basePlate);

    // 10 cooling fins
    for (let f = -0.3; f <= 0.3; f += 0.065) {
      const finGeo = new THREE.BoxGeometry(0.2, 0.68, 0.02);
      const fin = new THREE.Mesh(finGeo, heatsinkMat);
      fin.position.set(0.12, 0, f);
      heatsinkGroup.add(fin);
    }

    // 6. Axial Cooling Fan Assembly
    const fanAssembly = new THREE.Group();
    fanAssembly.position.set(0.32, 0, 0);
    heatsinkGroup.add(fanAssembly);

    // Fan Shroud Frame
    const fanFrameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.7,
      metalness: 0.2,
    });
    const fanFrameGeo = new THREE.BoxGeometry(0.08, 0.72, 0.72);
    const fanFrame = new THREE.Mesh(fanFrameGeo, fanFrameMat);
    fanAssembly.add(fanFrame);

    // Fan Impeller Group (Rotates in animation loop)
    const fanImpeller = new THREE.Group();
    fanImpeller.position.set(0.05, 0, 0);
    fanAssembly.add(fanImpeller);
    sceneRef.current.fanImpeller = fanImpeller;

    // Center hub
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 });
    const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    fanImpeller.add(hub);

    // 7 Fan Blades
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Distinctive blue rotor blades
      roughness: 0.3,
      metalness: 0.3,
    });
    for (let b = 0; b < 7; b++) {
      const angle = (b / 7) * Math.PI * 2;
      const bladeGeo = new THREE.BoxGeometry(0.02, 0.24, 0.08);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, Math.cos(angle) * 0.2, Math.sin(angle) * 0.2);
      blade.rotation.x = angle + 0.35; // pitched blade
      fanImpeller.add(blade);
    }

    // Protective Wire Grill
    const grillMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
    for (let r = 0.12; r <= 0.34; r += 0.09) {
      const ringGeo = new THREE.TorusGeometry(r, 0.01, 8, 24);
      const ring = new THREE.Mesh(ringGeo, grillMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = 0.08;
      fanAssembly.add(ring);
    }

    // 7. Hermetic Insulated Lid with Latches & Viewing Window
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 1.4, -0.9); // Pivot hinge at back
    rootBoxGroup.add(lidGroup);
    sceneRef.current.lidGroup = lidGroup;

    const lidMat = new THREE.MeshStandardMaterial({
      color: 0x0e7490, // darker contrasting cyan
      roughness: 0.3,
      metalness: 0.2,
    });
    bodyMaterials.push(lidMat);

    // Main lid slab
    const lidSlabGeo = new THREE.BoxGeometry(2.44, 0.22, 1.84);
    const lidSlab = new THREE.Mesh(lidSlabGeo, lidMat);
    lidSlab.position.set(0, 0.11, 0.9);
    lidSlab.castShadow = !isSoftwareGl;
    lidGroup.add(lidSlab);

    // Dual Front Heavy-Duty Stainless Latches
    const latchMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.15,
      metalness: 0.95,
    });
    bodyMaterials.push(latchMat);

    [-0.6, 0.6].forEach((lx) => {
      const latchGeo = new THREE.BoxGeometry(0.12, 0.28, 0.06);
      const latch = new THREE.Mesh(latchGeo, latchMat);
      latch.position.set(lx, 0.05, 1.84);
      lidGroup.add(latch);
    });

    // 8. Front Telemetry OLED Display & Status LED
    const oledCanvas = document.createElement('canvas');
    oledCanvas.width = 512;
    oledCanvas.height = 256;
    const oledCtx = oledCanvas.getContext('2d');
    if (oledCtx) {
      oledCtx.fillStyle = '#020617';
      oledCtx.fillRect(0, 0, 512, 256);
      oledCtx.fillStyle = '#38bdf8';
      oledCtx.font = 'bold 36px monospace';
      oledCtx.fillText('SAVE BOX IoT', 28, 55);
      oledCtx.fillStyle = '#4ade80';
      oledCtx.font = 'bold 64px monospace';
      oledCtx.fillText('+5.0°C', 28, 140);
      oledCtx.font = '24px monospace';
      oledCtx.fillStyle = '#94a3b8';
      oledCtx.fillText('TARGET: 5.0°C | ESP32 OK', 28, 205);
    }
    const oledTexture = new THREE.CanvasTexture(oledCanvas);
    oledTexture.colorSpace = THREE.SRGBColorSpace;
    sceneRef.current.oledCanvas = oledCanvas;
    sceneRef.current.oledTexture = oledTexture;

    const oledMat = new THREE.MeshBasicMaterial({
      map: oledTexture,
    });
    const oledGeo = new THREE.PlaneGeometry(0.9, 0.45);
    const oledMesh = new THREE.Mesh(oledGeo, oledMat);
    oledMesh.position.set(-0.2, 0.82, 0.905);
    chassisGroup.add(oledMesh);

    // Status LED Beacon (Top right corner of front face)
    const statusLedMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    sceneRef.current.statusLedMat = statusLedMat;
    const statusLedGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const statusLed = new THREE.Mesh(statusLedGeo, statusLedMat);
    statusLed.position.set(0.55, 0.95, 0.905);
    chassisGroup.add(statusLed);

    // 9. Thermal Airflow & Dissipation Particles
    // Hot side exhaust particles (drifting out from fan)
    const hotParticleCount = 120;
    const hotParticleGeo = new THREE.BufferGeometry();
    const hotPositions = new Float32Array(hotParticleCount * 3);
    for (let i = 0; i < hotParticleCount * 3; i += 3) {
      hotPositions[i] = 1.4 + Math.random() * 0.8; // drifting right along X
      hotPositions[i + 1] = 0.5 + (Math.random() - 0.5) * 0.5;
      hotPositions[i + 2] = (Math.random() - 0.5) * 0.5;
    }
    hotParticleGeo.setAttribute('position', new THREE.BufferAttribute(hotPositions, 3));
    const hotParticleMat = new THREE.PointsMaterial({
      color: 0xf97316, // amber/orange hot air
      size: 0.05,
      transparent: true,
      opacity: 0.65,
    });
    const hotParticles = new THREE.Points(hotParticleGeo, hotParticleMat);
    scene.add(hotParticles);
    sceneRef.current.hotParticles = hotParticles;

    // Cold chamber mist particles
    const coldParticleCount = 80;
    const coldParticleGeo = new THREE.BufferGeometry();
    const coldPositions = new Float32Array(coldParticleCount * 3);
    for (let i = 0; i < coldParticleCount * 3; i += 3) {
      coldPositions[i] = -0.8 + Math.random() * 1.2;
      coldPositions[i + 1] = 0.4 + Math.random() * 0.5;
      coldPositions[i + 2] = -0.4 + Math.random() * 0.8;
    }
    coldParticleGeo.setAttribute('position', new THREE.BufferAttribute(coldPositions, 3));
    const coldParticleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.04,
      transparent: true,
      opacity: 0.45,
    });
    const coldParticles = new THREE.Points(coldParticleGeo, coldParticleMat);
    scene.add(coldParticles);
    sceneRef.current.coldParticles = coldParticles;

    // ==========================================
    // ANIMATION & RENDER LOOP
    // ==========================================
    let frameId = 0;
    const clock = new THREE.Clock();

    function updateOled(tempC: number, targetC: number, online: boolean, statusStr: string) {
      if (!oledCtx) return;
      oledCtx.fillStyle = '#020617';
      oledCtx.fillRect(0, 0, 512, 256);

      // Header
      oledCtx.fillStyle = '#38bdf8';
      oledCtx.font = 'bold 30px monospace';
      oledCtx.fillText('SAVE BOX IoT', 28, 48);

      oledCtx.font = '22px monospace';
      oledCtx.fillStyle = online ? '#4ade80' : '#ef4444';
      oledCtx.fillText(online ? 'ONLINE [WiFi]' : 'OFFLINE', 320, 48);

      // Big Temperature Number
      const isExcursion = tempC > 8.0 || tempC < 2.0;
      oledCtx.fillStyle = isExcursion ? '#ef4444' : '#22c55e';
      oledCtx.font = 'bold 74px monospace';
      oledCtx.fillText(`${tempC.toFixed(1)}°C`, 28, 142);

      // Bottom status bar
      oledCtx.font = '24px monospace';
      oledCtx.fillStyle = '#94a3b8';
      oledCtx.fillText(`SET: ${targetC.toFixed(1)}°C | STAT: ${statusStr}`, 28, 210);

      oledTexture.needsUpdate = true;
    }

    let lastOledUpdate = 0;

    function tick() {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth camera interpolation towards preset
      if (sceneRef.current.camera && sceneRef.current.controls) {
        sceneRef.current.camera.position.lerp(sceneRef.current.targetCameraPos, 0.05);
        sceneRef.current.controls.target.lerp(sceneRef.current.targetLookAt, 0.05);
        if (autoRotateRef.current) {
          rootBoxGroup.rotation.y += 0.004;
        }
        sceneRef.current.controls.update();
      }

      // Rotate fan blades based on live fan RPM or duty
      const currentTelemetry = telemetryRef.current;
      const fanRunning = currentTelemetry.fan.running && !currentTelemetry.fan.fault;
      if (sceneRef.current.fanImpeller && fanRunning) {
        const rpm = currentTelemetry.fan.rpm || currentTelemetry.fan.pwmPercent * 25;
        const speed = (rpm / 60) * Math.PI * 2 * delta;
        sceneRef.current.fanImpeller.rotation.x += speed * 0.25;
      }

      // Exploded View smoothly damped
      const targetExploded = explodedTargetRef.current;
      if (sceneRef.current.lidGroup) {
        const targetLidAngle = lidOpenTargetRef.current * (Math.PI / 2.3);
        sceneRef.current.lidGroup.rotation.x = THREE.MathUtils.damp(
          sceneRef.current.lidGroup.rotation.x,
          -targetLidAngle,
          6,
          delta
        );

        // Displace lid along Y in exploded view
        const targetLidY = 1.4 + targetExploded * 1.2;
        sceneRef.current.lidGroup.position.y = THREE.MathUtils.damp(
          sceneRef.current.lidGroup.position.y,
          targetLidY,
          6,
          delta
        );
      }

      if (sceneRef.current.peltierGroup) {
        const targetPeltierX = 0.9 + targetExploded * 0.9;
        sceneRef.current.peltierGroup.position.x = THREE.MathUtils.damp(
          sceneRef.current.peltierGroup.position.x,
          targetPeltierX,
          6,
          delta
        );
      }

      if (sceneRef.current.vialTrayGroup) {
        const targetVialY = 0.35 + targetExploded * 0.6;
        sceneRef.current.vialTrayGroup.position.y = THREE.MathUtils.damp(
          sceneRef.current.vialTrayGroup.position.y,
          targetVialY,
          6,
          delta
        );
      }

      // Animate thermal particles
      if (showThermalAirflowRef.current) {
        if (sceneRef.current.hotParticles && fanRunning) {
          sceneRef.current.hotParticles.visible = true;
          const pos = sceneRef.current.hotParticles.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < hotParticleCount * 3; i += 3) {
            pos[i] += 0.02 + Math.random() * 0.01; // drift right
            pos[i + 1] += (Math.random() - 0.5) * 0.005;
            if (pos[i] > 2.6) {
              pos[i] = 1.35;
              pos[i + 1] = 0.5 + (Math.random() - 0.5) * 0.4;
              pos[i + 2] = (Math.random() - 0.5) * 0.4;
            }
          }
          sceneRef.current.hotParticles.geometry.attributes.position.needsUpdate = true;
        } else if (sceneRef.current.hotParticles) {
          sceneRef.current.hotParticles.visible = false;
        }

        if (sceneRef.current.coldParticles) {
          sceneRef.current.coldParticles.visible = currentTelemetry.peltier.commandedOn;
          const pos = sceneRef.current.coldParticles.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < coldParticleCount * 3; i += 3) {
            pos[i + 1] -= 0.003; // cold air sinking
            if (pos[i + 1] < 0.35) {
              pos[i + 1] = 0.85;
            }
          }
          sceneRef.current.coldParticles.geometry.attributes.position.needsUpdate = true;
        }
      } else {
        if (sceneRef.current.hotParticles) sceneRef.current.hotParticles.visible = false;
        if (sceneRef.current.coldParticles) sceneRef.current.coldParticles.visible = false;
      }

      // Periodically update OLED display
      if (elapsed - lastOledUpdate > 0.4) {
        lastOledUpdate = elapsed;
        const temp = currentTelemetry.temperature.valueC;
        const status =
          temp > 8.0 ? 'OVERHEAT' : temp < 2.0 ? 'FREEZE' : currentTelemetry.peltier.commandedOn ? 'COOLING' : 'HOLDING';
        updateOled(temp, currentTelemetry.temperature.targetC, currentTelemetry.esp32.online, status);

        // Update Status LED
        if (sceneRef.current.statusLedMat) {
          if (!currentTelemetry.esp32.online) {
            sceneRef.current.statusLedMat.color.setHex(0x64748b);
            sceneRef.current.statusLedMat.emissive.setHex(0x000000);
          } else if (temp > 8.0 || temp < 2.0 || currentTelemetry.peltier.fault) {
            sceneRef.current.statusLedMat.color.setHex(0xef4444);
            sceneRef.current.statusLedMat.emissive.setHex(0xef4444);
          } else if (currentTelemetry.peltier.commandedOn) {
            sceneRef.current.statusLedMat.color.setHex(0x06b6d4);
            sceneRef.current.statusLedMat.emissive.setHex(0x06b6d4);
          } else {
            sceneRef.current.statusLedMat.color.setHex(0x22c55e);
            sceneRef.current.statusLedMat.emissive.setHex(0x22c55e);
          }
        }
      }

      // Apply X-Ray transparency if toggled
      const isX = isXrayRef.current;
      bodyMaterials.forEach((m) => {
        m.transparent = isX;
        m.opacity = isX ? 0.28 : 1.0;
        m.depthWrite = !isX;
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        // Pace loop on software WebGL
        frameId = window.setTimeout(tick, 60);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    // Handle Window Resizing
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (isSoftwareGl) clearTimeout(frameId);
      else cancelAnimationFrame(frameId);
      renderer.dispose();
    };
  }, []);

  // Camera preset handler
  const setPreset = (preset: 'ISOMETRIC' | 'CORE' | 'VIALS' | 'FAN') => {
    setCameraPreset(preset);
    if (!sceneRef.current.camera) return;
    if (preset === 'ISOMETRIC') {
      sceneRef.current.targetCameraPos.set(4.5, 3.8, 4.5);
      sceneRef.current.targetLookAt.set(0, 0.4, 0);
    } else if (preset === 'CORE') {
      sceneRef.current.targetCameraPos.set(2.8, 1.8, 1.2);
      sceneRef.current.targetLookAt.set(0.9, 0.7, 0);
    } else if (preset === 'VIALS') {
      setLidOpenVal(1);
      sceneRef.current.targetCameraPos.set(-0.2, 3.2, 1.4);
      sceneRef.current.targetLookAt.set(-0.2, 0.4, 0);
    } else if (preset === 'FAN') {
      sceneRef.current.targetCameraPos.set(3.2, 1.2, 0);
      sceneRef.current.targetLookAt.set(1.4, 0.7, 0);
    }
  };

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      {/* 3D Canvas Mounting Point */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top overlay badge: Model Identity & Active State */}
      <div className="absolute top-4 left-4 z-10 flex items-center space-x-3 pointer-events-none">
        <div className="bg-slate-900/90 border border-slate-700/80 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-lg flex items-center space-x-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              telemetry.temperature.valueC > 8.0 || telemetry.temperature.valueC < 2.0
                ? 'bg-rose-500'
                : telemetry.peltier.commandedOn
                ? 'bg-cyan-400'
                : 'bg-emerald-400'
            }`}
          />
          <div>
            <div className="text-xs font-bold text-white tracking-wider uppercase font-mono">
              SAVE Box Digital Twin
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Peltier: {telemetry.peltier.commandedOn ? 'ACTIVE' : 'IDLE'} | Fan: {telemetry.fan.rpm ?? (telemetry.fan.pwmPercent * 24)} RPM
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (skill compliance: no backdrop-filter over WebGL, solid/rgba surfaces) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-[840px] pointer-events-auto">
        {/* Toggle Collapse Bar */}
        <div className="flex justify-center -mb-px">
          <button
            onClick={() => setIsDockCollapsed(!isDockCollapsed)}
            className="bg-slate-900 border-t border-x border-slate-700 text-slate-300 hover:text-white px-3 py-1 rounded-t-lg text-xs font-mono flex items-center space-x-1.5 transition-colors shadow-md"
          >
            {isDockCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            <span>{isDockCollapsed ? 'Show 3D Controls' : 'Hide Controls'}</span>
          </button>
        </div>

        {/* Main Dock Container */}
        {!isDockCollapsed && (
          <div className="bg-slate-900/95 border border-slate-700/90 rounded-2xl p-3 shadow-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Camera Presets */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-mono text-slate-400 px-2">View:</span>
                <button
                  onClick={() => setPreset('ISOMETRIC')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    cameraPreset === 'ISOMETRIC'
                      ? 'bg-cyan-500 text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Isometric
                </button>
                <button
                  onClick={() => setPreset('CORE')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    cameraPreset === 'CORE'
                      ? 'bg-cyan-500 text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Peltier Core
                </button>
                <button
                  onClick={() => setPreset('VIALS')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    cameraPreset === 'VIALS'
                      ? 'bg-cyan-500 text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Vaccine Rack
                </button>
                <button
                  onClick={() => setPreset('FAN')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    cameraPreset === 'FAN'
                      ? 'bg-cyan-500 text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Exhaust Fan
                </button>
              </div>

              {/* Quick Action Toggles */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsXray(!isXray)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                    isXray
                      ? 'bg-cyan-600 border-cyan-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Toggle X-Ray Transparency to see internal vials and Peltier"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>X-Ray</span>
                </button>

                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                    autoRotate
                      ? 'bg-cyan-600 border-cyan-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Toggle continuous turntable rotation"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Turntable</span>
                </button>

                <button
                  onClick={() => setShowThermalAirflow(!showThermalAirflow)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                    showThermalAirflow
                      ? 'bg-amber-600 border-amber-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Toggle thermal dissipation particle flow"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Thermal Flow</span>
                </button>
              </div>
            </div>

            {/* Exploded View & Chamber Lid Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800">
              <div className="flex items-center space-x-2 text-xs text-slate-300">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="w-24 text-[11px] font-mono">Exploded View:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={explodedVal}
                  onChange={(e) => setExplodedVal(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <span className="text-[10px] font-mono text-cyan-400 w-8 text-right">
                  {Math.round(explodedVal * 100)}%
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-300">
                <Wind className="w-3.5 h-3.5 text-emerald-400" />
                <span className="w-24 text-[11px] font-mono">Chamber Lid:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={lidOpenVal}
                  onChange={(e) => setLidOpenVal(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <span className="text-[10px] font-mono text-emerald-400 w-8 text-right">
                  {Math.round(lidOpenVal * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
