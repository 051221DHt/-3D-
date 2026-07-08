import * as THREE from 'three';
import {
  MAP_REGIONS,
  MAP_ROADS,
  barHeightForCount,
  colorForTypeGroup,
  opacityForPrecision,
  precisionShape,
  schematicToWorld,
} from './mapGeometry.js';

const FULL_VIEW = {
  position: new THREE.Vector3(0, 10.8, 14.2),
  target: new THREE.Vector3(0, 0, 0.05),
};

const JINGHONG_VIEW = {
  position: new THREE.Vector3(0.9, 7.4, 8.9),
  target: new THREE.Vector3(0.15, 0, -0.08),
};

const REGION_COLORS = {
  menghai: 0x2464a2,
  jinghong: 0x1b86c7,
  mengla: 0x31836c,
};

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }

  material.dispose();
}

function disposeObject(object) {
  object.geometry?.dispose();
  if (object.material) {
    disposeMaterial(object.material);
  }
}

function makeMarkerGeometry(shape, height) {
  if (shape === 'pin') {
    return new THREE.ConeGeometry(0.095, height, 24);
  }

  if (shape === 'diamond') {
    const radius = 0.16;
    const geometry = new THREE.OctahedronGeometry(radius);
    geometry.scale(1, height / (radius * 2), 1);
    return geometry;
  }

  if (shape === 'block') {
    return new THREE.BoxGeometry(0.22, height, 0.22);
  }

  return new THREE.CylinderGeometry(0.095, 0.13, height, 24);
}

