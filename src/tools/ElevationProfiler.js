import * as THREE from 'three';
import { projectLonLat, unprojectXZ } from '../utils/projection.js';

export const PROFILE_PRESETS = {
  lat32: {
    label: '北纬 32°N · 三级阶梯经典剖面',
    startLonLat: [80.0, 31.8],
    endLonLat: [122.2, 31.4],
    landmarks: [
      { t: 0.14, name: '青藏高原' },
      { t: 0.42, name: '横断山脉' },
      { t: 0.56, name: '四川盆地' },
      { t: 0.68, name: '巫山' },
      { t: 0.84, name: '长江中下游平原' },
      { t: 0.97, name: '东海' },
    ],
  },
  lat36: {
    label: '北纬 36°N · 黄河阶梯与黄土剖面',
    startLonLat: [78.0, 36.0],
    endLonLat: [120.8, 36.1],
    landmarks: [
      { t: 0.12, name: '昆仑山' },
      { t: 0.36, name: '柴达木/青海' },
      { t: 0.62, name: '黄土高原' },
      { t: 0.78, name: '太行山' },
      { t: 0.88, name: '华北平原' },
      { t: 0.96, name: '山东丘陵' },
    ],
  },
  lon108: {
    label: '东经 108.5°E · 秦岭南北分界剖面',
    startLonLat: [108.5, 42.2],
    endLonLat: [109.5, 18.4],
    landmarks: [
      { t: 0.08, name: '阴山/内蒙古' },
      { t: 0.24, name: '黄土高原' },
      { t: 0.34, name: '秦岭(3771m)' },
      { t: 0.46, name: '大巴/四川东缘' },
      { t: 0.65, name: '云贵/苗岭' },
      { t: 0.95, name: '海南五指山' },
    ],
  },
};

