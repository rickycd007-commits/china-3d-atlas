import * as THREE from 'three';
import { unprojectXZ } from '../utils/projection.js';

/**
 * Dynamic East Asian Monsoon Wind Streamlines + Seasonal Volumetric Rain/Snow/Cloud Engine
 * Models:
 *  - Summer/Spring: SE Pacific Monsoon + SW Bay of Bengal Monsoon (deflected by Himalayas & Tibetan Plateau!)
 *  - Winter/Autumn: Siberian-Mongolian High Cold Surge NW Monsoon (splitting around Tibet & attenuated by Qinling!)
 *  - Volumetric 3D Rain Streaks / Crystalline Snowflakes & Drifting Monsoon Cloud Puffs
 */
export function createClimateParticles(scene, sampleWorldYAtXZ) {
  const group = new THREE.Group();

  // ================= 1. MONSOON STREAMLINE COMET RIBBONS =================
  const NUM_STREAMS = 950;
  const TRAIL_LEN = 14;
  const totalVerts = (NUM_STREAMS * (TRAIL_LEN - 1) * 2);
  const streamPos = new Float32Array(totalVerts * 3);
  const streamCol = new Float32Array(totalVerts * 4); // r,g,b,alpha

  const streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPos, 3));
  streamGeo.setAttribute('color', new THREE.BufferAttribute(streamCol, 4));

  const streamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 color;
      varying vec4 vColor;
      void main() {
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec4 vColor;
      void main() {
        gl_FragColor = vColor;
      }
    `,
  });
  const streamLines = new THREE.LineSegments(streamGeo, streamMat);
  streamLines.frustumCulled = false;
  group.add(streamLines);

  // Glowing Comet Heads at the front of each wind streamline for unmistakable flow direction & brilliance!
  const headPos = new Float32Array(NUM_STREAMS * 3);
  const headCol = new Float32Array(NUM_STREAMS * 4);
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', new THREE.BufferAttribute(headPos, 3));
  headGeo.setAttribute('color', new THREE.BufferAttribute(headCol, 4));
  const headMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 color;
      varying vec4 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 6.5 * (75.0 / max(14.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec4 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float g = pow(1.0 - d * 2.0, 1.8);
        gl_FragColor = vec4(vColor.rgb * 1.4, g * vColor.a);
      }
    `,
  });
  const streamHeads = new THREE.Points(headGeo, headMat);
  streamHeads.frustumCulled = false;
  group.add(streamHeads);

  // Streamline particle state
  const streams = [];
  function resetStream(s, season, randomAge = false) {
    const sWrap = ((season % 4) + 4) % 4;
    const isSummerHalf = sWrap >= 0.35 && sWrap <= 2.15;

    let x, z, type;
    if (isSummerHalf) {
      const r = Math.random();
      if (r < 0.62) {
        // SE Pacific Monsoon entering from South China Sea & Western Pacific
        x = 6 + Math.random() * 34;
        z = 12 + Math.random() * 22;
        type = 'SE_WARM';
      } else if (r < 0.90) {
        // SW Indian Ocean Monsoon surging from Bay of Bengal toward Yunnan & SE Tibet
        x = -26 + Math.random() * 24;
        z = 18 + Math.random() * 16;
        type = 'SW_MOIST';
      } else {
        // Westerlies brushing Northern Xinjiang
        x = -42 + Math.random() * 10;
        z = -26 + Math.random() * 14;
        type = 'WESTERLY';
      }
    } else {
      // Winter/Late Autumn: Siberian-Mongolian Cold High surging SE!
      const r = Math.random();
      if (r < 0.78) {
        x = -26 + Math.random() * 44;
        z = -34 + Math.random() * 14;
        type = 'NW_COLD';
      } else {
        x = 4 + Math.random() * 28;
        z = -18 + Math.random() * 22;
        type = 'NE_WINTER';
      }
    }

    s.type = type;
    s.age = randomAge ? Math.random() * s.maxAge : 0;
    s.maxAge = 2.6 + Math.random() * 2.4;
    const y0 = Math.max(0.25, sampleWorldYAtXZ(x, z) + 0.55 + Math.random() * 0.65);
    for (let k = 0; k < TRAIL_LEN; k++) {
      s.hx[k] = x;
      s.hy[k] = y0;
      s.hz[k] = z;
    }
  }

  for (let i = 0; i < NUM_STREAMS; i++) {
    const s = {
      type: 'SE_WARM',
      age: 0,
      maxAge: 3.5,
      hx: new Float32Array(TRAIL_LEN),
      hy: new Float32Array(TRAIL_LEN),
      hz: new Float32Array(TRAIL_LEN),
    };
    resetStream(s, 1.0, true);
    streams.push(s);
  }

  // Physically inspired monsoon wind vector field (vx, vz in world units/sec)
  function sampleWindVector(x, z, type, time) {
    const [lon, lat] = unprojectXZ(x, z);
    let vx = 0, vz = 0;

    if (type === 'SE_WARM') {
      // Curves from SE -> NW in South China, then recurves S -> NNE across East & Northeast China!
      const recurve = Math.max(0, Math.min(1, (lat - 24.0) / 18.0));
      vx = -6.2 * (1.0 - recurve * 1.45);
      vz = -9.5;
      // Blocked from penetrating deep onto Tibetan Plateau (>103E edge)
      if (lon < 106 && lat > 27 && lat < 38) {
        vx += (106 - lon) * 1.4;
      }
    } else if (type === 'SW_MOIST') {
      // Surges NE up Yunnan & Yarlung Tsangpo, deflected eastward by the Himalayan wall!
      vx = 7.2;
      vz = -7.8;
      if (lat > 27.5 && lon < 97.0) {
        // Himalayan barrier deflection!
        vz += (lat - 27.5) * 3.4;
        vx += 3.5;
      }
    } else if (type === 'WESTERLY') {
      vx = 9.5;
      vz = 1.2 + Math.sin(x * 0.15 + time) * 1.2;
    } else {
      // NW_COLD / NE_WINTER: Siberian-Mongolian Cold Surge!
      vx = 7.4;
      vz = 9.6;
      // Splits around the colossal Qinghai-Tibet Plateau (-28 < x < -2, -6 < z < 14)
      const dxTibet = x - (-15.0);
      const dzTibet = z - 3.5;
      const d2 = (dxTibet / 15.0) ** 2 + (dzTibet / 9.5) ** 2;
      if (d2 < 1.35) {
        const push = (1.35 - d2) * 8.5;
        vx += Math.sign(dxTibet || 1) * push * 1.1;
        vz -= 2.2;
      }
      // Over South China Sea turns into NE Trade/Winter Monsoon
      if (lat < 24.0 && lon > 108.0) {
        vx = -5.5;
        vz = 7.8;
      }
    }

    // Gentle synoptic wave meander
    vx += Math.sin(z * 0.14 + time * 0.8) * 1.3;
    vz += Math.cos(x * 0.14 + time * 0.7) * 1.1;
    return [vx, vz];
  }

  // ================= 2. VOLUMETRIC RAIN / SNOW & CLOUD PUFFS =================
  const PRECIP_COUNT = 5200;
  const pPos = new Float32Array(PRECIP_COUNT * 3);
  const pSeed = new Float32Array(PRECIP_COUNT * 3); // x:phase, y:speed, z:isSnowFlag

  for (let i = 0; i < PRECIP_COUNT; i++) {
    // Concentrate precipitation over China territory & monsoon belt
    const x = -34 + Math.random() * 68;
    const z = -30 + Math.random() * 60;
    pPos[i * 3] = x;
    pPos[i * 3 + 1] = 1.0 + Math.random() * 9.5;
    pPos[i * 3 + 2] = z;
    pSeed[i * 3] = Math.random();
    pSeed[i * 3 + 1] = 0.65 + Math.random() * 0.75;
    pSeed[i * 3 + 2] = 0.0;
  }

  const precipGeo = new THREE.BufferGeometry();
  precipGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  precipGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 3));

  const precipMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSeason: { value: 1.0 },
      uIntensity: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform float uSeason;
      uniform float uIntensity;
      varying float vSnow;
      varying float vAlpha;

      vec2 worldXZToLonLat(vec2 xz) {
        float rx = xz.x / 92.0;
        float ry = 1.390730 + xz.y / 92.0;
        float r = length(vec2(rx, ry));
        float theta = atan(rx, ry);
        float sinLat = clamp((1.309083 - (r * 0.576986) * (r * 0.576986)) / 1.153972, -1.0, 1.0);
        return vec2(104.0 + (theta / 0.576986) * 57.2958, asin(sinLat) * 57.2958);
      }

      void main() {
        vec3 p = position;
        vec2 ll = worldXZToLonLat(p.xz);
        float lon = ll.x;
        float lat = ll.y;

        float sWrap = fract(uSeason * 0.25) * 4.0;
        float isWinter = smoothstep(2.2, 2.8, sWrap) * (1.0 - smoothstep(3.6, 4.0, sWrap));
        float isSpring = 1.0 - smoothstep(0.0, 0.9, min(sWrap, 4.0 - sWrap));
        float isSummer = 1.0 - smoothstep(0.0, 0.9, abs(sWrap - 1.0));

        // Determine snow vs rain from latitude + Tibetan highland + season
        float tibetHigh = step(28.0, lat) * (1.0 - step(103.5, lon)) * (1.0 - step(39.5, lat));
        float snowMask = clamp(isWinter * smoothstep(31.0, 36.0, lat) + tibetHigh * (1.0 - isSummer * 0.7), 0.0, 1.0);
        vSnow = snowMask;

        // Seasonal rainbelt migration!
        // Spring: South China (lat 20..30, lon > 106)
        // Summer: Yangtze/North/SW Monsoon (lon > 97)
        // Winter: Northern snow + Tibetan snow + light Jiangnan drizzle
        float activeRegion = 0.0;
        if (isWinter > 0.4) {
          activeRegion = smoothstep(28.0, 38.0, lat) * 0.85 + tibetHigh * 0.6;
        } else if (isSpring > 0.4) {
          activeRegion = smoothstep(98.0, 110.0, lon) * (1.0 - smoothstep(31.0, 40.0, lat));
        } else {
          activeRegion = smoothstep(95.0, 108.0, lon) * 0.95;
        }

        float fallSpeed = mix(8.5, 2.2, snowMask) * aSeed.y;
        float hSpan = 9.0;
        p.y = mod(p.y - uTime * fallSpeed + aSeed.x * 20.0, hSpan) + 0.6;
        p.x += sin(uTime * 1.4 + aSeed.x * 30.0) * mix(0.15, 0.65, snowMask);

        float edgeFade = sin(clamp((p.y - 0.6) / hSpan, 0.0, 1.0) * 3.14159);
        vAlpha = activeRegion * edgeFade * uIntensity;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = mix(2.8, 4.4, snowMask) * (75.0 / max(12.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vSnow;
      varying float vAlpha;
      void main() {
        if (vAlpha < 0.02) discard;
        vec2 uv = gl_PointCoord - 0.5;
        if (vSnow > 0.5) {
          float d = length(uv);
          if (d > 0.5) discard;
          float g = pow(1.0 - d * 2.0, 1.8);
          gl_FragColor = vec4(0.92, 0.96, 1.0, g * vAlpha * 0.85);
        } else {
          // Crisp vertical rain streak
          float streak = smoothstep(0.16, 0.0, abs(uv.x)) * smoothstep(0.5, 0.0, abs(uv.y));
          if (streak < 0.02) discard;
          gl_FragColor = vec4(0.45, 0.82, 1.0, streak * vAlpha * 0.72);
        }
      }
    `,
  });
  const precipPoints = new THREE.Points(precipGeo, precipMat);
  precipPoints.frustumCulled = false;
  group.add(precipPoints);

  // Soft 3D Atmospheric Cloud Puffs over Monsoon Regions in Precipitation Mode
  const CLOUD_COUNT = 260;
  const cPos = new Float32Array(CLOUD_COUNT * 3);
  const cSeed = new Float32Array(CLOUD_COUNT);
  for (let i = 0; i < CLOUD_COUNT; i++) {
    cPos[i * 3] = -20 + Math.random() * 52;
    cPos[i * 3 + 1] = 4.6 + Math.random() * 2.2;
    cPos[i * 3 + 2] = -24 + Math.random() * 52;
    cSeed[i] = Math.random();
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cloudGeo.setAttribute('aSeed', new THREE.BufferAttribute(cSeed, 1));
  const cloudMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vSeed;
      void main() {
        vSeed = aSeed;
        vec3 p = position;
        p.x += sin(uTime * 0.18 + aSeed * 20.0) * 2.8;
        p.z += cos(uTime * 0.14 + aSeed * 15.0) * 2.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (22.0 + aSeed * 26.0) * (80.0 / max(15.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vSeed;
      void main() {
        if (uOpacity < 0.005) discard;
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float soft = pow(1.0 - d * 2.0, 2.4);
        gl_FragColor = vec4(0.86, 0.93, 1.0, soft * uOpacity * (0.14 + vSeed * 0.12));
      }
    `,
  });
  const clouds = new THREE.Points(cloudGeo, cloudMat);
  clouds.frustumCulled = false;
  group.add(clouds);

  scene.add(group);

  let lastSeasonBucket = -1;

  return {
    group,
    update(dt, time, season, climateMode, exaggeration) {
      // climateMode: 0=Natural, 1=ClimateZones, 2=Monsoon, 3=Temp, 4=Precipitation
      const showMonsoon = climateMode === 2;
      streamLines.visible = showMonsoon;
      streamHeads.visible = showMonsoon;

      // Subtle ambient weather in Natural mode (0.24), full intensity in Precipitation mode (1.0)!
      const targetPrecip = climateMode === 4 ? 0.95 : climateMode === 0 ? 0.22 : 0.0;
      precipMat.uniforms.uIntensity.value += (targetPrecip - precipMat.uniforms.uIntensity.value) * 0.08;
      precipMat.uniforms.uTime.value = time;
      precipMat.uniforms.uSeason.value = season;
      precipPoints.visible = precipMat.uniforms.uIntensity.value > 0.015;

      const targetCloud = climateMode === 4 ? 1.0 : 0.0;
      cloudMat.uniforms.uOpacity.value += (targetCloud - cloudMat.uniforms.uOpacity.value) * 0.08;
      cloudMat.uniforms.uTime.value = time;
      clouds.visible = cloudMat.uniforms.uOpacity.value > 0.01;

      if (!showMonsoon) return;

      const sWrap = ((season % 4) + 4) % 4;
      const bucket = sWrap >= 0.35 && sWrap <= 2.15 ? 1 : 0;
      if (bucket !== lastSeasonBucket) {
        lastSeasonBucket = bucket;
        for (let i = 0; i < NUM_STREAMS; i++) resetStream(streams[i], season, true);
      }

      const clampedDt = Math.min(0.05, dt);
      let vPtr = 0;
      let cPtr = 0;

      for (let i = 0; i < NUM_STREAMS; i++) {
        const s = streams[i];
        s.age += clampedDt;
        const headX = s.hx[0], headZ = s.hz[0];

        if (s.age >= s.maxAge || Math.abs(headX) > 44.0 || Math.abs(headZ) > 35.0) {
          resetStream(s, season, false);
        } else {
          // Shift trail history
          for (let k = TRAIL_LEN - 1; k >= 1; k--) {
            s.hx[k] = s.hx[k - 1];
            s.hy[k] = s.hy[k - 1];
            s.hz[k] = s.hz[k - 1];
          }
          const [vx, vz] = sampleWindVector(headX, headZ, s.type, time);
          const nx = headX + vx * clampedDt;
          const nz = headZ + vz * clampedDt;
          const terrY = sampleWorldYAtXZ(nx, nz) * exaggeration;
          const targetY = Math.max(0.35, terrY + 0.55);
          s.hx[0] = nx;
          s.hy[0] = s.hy[1] + (targetY - s.hy[1]) * 0.32;
          s.hz[0] = nz;
        }

        const lifeFade = Math.sin(Math.min(1, s.age / s.maxAge) * Math.PI);
        let r = 0.22, g = 1.0, b = 0.78;
        if (s.type === 'SW_MOIST') {
          r = 0.18; g = 0.90; b = 1.0;
        } else if (s.type === 'WESTERLY') {
          r = 1.0; g = 0.84; b = 0.36;
        } else if (s.type === 'NW_COLD' || s.type === 'NE_WINTER') {
          r = 0.42; g = 0.84; b = 1.0;
        }

        headPos[i * 3] = s.hx[0];
        headPos[i * 3 + 1] = s.hy[0];
        headPos[i * 3 + 2] = s.hz[0];
        headCol[i * 4] = r;
        headCol[i * 4 + 1] = g;
        headCol[i * 4 + 2] = b;
        headCol[i * 4 + 3] = lifeFade * 0.95;

        for (let k = 0; k < TRAIL_LEN - 1; k++) {
          const a0 = (1.0 - k / (TRAIL_LEN - 1)) ** 1.25 * lifeFade * 0.95;
          const a1 = (1.0 - (k + 1) / (TRAIL_LEN - 1)) ** 1.25 * lifeFade * 0.95;

          streamPos[vPtr++] = s.hx[k];
          streamPos[vPtr++] = s.hy[k];
          streamPos[vPtr++] = s.hz[k];
          streamPos[vPtr++] = s.hx[k + 1];
          streamPos[vPtr++] = s.hy[k + 1];
          streamPos[vPtr++] = s.hz[k + 1];

          streamCol[cPtr++] = r * 1.25; streamCol[cPtr++] = g * 1.25; streamCol[cPtr++] = b * 1.25; streamCol[cPtr++] = a0;
          streamCol[cPtr++] = r * 1.25; streamCol[cPtr++] = g * 1.25; streamCol[cPtr++] = b * 1.25; streamCol[cPtr++] = a1;
        }
      }

      streamGeo.attributes.position.needsUpdate = true;
      streamGeo.attributes.color.needsUpdate = true;
      headGeo.attributes.position.needsUpdate = true;
      headGeo.attributes.color.needsUpdate = true;
    },
  };
}