export function createMapScene(root, { onSelect } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020712);
  scene.fog = new THREE.Fog(0x020712, 11, 28);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.copy(FULL_VIEW.position);
  camera.lookAt(FULL_VIEW.target);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.domElement.className = 'scene-canvas';
  root.replaceChildren(renderer.domElement);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const interactive = [];
  const dynamicRoot = new THREE.Group();
  let activeId = null;
  scene.add(dynamicRoot);

  scene.add(new THREE.HemisphereLight(0x9cecff, 0x050913, 1.7));

  const sun = new THREE.DirectionalLight(0x92e7ff, 3.4);
  sun.position.set(3.8, 8.4, 5.4);
  scene.add(sun);

  const rim = new THREE.PointLight(0xffd866, 42, 14);
  rim.position.set(-3.2, 3.2, 2.6);
  scene.add(rim);

  function resize() {
    const rect = root.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function clearDynamicObjects() {
    for (const item of interactive.splice(0)) {
      dynamicRoot.remove(item);
      disposeObject(item);
    }
    for (const item of [...dynamicRoot.children]) {
      dynamicRoot.remove(item);
      disposeObject(item);
    }
  }

  function makeRegion(region) {
    const shape = new THREE.Shape();
    region.points.forEach(([x, z], index) => {
      if (index === 0) {
        shape.moveTo(x, z);
      } else {
        shape.lineTo(x, z);
      }
    });
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.018 });
    geometry.rotateX(Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: REGION_COLORS[region.id] ?? 0xd6c4a9,
      roughness: 0.42,
      metalness: 0.16,
      emissive: REGION_COLORS[region.id] ?? 0x1b86c7,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -0.15;
    scene.add(mesh);

    const outlinePoints = region.points.map(([x, z]) => new THREE.Vector3(x, 0.08, z));
    outlinePoints.push(outlinePoints[0].clone());
    const outline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(outlinePoints),
      new THREE.LineBasicMaterial({ color: 0x62ecff, transparent: true, opacity: 0.82 }),
    );
    scene.add(outline);
  }

  function makeRoad(road) {
    const curve = new THREE.CatmullRomCurve3(
      road.points.map(([x, z]) => new THREE.Vector3(x, 0.035, z)),
    );
    const isRiver = road.id === 'river';
    const geometry = new THREE.TubeGeometry(curve, 48, isRiver ? 0.06 : 0.028, 10, false);
    const material = new THREE.MeshBasicMaterial({
      color: isRiver ? 0x43e8ff : 0xffce5a,
      transparent: true,
      opacity: isRiver ? 0.78 : 0.46,
    });
    scene.add(new THREE.Mesh(geometry, material));
  }

  function isActiveObject(object) {
    return activeId !== null && object.userData.recordId === activeId;
  }

  function isDimmedObject(object) {
    return activeId !== null && object.userData.recordId !== undefined && !isActiveObject(object);
  }

  function syncActiveDataset() {
    if (activeId === null) {
      delete root.dataset.activeId;
      return;
    }

    root.dataset.activeId = String(activeId);
  }

  function applyActiveStyles() {
    syncActiveDataset();

    for (const item of interactive) {
      const isActive = isActiveObject(item);
      const isDimmed = isDimmedObject(item);

      item.scale.setScalar(isActive ? 2.35 : 1);
      item.renderOrder = isActive ? 20 : 0;
      item.userData.activeLift = isActive ? 0.16 : 0;
      item.material.opacity = isActive ? 1 : item.userData.baseOpacity * (isDimmed ? 0.24 : 1);
      item.material.emissiveIntensity = isActive ? 1.35 : item.userData.baseEmissiveIntensity;
    }

    for (const item of dynamicRoot.children) {
      if (item.userData.kind === 'beam') {
        item.visible = isActiveObject(item);
        item.material.opacity = item.visible ? 0.62 : 0;
      }
    }
  }

  function makeHeatDisc(world, count, index, recordId) {
    const radius = Math.min(0.5, 0.17 + count * 0.025);
    const geometry = new THREE.CircleGeometry(radius, 48);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: count >= 6 ? 0xff4e35 : 0xffce5a,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const disc = new THREE.Mesh(geometry, material);
    disc.position.set(world.x, 0.065, world.z);
    disc.userData.kind = 'heat';
    disc.userData.phase = index * 0.41;
    disc.userData.recordId = recordId;
    dynamicRoot.add(disc);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.05, 0.012, 8, 96),
      new THREE.MeshBasicMaterial({
        color: 0x43e8ff,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(world.x, 0.09, world.z);
    ring.userData.kind = 'ring';
    ring.userData.phase = index * 0.33;
    ring.userData.recordId = recordId;
    dynamicRoot.add(ring);
  }

  function makeActiveBeam(world, index, recordId) {
    if (recordId === undefined) {
      return;
    }

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.055, 0.82, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff1a6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    beam.position.set(world.x, 0.55, world.z);
    beam.userData.kind = 'beam';
    beam.userData.phase = index * 0.29;
    beam.userData.recordId = recordId;
    beam.visible = false;
    dynamicRoot.add(beam);
  }

  function makeFlowArc(start, end, index) {
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      0.85 + index * 0.035,
      (start.z + end.z) / 2,
    );
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(start.x, 0.12, start.z),
      mid,
      new THREE.Vector3(end.x, 0.12, end.z),
    );
    const geometry = new THREE.TubeGeometry(curve, 48, 0.012, 8, false);
    const material = new THREE.MeshBasicMaterial({
      color: index % 2 === 0 ? 0x43e8ff : 0xffce5a,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });
    const arc = new THREE.Mesh(geometry, material);
    arc.userData.kind = 'flow';
    arc.userData.phase = index * 0.24;
    dynamicRoot.add(arc);
  }

  function makeObject(mapGroup, index) {
    const count = mapGroup.records.length;
    const height = barHeightForCount(count);
    const world = schematicToWorld(mapGroup.schematic);
    const shape = precisionShape(mapGroup.precision);
    const geometry = makeMarkerGeometry(shape, height);
    const material = new THREE.MeshStandardMaterial({
      color: colorForTypeGroup(mapGroup.typeGroup),
      transparent: true,
      opacity: opacityForPrecision(mapGroup.precision),
      roughness: 0.34,
      metalness: 0.22,
      emissive: colorForTypeGroup(mapGroup.typeGroup),
      emissiveIntensity: 0.22,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const recordId = mapGroup.records.length === 1 ? mapGroup.records[0].id : undefined;
    mesh.position.set(world.x, height / 2, world.z);
    mesh.userData.baseY = height / 2;
    mesh.userData.baseOpacity = material.opacity;
    mesh.userData.baseEmissiveIntensity = material.emissiveIntensity;
    mesh.userData.phase = index * 0.37;
    mesh.userData.recordId = recordId;
    mesh.userData.mapGroup = mapGroup;
    interactive.push(mesh);
    dynamicRoot.add(mesh);
    makeHeatDisc(world, count, index, recordId);
    makeActiveBeam(world, index, recordId);
  }

  function renderGroups(mapGroups = []) {
    clearDynamicObjects();
    root.dataset.mapPointCount = String(mapGroups.length);
    const visibleIds = new Set(mapGroups.flatMap((mapGroup) => mapGroup.records.map((record) => record.id)));
    if (activeId !== null && !visibleIds.has(activeId)) {
      activeId = null;
    }

    mapGroups.forEach((mapGroup, index) => makeObject(mapGroup, index));

    const hub = new THREE.Vector3(0.36, 0, -0.18);
    [...mapGroups]
      .sort((a, b) => b.records.length - a.records.length)
      .slice(0, 12)
      .forEach((mapGroup, index) => {
        const world = schematicToWorld(mapGroup.schematic);
        makeFlowArc(new THREE.Vector3(world.x, 0, world.z), hub, index);
      });
    applyActiveStyles();
  }

  function handlePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactive, false)[0];
    if (hit?.object.userData.mapGroup) {
      setActiveId(hit.object.userData.recordId);
      onSelect?.(hit.object.userData.mapGroup);
    }
  }

  function setActiveId(nextId) {
    if (nextId === null || nextId === undefined || nextId === '') {
      activeId = null;
      applyActiveStyles();
      return;
    }

    const numericId = Number(nextId);
    activeId = Number.isFinite(numericId) ? numericId : null;
    applyActiveStyles();
  }

  function setView(view) {
    const nextView = view === 'jinghong' ? JINGHONG_VIEW : FULL_VIEW;
    camera.position.copy(nextView.position);
    camera.lookAt(nextView.target);
  }

  for (const region of MAP_REGIONS) {
    makeRegion(region);
  }

  const grid = new THREE.GridHelper(10, 24, 0x185b88, 0x12324c);
  grid.position.y = -0.16;
  scene.add(grid);

  for (const road of MAP_ROADS) {
    makeRoad(road);
  }

  renderer.domElement.addEventListener('click', handlePointer);
  window.addEventListener('resize', resize);

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  resizeObserver?.observe(root);

  let animationFrame = null;
  let disposed = false;
  const clock = new THREE.Clock();

  function animate() {
    if (disposed) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    for (const item of interactive) {
      item.rotation.y = elapsed * 0.35 + item.userData.phase;
      item.position.y = item.userData.baseY
        + (item.userData.activeLift ?? 0)
        + Math.sin(elapsed * 1.4 + item.userData.phase) * 0.025;
    }

    for (const item of dynamicRoot.children) {
      if (item.userData.kind === 'heat') {
        const isActive = isActiveObject(item);
        const isDimmed = isDimmedObject(item);
        const baseOpacity = isActive ? 0.36 : isDimmed ? 0.025 : 0.13;
        const pulseOpacity = isActive ? 0.065 : 0.035;
        item.material.opacity = baseOpacity + Math.sin(elapsed * 1.8 + item.userData.phase) * pulseOpacity;
      } else if (item.userData.kind === 'ring') {
        const pulse = 1 + Math.sin(elapsed * 1.6 + item.userData.phase) * 0.04;
        const isActive = isActiveObject(item);
        const isDimmed = isDimmedObject(item);
        item.scale.setScalar(pulse * (isActive ? 2.25 : isDimmed ? 0.62 : 1));
        item.material.opacity = isActive ? 0.9 : isDimmed ? 0.045 : 0.34;
      } else if (item.userData.kind === 'beam') {
        const isActive = isActiveObject(item);
        item.visible = isActive;
        item.material.opacity = isActive
          ? 0.46 + (Math.sin(elapsed * 2.2 + item.userData.phase) + 1) * 0.16
          : 0;
        item.scale.y = isActive ? 1 + Math.sin(elapsed * 1.7 + item.userData.phase) * 0.08 : 1;
      } else if (item.userData.kind === 'flow') {
        item.material.opacity = 0.2 + (Math.sin(elapsed * 1.9 + item.userData.phase) + 1) * 0.09;
      }
    }

    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(animate);
  }

  resize();
  animate();

  return {
    renderGroups,
    setActiveId,
    setView,
    dispose() {
      disposed = true;
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('click', handlePointer);
      clearDynamicObjects();
      scene.traverse((object) => {
        if (object.isMesh) {
          disposeObject(object);
        }
      });
      renderer.dispose();
    },
  };
}
