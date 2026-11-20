import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
  PROJ_CONFIG,
  unprojectXZ,
  xzToUV,
  elevMetersToWorldY,
} from './utils/projection.js';
import { terrainVertexShader, terrainFragmentShader } from './shaders/terrainShaders.js';
import { createPlinthAndEnvironment } from './scene/PlinthAndEnvironment.js';
import { createOverlays3D } from './scene/Overlays3D.js';
import { createClimateParticles } from './scene/ClimateParticles.js';
import { renderSouthChinaSeaInset } from './ui/SouthChinaSeaInset.js';
import {
  MOUNTAIN_FLANKS,
  RIVER_OCEAN_BASIN,
  MONTHLY_CLIMATE_GUIDE,
  projectTeachingEntities,
} from './data/teachingData.js';
import { renderClimatographCanvas } from './tools/Climatograph.js';
import { createElevationProfiler } from './tools/ElevationProfiler.js';
import { createChalkboardTool, createClassroomQuiz } from './tools/ClassroomTools.js';

// ================= CAMERA VANTAGE PRESETS =================
const CAMERA_PRESETS = {
  panorama: {
    target: [-1.8, 0.6, -0.8],
    pos: [-1.8, 63.5, 59.5],
  },
  everest: {
    target: [-16.5, 3.6, 8.8],
    pos: [-23.5, 16.5, 27.5],
  },
  qinling: {
    target: [3.2, 1.6, 1.8],
    pos: [5.8, 17.5, 19.5],
  },
  sichuan: {
    target: [0.8, 1.4, 6.8],
    pos: [9.5, 16.0, 23.0],
  },
  xinjiang: {
    target: [-18.5, 2.0, -11.5],
    pos: [-20.0, 24.0, 11.0],
  },
  southeast: {
    target: [17.5, 0.8, 16.5],
    pos: [26.5, 19.5, 35.5],
  },
  northeast: {
    target: [18.5, 1.0, -19.5],
    pos: [24.0, 21.0, 1.5],
  },
};

const LIGHT_MOODS = {
  dawn: {
    sunDir: new THREE.Vector3(0.76, 0.36, 0.54).normalize(),
    sunColor: new THREE.Color(0xffb980),
    skyColor: new THREE.Color(0x6995d6),
    nightMix: 0.0,
    fogColor: new THREE.Color(0x0b1524),
  },
  golden: {
    sunDir: new THREE.Vector3(-0.62, 0.48, 0.62).normalize(),
    sunColor: new THREE.Color(0xffe4b5),
    skyColor: new THREE.Color(0x7aa9e2),
    nightMix: 0.0,
    fogColor: new THREE.Color(0x08111d),
  },
  noon: {
    sunDir: new THREE.Vector3(-0.28, 0.84, 0.46).normalize(),
    sunColor: new THREE.Color(0xfff8eb),
    skyColor: new THREE.Color(0x8bbcf0),
    nightMix: 0.0,
    fogColor: new THREE.Color(0x091524),
  },
  night: {
    sunDir: new THREE.Vector3(-0.45, 0.55, -0.70).normalize(),
    sunColor: new THREE.Color(0x7ca6e8),
    skyColor: new THREE.Color(0x283e68),
    nightMix: 0.92,
    fogColor: new THREE.Color(0x03060c),
  },
};

