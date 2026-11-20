import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Box, Compass, Eye, EyeOff, Map as MapIcon, Minus, Plus} from 'lucide-react';
import {
  AmenityCategory,
  CampusBuilding,
  GeolocationStatus,
  LatLngLiteral,
  OriginAnchorMode,
  WalkingRouteResult,
} from '../types/campus';
import {CAMPUS_ANCHOR_COORDS} from '../data/campusData';
import {
  CENTRAL_PLAZA_LOCATION,
  formatDistanceLabel,
  getCampusWalkwaySegments,
} from '../services/routingService';
import {
  buildCampusBuildingGroup,
  BuildingModelAssets,
  createSharedBuildingTextures,
  SharedBuildingTextures,
} from './campus3d/buildingModels';

interface Campus3DModelProps {
  campusCenter: LatLngLiteral;
  buildings: CampusBuilding[];
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string) => void;
  activeAmenityFilter: AmenityCategory;
  userGpsLocation: LatLngLiteral | null;
  activeOrigin: LatLngLiteral | null;
  originMode: OriginAnchorMode;
  geoStatus: GeolocationStatus;
  activeRoute: WalkingRouteResult | null;
  cameraRecenterNonce: number;
}

interface LocalVec2 {
  x: number;
  z: number;
}

interface ProjectedBuildingLayout {
  building: CampusBuilding;
  pos: LocalVec2;
  lookAngleY: number;
}

interface RoadSegment {
  a: LocalVec2;
  b: LocalVec2;
  isMainSpine?: boolean;
}

const METERS_PER_LAT = 111320;

function projectLatLngToLocal(
  loc: LatLngLiteral,
  center: LatLngLiteral
): LocalVec2 {
  const metersPerLng =
    METERS_PER_LAT * Math.cos((center.lat * Math.PI) / 180);
  return {
    x: (loc.lng - center.lng) * metersPerLng,
    z: -(loc.lat - center.lat) * METERS_PER_LAT,
  };
}

function dist2D(a: LocalVec2, b: LocalVec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function pointToSegmentDist(p: LocalVec2, a: LocalVec2, b: LocalVec2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-4) return dist2D(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lenSq)
  );
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

function createRoundedRectShape(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  radius: number
): THREE.Shape {
  const w = maxX - minX;
  const h = maxZ - minZ;
  const r = Math.min(radius, w * 0.25, h * 0.25);
  const shape = new THREE.Shape();
  const x0 = minX;
  const x1 = maxX;
  const y0 = -maxZ;
  const y1 = -minZ;

  shape.moveTo(x0 + r, y0);
  shape.lineTo(x1 - r, y0);
  shape.quadraticCurveTo(x1, y0, x1, y0 + r);
  shape.lineTo(x1, y1 - r);
  shape.quadraticCurveTo(x1, y1, x1 - r, y1);
  shape.lineTo(x0 + r, y1);
  shape.quadraticCurveTo(x0, y1, x0, y1 - r);
  shape.lineTo(x0, y0 + r);
  shape.quadraticCurveTo(x0, y0, x0 + r, y0);
  shape.closePath();
  return shape;
}