function haversineKm(lon1, lat1, lon2, lat2) {
  const R = 6371;
  const toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR;
  const dLon = (lon2 - lon1) * toR;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function createElevationProfiler(scene, sampleCPU, provById) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const SAMPLES = 200;

  // 1. 3D Translucent Laser Cut Curtain Mesh + Bright Crest Ribbon
  const curtainVerts = new Float32Array(SAMPLES * 2 * 3);
  const curtainIdx = [];
  for (let i = 0; i < SAMPLES - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    curtainIdx.push(a, b, c, b, d, c);
  }
  const curtainGeo = new THREE.BufferGeometry();
  curtainGeo.setAttribute('position', new THREE.BufferAttribute(curtainVerts, 3));
  curtainGeo.setIndex(curtainIdx);

  const curtainMat = new THREE.MeshBasicMaterial({
    color: 0xf5c869,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const curtainMesh = new THREE.Mesh(curtainGeo, curtainMat);
  curtainMesh.frustumCulled = false;
  group.add(curtainMesh);

  const crestPos = new Float32Array(SAMPLES * 3);
  const crestGeo = new THREE.BufferGeometry();
  crestGeo.setAttribute('position', new THREE.BufferAttribute(crestPos, 3));
  const crestLine = new THREE.Line(
    crestGeo,
    new THREE.LineBasicMaterial({ color: 0xffe484, transparent: true, opacity: 0.98 })
  );
  crestLine.frustumCulled = false;
  group.add(crestLine);

  // Start & End 3D Pillars (A -> B)
  const endPinGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.2, 12);
  endPinGeo.translate(0, 1.1, 0);
  const pinA = new THREE.Mesh(endPinGeo, new THREE.MeshBasicMaterial({ color: 0x42f5c8 }));
  const pinB = new THREE.Mesh(endPinGeo, new THREE.MeshBasicMaterial({ color: 0xff6b57 }));
  group.add(pinA, pinB);

  // Moving 3D Probe Beacon synced to mouse hover on the 2D chart!
  const probeGroup = new THREE.Group();
  const probeSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffd5 })
  );
  const probeBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 3.8, 8),
    new THREE.MeshBasicMaterial({ color: 0x00ffd5, transparent: true, opacity: 0.72, depthWrite: false })
  );
  probeBeam.position.y = 1.9;
  probeGroup.add(probeSphere, probeBeam);
  probeGroup.visible = false;
  group.add(probeGroup);

  // State
  let isOpen = false;
  let customPickMode = false;
  let pickPointA = null;
  let currentExag = 1.25;
  let currentTransect = null; // { title, samples: [...], totalKm, landmarks }
  let hoverIndex = -1;

  const drawerEl = document.getElementById('profiler-drawer');
  const canvasEl = document.getElementById('profiler-canvas');
  const readoutEl = document.getElementById('profiler-readout');
  const statusHintEl = document.getElementById('profiler-hint');

  function buildTransectFromXZ(x0, z0, x1, z1, title, landmarks = []) {
    const [lon0, lat0] = unprojectXZ(x0, z0);
    const [lon1, lat1] = unprojectXZ(x1, z1);
    const totalKm = Math.round(haversineKm(lon0, lat0, lon1, lat1));

    const pts = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / (SAMPLES - 1);
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const [lon, lat] = unprojectXZ(x, z);
      const s = sampleCPU(x, z);
      const elev = s.isOcean ? Math.max(-4500, s.elevM) : Math.max(2, s.elevM);
      const precip = s.isOcean ? 1400 : Math.round(Math.pow(s.moisture, 1.45) * 2150);
      const prov = provById.get(s.provId);
      pts.push({
        t,
        km: Math.round(totalKm * t),
        x,
        z,
        lon,
        lat,
        elev: Math.round(elev),
        isOcean: s.isOcean,
        worldYBase: s.worldYBase,
        precip,
        provName: prov ? prov.short : s.isOcean ? '海域' : '境外邻区',
      });
    }

    currentTransect = { title, samples: pts, totalKm, landmarks };
    hoverIndex = -1;
    probeGroup.visible = false;
    update3DGeometry();
    renderChart();
  }

  function update3DGeometry() {
    if (!currentTransect) return;
    const pts = currentTransect.samples;
    for (let i = 0; i < SAMPLES; i++) {
      const p = pts[i];
      const topY = p.worldYBase * currentExag + 0.16;
      // Bottom vertex at y = -0.05
      curtainVerts[i * 6] = p.x;
      curtainVerts[i * 6 + 1] = -0.05;
      curtainVerts[i * 6 + 2] = p.z;
      // Top vertex on terrain crest
      curtainVerts[i * 6 + 3] = p.x;
      curtainVerts[i * 6 + 4] = topY;
      curtainVerts[i * 6 + 5] = p.z;

      crestPos[i * 3] = p.x;
      crestPos[i * 3 + 1] = topY + 0.03;
      crestPos[i * 3 + 2] = p.z;
    }
    curtainGeo.attributes.position.needsUpdate = true;
    crestGeo.attributes.position.needsUpdate = true;

    const first = pts[0], last = pts[SAMPLES - 1];
    pinA.position.set(first.x, first.worldYBase * currentExag, first.z);
    pinB.position.set(last.x, last.worldYBase * currentExag, last.z);
  }

  function renderChart() {
    if (!canvasEl || !currentTransect) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvasEl.parentElement.getBoundingClientRect();
    const w = Math.max(480, Math.floor(rect.width));
    const h = 142;
    canvasEl.width = w * dpr;
    canvasEl.height = h * dpr;
    canvasEl.style.width = `${w}px`;
    canvasEl.style.height = `${h}px`;

    const ctx = canvasEl.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const padL = 44, padR = 46, padT = 20, padB = 22;
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    const pts = currentTransect.samples;
    const maxElev = Math.max(4800, Math.ceil(Math.max(...pts.map((p) => p.elev)) / 1000) * 1000 + 500);
    const minElev = -500;
    const maxPrecip = 2200;

    const xOf = (t) => padL + t * pw;
    const yElev = (e) => padT + (1 - (Math.max(minElev, e) - minElev) / (maxElev - minElev)) * ph;
    const yRain = (mm) => padT + (1 - Math.min(1, mm / maxPrecip)) * ph;

    // Three Topographic Step Reference Guides (4000m, 1500m, 0m sea level)
    for (const [eVal, label, col] of [
      [4000, '第一级阶梯 4000m', 'rgba(244,206,130,0.28)'],
      [1500, '第二级阶梯 1500m', 'rgba(244,206,130,0.18)'],
      [0, '海平面 0m', 'rgba(90,190,255,0.32)'],
    ]) {
      if (eVal > maxElev) continue;
      const y = yElev(eVal);
      ctx.save();
      ctx.strokeStyle = col;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(235, 215, 175, 0.58)';
      ctx.font = '9.5px "PingFang SC", sans-serif';
      ctx.fillText(label, padL + 4, y - 3);
      ctx.restore();
    }

    // 1. Filled Hypsometric Terrain Profile
    const terrainGrad = ctx.createLinearGradient(0, padT, 0, padT + ph);
    terrainGrad.addColorStop(0, 'rgba(255, 232, 178, 0.78)');
    terrainGrad.addColorStop(0.45, 'rgba(218, 168, 86, 0.52)');
    terrainGrad.addColorStop(1, 'rgba(42, 98, 76, 0.22)');

    ctx.beginPath();
    ctx.moveTo(xOf(0), yElev(0));
    pts.forEach((p) => ctx.lineTo(xOf(p.t), yElev(p.elev)));
    ctx.lineTo(xOf(1), yElev(0));
    ctx.closePath();
    ctx.fillStyle = terrainGrad;
    ctx.fill();

    // Terrain Crest Stroke
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(xOf(p.t), yElev(p.elev));
      else ctx.lineTo(xOf(p.t), yElev(p.elev));
    });
    ctx.strokeStyle = '#f6d27a';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // 2. Annual Precipitation Curve (Cyan-Azure Overlay showing windward orographic rain!)
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(xOf(p.t), yRain(p.precip));
      else ctx.lineTo(xOf(p.t), yRain(p.precip));
    });
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.65;
    ctx.stroke();

    // 3. Landmark Callouts along the Transect
    ctx.font = '600 10.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    for (const lm of currentTransect.landmarks) {
      const idx = Math.min(SAMPLES - 1, Math.max(0, Math.round(lm.t * (SAMPLES - 1))));
      const p = pts[idx];
      const lx = xOf(p.t);
      const ly = Math.max(padT + 10, yElev(p.elev) - 8);
      ctx.fillStyle = '#fff3d1';
      ctx.fillText(lm.name, lx, ly);
    }

    // 4. Hover Crosshair & Active Probe Dot
    if (hoverIndex >= 0 && hoverIndex < SAMPLES) {
      const hp = pts[hoverIndex];
      const hx = xOf(hp.t);
      ctx.strokeStyle = '#00ffd5';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx, padT);
      ctx.lineTo(hx, padT + ph);
      ctx.stroke();

      ctx.fillStyle = '#00ffd5';
      ctx.beginPath();
      ctx.arc(hx, yElev(hp.elev), 4.0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Axes Labels
    ctx.font = '10px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f5d27a';
    ctx.fillText(`${maxElev}m`, padL - 5, padT + 7);
    ctx.fillText('0m', padL - 5, yElev(0) + 3);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('2200mm', w - padR + 4, padT + 7);
    ctx.fillText('800mm', w - padR + 4, yRain(800) + 3);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(210,225,242,0.68)';
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.fillText(`${Math.round(currentTransect.totalKm * frac)} km`, xOf(frac), h - 5);
    }
  }

  function loadPreset(presetKey) {
    const preset = PROFILE_PRESETS[presetKey];
    if (!preset) return;
    customPickMode = false;
    pickPointA = null;
    if (statusHintEl) statusHintEl.textContent = `当前剖面：${preset.label}（鼠标滑过图表可在3D沙盘联动定位）`;
    const [x0, z0] = projectLonLat(preset.startLonLat[0], preset.startLonLat[1]);
    const [x1, z1] = projectLonLat(preset.endLonLat[0], preset.endLonLat[1]);
    buildTransectFromXZ(x0, z0, x1, z1, preset.label, preset.landmarks);
  }

  // Chart mouse hover -> 3D terrain laser probe sync!
  if (canvasEl) {
    canvasEl.addEventListener('pointermove', (e) => {
      if (!currentTransect) return;
      const rect = canvasEl.getBoundingClientRect();
      const padL = 44, padR = 46;
      const t = (e.clientX - rect.left - padL) / Math.max(1, rect.width - padL - padR);
      if (t < 0 || t > 1) {
        hoverIndex = -1;
        probeGroup.visible = false;
        renderChart();
        return;
      }
      hoverIndex = Math.min(SAMPLES - 1, Math.max(0, Math.round(t * (SAMPLES - 1))));
      const p = currentTransect.samples[hoverIndex];
      probeGroup.visible = true;
      probeGroup.position.set(p.x, p.worldYBase * currentExag + 0.22, p.z);
      if (readoutEl) {
        readoutEl.innerHTML = `📍 距起点 <b>${p.km} km</b> · 坐标 <b>${p.lon.toFixed(1)}°E, ${p.lat.toFixed(1)}°N</b>（${p.provName}） · 海拔 <b style="color:#f6d27a">${p.elev} m</b> · 年降水量 <b style="color:#38bdf8">~${p.precip} mm</b>`;
      }
      renderChart();
    });
    canvasEl.addEventListener('pointerleave', () => {
      hoverIndex = -1;
      probeGroup.visible = false;
      renderChart();
    });
  }

  return {
    open(defaultPreset = 'lat32') {
      isOpen = true;
      group.visible = true;
      drawerEl?.classList.add('is-open');
      if (!currentTransect) loadPreset(defaultPreset);
      else renderChart();
    },
    close() {
      isOpen = false;
      customPickMode = false;
      pickPointA = null;
      group.visible = false;
      drawerEl?.classList.remove('is-open');
    },
    toggle() {
      if (isOpen) this.close();
      else this.open('lat32');
      return isOpen;
    },
    isOpen: () => isOpen,
    isPickingPoints: () => customPickMode,
    loadPreset,
    startCustomTwoPointPick() {
      if (!isOpen) this.open('lat32');
      customPickMode = true;
      pickPointA = null;
      if (statusHintEl) statusHintEl.textContent = '👆 请在 3D 地形上点击剖面【起点 A】…';
    },
    handleTerrainClick(hitXZ) {
      if (!customPickMode) return false;
      if (!pickPointA) {
        pickPointA = hitXZ;
        pinA.position.set(hitXZ[0], sampleCPU(hitXZ[0], hitXZ[1]).worldYBase * currentExag, hitXZ[1]);
        if (statusHintEl) statusHintEl.textContent = '👆 已选起点 A！请再点击 3D 地形上的剖面【终点 B】…';
        return true;
      } else {
        const a = pickPointA;
        customPickMode = false;
        pickPointA = null;
        if (statusHintEl) statusHintEl.textContent = '自定义两点立体地形—降水剖面（滑过折线实时联动3D光点）';
        buildTransectFromXZ(a[0], a[1], hitXZ[0], hitXZ[1], '自定义两点切线剖面', []);
        return true;
      }
    },
    setExaggeration(exag) {
      currentExag = exag;
      if (isOpen && currentTransect) update3DGeometry();
    },
    onResize() {
      if (isOpen) renderChart();
    },
  };
}
