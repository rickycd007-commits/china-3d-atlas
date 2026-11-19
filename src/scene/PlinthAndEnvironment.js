import * as THREE from 'three';
import { PROJ_CONFIG, projectLonLat } from '../utils/projection.js';

export function createPlinthAndEnvironment(scene) {
  const group = new THREE.Group();
  const W = PROJ_CONFIG.worldWidth;  // 90
  const H = PROJ_CONFIG.worldHeight; // 72

  // 1. Sculpted Dark Obsidian-Bronze Diorama Base Slab beneath the 90x72 terrain
  const baseDepth = 2.2;
  const plinthGeo = new THREE.BoxGeometry(W + 0.9, baseDepth, H + 0.9);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x0b1018,
    roughness: 0.42,
    metalness: 0.58,
  });
  const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
  plinthMesh.position.y = -baseDepth * 0.5 - 0.04;
  group.add(plinthMesh);

  // Outer Stepped Imperial Slate Pedestal
  const stepGeo = new THREE.BoxGeometry(W + 3.2, 0.55, H + 3.2);
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0x070a10,
    roughness: 0.32,
    metalness: 0.72,
  });
  const stepMesh = new THREE.Mesh(stepGeo, stepMat);
  stepMesh.position.y = -baseDepth - 0.25;
  group.add(stepMesh);

  // Champagne-Gold Hairline Trim Rim around the Plinth Top & Pedestal
  function createRectTrim(w, h, y, colorHex, opacity) {
    const hw = w * 0.5, hh = h * 0.5;
    const pts = [
      new THREE.Vector3(-hw, y, -hh),
      new THREE.Vector3(hw, y, -hh),
      new THREE.Vector3(hw, y, hh),
      new THREE.Vector3(-hw, y, hh),
      new THREE.Vector3(-hw, y, -hh),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity,
    });
    return new THREE.Line(geo, mat);
  }
  group.add(createRectTrim(W + 0.94, H + 0.94, -0.02, 0xd9b36c, 0.62));
  group.add(createRectTrim(W + 3.24, H + 3.24, -baseDepth + 0.03, 0xd9b36c, 0.35));

  // 2. Subtle Albers Latitude & Longitude Graticule Lines just above sea/frame
  const gratPositions = [];
  for (let lon = 75; lon <= 135; lon += 10) {
    for (let lat = 16; lat < 53; lat += 1.0) {
      const [x0, z0] = projectLonLat(lon, lat);
      const [x1, z1] = projectLonLat(lon, lat + 1.0);
      if (Math.abs(x0) <= W * 0.49 && Math.abs(z0) <= H * 0.49 && Math.abs(x1) <= W * 0.49 && Math.abs(z1) <= H * 0.49) {
        gratPositions.push(x0, 0.015, z0, x1, 0.015, z1);
      }
    }
  }
  for (let lat = 20; lat <= 50; lat += 10) {
    for (let lon = 72; lon < 138; lon += 1.0) {
      const [x0, z0] = projectLonLat(lon, lat);
      const [x1, z1] = projectLonLat(lon + 1.0, lat);
      if (Math.abs(x0) <= W * 0.49 && Math.abs(z0) <= H * 0.49 && Math.abs(x1) <= W * 0.49 && Math.abs(z1) <= H * 0.49) {
        gratPositions.push(x0, 0.015, z0, x1, 0.015, z1);
      }
    }
  }
  const gratGeo = new THREE.BufferGeometry();
  gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(gratPositions, 3));
  const gratMat = new THREE.LineBasicMaterial({
    color: 0x9ec5e8,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
  });
  const graticuleLines = new THREE.LineSegments(gratGeo, gratMat);
  group.add(graticuleLines);

  // 3. Celestial Compass Ring & Horizon Floor Plane
  const ringGroup = new THREE.Group();
  ringGroup.position.y = -baseDepth - 0.5;
  for (const [radius, op] of [[59, 0.22], [63.5, 0.12], [70, 0.06]]) {
    const rGeo = new THREE.RingGeometry(radius, radius + 0.14, 160);
    rGeo.rotateX(-Math.PI * 0.5);
    const rMat = new THREE.MeshBasicMaterial({
      color: 0xd9b36c,
      transparent: true,
      opacity: op,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    ringGroup.add(new THREE.Mesh(rGeo, rMat));
  }
  // 72 compass degree ticks on the celestial ring
  const tickPos = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r0 = 59.3;
    const r1 = i % 6 === 0 ? 61.4 : 60.2;
    tickPos.push(Math.cos(a) * r0, 0.01, Math.sin(a) * r0, Math.cos(a) * r1, 0.01, Math.sin(a) * r1);
  }
  const tickGeo = new THREE.BufferGeometry();
  tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPos, 3));
  ringGroup.add(
    new THREE.LineSegments(
      tickGeo,
      new THREE.LineBasicMaterial({ color: 0xd9b36c, transparent: true, opacity: 0.26, depthWrite: false })
    )
  );
  group.add(ringGroup);

  // Subtle expansive abyssal floor catching ambient glow
  const floorGeo = new THREE.CircleGeometry(190, 96);
  floorGeo.rotateX(-Math.PI * 0.5);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x04070c,
    roughness: 0.85,
    metalness: 0.2,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = -baseDepth - 0.54;
  group.add(floorMesh);

  // 4. Celestial Starfield & Seasonal Floating Atmospheric Motes
  const starCount = 1800;
  const starPos = new Float32Array(starCount * 3);
  const starSeed = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.08 + Math.random() * 0.92);
    const rad = 145 + Math.random() * 85;
    starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * rad;
    starPos[i * 3 + 1] = Math.cos(phi) * rad - 8;
    starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * rad;
    starSeed[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.55 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vAlpha;
      varying float vSeed;
      void main() {
        vSeed = aSeed;
        float twinkle = 0.6 + 0.4 * sin(uTime * (1.2 + aSeed * 2.5) + aSeed * 40.0);
        vAlpha = twinkle;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (1.2 + aSeed * 2.2) * (180.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vAlpha;
      varying float vSeed;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float glow = pow(1.0 - d * 2.0, 2.0);
        vec3 col = mix(vec3(0.72, 0.85, 1.0), vec3(1.0, 0.88, 0.68), vSeed);
        gl_FragColor = vec4(col, glow * vAlpha * uOpacity);
      }
    `,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  // Ambient floating seasonal motes right above the China relief diorama
  const moteCount = 900;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 86;
    motePos[i * 3 + 1] = 0.8 + Math.random() * 11.5;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 68;
    moteSeed[i] = Math.random();
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(moteSeed, 1));
  const moteMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMoteColor: { value: new THREE.Color(0x9ee8c8) },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.25 + aSeed * 25.0) * 1.4;
        p.y += sin(uTime * 0.38 + aSeed * 17.0) * 0.55;
        p.z += cos(uTime * 0.22 + aSeed * 31.0) * 1.4;
        vAlpha = (0.22 + 0.35 * sin(uTime * 1.3 + aSeed * 50.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.6 + aSeed * 2.4) * (65.0 / max(10.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uMoteColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float g = pow(1.0 - d * 2.0, 2.2);
        gl_FragColor = vec4(uMoteColor, g * vAlpha);
      }
    `,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);

  scene.add(group);

  const seasonalMoteColors = [
    new THREE.Color(0xaef2c6), // Spring celadon-blossom
    new THREE.Color(0x7be8d4), // Summer emerald-firefly
    new THREE.Color(0xf5b553), // Autumn golden maple dust
    new THREE.Color(0xc8e4ff), // Winter diamond frost
  ];

  return {
    group,
    update(time, season, nightMix) {
      ringGroup.rotation.y = time * 0.012;
      starMat.uniforms.uTime.value = time;
      starMat.uniforms.uOpacity.value = 0.35 + nightMix * 0.55;
      moteMat.uniforms.uTime.value = time;

      const sWrap = ((season % 4) + 4) % 4;
      const i0 = Math.floor(sWrap) % 4;
      const i1 = (i0 + 1) % 4;
      const f = sWrap - Math.floor(sWrap);
      moteMat.uniforms.uMoteColor.value.copy(seasonalMoteColors[i0]).lerp(seasonalMoteColors[i1], f);
    },
  };
}