export const Campus3DModel: React.FC<Campus3DModelProps> = ({
  campusCenter,
  buildings,
  selectedBuildingId,
  onSelectBuilding,
  activeAmenityFilter,
  userGpsLocation,
  activeOrigin,
  originMode,
  geoStatus,
  activeRoute,
  cameraRecenterNonce,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelNodesRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const gateLabelNodesRef = useRef<Record<string, HTMLDivElement | null>>({});

  const [showLabels, setShowLabels] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<'3d' | 'top'>('3d');
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(
    null
  );
  const [contextLost, setContextLost] = useState(false);

  const projectedLayouts: ProjectedBuildingLayout[] = useMemo(() => {
    const plazaLocal = projectLatLngToLocal(
      CENTRAL_PLAZA_LOCATION,
      campusCenter
    );
    return buildings.map((b) => {
      const pos = projectLatLngToLocal(b.location, campusCenter);
      const dx = plazaLocal.x - pos.x;
      const dz = plazaLocal.z - pos.z;
      const lookAngleY = Math.hypot(dx, dz) > 4 ? Math.atan2(dx, dz) : 0;
      return {
        building: b,
        pos,
        lookAngleY,
      };
    });
  }, [buildings, campusCenter]);

  const gateAnchors = useMemo(
    () => [
      {
        id: CAMPUS_ANCHOR_COORDS.mainGate.id,
        label: '가톨릭관동대 정문',
        pos: projectLatLngToLocal(
          CAMPUS_ANCHOR_COORDS.mainGate.location,
          campusCenter
        ),
      },
      {
        id: CAMPUS_ANCHOR_COORDS.backGate.id,
        label: '후문 (동측 진입)',
        pos: projectLatLngToLocal(
          CAMPUS_ANCHOR_COORDS.backGate.location,
          campusCenter
        ),
      },
    ],
    [campusCenter]
  );

  const layoutMapRef = useRef<Record<string, ProjectedBuildingLayout>>({});
  useEffect(() => {
    const next: Record<string, ProjectedBuildingLayout> = {};
    for (const item of projectedLayouts) {
      next[item.building.id] = item;
    }
    layoutMapRef.current = next;
  }, [projectedLayouts]);

  const gateAnchorsRef = useRef(gateAnchors);
  gateAnchorsRef.current = gateAnchors;

  const onSelectBuildingRef = useRef(onSelectBuilding);
  onSelectBuildingRef.current = onSelectBuilding;

  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  // Refs to live Three.js engine objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const campusGroupRef = useRef<THREE.Group | null>(null);
  const routeGroupRef = useRef<THREE.Group | null>(null);
  const buildingAssetsRef = useRef<Record<string, BuildingModelAssets>>({});
  const sharedTexturesRef = useRef<SharedBuildingTextures | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const isSoftwareGlRef = useRef(false);

  // Camera transition state
  const camGoalPosRef = useRef<THREE.Vector3 | null>(null);
  const camGoalTargetRef = useRef<THREE.Vector3 | null>(null);
  const overviewCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(140, 260, 340));
  const topDownCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 480, 14));
  const overviewTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const rafIdRef = useRef<number | null>(null);

  const updateProjectedLabels = useCallback(() => {
    const camera = cameraRef.current;
    const mount = mountRef.current;
    if (!camera || !mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;
    if (width === 0 || height === 0) return;

    const vec = new THREE.Vector3();
    for (const [id, layout] of Object.entries(layoutMapRef.current)) {
      const btn = labelNodesRef.current[id];
      if (!btn) continue;

      if (!showLabelsRef.current) {
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
        continue;
      }

      const assets = buildingAssetsRef.current[id];
      const roofY = assets ? assets.roofHeight + 5.5 : 22;
      vec.set(layout.pos.x, roofY, layout.pos.z);
      vec.project(camera);

      const isBehind = vec.z > 1 || vec.z < -1;
      const sx = (vec.x * 0.5 + 0.5) * width;
      const sy = (-vec.y * 0.5 + 0.5) * height;
      const outOfBounds =
        sx < -40 || sx > width + 40 || sy < -30 || sy > height + 30;

      if (isBehind || outOfBounds) {
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
      } else {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        btn.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(
          1
        )}px, 0) translate(-50%, -100%)`;
      }
    }

    for (const gate of gateAnchorsRef.current) {
      const el = gateLabelNodesRef.current[gate.id];
      if (!el) continue;
      if (!showLabelsRef.current) {
        el.style.opacity = '0';
        continue;
      }
      vec.set(gate.pos.x, 7.5, gate.pos.z);
      vec.project(camera);
      const isBehind = vec.z > 1 || vec.z < -1;
      const sx = (vec.x * 0.5 + 0.5) * width;
      const sy = (-vec.y * 0.5 + 0.5) * height;
      const outOfBounds =
        sx < -40 || sx > width + 40 || sy < -30 || sy > height + 30;
      if (isBehind || outOfBounds) {
        el.style.opacity = '0';
      } else {
        el.style.opacity = '1';
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(
          1
        )}px, 0) translate(-50%, -100%)`;
      }
    }
  }, []);

  const stopCameraAnimationLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const startCameraAnimationLoop = useCallback(() => {
    if (rafIdRef.current !== null) return;

    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) {
        rafIdRef.current = null;
        return;
      }

      let stillAnimating = false;

      if (camGoalPosRef.current && camGoalTargetRef.current) {
        const lambda = isSoftwareGlRef.current ? 14 : 6.5;
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          camGoalPosRef.current.x,
          lambda,
          dt
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          camGoalPosRef.current.y,
          lambda,
          dt
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          camGoalPosRef.current.z,
          lambda,
          dt
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          camGoalTargetRef.current.x,
          lambda,
          dt
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          camGoalTargetRef.current.y,
          lambda,
          dt
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          camGoalTargetRef.current.z,
          lambda,
          dt
        );

        const posDist = camera.position.distanceTo(camGoalPosRef.current);
        const tgtDist = controls.target.distanceTo(camGoalTargetRef.current);
        if (posDist < 0.35 && tgtDist < 0.35) {
          camera.position.copy(camGoalPosRef.current);
          controls.target.copy(camGoalTargetRef.current);
          camGoalPosRef.current = null;
          camGoalTargetRef.current = null;
        } else {
          stillAnimating = true;
        }
      }

      const dampingChanged = controls.update();
      requestRenderRef.current();

      if (stillAnimating || (controls.enableDamping && dampingChanged)) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const focusCameraOnGoal = useCallback(
    (pos: THREE.Vector3, target: THREE.Vector3) => {
      if (isSoftwareGlRef.current && cameraRef.current && controlsRef.current) {
        cameraRef.current.position.copy(pos);
        controlsRef.current.target.copy(target);
        controlsRef.current.update();
        requestRenderRef.current();
        return;
      }
      camGoalPosRef.current = pos.clone();
      camGoalTargetRef.current = target.clone();
      startCameraAnimationLoop();
    },
    [startCameraAnimationLoop]
  );

  // 1. Initialize WebGL Scene, Renderer, Lights, RoomEnvironment & OrbitControls ONCE
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    mount.innerHTML = '';

    const probeCanvas = document.createElement('canvas');
    const probeGl =
      probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    let rendererString = '';
    if (probeGl) {
      const debugExt = probeGl.getExtension('WEBGL_debug_renderer_info');
      if (debugExt) {
        rendererString = String(
          probeGl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || ''
        );
      }
      if (!rendererString) {
        rendererString = String(probeGl.getParameter(probeGl.RENDERER) || '');
      }
    }
    const isSoftwareGl =
      /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
        rendererString
      );
    isSoftwareGlRef.current = isSoftwareGl;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(
      Math.max(1, mount.clientWidth),
      Math.max(1, mount.clientHeight)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.outline = 'none';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F2F6F9');
    scene.fog = new THREE.Fog('#F2F6F9', 620, 1280);
    sceneRef.current = scene;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.65;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      38,
      Math.max(1, mount.clientWidth) / Math.max(1, mount.clientHeight),
      2,
      2800
    );
    camera.position.set(140, 260, 340);
    cameraRef.current = camera;

    const hemiLight = new THREE.HemisphereLight('#FFFFFF', '#D6E2E8', 1.15);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFFBF5', 1.65);
    keyLight.position.set(220, 310, 195);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 20;
    keyLight.shadow.camera.far = 1100;
    keyLight.shadow.camera.left = -360;
    keyLight.shadow.camera.right = 360;
    keyLight.shadow.camera.top = 360;
    keyLight.shadow.camera.bottom = -360;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.04;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#DCEBF2', 0.45);
    rimLight.position.set(-200, 140, -170);
    scene.add(rimLight);

    const studioGroundGeom = new THREE.PlaneGeometry(3000, 3000);
    studioGroundGeom.rotateX(-Math.PI / 2);
    const studioGroundMat = new THREE.MeshStandardMaterial({
      color: '#F2F6F9',
      roughness: 0.96,
      metalness: 0.0,
    });
    const studioGround = new THREE.Mesh(studioGroundGeom, studioGroundMat);
    studioGround.position.y = -0.08;
    studioGround.receiveShadow = true;
    scene.add(studioGround);

    const campusGroup = new THREE.Group();
    campusGroup.name = 'cku-campus-root';
    scene.add(campusGroup);
    campusGroupRef.current = campusGroup;

    const routeGroup = new THREE.Group();
    routeGroup.name = 'cku-route-root';
    scene.add(routeGroup);
    routeGroupRef.current = routeGroup;

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const sharedTextures = createSharedBuildingTextures(maxAnisotropy);
    sharedTexturesRef.current = sharedTextures;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 60;
    controls.maxDistance = 850;
    controls.maxPolarAngle = Math.PI * 0.465;
    controls.minPolarAngle = 0.05;
    controls.screenSpacePanning = false;
    controlsRef.current = controls;

    let renderPending = false;
    const performRender = () => {
      renderPending = false;
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        const gl = renderer.getContext();
        gl.finish();
      }
      updateProjectedLabels();
    };

    const requestRender = () => {
      if (isSoftwareGl) {
        performRender();
        return;
      }
      if (!renderPending) {
        renderPending = true;
        requestAnimationFrame(performRender);
      }
    };
    requestRenderRef.current = requestRender;

    const handleControlsStart = () => {
      camGoalPosRef.current = null;
      camGoalTargetRef.current = null;
      if (controls.enableDamping) {
        startCameraAnimationLoop();
      }
    };
    const handleControlsChange = () => {
      requestRender();
    };
    controls.addEventListener('start', handleControlsStart);
    controls.addEventListener('change', handleControlsChange);

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const pickBuildingId = (clientX: number, clientY: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(campusGroup.children, true);
      for (const hit of hits) {
        const bid = hit.object.userData?.buildingId as string | undefined;
        if (bid) return bid;
      }
      return null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const handlePointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moveDist > 6) return;
      const bid = pickBuildingId(e.clientX, e.clientY);
      if (bid) {
        onSelectBuildingRef.current(bid);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const bid = pickBuildingId(e.clientX, e.clientY);
      renderer.domElement.style.cursor = bid ? 'pointer' : 'grab';
      setHoveredBuildingId((prev) => (prev === bid ? prev : bid));
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
      stopCameraAnimationLoop();
    };
    const handleContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      handleContextRestored
    );

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, Math.floor(entry.contentRect.width));
        const h = Math.max(1, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      }
    });
    resizeObserver.observe(mount);

    requestRender();

    return () => {
      stopCameraAnimationLoop();
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlsStart);
      controls.removeEventListener('change', handleControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        handleContextRestored
      );

      Object.values(buildingAssetsRef.current).forEach((b) => b.dispose());
      buildingAssetsRef.current = {};
      campusGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          if (!obj.userData?.buildingId) {
            obj.geometry?.dispose();
            const mats = Array.isArray(obj.material)
              ? obj.material
              : [obj.material];
            mats.forEach((m) => {
              if (
                m instanceof THREE.MeshStandardMaterial &&
                m.map &&
                m.map !== sharedTextures.roadSurface
              ) {
                m.map.dispose();
              }
              m?.dispose();
            });
          }
        }
      });
      routeGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      sharedTextures.dispose();
      sharedTexturesRef.current = null;
      studioGroundGeom.dispose();
      studioGroundMat.dispose();
      envTarget.dispose();
      roomEnv.dispose();
      renderer.dispose();
      mount.innerHTML = '';
    };
  }, [startCameraAnimationLoop, stopCameraAnimationLoop, updateProjectedLabels]);

  // 2. Build Campus Terrain Base, Internal Campus Road Network, Buildings, Gate Monuments & Trees
  useEffect(() => {
    const campusGroup = campusGroupRef.current;
    const sharedTextures = sharedTexturesRef.current;
    if (!campusGroup || !sharedTextures) return;

    Object.values(buildingAssetsRef.current).forEach((b) => b.dispose());
    buildingAssetsRef.current = {};

    campusGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        if (!obj.userData?.buildingId) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((m) => {
            if (
              m instanceof THREE.MeshStandardMaterial &&
              m.map &&
              m.map !== sharedTextures.roadSurface
            ) {
              m.map.dispose();
            }
            m?.dispose();
          });
        }
      }
    });
    campusGroup.clear();

    if (projectedLayouts.length === 0) {
      requestRenderRef.current();
      return;
    }

    const plazaCenter = projectLatLngToLocal(
      CENTRAL_PLAZA_LOCATION,
      campusCenter
    );

    // Compute campus bounding box including gates (excludes off-campus city blocks)
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const item of projectedLayouts) {
      minX = Math.min(minX, item.pos.x);
      maxX = Math.max(maxX, item.pos.x);
      minZ = Math.min(minZ, item.pos.z);
      maxZ = Math.max(maxZ, item.pos.z);
    }
    for (const g of gateAnchors) {
      minX = Math.min(minX, g.pos.x);
      maxX = Math.max(maxX, g.pos.x);
      minZ = Math.min(minZ, g.pos.z);
      maxZ = Math.max(maxZ, g.pos.z);
    }
    const padMargin = 64;
    minX -= padMargin;
    maxX += padMargin;
    minZ -= padMargin;
    maxZ += padMargin;

    const spanX = Math.max(220, maxX - minX);
    const spanZ = Math.max(220, maxZ - minZ);
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;

    // A. Campus Green Site Plinth (strictly internal CKU campus footprint)
    const siteShape = createRoundedRectShape(minX, maxX, minZ, maxZ, 44);
    const siteGeom = new THREE.ExtrudeGeometry(siteShape, {
      depth: 0.4,
      bevelEnabled: false,
    });
    siteGeom.rotateX(-Math.PI / 2);
    const siteMat = new THREE.MeshStandardMaterial({
      color: '#E3EEE8',
      roughness: 0.92,
      metalness: 0.0,
    });
    const siteMesh = new THREE.Mesh(siteGeom, siteMat);
    siteMesh.position.y = -0.38;
    siteMesh.receiveShadow = true;
    campusGroup.add(siteMesh);

    const borderShape = createRoundedRectShape(
      minX - 2.5,
      maxX + 2.5,
      minZ - 2.5,
      maxZ + 2.5,
      46
    );
    const borderGeom = new THREE.ExtrudeGeometry(borderShape, {
      depth: 0.25,
      bevelEnabled: false,
    });
    borderGeom.rotateX(-Math.PI / 2);
    const borderMat = new THREE.MeshStandardMaterial({
      color: '#D2DFE7',
      roughness: 0.85,
      metalness: 0.02,
    });
    const borderMesh = new THREE.Mesh(borderGeom, borderMat);
    borderMesh.position.y = -0.4;
    borderMesh.receiveShadow = true;
    campusGroup.add(borderMesh);

    // B. Internal Campus Road Network (1:1 synced with campus pedestrian routing graph)
    const rawWalkways = getCampusWalkwaySegments();
    const allRoads: RoadSegment[] = rawWalkways.map((seg) => ({
      a: projectLatLngToLocal(seg.a, campusCenter),
      b: projectLatLngToLocal(seg.b, campusCenter),
      isMainSpine: seg.isMainSpine,
    }));

    // Central Campus Plaza stone disc + CKU BlueGreen inlay ring
    const plazaGeom = new THREE.CylinderGeometry(32, 33, 0.08, 48);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: '#ECEFF2',
      roughness: 0.85,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const plazaMesh = new THREE.Mesh(plazaGeom, plazaMat);
    plazaMesh.position.set(plazaCenter.x, 0.04, plazaCenter.z);
    plazaMesh.receiveShadow = true;
    campusGroup.add(plazaMesh);

    const plazaRingGeom = new THREE.RingGeometry(25, 26.8, 48);
    plazaRingGeom.rotateX(-Math.PI / 2);
    const plazaRingMat = new THREE.MeshBasicMaterial({
      color: '#006272',
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    const plazaRing = new THREE.Mesh(plazaRingGeom, plazaRingMat);
    plazaRing.position.set(plazaCenter.x, 0.09, plazaCenter.z);
    campusGroup.add(plazaRing);

    const curbMat = new THREE.MeshStandardMaterial({
      color: '#DCE3E8',
      roughness: 0.85,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    for (const seg of allRoads) {
      const dx = seg.b.x - seg.a.x;
      const dz = seg.b.z - seg.a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const angle = Math.atan2(dz, dx);
      const midX = (seg.a.x + seg.b.x) * 0.5;
      const midZ = (seg.a.z + seg.b.z) * 0.5;
      const roadW = seg.isMainSpine ? 8.4 : 6.4;
      const curbW = roadW + 2.8;

      const curbGeom = new THREE.PlaneGeometry(len, curbW);
      curbGeom.rotateX(-Math.PI / 2);
      const curbMesh = new THREE.Mesh(curbGeom, curbMat);
      curbMesh.position.set(midX, 0.055, midZ);
      curbMesh.rotation.y = -angle;
      curbMesh.receiveShadow = true;
      campusGroup.add(curbMesh);

      const roadTex = sharedTextures.roadSurface.clone();
      roadTex.needsUpdate = true;
      roadTex.repeat.set(Math.max(1, len / 14), 1);
      const roadMat = new THREE.MeshStandardMaterial({
        map: roadTex,
        roughness: 0.82,
        metalness: 0.04,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const roadGeom = new THREE.PlaneGeometry(len, roadW);
      roadGeom.rotateX(-Math.PI / 2);
      const roadMesh = new THREE.Mesh(roadGeom, roadMat);
      roadMesh.position.set(midX, 0.085, midZ);
      roadMesh.rotation.y = -angle;
      roadMesh.receiveShadow = true;
      campusGroup.add(roadMesh);
    }

    // Junction forecourts at all buildings + gates + central plaza
    const nodeAsphaltMat = new THREE.MeshStandardMaterial({
      color: '#6B7A86',
      roughness: 0.82,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const junctionPoints: LocalVec2[] = [
      ...projectedLayouts.map((l) => l.pos),
      ...gateAnchors.map((g) => g.pos),
      plazaCenter,
    ];
    for (const pt of junctionPoints) {
      const jCurbGeom = new THREE.CircleGeometry(6.8, 24);
      jCurbGeom.rotateX(-Math.PI / 2);
      const jCurb = new THREE.Mesh(jCurbGeom, curbMat);
      jCurb.position.set(pt.x, 0.06, pt.z);
      jCurb.receiveShadow = true;
      campusGroup.add(jCurb);

      const jRoadGeom = new THREE.CircleGeometry(5.0, 24);
      jRoadGeom.rotateX(-Math.PI / 2);
      const jRoad = new THREE.Mesh(jRoadGeom, nodeAsphaltMat);
      jRoad.position.set(pt.x, 0.09, pt.z);
      jRoad.receiveShadow = true;
      campusGroup.add(jRoad);
    }

    // Minimalist Gate Pillars for Main Gate & Back Gate
    const pillarMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.5,
      metalness: 0.08,
    });
    const gateBeamMat = new THREE.MeshStandardMaterial({
      color: '#006272',
      roughness: 0.4,
      metalness: 0.14,
    });
    for (const gate of gateAnchors) {
      const gateGroup = new THREE.Group();
      gateGroup.position.set(gate.pos.x, 0, gate.pos.z);

      const pGeom = new THREE.BoxGeometry(1.6, 5.2, 1.6);
      const leftPillar = new THREE.Mesh(pGeom, pillarMat);
      leftPillar.position.set(-5.2, 2.6, 0);
      leftPillar.castShadow = true;
      const rightPillar = new THREE.Mesh(pGeom, pillarMat);
      rightPillar.position.set(5.2, 2.6, 0);
      rightPillar.castShadow = true;

      const beamGeom = new THREE.BoxGeometry(12.4, 0.9, 1.8);
      const beam = new THREE.Mesh(beamGeom, gateBeamMat);
      beam.position.set(0, 5.4, 0);
      beam.castShadow = true;

      gateGroup.add(leftPillar, rightPillar, beam);
      campusGroup.add(gateGroup);
    }

    // C. Build 3-12 part architectural models for each CKU building
    for (const item of projectedLayouts) {
      const assets = buildCampusBuildingGroup(item.building.id, sharedTextures);
      assets.group.position.set(item.pos.x, 0, item.pos.z);
      assets.group.rotation.y = item.lookAngleY;
      campusGroup.add(assets.group);
      buildingAssetsRef.current[item.building.id] = assets;
    }

    // D. Stylized Campus Pine Trees (InstancedMesh) placed outside buildings & internal roads
    const treePlacements: Array<{x: number; z: number; scale: number}> = [];
    const step = 22;
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let gx = minX + 16; gx <= maxX - 16; gx += step) {
      for (let gz = minZ + 16; gz <= maxZ - 16; gz += step) {
        const px = gx + (rand() - 0.5) * 12;
        const pz = gz + (rand() - 0.5) * 12;
        const p: LocalVec2 = {x: px, z: pz};

        if (dist2D(p, plazaCenter) < 35) continue;
        let blocked = false;
        for (const item of projectedLayouts) {
          const assets = buildingAssetsRef.current[item.building.id];
          const minR = (assets?.footprintRadius ?? 20) + 10;
          if (dist2D(p, item.pos) < minR) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        for (const g of gateAnchors) {
          if (dist2D(p, g.pos) < 14) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        for (const seg of allRoads) {
          if (pointToSegmentDist(p, seg.a, seg.b) < 11) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        treePlacements.push({
          x: px,
          z: pz,
          scale: 0.78 + rand() * 0.48,
        });
      }
    }

    if (treePlacements.length > 0) {
      const trunkGeom = new THREE.CylinderGeometry(0.42, 0.58, 3.2, 8);
      trunkGeom.translate(0, 1.6, 0);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: '#7B6756',
        roughness: 0.9,
      });
      const canopyGeom = new THREE.ConeGeometry(2.6, 7.2, 9);
      canopyGeom.translate(0, 6.2, 0);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: '#4F7E68',
        roughness: 0.85,
        metalness: 0.02,
      });

      const trunkInst = new THREE.InstancedMesh(
        trunkGeom,
        trunkMat,
        treePlacements.length
      );
      const canopyInst = new THREE.InstancedMesh(
        canopyGeom,
        canopyMat,
        treePlacements.length
      );
      trunkInst.castShadow = true;
      canopyInst.castShadow = true;
      canopyInst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      treePlacements.forEach((tp, idx) => {
        dummy.position.set(tp.x, 0, tp.z);
        dummy.scale.setScalar(tp.scale);
        dummy.rotation.y = (idx * 1.37) % (Math.PI * 2);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(idx, dummy.matrix);
        canopyInst.setMatrixAt(idx, dummy.matrix);
      });
      trunkInst.instanceMatrix.needsUpdate = true;
      canopyInst.instanceMatrix.needsUpdate = true;
      trunkInst.computeBoundingSphere();
      canopyInst.computeBoundingSphere();

      campusGroup.add(trunkInst);
      campusGroup.add(canopyInst);
    }

    const radius = Math.max(spanX, spanZ) * 0.58;
    const overviewTarget = new THREE.Vector3(centerX, 0, centerZ);
    const overviewPos = new THREE.Vector3(
      centerX + radius * 0.44,
      radius * 0.86,
      centerZ + radius * 1.12
    );
    const topDownPos = new THREE.Vector3(
      centerX,
      radius * 1.65,
      centerZ + 18
    );

    overviewTargetRef.current.copy(overviewTarget);
    overviewCamPosRef.current.copy(overviewPos);
    topDownCamPosRef.current.copy(topDownPos);

    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(overviewPos);
      controlsRef.current.target.copy(overviewTarget);
      controlsRef.current.update();
    }

    requestRenderRef.current();
  }, [projectedLayouts, gateAnchors, campusCenter]);

  // 3. Highlight Selected Building & Amenity Filter Matches cleanly in CKU BlueGreen
  useEffect(() => {
    for (const b of buildings) {
      const assets = buildingAssetsRef.current[b.id];
      if (!assets) continue;

      const isSelected = b.id === selectedBuildingId;
      const isHovered = b.id === hoveredBuildingId;
      const isFilterMatch =
        activeAmenityFilter !== 'all' &&
        b.amenities.some((a) => a.category === activeAmenityFilter);
      const dimmedByFilter =
        activeAmenityFilter !== 'all' && !isFilterMatch && !isSelected;

      if (isSelected || isFilterMatch || isHovered) {
        assets.ringMesh.visible = true;
        assets.ringMaterial.color.set(isSelected ? '#006272' : '#008196');
        assets.ringMaterial.opacity = isSelected
          ? 0.85
          : isFilterMatch
          ? 0.55
          : 0.35;
      } else {
        assets.ringMesh.visible = false;
      }

      for (const accentMat of assets.accentMaterials) {
        accentMat.color.set(
          isSelected
            ? '#007C91'
            : isFilterMatch
            ? '#006272'
            : dimmedByFilter
            ? '#8FA3AE'
            : '#006272'
        );
        accentMat.emissive.set(
          isSelected || isFilterMatch ? '#006272' : '#000000'
        );
        accentMat.emissiveIntensity = isSelected
          ? 0.25
          : isFilterMatch
          ? 0.14
          : 0;
      }

      for (const bodyMat of assets.bodyMaterials) {
        bodyMat.color.set(dimmedByFilter ? '#CFD8DF' : '#FFFFFF');
      }
    }

    requestRenderRef.current();
  }, [buildings, selectedBuildingId, hoveredBuildingId, activeAmenityFilter]);

  // 4. Render 3D Walking Route Ribbon & Origin / GPS Beacons along Campus Roads
  useEffect(() => {
    const routeGroup = routeGroupRef.current;
    if (!routeGroup) return;

    routeGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
    routeGroup.clear();

    if (activeRoute && activeRoute.pathCoords.length >= 2) {
      const localPoints: THREE.Vector3[] = [];
      for (const c of activeRoute.pathCoords) {
        const pt = projectLatLngToLocal(c, campusCenter);
        if (Math.hypot(pt.x, pt.z) > 1200) continue;
        const vec = new THREE.Vector3(pt.x, 0.9, pt.z);
        const last = localPoints[localPoints.length - 1];
        if (!last || last.distanceTo(vec) > 1.5) {
          localPoints.push(vec);
        }
      }

      if (localPoints.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(
          localPoints,
          false,
          'centripetal',
          0.15
        );
        const tubeGeom = new THREE.TubeGeometry(
          curve,
          Math.max(32, localPoints.length * 10),
          1.25,
          10,
          false
        );
        const tubeMat = new THREE.MeshStandardMaterial({
          color: '#006272',
          emissive: '#006272',
          emissiveIntensity: 0.32,
          roughness: 0.3,
          metalness: 0.1,
        });
        const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
        tubeMesh.castShadow = true;
        routeGroup.add(tubeMesh);

        const beadCount = Math.min(
          18,
          Math.max(3, Math.floor(curve.getLength() / 22))
        );
        const beadGeom = new THREE.SphereGeometry(0.95, 12, 12);
        const beadMat = new THREE.MeshBasicMaterial({color: '#FFFFFF'});
        for (let i = 1; i < beadCount; i++) {
          const t = i / beadCount;
          const pos = curve.getPointAt(t);
          const bead = new THREE.Mesh(beadGeom, beadMat);
          bead.position.set(pos.x, 2.0, pos.z);
          routeGroup.add(bead);
        }

        const endPt = localPoints[localPoints.length - 1];
        const destPinGeom = new THREE.CylinderGeometry(0.45, 0.45, 22, 12);
        const destPinMat = new THREE.MeshBasicMaterial({
          color: '#006272',
          transparent: true,
          opacity: 0.85,
        });
        const destPin = new THREE.Mesh(destPinGeom, destPinMat);
        destPin.position.set(endPt.x, 12, endPt.z);
        routeGroup.add(destPin);

        const destHeadGeom = new THREE.SphereGeometry(2.1, 16, 16);
        const destHeadMat = new THREE.MeshStandardMaterial({
          color: '#006272',
          emissive: '#006272',
          emissiveIntensity: 0.35,
          roughness: 0.25,
        });
        const destHead = new THREE.Mesh(destHeadGeom, destHeadMat);
        destHead.position.set(endPt.x, 23.5, endPt.z);
        routeGroup.add(destHead);
      }
    }

    const originCoords =
      originMode === 'gps' && userGpsLocation
        ? userGpsLocation
        : activeOrigin;
    if (originCoords) {
      const oPt = projectLatLngToLocal(originCoords, campusCenter);
      if (Math.hypot(oPt.x, oPt.z) <= 600) {
        const baseRingGeom = new THREE.RingGeometry(2.4, 3.8, 32);
        baseRingGeom.rotateX(-Math.PI / 2);
        const baseRingMat = new THREE.MeshBasicMaterial({
          color: originMode === 'gps' ? '#006272' : '#0F172A',
          transparent: true,
          opacity: 0.6,
        });
        const baseRing = new THREE.Mesh(baseRingGeom, baseRingMat);
        baseRing.position.set(oPt.x, 0.2, oPt.z);
        routeGroup.add(baseRing);

        const orbGeom = new THREE.SphereGeometry(1.75, 16, 16);
        const orbMat = new THREE.MeshStandardMaterial({
          color: originMode === 'gps' ? '#006272' : '#0F172A',
          emissive: originMode === 'gps' ? '#006272' : '#0F172A',
          emissiveIntensity: 0.28,
          roughness: 0.25,
        });
        const orb = new THREE.Mesh(orbGeom, orbMat);
        orb.position.set(oPt.x, 2.2, oPt.z);
        routeGroup.add(orb);
      }
    }

    requestRenderRef.current();
  }, [activeRoute, activeOrigin, userGpsLocation, originMode, campusCenter]);

  // 5. Smooth Camera Focus when Building Selected or Reset Triggered
  useEffect(() => {
    if (!selectedBuildingId) return;
    const layout = layoutMapRef.current[selectedBuildingId];
    if (!layout) return;
    const target = new THREE.Vector3(layout.pos.x, 5, layout.pos.z);
    const pos =
      cameraPreset === 'top'
        ? new THREE.Vector3(layout.pos.x, 195, layout.pos.z + 10)
        : new THREE.Vector3(layout.pos.x + 62, 84, layout.pos.z + 98);
    focusCameraOnGoal(pos, target);
  }, [selectedBuildingId, cameraPreset, focusCameraOnGoal]);

  useEffect(() => {
    if (cameraRecenterNonce === 0) return;
    const goalPos =
      cameraPreset === 'top'
        ? topDownCamPosRef.current
        : overviewCamPosRef.current;
    focusCameraOnGoal(goalPos, overviewTargetRef.current);
  }, [cameraRecenterNonce, cameraPreset, focusCameraOnGoal]);

  const handleSwitchPreset = (mode: '3d' | 'top') => {
    setCameraPreset(mode);
    const goalPos =
      mode === 'top' ? topDownCamPosRef.current : overviewCamPosRef.current;
    focusCameraOnGoal(goalPos, overviewTargetRef.current);
  };

  const handleResetOverview = () => {
    const goalPos =
      cameraPreset === 'top'
        ? topDownCamPosRef.current
        : overviewCamPosRef.current;
    focusCameraOnGoal(goalPos, overviewTargetRef.current);
  };

  const handleZoomStep = (factor: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const len = offset.length();
    const nextLen = Math.max(60, Math.min(780, len * factor));
    offset.setLength(nextLen);
    focusCameraOnGoal(
      controls.target.clone().add(offset),
      controls.target.clone()
    );
  };

  return (
    <div className="relative flex-1 w-full h-full min-h-[300px] bg-[#F2F6F9] overflow-hidden select-none">
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Sibling DOM Overlay for Projected 2D Building & Gate Labels (no backdrop-blur over WebGL) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {projectedLayouts.map(({building}) => {
          const isSelected = building.id === selectedBuildingId;
          const isFilterMatch =
            activeAmenityFilter !== 'all' &&
            building.amenities.some((a) => a.category === activeAmenityFilter);
          return (
            <button
              key={building.id}
              ref={(el) => {
                labelNodesRef.current[building.id] = el;
              }}
              type="button"
              onClick={() => onSelectBuilding(building.id)}
              style={{opacity: 0, pointerEvents: 'none'}}
              className={`absolute top-0 left-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold shadow-sm transition-colors cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-[#006272] text-white border-[#004D59] z-20'
                  : isFilterMatch
                  ? 'bg-white text-[#006272] border-[#006272] z-10'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#006272] hover:text-[#006272]'
              }`}
            >
              <span
                className={`w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EAF4F6] text-[#006272]'
                }`}
              >
                {building.shortCode}
              </span>
              <span>{building.name}</span>
            </button>
          );
        })}

        {gateAnchors.map((gate) => (
          <div
            key={gate.id}
            ref={(el) => {
              gateLabelNodesRef.current[gate.id] = el;
            }}
            style={{opacity: 0}}
            className="absolute top-0 left-0 px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-semibold shadow-sm whitespace-nowrap"
          >
            {gate.label}
          </div>
        ))}
      </div>

      {/* WebGL Context Lost Notice */}
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F2F6F9]/90 z-30">
          <div className="px-4 py-3 rounded-lg bg-white border border-slate-200 shadow-sm text-xs font-medium text-slate-700">
            3D 그래픽 컨텍스트를 복구하는 중입니다.
          </div>
        </div>
      )}

      {/* Top-left Campus 3D Scope Caption */}
      <div className="hidden sm:flex absolute top-3 left-3 z-10 items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-xs text-slate-600">
        <span className="font-semibold text-[#006272]">3D 교내 전용 모델</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          건물 {buildings.length}개소 및 교내 보행로
        </span>
      </div>

      {/* Top-right 3D Perspective / Top-Down Plan Switcher */}
      <div
        role="tablist"
        aria-label="시점 방식 선택"
        className="absolute top-3 right-3 z-20 inline-flex items-center rounded-lg bg-white border border-slate-200 shadow-sm p-0.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={cameraPreset === '3d'}
          onClick={() => handleSwitchPreset('3d')}
          className={`h-8 px-2.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
            cameraPreset === '3d'
              ? 'bg-[#006272] text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D 입체</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={cameraPreset === 'top'}
          onClick={() => handleSwitchPreset('top')}
          className={`h-8 px-2.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
            cameraPreset === 'top'
              ? 'bg-[#006272] text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>평면도</span>
        </button>
      </div>

      {/* Bottom-right Compact 3D Camera Controls */}
      <div className="absolute bottom-4 right-3 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setShowLabels((prev) => {
              const next = !prev;
              showLabelsRef.current = next;
              updateProjectedLabels();
              return next;
            });
          }}
          className="h-9 px-2.5 rounded-lg bg-white border border-slate-200 shadow-sm text-xs font-medium text-slate-700 hover:text-[#006272] hover:border-[#006272]/40 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          title={showLabels ? '건물 라벨 숨기기' : '건물 라벨 표시'}
        >
          {showLabels ? (
            <Eye className="w-3.5 h-3.5 text-[#006272]" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="hidden sm:inline">라벨</span>
        </button>

        <div className="flex items-center rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => handleZoomStep(0.76)}
            className="h-9 w-8 flex items-center justify-center text-slate-700 hover:text-[#006272] hover:bg-slate-50 border-r border-slate-200 transition-colors cursor-pointer"
            aria-label="확대"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoomStep(1.28)}
            className="h-9 w-8 flex items-center justify-center text-slate-700 hover:text-[#006272] hover:bg-slate-50 transition-colors cursor-pointer"
            aria-label="축소"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleResetOverview}
          className="h-9 px-3 rounded-lg bg-white border border-slate-200 shadow-sm text-xs font-medium text-slate-700 hover:text-[#006272] hover:border-[#006272]/40 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-[#006272]" />
          <span>전체 보기</span>
        </button>
      </div>

      {/* Bottom-left Floating Route / Location Summary */}
      <div className="hidden sm:flex absolute bottom-4 left-3 z-10 items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-sm text-xs text-slate-600">
        {activeRoute ? (
          <>
            <span className="font-semibold text-[#006272]">
              {activeRoute.destinationLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums font-medium text-slate-900">
              {formatDistanceLabel(activeRoute.distanceMeters)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              도보 약 {activeRoute.durationMinutes}분
            </span>
          </>
        ) : (
          <span>
            {geoStatus === 'active'
              ? '실시간 GPS 위치 연동 중 · 드래그 회전 / 스크롤 확대'
              : '마우스 드래그로 3D 회전 · 건물 클릭 시 상세 정보 확인'}
          </span>
        )}
      </div>
    </div>
  );
};
