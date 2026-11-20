import * as THREE from 'three';

export interface BuildingModelAssets {
  group: THREE.Group;
  roofHeight: number;
  footprintRadius: number;
  ringMesh: THREE.Mesh;
  ringMaterial: THREE.MeshBasicMaterial;
  accentMaterials: THREE.MeshStandardMaterial[];
  bodyMaterials: THREE.MeshStandardMaterial[];
  dispose: () => void;
}

export interface SharedBuildingTextures {
  facadeLight: THREE.CanvasTexture;
  facadeWarm: THREE.CanvasTexture;
  glassCurtain: THREE.CanvasTexture;
  roadSurface: THREE.CanvasTexture;
  dispose: () => void;
}

function createFacadeCanvasTexture(
  wallHex: string,
  glassHex: string,
  mullionHex: string,
  cols: number,
  rows: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = wallHex;
    ctx.fillRect(0, 0, 512, 512);

    const padX = 20;
    const padY = 22;
    const cellW = (512 - padX * 2) / cols;
    const cellH = (512 - padY * 2) / rows;

    for (let r = 0; r < rows; r++) {
      // Subtle floor spandrel band
      ctx.fillStyle = mullionHex;
      ctx.fillRect(0, padY + r * cellH - 4, 512, 4);

      for (let c = 0; c < cols; c++) {
        const wx = padX + c * cellW + 6;
        const wy = padY + r * cellH + 8;
        const ww = cellW - 12;
        const wh = cellH - 18;

        ctx.fillStyle = glassHex;
        ctx.fillRect(wx, wy, ww, wh);

        // Subtle sky reflection highlight at top of window pane
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(wx, wy, ww, Math.max(4, wh * 0.28));

        // Center vertical mullion
        ctx.fillStyle = mullionHex;
        ctx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRoadSurfaceTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Clean campus asphalt tone
    ctx.fillStyle = '#6B7A86';
    ctx.fillRect(0, 0, 256, 256);

    // Subtle stone aggregate speckling
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 160; i++) {
      const rx = (i * 53) % 256;
      const ry = (i * 97) % 256;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // Crisp sidewalk edge lines
    ctx.fillStyle = '#CBD5DF';
    ctx.fillRect(0, 0, 256, 12);
    ctx.fillRect(0, 244, 256, 12);

    // Dashed centerline along U
    ctx.fillStyle = '#E6EEF2';
    ctx.fillRect(24, 125, 84, 6);
    ctx.fillRect(148, 125, 84, 6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSharedBuildingTextures(
  maxAnisotropy: number
): SharedBuildingTextures {
  const facadeLight = createFacadeCanvasTexture(
    '#F5F7F9',
    '#6B8E9B',
    '#DCE3E9',
    6,
    5,
    maxAnisotropy
  );
  const facadeWarm = createFacadeCanvasTexture(
    '#EFECE6',
    '#5E7D8B',
    '#D5D0C7',
    5,
    4,
    maxAnisotropy
  );
  const glassCurtain = createFacadeCanvasTexture(
    '#DCE6EC',
    '#4A7485',
    '#B5C8D3',
    8,
    5,
    maxAnisotropy
  );
  const roadSurface = createRoadSurfaceTexture(maxAnisotropy);

  return {
    facadeLight,
    facadeWarm,
    glassCurtain,
    roadSurface,
    dispose: () => {
      facadeLight.dispose();
      facadeWarm.dispose();
      glassCurtain.dispose();
      roadSurface.dispose();
    },
  };
}

function addBoxPart(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  yBottom: number,
  z: number,
  material: THREE.Material,
  geometries: THREE.BufferGeometry[],
  buildingId: string,
  castShadow = true
): THREE.Mesh {
  const geom = new THREE.BoxGeometry(w, h, d);
  geometries.push(geom);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(x, yBottom + h / 2, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.userData.buildingId = buildingId;
  parent.add(mesh);
  return mesh;
}

export function buildCampusBuildingGroup(
  buildingId: string,
  textures: SharedBuildingTextures
): BuildingModelAssets {
  const group = new THREE.Group();
  group.name = `building-${buildingId}`;
  group.userData.buildingId = buildingId;

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const accentMaterials: THREE.MeshStandardMaterial[] = [];
  const bodyMaterials: THREE.MeshStandardMaterial[] = [];

  const plinthMat = new THREE.MeshStandardMaterial({
    color: '#DFE5EA',
    roughness: 0.78,
    metalness: 0.04,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: '#D4DCE3',
    roughness: 0.7,
    metalness: 0.08,
  });
  const wallFacadeMat = new THREE.MeshStandardMaterial({
    map:
      buildingId === 'joseph-hall' || buildingId === 'francis-chapel'
        ? textures.facadeWarm
        : textures.facadeLight,
    roughness: 0.58,
    metalness: 0.06,
  });
  const glassAtriumMat = new THREE.MeshStandardMaterial({
    map: textures.glassCurtain,
    roughness: 0.25,
    metalness: 0.25,
  });
  const accentTrimMat = new THREE.MeshStandardMaterial({
    color: '#006272',
    roughness: 0.42,
    metalness: 0.14,
  });

  materials.push(plinthMat, roofMat, wallFacadeMat, glassAtriumMat, accentTrimMat);
  bodyMaterials.push(wallFacadeMat, glassAtriumMat);
  accentMaterials.push(accentTrimMat);

  let roofHeight = 16;
  let footprintRadius = 18;

  switch (buildingId) {
    case 'maria-hall': {
      // Symmetrical U-shaped university headquarters with central glass atrium & portico
      footprintRadius = 23;
      roofHeight = 20;
      addBoxPart(group, 34, 1.4, 20, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 30, 14.5, 10, 0, 1.4, -2.5, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 8.5, 13.5, 9, -10.75, 1.4, 5, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 8.5, 13.5, 9, 10.75, 1.4, 5, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 11, 12.5, 7, 0, 1.4, 3.5, glassAtriumMat, geometries, buildingId);
      // Entrance canopy & roof crown
      addBoxPart(group, 12, 0.9, 4.2, 0, 4.2, 8.2, accentTrimMat, geometries, buildingId);
      addBoxPart(group, 14, 2.4, 6, 0, 15.9, -2.5, roofMat, geometries, buildingId);
      addBoxPart(group, 30.8, 0.7, 10.8, 0, 15.9, -2.5, accentTrimMat, geometries, buildingId);
      break;
    }

    case 'changjo-hall': {
      // Large academic complex + auditorium volume
      footprintRadius = 25;
      roofHeight = 21;
      addBoxPart(group, 38, 1.4, 22, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 25, 16.5, 12, -4.5, 1.4, -2.5, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 12, 12, 15, 11, 1.4, 1.5, glassAtriumMat, geometries, buildingId);
      // Auditorium cylindrical wing
      const cylGeom = new THREE.CylinderGeometry(6.8, 7.2, 10.5, 24);
      geometries.push(cylGeom);
      const auditorium = new THREE.Mesh(cylGeom, wallFacadeMat);
      auditorium.position.set(-10, 1.4 + 5.25, 5.5);
      auditorium.castShadow = true;
      auditorium.receiveShadow = true;
      auditorium.userData.buildingId = buildingId;
      group.add(auditorium);

      addBoxPart(group, 25.8, 0.7, 12.8, -4.5, 17.9, -2.5, accentTrimMat, geometries, buildingId);
      addBoxPart(group, 9, 2.2, 5.5, -2, 18.6, -2.5, roofMat, geometries, buildingId);
      addBoxPart(group, 10, 0.8, 3.6, 2, 4.0, 9.6, accentTrimMat, geometries, buildingId);
      break;
    }

    case 'central-library': {
      // Broad stepped reading pavilion with cantilevered roof & vertical fins
      footprintRadius = 22;
      roofHeight = 19;
      addBoxPart(group, 32, 1.6, 24, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 28, 13.5, 19, 0, 1.6, 0, glassAtriumMat, geometries, buildingId);
      // Cantilevered library roof overhang
      addBoxPart(group, 31, 1.4, 22, 0, 15.1, 0, roofMat, geometries, buildingId);
      addBoxPart(group, 31.4, 0.7, 22.4, 0, 16.5, 0, accentTrimMat, geometries, buildingId);
      // Skylight lantern
      addBoxPart(group, 14, 2.0, 9, 0, 17.2, 0, glassAtriumMat, geometries, buildingId);
      // Vertical architectural fins along front facade
      for (let i = -3; i <= 3; i++) {
        addBoxPart(group, 0.7, 13.5, 1.2, i * 3.8, 1.6, 9.8, plinthMat, geometries, buildingId);
      }
      break;
    }

    case 'student-union': {
      // Terraced 3-level welfare & dining hub
      footprintRadius = 20;
      roofHeight = 15;
      addBoxPart(group, 30, 1.2, 20, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 26, 5.5, 16, 0, 1.2, 0, glassAtriumMat, geometries, buildingId);
      addBoxPart(group, 18, 5.2, 12, -2, 6.7, -1.5, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 18.6, 0.7, 12.6, -2, 11.9, -1.5, accentTrimMat, geometries, buildingId);
      addBoxPart(group, 9, 1.8, 5, -2, 12.6, -1.5, roofMat, geometries, buildingId);
      // Terrace canopy
      addBoxPart(group, 8.5, 0.6, 6, 7.5, 6.7, 3.5, accentTrimMat, geometries, buildingId);
      break;
    }

    case 'joseph-hall': {
      // L-shaped gate-side academic building
      footprintRadius = 19;
      roofHeight = 16.5;
      addBoxPart(group, 28, 1.4, 22, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 24, 12.5, 9, 0, 1.4, -4.5, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 9, 11.5, 12, -7.5, 1.4, 3.5, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 7, 12.8, 7, -7.5, 1.4, -4.5, glassAtriumMat, geometries, buildingId);
      addBoxPart(group, 24.6, 0.6, 9.6, 0, 13.9, -4.5, accentTrimMat, geometries, buildingId);
      addBoxPart(group, 7, 0.7, 3.5, 4, 3.8, 1.6, accentTrimMat, geometries, buildingId);
      break;
    }

    case 'jinsil-hall': {
      // Twin-bar lecture building linked by a glazed central stair core
      footprintRadius = 19;
      roofHeight = 17;
      addBoxPart(group, 29, 1.3, 19, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 25, 12.5, 6.5, 0, 1.3, -4.2, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 25, 12.5, 6.5, 0, 1.3, 4.2, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 7.5, 14.0, 15.6, 0, 1.3, 0, glassAtriumMat, geometries, buildingId);
      addBoxPart(group, 8.1, 0.7, 16.2, 0, 15.3, 0, accentTrimMat, geometries, buildingId);
      break;
    }

    case 'raphael-hall': {
      // Medical & health sciences H-plan building
      footprintRadius = 21;
      roofHeight = 18.5;
      addBoxPart(group, 31, 1.4, 21, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 8, 14.5, 17, -9, 1.4, 0, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 8, 14.5, 17, 9, 1.4, 0, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 12, 13.0, 8, 0, 1.4, 0, glassAtriumMat, geometries, buildingId);
      addBoxPart(group, 8.6, 0.7, 17.6, -9, 15.9, 0, accentTrimMat, geometries, buildingId);
      addBoxPart(group, 8.6, 0.7, 17.6, 9, 15.9, 0, accentTrimMat, geometries, buildingId);
      addBoxPart(group, 7, 1.8, 5, 0, 14.4, 0, roofMat, geometries, buildingId);
      break;
    }

    case 'michael-hall': {
      // Engineering complex with vertical lab stair tower & modular bays
      footprintRadius = 20;
      roofHeight = 18;
      addBoxPart(group, 30, 1.4, 19, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 22, 12.5, 13, -2.5, 1.4, 0, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 7.5, 15.8, 11, 9.5, 1.4, 0, glassAtriumMat, geometries, buildingId);
      // Skylight bays on roof
      addBoxPart(group, 4.5, 1.6, 9, -8, 13.9, 0, roofMat, geometries, buildingId);
      addBoxPart(group, 4.5, 1.6, 9, -2, 13.9, 0, roofMat, geometries, buildingId);
      addBoxPart(group, 8.1, 0.7, 11.6, 9.5, 17.2, 0, accentTrimMat, geometries, buildingId);
      break;
    }

    case 'sebastiano-sports': {
      // Wide-span vaulted sports arena + outdoor court pad
      footprintRadius = 24;
      roofHeight = 17;
      addBoxPart(group, 36, 1.2, 24, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 28, 8.2, 18, -2, 1.2, 0, wallFacadeMat, geometries, buildingId);
      // Vaulted barrel roof
      const vaultGeom = new THREE.CylinderGeometry(
        9.2,
        9.2,
        28.6,
        24,
        1,
        false,
        0,
        Math.PI
      );
      vaultGeom.rotateZ(Math.PI / 2);
      geometries.push(vaultGeom);
      const vault = new THREE.Mesh(vaultGeom, roofMat);
      vault.position.set(-2, 9.4, 0);
      vault.scale.set(1, 0.48, 1);
      vault.castShadow = true;
      vault.receiveShadow = true;
      vault.userData.buildingId = buildingId;
      group.add(vault);

      // Glazed concourse entrance & accent collar
      addBoxPart(group, 7.5, 6.2, 14, 13, 1.2, 0, glassAtriumMat, geometries, buildingId);
      addBoxPart(group, 29, 0.7, 18.8, -2, 9.4, 0, accentTrimMat, geometries, buildingId);
      break;
    }

    case 'francis-chapel': {
      // Distinctive sloped gable nave + vertical bell tower with cross finial
      footprintRadius = 18;
      roofHeight = 23;
      addBoxPart(group, 24, 1.4, 20, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 15, 9.5, 14, -2, 1.4, 0, wallFacadeMat, geometries, buildingId);
      // Pitched chapel roof prism
      const roofShape = new THREE.Shape();
      roofShape.moveTo(-8, 0);
      roofShape.lineTo(0, 5.2);
      roofShape.lineTo(8, 0);
      roofShape.closePath();
      const pitchedGeom = new THREE.ExtrudeGeometry(roofShape, {
        depth: 15,
        bevelEnabled: false,
      });
      pitchedGeom.translate(0, 0, -7.5);
      geometries.push(pitchedGeom);
      const pitchedRoof = new THREE.Mesh(pitchedGeom, roofMat);
      pitchedRoof.position.set(-2, 10.9, 0);
      pitchedRoof.castShadow = true;
      pitchedRoof.receiveShadow = true;
      pitchedRoof.userData.buildingId = buildingId;
      group.add(pitchedRoof);

      // Bell tower & architectural cross finial
      addBoxPart(group, 4.4, 19, 4.4, 8, 1.4, -3.5, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 4.8, 0.7, 4.8, 8, 20.4, -3.5, accentTrimMat, geometries, buildingId);
      addBoxPart(group, 0.55, 3.2, 0.55, 8, 21.1, -3.5, accentTrimMat, geometries, buildingId);
      addBoxPart(group, 2.0, 0.5, 0.55, 8, 22.8, -3.5, accentTrimMat, geometries, buildingId);
      break;
    }

    default: {
      addBoxPart(group, 22, 1.4, 16, 0, 0, 0, plinthMat, geometries, buildingId);
      addBoxPart(group, 19, 12, 13, 0, 1.4, 0, wallFacadeMat, geometries, buildingId);
      addBoxPart(group, 19.6, 0.7, 13.6, 0, 13.4, 0, accentTrimMat, geometries, buildingId);
      break;
    }
  }

  // Crisp ground halo ring for selected or amenity-matched highlight
  const ringGeom = new THREE.RingGeometry(
    footprintRadius - 1.4,
    footprintRadius + 0.6,
    48
  );
  ringGeom.rotateX(-Math.PI / 2);
  geometries.push(ringGeom);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: '#006272',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  materials.push(ringMaterial);

  const ringMesh = new THREE.Mesh(ringGeom, ringMaterial);
  ringMesh.position.set(0, 0.14, 0);
  ringMesh.visible = false;
  ringMesh.userData.buildingId = buildingId;
  group.add(ringMesh);

  return {
    group,
    roofHeight,
    footprintRadius,
    ringMesh,
    ringMaterial,
    accentMaterials,
    bodyMaterials,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
