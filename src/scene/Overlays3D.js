import * as THREE from 'three';
import { projectLonLat } from '../utils/projection.js';
import { RIVER_OCEAN_BASIN } from '../data/teachingData.js';

const PRIMARY_CAPITALS = new Set([
  110000, // 北京
  310000, // 上海
  440000, // 广州
  510000, // 成都
  540000, // 拉萨
  650000, // 乌鲁木齐
  230000, // 哈尔滨
  610000, // 西安
  420000, // 武汉
  710000, // 台北
  810000, // 香港
  530000, // 昆明
  620000, // 兰州
  500000, // 重庆
]);

export function createOverlays3D(scene, atlasData, teachingEntities, labelLayerEl, callbacks) {
  const root = new THREE.Group();
  const riversGroup = new THREE.Group();
  const mountainsGroup = new THREE.Group();
  const capitalsGroup = new THREE.Group();
  const dividesGroup = new THREE.Group();
  const maritimeGroup = new THREE.Group();
  const landformsGroup = new THREE.Group();
  const huLineGroup = new THREE.Group();
  const hydroSpecialGroup = new THREE.Group();
  const rainBeltGroup = new THREE.Group();
  const activeRiverHighlightGroup = new THREE.Group();
  const activeMountainHighlightGroup = new THREE.Group();

  root.add(
    riversGroup,
    mountainsGroup,
    capitalsGroup,
    dividesGroup,
    maritimeGroup,
    landformsGroup,
    huLineGroup,
    hydroSpecialGroup,
    rainBeltGroup,
    activeRiverHighlightGroup,
    activeMountainHighlightGroup
  );
  scene.add(root);

  // Shared animated uniform for 3D volumetric river/mountain highlight ribbons
  const highlightTimeUniform = { value: 0 };

  function clearHighlightGroup(grp) {
    while (grp.children.length > 0) {
      const child = grp.children[0];
      grp.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  }

  function createFlowingTubeMaterial(baseHex, pulseHex, speed = 4.2, opacity = 0.96, additive = false) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: highlightTimeUniform,
        uBaseColor: { value: new THREE.Color(baseHex) },
        uPulseColor: { value: new THREE.Color(pulseHex) },
        uSpeed: { value: speed },
        uOpacity: { value: opacity },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uPulseColor;
        uniform float uSpeed;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float wave = 0.5 + 0.5 * sin(vUv.x * 26.0 - uTime * uSpeed);
          float pulse = pow(wave, 3.0);
          vec3 col = mix(uBaseColor, uPulseColor, pulse * 0.72);
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    });
  }

  function createVerticalVeilMaterial(colorHex, maxOpacity = 0.58) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: highlightTimeUniform,
        uColor: { value: new THREE.Color(colorHex) },
        uMaxOpacity: { value: maxOpacity },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uMaxOpacity;
        varying vec2 vUv;
        void main() {
          // vUv.y = 0 at ridge/river base, 1 at top of light curtain
          float vFade = pow(1.0 - vUv.y, 1.85);
          float shimmer = 0.82 + 0.18 * sin(vUv.x * 22.0 - uTime * 3.5);
          gl_FragColor = vec4(uColor * (1.1 + (1.0 - vUv.y) * 0.35), vFade * uMaxOpacity * shimmer);
        }
      `,
    });
  }

  function buildVerticalVeilGeometry(vec3Pts, curtainHeight) {
    const n = vec3Pts.length;
    const verts = new Float32Array(n * 2 * 3);
    const uvs = new Float32Array(n * 2 * 2);
    const indices = [];
    for (let i = 0; i < n; i++) {
      const p = vec3Pts[i];
      const u = i / Math.max(1, n - 1);
      verts[i * 6] = p.x;
      verts[i * 6 + 1] = p.y;
      verts[i * 6 + 2] = p.z;
      verts[i * 6 + 3] = p.x;
      verts[i * 6 + 4] = p.y + curtainHeight;
      verts[i * 6 + 5] = p.z;

      uvs[i * 4] = u;
      uvs[i * 4 + 1] = 0;
      uvs[i * 4 + 2] = u;
      uvs[i * 4 + 3] = 1;

      if (i < n - 1) {
        const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  const riverDataById = new Map(atlasData.rivers.map((r) => [r.id, r]));
  const mountainDataById = new Map(atlasData.mountains.map((m) => [m.id, m]));
  let currentHighlightedRiverId = null;
  let currentHighlightedMountainId = null;

  const scalableYObjects = [];
  const labelItems = [];

  function createScalableLine(points3D, material, yOffset = 0.04) {
    const n = points3D.length;
    const basePos = new Float32Array(n * 3);
    const livePos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      basePos[i * 3] = points3D[i][0];
      basePos[i * 3 + 1] = points3D[i][1];
      basePos[i * 3 + 2] = points3D[i][2];
      livePos[i * 3] = points3D[i][0];
      livePos[i * 3 + 1] = points3D[i][1] + yOffset;
      livePos[i * 3 + 2] = points3D[i][2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(livePos, 3));
    const line = new THREE.Line(geo, material);
    scalableYObjects.push({ type: 'line', geo, basePos, yOffset });
    return line;
  }

  // ================= 1. 14 MAJOR RIVER SYSTEMS + BASIN COLORING + FLOW PARTICLES =================
  const riverLineMats = new Map();
  const flowParticleTracks = [];
  let basinColorMode = false;

  for (const r of atlasData.rivers) {
    const col = new THREE.Color(r.color);
    const basinInfo = RIVER_OCEAN_BASIN[r.id] || { basin: '外流水系', basinColor: r.color };
    const basinCol = new THREE.Color(basinInfo.basinColor);

    const mat = new THREE.LineBasicMaterial({
      color: col.clone(),
      transparent: true,
      opacity: r.primary ? 0.84 : 0.58,
      depthWrite: false,
    });
    riverLineMats.set(r.id, {
      mat,
      baseOpacity: r.primary ? 0.84 : 0.58,
      baseColor: col.clone(),
      basinColor: basinCol,
    });

    for (const seg of r.segments) {
      if (seg.length < 2) continue;
      riversGroup.add(createScalableLine(seg, mat, 0.035));
      if (seg.length >= 5) {
        flowParticleTracks.push({ pts: seg, color: col, basinColor: basinCol, id: r.id, primary: r.primary });
      }
    }

    labelItems.push({
      kind: 'river',
      id: r.id,
      data: r,
      xyz: r.labelXYZ,
      priority: r.id === 'yangtze' || r.id === 'yellow' ? 92 : r.primary ? 74 : 46,
      minZoomDist: r.primary ? 125 : 68,
      html: `<span class="tag-river" style="--tag-accent:${r.color}"><i class="tag-dot"></i>${r.name}</span>`,
    });
  }

  for (const lk of atlasData.lakes) {
    const isTopLake = lk.name === '青海湖' || lk.name === '鄱阳湖' || lk.name === '洞庭湖' || lk.name === '太湖' || lk.name === '纳木错';
    labelItems.push({
      kind: 'lake',
      id: lk.name,
      data: lk,
      xyz: [lk.xyz[0], lk.xyz[1] + 0.05, lk.xyz[2]],
      priority: isTopLake ? 64 : 38,
      minZoomDist: isTopLake ? 88 : 48,
      html: `<span class="tag-lake">${lk.name}</span>`,
    });
  }

  const RIVER_PARTICLES = 2600;
  const rpPos = new Float32Array(RIVER_PARTICLES * 3);
  const rpCol = new Float32Array(RIVER_PARTICLES * 3);
  const rpMeta = [];
  if (flowParticleTracks.length > 0) {
    for (let i = 0; i < RIVER_PARTICLES; i++) {
      const track = flowParticleTracks[i % flowParticleTracks.length];
      rpMeta.push({
        track,
        t: Math.random(),
        speed: (0.055 + Math.random() * 0.065) * (track.primary ? 1.15 : 0.85),
      });
      rpCol[i * 3] = track.color.r;
      rpCol[i * 3 + 1] = track.color.g;
      rpCol[i * 3 + 2] = track.color.b;
    }
  }
  const rpGeo = new THREE.BufferGeometry();
  rpGeo.setAttribute('position', new THREE.BufferAttribute(rpPos, 3));
  rpGeo.setAttribute('color', new THREE.BufferAttribute(rpCol, 3));
  const rpMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 3.2 * (70.0 / max(12.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float g = pow(1.0 - d * 2.0, 2.0);
        gl_FragColor = vec4(vColor * 1.25, g * 0.88);
      }
    `,
  });
  const riverParticles = new THREE.Points(rpGeo, rpMat);
  riverParticles.frustumCulled = false;
  riversGroup.add(riverParticles);

  // ================= 2. 22 MAJOR MOUNTAIN RANGES & SUMMIT PYRAMIDS =================
  const peakConeGeo = new THREE.ConeGeometry(0.24, 0.58, 4);
  const peakConeMat = new THREE.MeshStandardMaterial({
    color: 0xf7dca1,
    emissive: 0x9c6e27,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.6,
  });

  const mtnSpineMats = new Map();
  for (const m of atlasData.mountains) {
    const spineMat = new THREE.LineBasicMaterial({
      color: m.tier === 1 ? 0xf3cf8a : 0xd4b475,
      transparent: true,
      opacity: m.tier === 1 ? 0.55 : 0.36,
      depthWrite: false,
    });
    mtnSpineMats.set(m.id, { mat: spineMat, baseOpacity: m.tier === 1 ? 0.55 : 0.36 });
    mountainsGroup.add(createScalableLine(m.spine, spineMat, 0.08));

    const cone = new THREE.Mesh(peakConeGeo, peakConeMat);
    cone.position.set(m.peakXYZ[0], m.peakXYZ[1] + 0.26, m.peakXYZ[2]);
    cone.rotation.y = Math.PI * 0.25;
    if (m.elev >= 7000) cone.scale.setScalar(1.35);
    mountainsGroup.add(cone);
    scalableYObjects.push({ type: 'mesh', mesh: cone, baseY: m.peakXYZ[1], yOffset: 0.26 });

    const isIconic = m.id === 'himalaya' || m.id === 'kunlun' || m.id === 'tianshan' || m.id === 'qinling' || m.id === 'daxingan' || m.id === 'hengduan' || m.id === 'taihang' || m.id === 'taiwan_range' || m.id === 'qilian' || m.id === 'changbai';
    labelItems.push({
      kind: 'mountain',
      id: m.id,
      data: m,
      xyz: [m.peakXYZ[0], m.peakXYZ[1] + 0.72, m.peakXYZ[2]],
      priority: m.id === 'himalaya' || m.id === 'qinling' ? 95 : isIconic ? 80 : 52,
      minZoomDist: isIconic ? 130 : 75,
      html: `<span class="tag-mountain ${m.tier === 1 ? 'tier-1' : ''}">▲ ${m.name}<em>${Math.round(m.elev)}m</em></span>`,
    });
  }

  // ================= 3. 34 PROVINCIAL CAPITALS BEACONS =================
  const capDiamondGeo = new THREE.OctahedronGeometry(0.19, 0);
  const beamGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.15, 6);
  beamGeo.translate(0, 0.575, 0);
  const beijingRings = [];

  for (const p of atlasData.provinces) {
    const isBeijing = p.adcode === 110000;
    const isPrimary = PRIMARY_CAPITALS.has(p.adcode);

    const pinGroup = new THREE.Group();
    pinGroup.position.set(p.capXZ[0], p.capY, p.capXZ[1]);

    if (isBeijing) {
      const starMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshBasicMaterial({ color: 0xff5a4e })
      );
      starMesh.position.y = 0.35;
      pinGroup.add(starMesh);

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.56, 32),
        new THREE.MeshBasicMaterial({ color: 0xffcf6e, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false })
      );
      halo.rotation.x = -Math.PI * 0.5;
      halo.position.y = 0.08;
      pinGroup.add(halo);
      beijingRings.push({ starMesh, halo });

      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({ color: 0xff7b54, transparent: true, opacity: 0.55, depthWrite: false })
      );
      beam.scale.y = 1.65;
      pinGroup.add(beam);
    } else {
      const diamond = new THREE.Mesh(
        capDiamondGeo,
        new THREE.MeshBasicMaterial({ color: isPrimary ? 0xffdf8e : 0x9ce6ff })
      );
      diamond.position.y = 0.24;
      diamond.scale.setScalar(isPrimary ? 1.0 : 0.78);
      pinGroup.add(diamond);

      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          color: isPrimary ? 0xf5c96b : 0x6ec9f5,
          transparent: true,
          opacity: isPrimary ? 0.38 : 0.24,
          depthWrite: false,
        })
      );
      beam.scale.y = isPrimary ? 0.95 : 0.65;
      pinGroup.add(beam);
    }

    capitalsGroup.add(pinGroup);
    scalableYObjects.push({ type: 'mesh', mesh: pinGroup, baseY: p.capY, yOffset: 0.02 });

    labelItems.push({
      kind: 'capital',
      id: p.id,
      provId: p.id,
      data: p,
      xyz: [p.capXZ[0], p.capY + (isBeijing ? 0.78 : 0.48), p.capXZ[1]],
      priority: isBeijing ? 100 : isPrimary ? 76 : 56,
      minZoomDist: isBeijing ? 160 : isPrimary ? 120 : 78,
      html: isBeijing
        ? `<span class="tag-capital is-beijing">★ ${p.capital}<small>${p.short}</small></span>`
        : `<span class="tag-capital">● ${p.capital}<small>${p.short}</small></span>`,
    });
  }

  // ================= 4. CLIMATIC & TOPOGRAPHIC STEP DIVIDE LINES =================
  for (const div of atlasData.divides) {
    const col = new THREE.Color(div.color);
    const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.90, depthWrite: false });
    dividesGroup.add(createScalableLine(div.points, mat, 0.14));

    const mid = div.points[Math.floor(div.points.length * 0.48)] || [0, 1, 0];
    labelItems.push({
      kind: 'divide',
      id: div.id,
      data: div,
      xyz: [mid[0], mid[1] + 0.35, mid[2]],
      priority: 86,
      minZoomDist: 140,
      html: `<span class="tag-divide" style="--div-col:${div.color}">${div.name}</span>`,
    });
  }
  dividesGroup.visible = false;

  // ================= 5. FOURTEEN MAJOR LANDFORM PLAQUES (四大高原·四大盆地·三大平原·三大丘陵) =================
  landformsGroup.visible = false;
  if (teachingEntities && Array.isArray(teachingEntities.landforms)) {
    for (const lf of teachingEntities.landforms) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.62, 24),
        new THREE.MeshBasicMaterial({ color: 0xffe29a, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false })
      );
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.set(lf.xyz[0], lf.xyz[1] - 0.25, lf.xyz[2]);
      landformsGroup.add(ring);
      scalableYObjects.push({ type: 'mesh', mesh: ring, baseY: lf.xyz[1] - 0.25, yOffset: 0.02 });

      labelItems.push({
        kind: 'landform',
        id: lf.id,
        data: lf,
        xyz: lf.xyz,
        priority: 88,
        minZoomDist: 145,
        html: `<span class="tag-landform">❖ ${lf.name}<small>${lf.cat}</small></span>`,
      });
    }

    // ================= 6. HU HUANYONG LINE (胡焕庸线：黑河—腾冲) =================
    const hu = teachingEntities.huLine;
    const huMat = new THREE.LineBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.98 });
    huLineGroup.add(createScalableLine(hu.points, huMat, 0.22));

    // Translucent vermilion vertical curtain along Hu Line!
    const hLen = hu.points.length;
    const hCurtainVerts = new Float32Array(hLen * 2 * 3);
    const hIdx = [];
    for (let i = 0; i < hLen; i++) {
      const p = hu.points[i];
      hCurtainVerts[i * 6] = p[0];
      hCurtainVerts[i * 6 + 1] = p[1];
      hCurtainVerts[i * 6 + 2] = p[2];
      hCurtainVerts[i * 6 + 3] = p[0];
      hCurtainVerts[i * 6 + 4] = p[1] + 1.65;
      hCurtainVerts[i * 6 + 5] = p[2];
      if (i < hLen - 1) {
        const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
        hIdx.push(a, b, c, b, d, c);
      }
    }
    const hCurtainGeo = new THREE.BufferGeometry();
    hCurtainGeo.setAttribute('position', new THREE.BufferAttribute(hCurtainVerts, 3));
    hCurtainGeo.setIndex(hIdx);
    huLineGroup.add(
      new THREE.Mesh(
        hCurtainGeo,
        new THREE.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
      )
    );

    const huMid = hu.points[Math.floor(hLen * 0.48)];
    const heihePt = hu.points[0];
    const tengchongPt = hu.points[hLen - 1];
    labelItems.push(
      {
        kind: 'huline',
        id: 'hu_main',
        data: hu,
        xyz: [huMid[0], huMid[1] + 1.5, huMid[2]],
        priority: 98,
        minZoomDist: 160,
        html: `<span class="tag-huline">★ 胡焕庸线（东南93.5%人口 ⇄ 西北6.5%人口）</span>`,
      },
      {
        kind: 'huline',
        id: 'hu_heihe',
        data: hu,
        xyz: [heihePt[0], heihePt[1] + 0.8, heihePt[2]],
        priority: 90,
        minZoomDist: 160,
        html: `<span class="tag-huline-end">黑河（黑龙江）</span>`,
      },
      {
        kind: 'huline',
        id: 'hu_tengchong',
        data: hu,
        xyz: [tengchongPt[0], tengchongPt[1] + 0.8, tengchongPt[2]],
        priority: 90,
        minZoomDist: 160,
        html: `<span class="tag-huline-end">腾冲（云南）</span>`,
      }
    );
    huLineGroup.visible = false;

    // ================= 7. ENDORHEIC DIVIDE & MEGA HYDRO PROJECTS (内外流界与超级水利枢纽) =================
    const endo = teachingEntities.endorheicLine;
    hydroSpecialGroup.add(
      createScalableLine(
        endo.points,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.92 }),
        0.18
      )
    );
    const endoMid = endo.points[Math.floor(endo.points.length * 0.45)];
    labelItems.push({
      kind: 'hydro',
      id: 'endo_divide',
      data: { name: endo.name, step: '三大洋外流区 ⇄ 西北/藏北内流区', desc: endo.desc, lonLat: [106, 38.8], xyz: endoMid },
      xyz: [endoMid[0], endoMid[1] + 0.6, endoMid[2]],
      priority: 91,
      minZoomDist: 155,
      html: `<span class="tag-divide" style="--div-col:#38bdf8">外流区 ⇄ 内流区分界线</span>`,
    });

    const damGeo = new THREE.OctahedronGeometry(0.28, 0);
    const damMat = new THREE.MeshBasicMaterial({ color: 0x38f8d8 });
    for (const hp of teachingEntities.hydroProjects) {
      const m = new THREE.Mesh(damGeo, damMat);
      m.position.set(hp.xyz[0], hp.xyz[1], hp.xyz[2]);
      hydroSpecialGroup.add(m);
      scalableYObjects.push({ type: 'mesh', mesh: m, baseY: hp.xyz[1], yOffset: 0.05 });

      labelItems.push({
        kind: 'hydro',
        id: hp.id,
        data: hp,
        xyz: [hp.xyz[0], hp.xyz[1] + 0.55, hp.xyz[2]],
        priority: 89,
        minZoomDist: 150,
        html: `<span class="tag-hydro">⚡ ${hp.name}</span>`,
      });
    }
    hydroSpecialGroup.visible = false;
  }

  // ================= 8. MONTHLY SUBTROPICAL HIGH RIDGE & TYPHOON SPIRAL (副高脊线与夏秋台风) =================
  const subHighPts = [];
  for (let i = 0; i <= 24; i++) subHighPts.push(new THREE.Vector3(0, 0.35, 0));
  const subHighGeo = new THREE.BufferGeometry().setFromPoints(subHighPts);
  const subHighLine = new THREE.Line(
    subHighGeo,
    new THREE.LineBasicMaterial({ color: 0xff9f43, transparent: true, opacity: 0.9 })
  );
  rainBeltGroup.add(subHighLine);

  // Translucent Frontal Rainbelt Band
  const beltGeo = new THREE.PlaneGeometry(36, 5.5);
  beltGeo.rotateX(-Math.PI * 0.5);
  const beltMesh = new THREE.Mesh(
    beltGeo,
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  beltMesh.position.set(14, 0.35, 8);
  rainBeltGroup.add(beltMesh);

  // 3D Rotating Typhoon Spiral for July–September!
  const typhoonGroup = new THREE.Group();
  const tyCount = 280;
  const tyPos = new Float32Array(tyCount * 3);
  for (let i = 0; i < tyCount; i++) {
    const arm = i % 3;
    const r = 0.35 + (i / tyCount) * 4.2;
    const ang = r * 1.65 + (arm * Math.PI * 2) / 3;
    tyPos[i * 3] = Math.cos(ang) * r + (Math.random() - 0.5) * 0.35;
    tyPos[i * 3 + 1] = 0.45 + (1 - r / 4.6) * 0.5;
    tyPos[i * 3 + 2] = Math.sin(ang) * r + (Math.random() - 0.5) * 0.35;
  }
  const tyGeo = new THREE.BufferGeometry();
  tyGeo.setAttribute('position', new THREE.BufferAttribute(tyPos, 3));
  const tyPoints = new THREE.Points(
    tyGeo,
    new THREE.PointsMaterial({ color: 0xe0f7ff, size: 0.36, transparent: true, opacity: 0.82, depthWrite: false })
  );
  typhoonGroup.add(tyPoints);
  typhoonGroup.visible = false;
  rainBeltGroup.add(typhoonGroup);
  rainBeltGroup.visible = false;

  function updateSubHighAndRainBelt(guideEntry, time) {
    if (!guideEntry) return;
    const posArr = subHighGeo.attributes.position.array;
    for (let i = 0; i <= 24; i++) {
      const lon = 108 + (i / 24) * 26;
      const lat = guideEntry.subHighLat + Math.sin((i / 24) * Math.PI) * 1.2;
      const [x, z] = projectLonLat(lon, lat);
      posArr[i * 3] = x;
      posArr[i * 3 + 1] = 0.65;
      posArr[i * 3 + 2] = z;
    }
    subHighGeo.attributes.position.needsUpdate = true;

    const midRainLat = 0.5 * (guideEntry.rainBeltLat[0] + guideEntry.rainBeltLat[1]);
    const [bx, bz] = projectLonLat(114.5, midRainLat);
    beltMesh.position.set(bx, 1.35, bz);

    typhoonGroup.visible = Boolean(guideEntry.typhoon);
    if (guideEntry.typhoon) {
      const cyc = (time * 0.14) % 1.0;
      const tLon = 128.5 - cyc * 13.5;
      const tLat = 18.5 + cyc * 7.8;
      const [tx, tz] = projectLonLat(tLon, tLat);
      typhoonGroup.position.set(tx, 0.6, tz);
      typhoonGroup.rotation.y = -time * 2.6; // Counter-clockwise Northern Hemisphere cyclone!
    }
  }

  // ================= 9. SOUTH CHINA SEA TEN-DASH LINE & ARCHIPELAGOS =================
  const dashMat = new THREE.LineBasicMaterial({ color: 0xf7cf78, transparent: true, opacity: 0.85 });
  for (const seg of atlasData.southChinaSea.tenDashLinesXZ) {
    const pts = seg.map(([x, z]) => new THREE.Vector3(x, 0.05, z));
    maritimeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dashMat));
  }
  for (const arch of atlasData.southChinaSea.archipelagos) {
    if (!arch.xz) continue;
    const [x, z] = arch.xz;
    if (Math.abs(x) > 44 || Math.abs(z) > 35) continue;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.30, 20),
      new THREE.MeshBasicMaterial({ color: 0xffe094, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.set(x, 0.04, z);
    maritimeGroup.add(ring);

    labelItems.push({
      kind: 'archipelago',
      id: arch.name,
      data: arch,
      xyz: [x, 0.25, z],
      priority: 62,
      minZoomDist: 98,
      html: `<span class="tag-island">◆ ${arch.name}</span>`,
    });
  }

  // ================= 10. CREATE INTERACTIVE DOM LABEL ELEMENTS =================
  for (const item of labelItems) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `map-label kind-${item.kind}`;
    el.innerHTML = item.html;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onLabelClick?.(item);
    });
    el.addEventListener('mouseenter', () => callbacks.onLabelHover?.(item, true));
    el.addEventListener('mouseleave', () => callbacks.onLabelHover?.(item, false));
    labelLayerEl.appendChild(el);
    item.el = el;
  }

  const projVec = new THREE.Vector3();
  let currentExag = 1.0;

  function rebuildHighlightedRiver(riverId) {
    clearHighlightGroup(activeRiverHighlightGroup);
    if (!riverId) return;
    const r = riverDataById.get(riverId);
    if (!r) return;

    // Choose unmistakable high-contrast glowing color (amber-gold for Yellow River, bright electric cyan-jade for others)
    const isYellow = riverId === 'yellow' || riverId === 'tarim';
    const coreHex = isYellow ? '#ff9d00' : '#00e5ff';
    const pulseHex = isYellow ? '#fff4b8' : '#d8ffff';
    const haloHex = isYellow ? '#ffbb33' : '#00c8ff';

    const coreMat = createFlowingTubeMaterial(coreHex, pulseHex, 5.2, 0.98, false);
    const haloMat = createFlowingTubeMaterial(haloHex, '#ffffff', 5.2, 0.36, true);
    const veilMat = createVerticalVeilMaterial(coreHex, 0.45);

    for (const seg of r.segments) {
      if (seg.length < 2) continue;
      const pts = seg.map((p) => new THREE.Vector3(p[0], p[1] * currentExag + 0.16, p[2]));
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubularSegs = Math.max(24, Math.min(220, pts.length * 3));

      const coreGeo = new THREE.TubeGeometry(curve, tubularSegs, 0.20, 8, false);
      const haloGeo = new THREE.TubeGeometry(curve, tubularSegs, 0.42, 8, false);
      const veilGeo = buildVerticalVeilGeometry(pts, 0.72);

      activeRiverHighlightGroup.add(new THREE.Mesh(coreGeo, coreMat));
      activeRiverHighlightGroup.add(new THREE.Mesh(haloGeo, haloMat));
      activeRiverHighlightGroup.add(new THREE.Mesh(veilGeo, veilMat));
    }
  }

  function rebuildHighlightedMountain(mtnId) {
    clearHighlightGroup(activeMountainHighlightGroup);
    if (!mtnId) return;
    const m = mountainDataById.get(mtnId);
    if (!m || !m.spine || m.spine.length < 2) return;

    const pts = m.spine.map((p) => new THREE.Vector3(p[0], p[1] * currentExag + 0.20, p[2]));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubularSegs = Math.max(36, pts.length * 3);

    // High-contrast fiery vermilion-gold ridge core + luminous vertical curtain veil so full length & strike pop over snow OR green!
    const coreMat = createFlowingTubeMaterial('#ff5e2b', '#ffe07a', 3.4, 0.98, false);
    const haloMat = createFlowingTubeMaterial('#ff9933', '#fff0b3', 3.4, 0.34, true);
    const veilMat = createVerticalVeilMaterial('#ff7b36', 0.62);

    activeMountainHighlightGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, tubularSegs, 0.24, 8, false), coreMat));
    activeMountainHighlightGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, tubularSegs, 0.48, 8, false), haloMat));
    activeMountainHighlightGroup.add(new THREE.Mesh(buildVerticalVeilGeometry(pts, 1.55), veilMat));

    // Endpoint pillars marking start & end of the mountain range
    const endMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    for (const endPt of [pts[0], pts[pts.length - 1]]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.55, 10), endMat);
      pillar.position.set(endPt.x, endPt.y + 0.77, endPt.z);
      activeMountainHighlightGroup.add(pillar);
    }

    // Pulsing Summit Crown Ring at main peak
    const peakRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.85, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe484, side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false })
    );
    peakRing.rotation.x = -Math.PI * 0.5;
    peakRing.position.set(m.peakXYZ[0], m.peakXYZ[1] * currentExag + 0.32, m.peakXYZ[2]);
    activeMountainHighlightGroup.add(peakRing);
  }

  function setExaggeration(exag) {
    if (Math.abs(exag - currentExag) < 0.001) return;
    currentExag = exag;
    for (const entry of scalableYObjects) {
      if (entry.type === 'line') {
        const pos = entry.geo.attributes.position.array;
        const base = entry.basePos;
        for (let i = 0; i < base.length; i += 3) {
          pos[i + 1] = base[i + 1] * exag + entry.yOffset;
        }
        entry.geo.attributes.position.needsUpdate = true;
      } else if (entry.type === 'mesh') {
        entry.mesh.position.y = entry.baseY * exag + entry.yOffset;
      }
    }
    if (currentHighlightedRiverId) rebuildHighlightedRiver(currentHighlightedRiverId);
    if (currentHighlightedMountainId) rebuildHighlightedMountain(currentHighlightedMountainId);
  }

  function applyRiverColors(highlightId = null) {
    for (const [id, info] of riverLineMats.entries()) {
      const targetBase = basinColorMode ? info.basinColor : info.baseColor;
      if (!highlightId) {
        info.mat.opacity = basinColorMode ? 0.92 : info.baseOpacity;
        info.mat.color.copy(targetBase);
      } else if (id === highlightId) {
        info.mat.opacity = 1.0;
        info.mat.color.setHex(0xffffff).lerp(targetBase, 0.35);
      } else {
        info.mat.opacity = info.baseOpacity * 0.28;
        info.mat.color.copy(targetBase);
      }
    }
    for (let i = 0; i < RIVER_PARTICLES; i++) {
      const tr = rpMeta[i].track;
      const c = basinColorMode ? tr.basinColor : tr.color;
      rpCol[i * 3] = c.r;
      rpCol[i * 3 + 1] = c.g;
      rpCol[i * 3 + 2] = c.b;
    }
    rpGeo.attributes.color.needsUpdate = true;
  }

  return {
    riversGroup,
    mountainsGroup,
    capitalsGroup,
    dividesGroup,
    maritimeGroup,
    landformsGroup,
    huLineGroup,
    hydroSpecialGroup,
    rainBeltGroup,
    setExaggeration,
    setBasinColorMode(enabled) {
      basinColorMode = enabled;
      applyRiverColors(null);
    },
    highlightRiver(riverId) {
      currentHighlightedRiverId = riverId || null;
      applyRiverColors(currentHighlightedRiverId);
      rebuildHighlightedRiver(currentHighlightedRiverId);
    },
    highlightMountain(mtnId) {
      currentHighlightedMountainId = mtnId || null;
      for (const [id, info] of mtnSpineMats.entries()) {
        if (!currentHighlightedMountainId) {
          info.mat.opacity = info.baseOpacity;
          info.mat.color.setHex(0xf3cf8a);
        } else if (id === currentHighlightedMountainId) {
          info.mat.opacity = 1.0;
          info.mat.color.setHex(0xffd166);
        } else {
          info.mat.opacity = info.baseOpacity * 0.25;
        }
      }
      rebuildHighlightedMountain(currentHighlightedMountainId);
    },
    updateSubHighAndRainBelt,
    update(dt, time, camera, viewportW, viewportH, visibilityState, targetPoint) {
      highlightTimeUniform.value = time;
      for (const bj of beijingRings) {
        bj.starMesh.rotation.y = time * 1.4;
        const s = 1.0 + 0.14 * Math.sin(time * 3.0);
        bj.halo.scale.set(s, s, 1);
      }

      if (riversGroup.visible && rpMeta.length > 0) {
        const clampedDt = Math.min(0.05, dt);
        for (let i = 0; i < RIVER_PARTICLES; i++) {
          const m = rpMeta[i];
          m.t = (m.t + m.speed * clampedDt) % 1.0;
          const pts = m.track.pts;
          const fIdx = m.t * (pts.length - 1);
          const i0 = Math.floor(fIdx);
          const i1 = Math.min(pts.length - 1, i0 + 1);
          const frac = fIdx - i0;
          const p0 = pts[i0], p1 = pts[i1];
          rpPos[i * 3] = p0[0] + (p1[0] - p0[0]) * frac;
          rpPos[i * 3 + 1] = (p0[1] + (p1[1] - p0[1]) * frac) * currentExag + 0.06;
          rpPos[i * 3 + 2] = p0[2] + (p1[2] - p0[2]) * frac;
        }
        rpGeo.attributes.position.needsUpdate = true;
      }

      // In Classroom Blind-Map Quiz Mode, hide ALL text labels so students identify shapes purely from 3D geography!
      if (document.body.classList.contains('quiz-blind-mode')) {
        for (const item of labelItems) {
          item.el.style.opacity = '0';
          item.el.style.pointerEvents = 'none';
        }
        return;
      }

      const camPos = camera.position;
      const camTargetDist = targetPoint
        ? Math.hypot(camPos.x - targetPoint.x, camPos.y - targetPoint.y, camPos.z - targetPoint.z)
        : 65.0;
      const horizonDistLimit = Math.max(32.0, camTargetDist * 1.38);
      const isZen = document.body.classList.contains('zen-mode');
      const minSafeX = isZen ? 44 : 318;
      const maxSafeX = isZen ? viewportW - 44 : viewportW - 328;
      const minSafeY = isZen ? 95 : 108;
      const maxSafeY = viewportH - 96;

      const candidates = [];

      for (const item of labelItems) {
        let layerOn = true;
        if (item.kind === 'capital') layerOn = visibilityState.showCapitals;
        else if (item.kind === 'mountain') layerOn = visibilityState.showMountains;
        else if (item.kind === 'river' || item.kind === 'lake') layerOn = visibilityState.showRivers;
        else if (item.kind === 'divide') layerOn = visibilityState.showDivides;
        else if (item.kind === 'landform') layerOn = visibilityState.showLandforms;
        else if (item.kind === 'huline') layerOn = visibilityState.showHuLine;
        else if (item.kind === 'hydro') layerOn = visibilityState.showHydroSpecial;

        if (!layerOn) {
          item.el.style.opacity = '0';
          item.el.style.pointerEvents = 'none';
          continue;
        }

        const wx = item.xyz[0];
        const wy = item.xyz[1] * currentExag;
        const wz = item.xyz[2];
        const dist = Math.hypot(camPos.x - wx, camPos.y - wy, camPos.z - wz);

        const isHighlightedProv =
          item.kind === 'capital' &&
          (item.provId === visibilityState.hoveredProv || item.provId === visibilityState.selectedProv);
        const isSelectedItem =
          visibilityState.selectedFeatureId && visibilityState.selectedFeatureId === `${item.kind}:${item.id}`;

        if (!isHighlightedProv && !isSelectedItem && (dist > item.minZoomDist || dist > horizonDistLimit)) {
          item.el.style.opacity = '0';
          item.el.style.pointerEvents = 'none';
          continue;
        }

        projVec.set(wx, wy, wz).project(camera);
        if (projVec.z > 0.995 || projVec.z < -0.995) {
          item.el.style.opacity = '0';
          item.el.style.pointerEvents = 'none';
          continue;
        }

        const sx = (projVec.x * 0.5 + 0.5) * viewportW;
        const sy = (-projVec.y * 0.5 + 0.5) * viewportH;

        if (sx < minSafeX || sx > maxSafeX || sy < minSafeY || sy > maxSafeY) {
          item.el.style.opacity = '0';
          item.el.style.pointerEvents = 'none';
          continue;
        }

        const effPriority = isSelectedItem ? 200 : isHighlightedProv ? 180 : item.priority;
        candidates.push({ item, sx, sy, dist, effPriority, isHighlightedProv, isSelectedItem });
      }

      candidates.sort((a, b) => b.effPriority - a.effPriority);

      const scaleBoost = document.body.classList.contains('classroom-boost') ? 1.25 : 1.0;
      const placedBoxes = [];
      for (const c of candidates) {
        const baseHalfW = c.item.kind === 'huline' ? 115 : c.item.kind === 'divide' ? 80 : c.item.kind === 'mountain' || c.item.kind === 'landform' ? 58 : 40;
        const halfW = baseHalfW * scaleBoost;
        const halfH = 14 * scaleBoost;
        let blocked = false;
        if (c.effPriority < 150) {
          for (let k = 0; k < placedBoxes.length; k++) {
            const b = placedBoxes[k];
            if (Math.abs(c.sx - b.x) < halfW + b.hw && Math.abs(c.sy - b.y) < halfH + b.hh) {
              blocked = true;
              break;
            }
          }
        }
        const el = c.item.el;
        if (blocked) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        } else {
          placedBoxes.push({ x: c.sx, y: c.sy, hw: halfW, hh: halfH });
          el.style.transform = `translate3d(${c.sx.toFixed(1)}px, ${c.sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
          el.classList.toggle('is-active', Boolean(c.isHighlightedProv || c.isSelectedItem));
        }
      }
    },
  };
}