function loadImageWithPixels(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data;

      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.NoColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;

      resolve({ tex, pixels, width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function initApp() {
  const progressEl = document.getElementById('loader-progress');
  const loaderScreen = document.getElementById('loader-screen');
  const setProgress = (pct) => {
    if (progressEl) progressEl.style.width = `${pct}%`;
  };

  setProgress(20);
  const BASE = import.meta.env.BASE_URL;
  const [demAsset, nwAsset, provAsset, atlasData] = await Promise.all([
    loadImageWithPixels(`${BASE}assets/dem_ao.png`),
    loadImageWithPixels(`${BASE}assets/normal_water.png`),
    loadImageWithPixels(`${BASE}assets/province_border.png`),
    fetch(`${BASE}assets/atlas_data.json`).then((r) => r.json()),
  ]);
  setProgress(85);

  demAsset.tex.minFilter = THREE.NearestFilter;
  demAsset.tex.magFilter = THREE.NearestFilter;
  nwAsset.tex.minFilter = THREE.LinearFilter;
  nwAsset.tex.magFilter = THREE.LinearFilter;
  provAsset.tex.minFilter = THREE.NearestFilter;
  provAsset.tex.magFilter = THREE.NearestFilter;

  const texW = demAsset.width;
  const texH = demAsset.height;

  function sampleCPU(x, z) {
    const [u, v] = xzToUV(x, z);
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      return { elevM: 0, isOcean: true, moisture: 0.5, provId: 0, worldYBase: 0 };
    }
    const px = Math.min(texW - 1, Math.max(0, Math.floor(u * texW)));
    const py = Math.min(texH - 1, Math.max(0, Math.floor(v * texH)));
    const off = (py * texW + px) * 4;

    const u16 = demAsset.pixels[off] * 256 + demAsset.pixels[off + 1];
    const elevM =
      (u16 / 65535.0) * (PROJ_CONFIG.maxElev - PROJ_CONFIG.minElev) + PROJ_CONFIG.minElev;
    const isOcean = nwAsset.pixels[off + 2] >= 250;
    const moisture = nwAsset.pixels[off + 3] / 255.0;
    const provId = provAsset.pixels[off];
    const worldYBase = isOcean ? 0.0 : elevMetersToWorldY(Math.max(1.5, elevM), 1.0);

    return { elevM, isOcean, moisture, provId, worldYBase };
  }

  function sampleWorldYBaseAtXZ(x, z) {
    return sampleCPU(x, z).worldYBase;
  }

  const teachingEntities = projectTeachingEntities((x, z) => sampleCPU(x, z).elevM);

  // ================= THREE.JS SCENE, RENDERER & POST-PROCESSING =================
  const wrap = document.getElementById('canvas-wrap');
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060c16);
  scene.fog = new THREE.FogExp2(0x08111d, 0.0042);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.5, 420);
  camera.position.set(-1.8, 72.0, 70.0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.72;
  controls.panSpeed = 0.85;
  controls.zoomSpeed = 0.95;
  controls.minDistance = 8.5;
  controls.maxDistance = 128.0;
  controls.maxPolarAngle = Math.PI * 0.465;
  controls.target.set(-1.8, 0.6, -0.8);

  const hemiLight = new THREE.HemisphereLight(0x9ec5ff, 0x1b1610, 0.95);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffe4b5, 1.65);
  dirLight.position.set(-35, 32, 35);
  scene.add(dirLight);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.28,
    0.52,
    0.82
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // ================= APP STATE & TERRAIN MESH =================
  const appState = {
    season: 1.0,
    targetSeason: 1.0,
    currentMonth: 7,
    autoSeason: false,
    exaggeration: 1.25,
    lightMood: 'golden',
    climateMode: 0,
    showBorders: true,
    showCapitals: true,
    showMountains: true,
    showRivers: true,
    showDivides: false,
    showLandforms: false,
    showHuLine: false,
    showHydroSpecial: false,
    showSubHighBelt: false,
    hoveredProv: 0,
    selectedProv: 0,
    selectedProvObj: null,
    selectedFeatureId: null,
  };

  const moodInit = LIGHT_MOODS[appState.lightMood];
  const terrainUniforms = {
    uDemAoTex: { value: demAsset.tex },
    uNormWaterTex: { value: nwAsset.tex },
    uProvBorderTex: { value: provAsset.tex },
    uTexSize: { value: new THREE.Vector2(texW, texH) },
    uTime: { value: 0 },
    uSeason: { value: appState.season },
    uExaggeration: { value: appState.exaggeration },
    uMinElev: { value: PROJ_CONFIG.minElev },
    uMaxElev: { value: PROJ_CONFIG.maxElev },
    uSunDir: { value: moodInit.sunDir.clone() },
    uSunColor: { value: moodInit.sunColor.clone() },
    uSkyColor: { value: moodInit.skyColor.clone() },
    uNightMix: { value: moodInit.nightMix },
    uHoveredProv: { value: 0 },
    uSelectedProv: { value: 0 },
    uShowProvBorders: { value: 1.0 },
    uClimateMode: { value: 0 },
  };

  const terrainGeo = new THREE.PlaneGeometry(PROJ_CONFIG.worldWidth, PROJ_CONFIG.worldHeight, 700, 560);
  terrainGeo.rotateX(-Math.PI * 0.5);
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: terrainUniforms,
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  scene.add(terrainMesh);

  // ================= SUBSYSTEMS & CLASSROOM TOOLS =================
  const provById = new Map(atlasData.provinces.map((p) => [p.id, p]));
  const plinthEnv = createPlinthAndEnvironment(scene);

  const labelLayerEl = document.getElementById('label-layer');
  const overlays = createOverlays3D(scene, atlasData, teachingEntities, labelLayerEl, {
    onLabelClick: (item) => handleFeatureSelection(item),
    onLabelHover: (item, entering) => {
      if (item.kind === 'capital') {
        appState.hoveredProv = entering ? item.provId : 0;
      } else if (item.kind === 'river') {
        const selRiver = appState.selectedFeatureId?.startsWith('river:')
          ? appState.selectedFeatureId.split(':')[1]
          : null;
        overlays.highlightRiver(entering ? item.id : selRiver);
      } else if (item.kind === 'mountain') {
        const selMtn = appState.selectedFeatureId?.startsWith('mountain:')
          ? appState.selectedFeatureId.split(':')[1]
          : null;
        overlays.highlightMountain(entering ? item.id : selMtn);
      }
    },
  });
  overlays.setExaggeration(appState.exaggeration);

  const climateParticles = createClimateParticles(scene, sampleWorldYBaseAtXZ);
  renderSouthChinaSeaInset(document.getElementById('scs-canvas'), atlasData.southChinaSea);

  // 1. 3D Elevation + Precipitation Profiler
  const profiler = createElevationProfiler(scene, sampleCPU, provById);
  profiler.setExaggeration(appState.exaggeration);

  // 2. Smartboard Chalk / Laser Tool
  const chalkboard = createChalkboardTool(document.getElementById('chalk-canvas'));

  // ================= CAMERA FLIGHT ENGINE =================
  let flight = null;
  function clearCameraPresetActive() {
    document.querySelectorAll('#camera-presets .preset-btn').forEach((b) => b.classList.remove('is-active'));
  }

  function flyTo(targetXYZ, camPosXYZ, duration = 1.35) {
    flight = {
      t: 0,
      duration,
      startTarget: controls.target.clone(),
      endTarget: new THREE.Vector3(...targetXYZ),
      startPos: camera.position.clone(),
      endPos: new THREE.Vector3(...camPosXYZ),
    };
  }
  controls.addEventListener('start', () => {
    flight = null;
  });

  flyTo(CAMERA_PRESETS.panorama.target, CAMERA_PRESETS.panorama.pos, 1.8);

  // ================= HEIGHTFIELD RAY-MARCHING =================
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const halfW = PROJ_CONFIG.worldWidth * 0.5;
  const halfH = PROJ_CONFIG.worldHeight * 0.5;

  function intersectTerrainRay(clientX, clientY) {
    pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);

    const orig = raycaster.ray.origin;
    const dir = raycaster.ray.direction;
    if (Math.abs(dir.y) < 1e-4) return null;

    const maxTopY = 5.2 * appState.exaggeration + 0.5;
    let tEnter = (maxTopY - orig.y) / dir.y;
    let tExit = (0.0 - orig.y) / dir.y;
    if (tEnter > tExit) [tEnter, tExit] = [tExit, tEnter];
    tEnter = Math.max(0.5, tEnter);
    if (tExit < tEnter) return null;

    const STEPS = 28;
    const dt = (tExit - tEnter) / STEPS;
    let prevT = tEnter;

    for (let s = 1; s <= STEPS; s++) {
      const t = tEnter + s * dt;
      const rx = orig.x + dir.x * t;
      const ry = orig.y + dir.y * t;
      const rz = orig.z + dir.z * t;
      if (Math.abs(rx) <= halfW && Math.abs(rz) <= halfH) {
        const surfY = sampleWorldYBaseAtXZ(rx, rz) * appState.exaggeration;
        if (ry <= surfY) {
          let lo = prevT, hi = t;
          for (let b = 0; b < 5; b++) {
            const mid = 0.5 * (lo + hi);
            const mx = orig.x + dir.x * mid;
            const my = orig.y + dir.y * mid;
            const mz = orig.z + dir.z * mid;
            if (my <= sampleWorldYBaseAtXZ(mx, mz) * appState.exaggeration) hi = mid;
            else lo = mid;
          }
          const hitT = 0.5 * (lo + hi);
          return new THREE.Vector3(orig.x + dir.x * hitT, orig.y + dir.y * hitT, orig.z + dir.z * hitT);
        }
      }
      prevT = t;
    }
    return null;
  }

  // ================= DOSSIER, CLIMATOGRAPH & FLANK CONTRAST =================
  const dosTag = document.getElementById('dos-tag');
  const dosTitle = document.getElementById('dos-title');
  const dosSub = document.getElementById('dos-sub');
  const dosMetrics = document.getElementById('dos-metrics');
  const dosDesc = document.getElementById('dos-desc');
  const dosClimWrap = document.getElementById('dos-clim-wrap');
  const dosClimCanvas = document.getElementById('dos-clim-canvas');
  const dosClimRule = document.getElementById('dos-clim-rule');
  const dosFlankBox = document.getElementById('dos-flank-box');

  function hideExtraDossierWidgets() {
    dosClimWrap.hidden = true;
    dosFlankBox.hidden = true;
    appState.selectedProvObj = null;
    overlays.highlightMountain(null);
  }

  function showDefaultDossier() {
    appState.selectedProv = 0;
    appState.selectedFeatureId = null;
    hideExtraDossierWidgets();
    overlays.highlightRiver(null);
    updateDirectoryActiveStates();

    dosTag.textContent = '九州总览';
    dosTitle.textContent = '中华人民共和国 · 立体地形全图';
    dosSub.textContent = '地势西高东低，呈三级阶梯状分布 · 点击省区、山脉、地形区或江河查看详志与考点图表';
    dosMetrics.innerHTML = `
      <div class="metric-box"><span>世界最高峰</span><strong>8,848.86 m</strong><small>珠穆朗玛峰</small></div>
      <div class="metric-box"><span>第一大河</span><strong>6,300 km</strong><small>长江干流</small></div>
      <div class="metric-box"><span>省级行政区</span><strong>34 个</strong><small>含港澳台及南海</small></div>
    `;
    dosDesc.textContent =
      '自第一级阶梯青藏高原（平均海拔>4000m）越过昆仑—祁连—横断山脉降至第二级阶梯高原与盆地，再越过大兴安岭—太行—巫山—雪峰山展布为东部三大平原与丘陵，孕育雨热同期的东亚季风文明。';
  }

  function selectProvince(prov, shouldFly = true) {
    if (!prov) return;
    clearCameraPresetActive();
    hideExtraDossierWidgets();
    appState.selectedProv = prov.id;
    appState.selectedProvObj = prov;
    appState.selectedFeatureId = `capital:${prov.id}`;
    overlays.highlightRiver(null);
    updateDirectoryActiveStates();

    dosTag.textContent = `省级行政区 · 简称「${prov.abbr}」`;
    dosTitle.textContent = `${prov.name}（省会/中心：${prov.capital}）`;
    dosSub.textContent = `${prov.climate} · 坐标 ${prov.capLonLat[0].toFixed(2)}°E, ${prov.capLonLat[1].toFixed(2)}°N`;
    dosMetrics.innerHTML = `
      <div class="metric-box"><span>平均海拔</span><strong>${prov.avgElev.toLocaleString()} m</strong><small>${prov.capital} ${prov.capElev}m</small></div>
      <div class="metric-box"><span>冬夏均温</span><strong>${prov.janT}° / ${prov.julT}°</strong><small>1月 / 7月(℃)</small></div>
      <div class="metric-box"><span>年降水量</span><strong>${prov.precip} mm</strong><small>多年平均</small></div>
    `;

    // Render Standard Textbook 12-Month Climatograph!
    dosClimWrap.hidden = false;
    const ruleText = renderClimatographCanvas(dosClimCanvas, prov, appState.currentMonth);
    dosClimRule.textContent = ruleText;

    dosDesc.textContent = prov.landform;

    if (shouldFly) {
      const [cx, cz] = prov.centroidXZ;
      const span = Math.max(10, Math.hypot(prov.bboxXZ[2] - prov.bboxXZ[0], prov.bboxXZ[3] - prov.bboxXZ[1]));
      const dist = Math.min(46, Math.max(15, span * 1.28));
      const cy = prov.capY * appState.exaggeration;
      flyTo([cx, cy, cz], [cx + dist * 0.12, cy + dist * 0.82, cz + dist * 0.88]);
    }
  }

  function computePointsBounds(pointArrays) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, sumY = 0, cnt = 0;
    for (const arr of pointArrays) {
      for (const p of arr) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[2] < minZ) minZ = p[2];
        if (p[2] > maxZ) maxZ = p[2];
        sumY += p[1];
        cnt++;
      }
    }
    if (!cnt) return { cx: 0, cy: 1, cz: 0, span: 18 };
    const cx = 0.5 * (minX + maxX);
    const cz = 0.5 * (minZ + maxZ);
    const cy = (sumY / cnt) * appState.exaggeration;
    const span = Math.max(8, Math.hypot(maxX - minX, maxZ - minZ));
    return { cx, cy, cz, span };
  }

  function selectMountain(m, shouldFly = true) {
    clearCameraPresetActive();
    hideExtraDossierWidgets();
    appState.selectedProv = 0;
    appState.selectedFeatureId = `mountain:${m.id}`;
    overlays.highlightRiver(null);
    overlays.highlightMountain(m.id);
    updateDirectoryActiveStates();

    dosTag.textContent = m.tier === 1 ? '中华脊梁 · 一级界山' : '重要地理界山';
    dosTitle.textContent = m.name;
    dosSub.textContent = m.role;
    dosMetrics.innerHTML = `
      <div class="metric-box"><span>最高主峰</span><strong>${m.peak}</strong><small>极高山脊</small></div>
      <div class="metric-box"><span>主峰海拔</span><strong>${m.elev} m</strong><small>SRTM高程校准</small></div>
      <div class="metric-box"><span>山脉地位</span><strong>${m.tier === 1 ? '核心骨架' : '区域屏障'}</strong><small>地形气候界</small></div>
    `;

    // Render Boundary Mountain Flank Landform Contrast Box if available!
    const flanks = MOUNTAIN_FLANKS[m.id];
    if (flanks) {
      dosFlankBox.hidden = false;
      const sideA = flanks.west ? `<div class="flank-side"><small>西侧地形区</small><b>${flanks.west}</b></div>` : `<div class="flank-side"><small>北侧地形区</small><b>${flanks.north}</b></div>`;
      const sideB = flanks.east ? `<div class="flank-side"><small>东侧地形区</small><b>${flanks.east}</b></div>` : `<div class="flank-side"><small>南侧地形区</small><b>${flanks.south}</b></div>`;
      dosFlankBox.innerHTML = `
        <div class="flank-grid">${sideA}<span>⇄</span>${sideB}</div>
        <div class="flank-tip">🎯 <b>考点精要</b>：${flanks.examTip}</div>
      `;
    }

    dosDesc.textContent = `${m.name}主峰为${m.peak}（${m.elev}m），在宏观地貌与季风环流中承担「${m.role}」作用。`;

    if (shouldFly) {
      const b = computePointsBounds([m.spine]);
      const dist = Math.min(54, Math.max(19, b.span * 1.45));
      flyTo([b.cx, b.cy, b.cz], [b.cx, b.cy + dist * 0.78, b.cz + dist * 0.85]);
    }
  }

  function selectRiver(r, shouldFly = true) {
    clearCameraPresetActive();
    hideExtraDossierWidgets();
    appState.selectedProv = 0;
    appState.selectedFeatureId = `river:${r.id}`;
    overlays.highlightRiver(r.id);
    updateDirectoryActiveStates();

    const basinMeta = RIVER_OCEAN_BASIN[r.id] || { basin: '外流水系' };
    dosTag.textContent = `中华水脉 · ${basinMeta.basin}`;
    dosTitle.textContent = `${r.name}（${r.en}）`;
    dosSub.textContent = `发源于${r.origin} · 归宿：${r.outlet}`;
    dosMetrics.innerHTML = `
      <div class="metric-box"><span>干流全长</span><strong>${r.lengthKm.toLocaleString()} km</strong><small>源远流长</small></div>
      <div class="metric-box"><span>流域面积</span><strong>${r.basinKm2 ? (r.basinKm2 / 10000).toFixed(1) + '万' : '运河沟通'}</strong><small>${r.basinKm2 ? 'km²' : '五大水系'}</small></div>
      <div class="metric-box"><span>水系归属</span><strong>${basinMeta.basin.slice(0, 5)}</strong><small>${r.outlet.slice(0, 6)}</small></div>
    `;
    dosDesc.textContent = r.role;

    if (shouldFly) {
      const b = computePointsBounds(r.segments);
      const dist = Math.min(64, Math.max(24, b.span * 1.15));
      flyTo([b.cx, b.cy, b.cz], [b.cx, b.cy + dist * 0.84, b.cz + dist * 0.82]);
    }
  }

  function selectLandform(lf) {
    clearCameraPresetActive();
    hideExtraDossierWidgets();
    appState.selectedProv = 0;
    appState.selectedFeatureId = `landform:${lf.id}`;
    overlays.highlightRiver(null);
    updateDirectoryActiveStates();

    // Ensure Landform plaques are visible!
    if (!appState.showLandforms) {
      appState.showLandforms = true;
      document.getElementById('chk-landforms').checked = true;
      overlays.landformsGroup.visible = true;
    }

    dosTag.textContent = `${lf.cat} · ${lf.tag}`;
    dosTitle.textContent = lf.name;
    dosSub.textContent = `中心坐标 ${lf.lonLat[0].toFixed(1)}°E, ${lf.lonLat[1].toFixed(1)}°N`;
    dosMetrics.innerHTML = `
      <div class="metric-box"><span>所属类别</span><strong>${lf.cat}</strong><small>中国宏观地貌</small></div>
      <div class="metric-box"><span>代表海拔</span><strong>~${lf.elev} m</strong><small>${lf.tag}</small></div>
      <div class="metric-box"><span>空间属性</span><strong>面状单元</strong><small>山脉围合</small></div>
    `;
    dosDesc.textContent = lf.desc;

    const [x, yBase, z] = lf.xyz;
    const y = yBase * appState.exaggeration;
    flyTo([x, y, z], [x + 2.0, y + 20.0, z + 21.0]);
  }

  function handleFeatureSelection(item) {
    if (item.kind === 'capital') selectProvince(item.data, true);
    else if (item.kind === 'mountain') selectMountain(item.data, true);
    else if (item.kind === 'river') selectRiver(item.data, true);
    else if (item.kind === 'landform') selectLandform(item.data);
    else if (item.kind === 'huline') {
      hideExtraDossierWidgets();
      const hu = item.data;
      dosTag.textContent = '人文与自然地理耦合核心线';
      dosTitle.textContent = hu.name;
      dosSub.textContent = `${hu.eastStat} | ${hu.westStat}`;
      dosDesc.textContent = hu.desc;
    } else if (item.kind === 'hydro') {
      hideExtraDossierWidgets();
      const hp = item.data;
      dosTag.textContent = '水文分界与大国重器水利枢纽';
      dosTitle.textContent = hp.name;
      dosSub.textContent = `${hp.river ? hp.river + ' · ' : ''}${hp.step}`;
      dosDesc.textContent = hp.desc;
      if (hp.xyz) {
        flyTo([hp.xyz[0], hp.xyz[1] * appState.exaggeration, hp.xyz[2]], [hp.xyz[0], hp.xyz[1] + 15, hp.xyz[2] + 16]);
      }
    } else if (item.kind === 'lake') {
      hideExtraDossierWidgets();
      const lk = item.data;
      appState.selectedFeatureId = `lake:${lk.name}`;
      dosTag.textContent = `中国名湖 · ${lk.type}`;
      dosTitle.textContent = lk.name;
      dosSub.textContent = `坐标 ${lk.lonLat[0].toFixed(2)}°E, ${lk.lonLat[1].toFixed(2)}°N`;
      dosDesc.textContent = lk.desc;
      flyTo([lk.xyz[0], lk.xyz[1] * appState.exaggeration, lk.xyz[2]], [lk.xyz[0], lk.xyz[1] + 13.5, lk.xyz[2] + 14.5]);
    } else if (item.kind === 'divide') {
      hideExtraDossierWidgets();
      const dv = item.data;
      dosTag.textContent = '重要自然地理分界线';
      dosTitle.textContent = dv.name;
      dosSub.textContent = '地貌与季风气候关键跃变带';
      dosDesc.textContent = dv.desc;
    }
  }

  // 3. Blind-Map Rapid Quiz Engine
  const quiz = createClassroomQuiz(atlasData, {
    onFocusProvince: (prov) => {
      appState.selectedProv = prov.id;
      overlays.highlightRiver(null);
      overlays.highlightMountain(null);
      const [cx, cz] = prov.centroidXZ;
      const span = Math.max(12, Math.hypot(prov.bboxXZ[2] - prov.bboxXZ[0], prov.bboxXZ[3] - prov.bboxXZ[1]));
      const dist = Math.min(44, Math.max(18, span * 1.32));
      flyTo([cx, prov.capY * appState.exaggeration, cz], [cx, prov.capY + dist * 0.85, cz + dist * 0.88]);
    },
    onFocusMountain: (m) => {
      appState.selectedProv = 0;
      overlays.highlightRiver(null);
      overlays.highlightMountain(m.id);
      const b = computePointsBounds([m.spine]);
      const dist = Math.min(54, Math.max(19, b.span * 1.45));
      flyTo([b.cx, b.cy, b.cz], [b.cx, b.cy + dist * 0.78, b.cz + dist * 0.85]);
    },
    onFocusRiver: (r) => {
      appState.selectedProv = 0;
      overlays.highlightMountain(null);
      overlays.highlightRiver(r.id);
      const b = computePointsBounds(r.segments);
      const dist = Math.min(64, Math.max(24, b.span * 1.15));
      flyTo([b.cx, b.cy, b.cz], [b.cx, b.cy + dist * 0.84, b.cz + dist * 0.82]);
    },
    onExitQuiz: () => {
      document.getElementById('btn-quiz').classList.remove('is-active');
      showDefaultDossier();
      flyTo(CAMERA_PRESETS.panorama.target, CAMERA_PRESETS.panorama.pos);
    },
  });

  // Populate Right Directory Tabs: 34 Provinces, 14 Landforms, 22 Mountains, 14 Rivers
  const provMatrixEl = document.getElementById('prov-matrix');
  atlasData.provinces.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'prov-chip';
    btn.dataset.provId = String(p.id);
    btn.title = `${p.name}（${p.capital}）`;
    btn.textContent = p.short;
    btn.addEventListener('click', () => selectProvince(p, true));
    btn.addEventListener('mouseenter', () => { appState.hoveredProv = p.id; });
    btn.addEventListener('mouseleave', () => { appState.hoveredProv = 0; });
    provMatrixEl.appendChild(btn);
  });

  const lfListEl = document.getElementById('landform-list');
  teachingEntities.landforms.forEach((lf) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'entity-row';
    btn.dataset.fId = `landform:${lf.id}`;
    btn.innerHTML = `<span>❖ ${lf.name}</span><em>${lf.cat}</em>`;
    btn.addEventListener('click', () => selectLandform(lf));
    lfListEl.appendChild(btn);
  });

  const mtnListEl = document.getElementById('mtn-list');
  atlasData.mountains.forEach((m) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'entity-row';
    btn.dataset.fId = `mountain:${m.id}`;
    btn.innerHTML = `<span>▲ ${m.name}</span><em>${m.peak} ${Math.round(m.elev)}m</em>`;
    btn.addEventListener('click', () => selectMountain(m, true));
    btn.addEventListener('mouseenter', () => overlays.highlightMountain(m.id));
    btn.addEventListener('mouseleave', () => {
      const selMtn = appState.selectedFeatureId?.startsWith('mountain:')
        ? appState.selectedFeatureId.split(':')[1]
        : null;
      overlays.highlightMountain(selMtn);
    });
    mtnListEl.appendChild(btn);
  });

  const riverListEl = document.getElementById('river-list');
  atlasData.rivers.forEach((r) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'entity-row';
    btn.dataset.fId = `river:${r.id}`;
    btn.innerHTML = `<span><b style="color:${r.color}">●</b> ${r.name}</span><em>${r.lengthKm} km</em>`;
    btn.addEventListener('click', () => selectRiver(r, true));
    btn.addEventListener('mouseenter', () => overlays.highlightRiver(r.id));
    btn.addEventListener('mouseleave', () => {
      const selRiver = appState.selectedFeatureId?.startsWith('river:')
        ? appState.selectedFeatureId.split(':')[1]
        : null;
      overlays.highlightRiver(selRiver);
    });
    riverListEl.appendChild(btn);
  });

  function updateDirectoryActiveStates() {
    provMatrixEl.querySelectorAll('.prov-chip').forEach((el) => {
      el.classList.toggle('is-active', Number(el.dataset.provId) === appState.selectedProv);
    });
    document.querySelectorAll('.entity-row').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.fId === appState.selectedFeatureId);
    });
  }

  document.getElementById('dos-reset').addEventListener('click', () => {
    showDefaultDossier();
    document.querySelector('[data-preset="panorama"]')?.classList.add('is-active');
    flyTo(CAMERA_PRESETS.panorama.target, CAMERA_PRESETS.panorama.pos);
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('is-active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('is-active');
    });
  });

  // ================= MOUSE INTERACTION ON 3D TERRAIN =================
  const teleLonLat = document.getElementById('tele-lonlat');
  const teleElev = document.getElementById('tele-elev');
  const teleProv = document.getElementById('tele-prov');
  const teleClimate = document.getElementById('tele-climate');

  let pointerDownPos = { x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  });

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.buttons !== 0) return;
    const hit = intersectTerrainRay(e.clientX, e.clientY);
    if (!hit) {
      appState.hoveredProv = 0;
      return;
    }

    const [lon, lat] = unprojectXZ(hit.x, hit.z);
    const sample = sampleCPU(hit.x, hit.z);
    appState.hoveredProv = quiz.isActive() ? 0 : sample.provId;

    const ew = lon >= 0 ? 'E' : 'W';
    const ns = lat >= 0 ? 'N' : 'S';
    teleLonLat.textContent = `${Math.abs(lon).toFixed(2)}°${ew} · ${Math.abs(lat).toFixed(2)}°${ns}`;

    if (sample.isOcean) {
      teleElev.textContent = `水深 ${Math.abs(Math.round(sample.elevM)).toLocaleString()} m`;
      teleProv.textContent = lon > 106 && lat < 23 ? '中国南海海域' : lon > 117 && lat < 33 ? '东海大陆架海域' : '毗邻海域';
      teleClimate.textContent = '海洋水文调节区';
    } else {
      const eRound = Math.round(sample.elevM);
      teleElev.textContent = `${eRound.toLocaleString()} m`;
      const prov = provById.get(sample.provId);
      teleProv.textContent = quiz.isActive() ? '🎯 盲测抢答中' : prov ? `${prov.name}（${prov.capital}）` : '亚洲毗邻陆域';

      const sWrap = ((appState.season % 4) + 4) % 4;
      const janBase = 26.5 - (lat - 18.0) * 1.32;
      const julBase = 30.5 - Math.max(0, lat - 24.0) * 0.26 + (1.0 - sample.moisture) * 4.5;
      const seasonCurve = Math.sin((sWrap / 4.0) * Math.PI * 2);
      const seaT = 0.5 * (janBase + julBase) + 0.5 * (julBase - janBase) * seasonCurve;
      const localT = seaT - Math.max(0, sample.elevM) * 0.006;
      const annualMm = Math.round(Math.pow(sample.moisture, 1.45) * 2150);
      teleClimate.textContent = `季均温 ${localT >= 0 ? '+' : ''}${localT.toFixed(1)}℃ · 年降水 ~${annualMm}mm`;
    }
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 5) return;
    const hit = intersectTerrainRay(e.clientX, e.clientY);
    if (!hit) return;

    // Check if Elevation Profiler is waiting for custom 2-point transect click!
    if (profiler.handleTerrainClick([hit.x, hit.z])) return;

    if (quiz.isActive()) return;
    const sample = sampleCPU(hit.x, hit.z);
    if (sample.provId > 0) {
      const prov = provById.get(sample.provId);
      if (prov) selectProvince(prov, true);
    }
  });

  // ================= MONTHLY RAINBELT, FOUR SEASONS & CLIMATE LEGEND =================
  const climateLegendEl = document.getElementById('climate-legend');
  const rngMonth = document.getElementById('rng-month');
  const valMonth = document.getElementById('val-month');
  const seasonBtns = document.querySelectorAll('.season-btn');
  const btnCycle = document.getElementById('btn-season-cycle');

  function syncSeasonButtons(seasonVal) {
    const nearest = Math.round(((seasonVal % 4) + 4) % 4) % 4;
    seasonBtns.forEach((b) => b.classList.toggle('is-active', Number(b.dataset.season) === nearest));
  }

  function updateClimateLegend() {
    const mGuide = MONTHLY_CLIMATE_GUIDE[(appState.currentMonth - 1 + 12) % 12];
    if (valMonth && mGuide) {
      valMonth.textContent = mGuide.title.split(' · ')[0] + ' · ' + mGuide.phenomenon.slice(0, 8);
    }

    if (appState.climateMode === 1) {
      climateLegendEl.innerHTML = `
        <div><b>中国五大气候区</b>（纬度、海陆热力差与青藏隆升塑造）：</div>
        <div class="legend-swatches">
          <span class="legend-item"><i style="background:#f25752"></i>热带季风</span>
          <span class="legend-item"><i style="background:#2ec28b"></i>亚热带季风</span>
          <span class="legend-item"><i style="background:#479ef0"></i>温带季风</span>
          <span class="legend-item"><i style="background:#ebba47"></i>温带大陆性</span>
          <span class="legend-item"><i style="background:#9e7bf0"></i>高原山地</span>
        </div>
      `;
    } else if (appState.climateMode === 3) {
      climateLegendEl.innerHTML = `
        <div><b>${mGuide.month}月热力场与等温线</b>（白亮线为 0℃ 等温线，海拔每升1km降温6℃）：</div>
        <div class="legend-bar" style="background:linear-gradient(90deg,#241a7a,#297be0,#52d6e0,#75db70,#f5c73d,#eb3d29)"></div>
        <div class="legend-scale"><span>-30℃ 极寒</span><span>0℃ 冰点线</span><span>+18℃</span><span>+36℃ 酷暑</span></div>
      `;
    } else {
      // Natural (0), Monsoon (2), and Precipitation/Rainbelt (4) show rich monthly rainbelt & monsoon exam insight!
      climateLegendEl.innerHTML = `
        <div><b style="color:#f4ce82">${mGuide.title}</b>（副高脊 ~${mGuide.subHighLat}°N）：</div>
        <div style="margin-top:3px">${mGuide.detail}</div>
      `;
    }
  }

  function setMonth(monthInt, enableRainBeltOverlay = false) {
    const m = Math.max(1, Math.min(12, Math.round(monthInt)));
    appState.currentMonth = m;
    if (rngMonth) rngMonth.value = String(m);
    document.querySelectorAll('.month-quick button').forEach((b) => {
      b.classList.toggle('is-active', Number(b.dataset.m) === m);
    });

    const guide = MONTHLY_CLIMATE_GUIDE[m - 1];
    appState.targetSeason = guide.seasonVal;
    syncSeasonButtons(guide.seasonVal);

    if (enableRainBeltOverlay) {
      appState.showSubHighBelt = true;
      overlays.rainBeltGroup.visible = true;
    }
    if (appState.selectedProvObj && !dosClimWrap.hidden) {
      renderClimatographCanvas(dosClimCanvas, appState.selectedProvObj, m);
    }
    updateClimateLegend();
  }

  updateClimateLegend();

  rngMonth.addEventListener('input', (e) => {
    appState.autoSeason = false;
    btnCycle.classList.remove('is-playing');
    setMonth(Number(e.target.value), true);
  });

  document.querySelectorAll('.month-quick button').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.autoSeason = false;
      btnCycle.classList.remove('is-playing');
      setMonth(Number(btn.dataset.m), true);
    });
  });

  document.querySelectorAll('#climate-modes .mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#climate-modes .mode-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const mode = Number(btn.dataset.climate);
      appState.climateMode = mode;
      terrainUniforms.uClimateMode.value = mode;

      overlays.rainBeltGroup.visible = mode === 4 || appState.showSubHighBelt;
      if (mode === 1 && !appState.showDivides) {
        appState.showDivides = true;
        document.getElementById('chk-divides').checked = true;
        overlays.dividesGroup.visible = true;
      }
      updateClimateLegend();
    });
  });

  seasonBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.autoSeason = false;
      btnCycle.classList.remove('is-playing');
      appState.showSubHighBelt = appState.climateMode === 4;
      overlays.rainBeltGroup.visible = appState.showSubHighBelt;
      setMonth(Number(btn.dataset.month), false);
    });
  });

  btnCycle.addEventListener('click', () => {
    appState.autoSeason = !appState.autoSeason;
    btnCycle.classList.toggle('is-playing', appState.autoSeason);
  });

  // ================= CLASSROOM HEADER TOOLKIT BUTTONS =================
  const btnProfiler = document.getElementById('btn-profiler');
  btnProfiler.addEventListener('click', () => {
    const open = profiler.toggle();
    btnProfiler.classList.toggle('is-active', open);
  });
  document.getElementById('btn-prof-close').addEventListener('click', () => {
    profiler.close();
    btnProfiler.classList.remove('is-active');
  });
  document.querySelectorAll('[data-prof]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-prof]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      profiler.loadPreset(btn.dataset.prof);
    });
  });
  document.getElementById('btn-prof-custom').addEventListener('click', () => {
    document.querySelectorAll('[data-prof]').forEach((b) => b.classList.remove('is-active'));
    profiler.startCustomTwoPointPick();
  });

  // Blind-Map Quiz Controls
  const btnQuiz = document.getElementById('btn-quiz');
  btnQuiz.addEventListener('click', () => {
    const on = quiz.toggle();
    btnQuiz.classList.toggle('is-active', on);
  });
  document.getElementById('btn-quiz-close').addEventListener('click', () => quiz.stop());
  document.getElementById('btn-quiz-reveal').addEventListener('click', () => quiz.revealAnswer());
  document.getElementById('btn-quiz-next').addEventListener('click', () => quiz.nextQuestion());
  document.querySelectorAll('.qcat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.qcat-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      quiz.setCategory(btn.dataset.qcat);
    });
  });

  // Chalkboard Controls
  const btnChalk = document.getElementById('btn-chalk');
  const chalkBar = document.getElementById('chalk-bar');
  const setChalkState = (on) => {
    chalkboard.setActive(on);
    btnChalk.classList.toggle('is-active', on);
    chalkBar.classList.toggle('is-open', on);
  };
  btnChalk.addEventListener('click', () => setChalkState(!chalkboard.isActive()));
  document.getElementById('btn-chalk-close').addEventListener('click', () => setChalkState(false));
  document.getElementById('btn-chalk-clear').addEventListener('click', () => chalkboard.clear());
  document.getElementById('btn-chalk-undo').addEventListener('click', () => chalkboard.undo());
  document.getElementById('chk-chalk-arrow').addEventListener('change', (e) => chalkboard.setArrowMode(e.target.checked));
  document.querySelectorAll('.swatch-btn').forEach((sw) => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.swatch-btn').forEach((b) => b.classList.remove('is-active'));
      sw.classList.add('is-active');
      chalkboard.setColor(sw.dataset.color);
    });
  });

  // Classroom Projector Large-Font & Brightness Boost Mode
  const btnBoost = document.getElementById('btn-boost');
  btnBoost.addEventListener('click', () => {
    const boosted = document.body.classList.toggle('classroom-boost');
    btnBoost.classList.toggle('is-active', boosted);
    renderer.toneMappingExposure = boosted ? 1.30 : 1.08;
  });

  // ================= LAYER TOGGLES, PRESETS, RELIEF & LIGHTING =================
  document.getElementById('chk-borders').addEventListener('change', (e) => {
    appState.showBorders = e.target.checked;
    terrainUniforms.uShowProvBorders.value = e.target.checked ? 1.0 : 0.0;
  });
  document.getElementById('chk-capitals').addEventListener('change', (e) => {
    appState.showCapitals = e.target.checked;
    overlays.capitalsGroup.visible = e.target.checked;
  });
  document.getElementById('chk-mountains').addEventListener('change', (e) => {
    appState.showMountains = e.target.checked;
    overlays.mountainsGroup.visible = e.target.checked;
  });
  document.getElementById('chk-rivers').addEventListener('change', (e) => {
    appState.showRivers = e.target.checked;
    overlays.riversGroup.visible = e.target.checked;
  });
  document.getElementById('chk-landforms').addEventListener('change', (e) => {
    appState.showLandforms = e.target.checked;
    overlays.landformsGroup.visible = e.target.checked;
  });
  document.getElementById('chk-basin-color').addEventListener('change', (e) => {
    overlays.setBasinColorMode(e.target.checked);
  });
  document.getElementById('chk-huline').addEventListener('change', (e) => {
    appState.showHuLine = e.target.checked;
    overlays.huLineGroup.visible = e.target.checked;
    if (e.target.checked) {
      handleFeatureSelection({ kind: 'huline', data: teachingEntities.huLine });
    }
  });
  document.getElementById('chk-hydro-special').addEventListener('change', (e) => {
    appState.showHydroSpecial = e.target.checked;
    overlays.hydroSpecialGroup.visible = e.target.checked;
  });
  document.getElementById('chk-divides').addEventListener('change', (e) => {
    appState.showDivides = e.target.checked;
    overlays.dividesGroup.visible = e.target.checked;
  });

  document.querySelectorAll('#camera-presets .preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearCameraPresetActive();
      btn.classList.add('is-active');
      const p = CAMERA_PRESETS[btn.dataset.preset];
      if (p) flyTo(p.target, p.pos, 1.45);
    });
  });

  document.getElementById('scs-inset').addEventListener('click', () => {
    clearCameraPresetActive();
    flyTo([12.5, 0.3, 24.5], [14.5, 22.0, 44.5], 1.45);
  });

  const rngExag = document.getElementById('rng-exag');
  const valExag = document.getElementById('val-exag');
  rngExag.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    appState.exaggeration = v;
    valExag.textContent = `${v.toFixed(2)}×`;
    terrainUniforms.uExaggeration.value = v;
    overlays.setExaggeration(v);
    profiler.setExaggeration(v);
  });

  document.querySelectorAll('#light-modes button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#light-modes button').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      appState.lightMood = btn.dataset.light;
    });
  });

  const toggleZen = () => document.body.classList.toggle('zen-mode');
  document.getElementById('btn-zen').addEventListener('click', toggleZen);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') toggleZen();
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
    profiler.onResize();
  });

  setProgress(100);
  setTimeout(() => loaderScreen.classList.add('is-hidden'), 240);

  // ================= MAIN ANIMATION LOOP =================
  const clock = new THREE.Clock();
  let autoMonthFloat = 7.0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const elapsed = clock.elapsedTime;

    if (appState.autoSeason) {
      autoMonthFloat = ((autoMonthFloat - 1 + dt * 0.85) % 12) + 1;
      const mInt = Math.floor(autoMonthFloat);
      if (mInt !== appState.currentMonth) {
        setMonth(mInt, appState.climateMode === 4);
      }
      const g0 = MONTHLY_CLIMATE_GUIDE[mInt - 1];
      const g1 = MONTHLY_CLIMATE_GUIDE[mInt % 12];
      const frac = autoMonthFloat - mInt;
      let sDiff = ((g1.seasonVal - g0.seasonVal + 2) % 4 + 4) % 4 - 2;
      appState.season = ((g0.seasonVal + sDiff * frac) % 4 + 4) % 4;
    } else {
      let diff = ((appState.targetSeason - appState.season + 2.0) % 4.0 + 4.0) % 4.0 - 2.0;
      appState.season = ((appState.season + diff * Math.min(1, dt * 3.6)) % 4.0 + 4.0) % 4.0;
    }

    const targetMood = LIGHT_MOODS[appState.lightMood];
    terrainUniforms.uSunDir.value.lerp(targetMood.sunDir, 0.06).normalize();
    terrainUniforms.uSunColor.value.lerp(targetMood.sunColor, 0.06);
    terrainUniforms.uSkyColor.value.lerp(targetMood.skyColor, 0.06);
    terrainUniforms.uNightMix.value += (targetMood.nightMix - terrainUniforms.uNightMix.value) * 0.06;
    scene.fog.color.lerp(targetMood.fogColor, 0.06);
    dirLight.position.copy(terrainUniforms.uSunDir.value).multiplyScalar(60);
    dirLight.color.copy(terrainUniforms.uSunColor.value);
    dirLight.intensity = 1.65 * (1.0 - terrainUniforms.uNightMix.value * 0.68);
    bloomPass.strength = 0.28 + terrainUniforms.uNightMix.value * 0.24;

    if (flight) {
      flight.t += dt / flight.duration;
      const k = Math.min(1, flight.t);
      const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      controls.target.lerpVectors(flight.startTarget, flight.endTarget, ease);
      camera.position.lerpVectors(flight.startPos, flight.endPos, ease);
      if (k >= 1) flight = null;
    }
    controls.update();

    terrainUniforms.uTime.value = elapsed;
    terrainUniforms.uSeason.value = appState.season;
    terrainUniforms.uHoveredProv.value = appState.hoveredProv;
    terrainUniforms.uSelectedProv.value = appState.selectedProv;

    const mGuide = MONTHLY_CLIMATE_GUIDE[(appState.currentMonth - 1 + 12) % 12];
    overlays.updateSubHighAndRainBelt(mGuide, elapsed);

    plinthEnv.update(elapsed, appState.season, terrainUniforms.uNightMix.value);
    climateParticles.update(dt, elapsed, appState.season, appState.climateMode, appState.exaggeration);
    overlays.update(dt, elapsed, camera, window.innerWidth, window.innerHeight, appState, controls.target);

    composer.render();
  }

  animate();
}

initApp().catch((err) => {
  console.error('Failed to initialize China 3D Atlas:', err);
});
