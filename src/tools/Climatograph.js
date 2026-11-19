// Standard Textbook Climatograph Renderer (12个月气温曲线 + 降水量柱状统计图 & “以温定带·以水定型”判读)

const MONTH_WEIGHTS_MONSOON_N = [0.01, 0.015, 0.025, 0.045, 0.07, 0.13, 0.30, 0.24, 0.095, 0.04, 0.02, 0.01];
const MONTH_WEIGHTS_JIANGNAN  = [0.045, 0.06, 0.095, 0.125, 0.15, 0.185, 0.095, 0.085, 0.065, 0.04, 0.03, 0.025]; // June Meiyu + July Fuhan dip!
const MONTH_WEIGHTS_SOUTH     = [0.025, 0.035, 0.055, 0.10, 0.155, 0.165, 0.145, 0.145, 0.095, 0.045, 0.02, 0.015];
const MONTH_WEIGHTS_ARID      = [0.04, 0.045, 0.065, 0.095, 0.125, 0.15, 0.16, 0.13, 0.085, 0.05, 0.03, 0.025];
const MONTH_WEIGHTS_SW        = [0.015, 0.02, 0.03, 0.055, 0.10, 0.18, 0.22, 0.19, 0.115, 0.045, 0.02, 0.01];

export function computeMonthlySeries(prov) {
  const { janT, julT, precip, climate, capLonLat } = prov;
  const lat = capLonLat[1];
  const temps = [];
  // Realistic seasonal temperature phase (min in Jan m=0, max in Jul m=6, slight thermal lag in coastal areas)
  for (let m = 0; m < 12; m++) {
    const rad = ((m - 0.15) / 12) * Math.PI * 2;
    const norm = 0.5 - 0.5 * Math.cos(rad);
    temps.push(+(janT + (julT - janT) * Math.pow(norm, 0.94)).toFixed(1));
  }

  let weights = MONTH_WEIGHTS_MONSOON_N;
  if (climate.includes('干旱') || (climate.includes('大陆') && precip < 350)) {
    weights = MONTH_WEIGHTS_ARID;
  } else if (lat >= 27.5 && lat <= 33.5 && capLonLat[0] > 111) {
    weights = MONTH_WEIGHTS_JIANGNAN; // Classic Meiyu + July Fuhan dip!
  } else if (lat < 25.5 && capLonLat[0] > 106) {
    weights = MONTH_WEIGHTS_SOUTH;
  } else if (capLonLat[0] < 107 && lat < 32) {
    weights = MONTH_WEIGHTS_SW;
  }

  const rains = weights.map((w) => Math.round(precip * w));

  // Generate textbook "以温定带 · 以水定型" diagnostic rule!
  let tempRule = '';
  if (prov.avgElev >= 3000) tempRule = `海拔高（均高${prov.avgElev}m），7月仅${julT}℃ → 高原山地气候`;
  else if (janT > 15) tempRule = `最冷月(${janT}℃) > 15℃ → 热带`;
  else if (janT > 0) tempRule = `最冷月(${janT}℃) 在 0℃~15℃ 之间 → 亚热带`;
  else tempRule = `最冷月(${janT}℃) < 0℃ → 温带`;

  let rainRule = '';
  if (prov.avgElev >= 3000) rainRule = `年降水 ${precip}mm，水热垂直分异显著`;
  else if (precip >= 800) rainRule = `年降水 ${precip}mm (>800mm 湿润区)，夏半年多雨（雨热同期）`;
  else if (precip >= 400) rainRule = `年降水 ${precip}mm (400~800mm 半湿润区)，夏季暴雨集中`;
  else rainRule = `年降水仅 ${precip}mm (<400mm 干旱/半干旱)，全年少雨大陆性强`;

  return { temps, rains, diagnostic: `📐 判读法则：${tempRule}；${rainRule}。` };
}

export function renderClimatographCanvas(canvas, prov, highlightMonth = null) {
  if (!canvas || !prov) return;
  const { temps, rains, diagnostic } = computeMonthlySeries(prov);

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = 266;
  const h = 128;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const padL = 28, padR = 30, padT = 14, padB = 20;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const tMin = -25, tMax = 35;
  const pMax = Math.max(300, Math.ceil(Math.max(...rains) / 100) * 100 + 50);

  const yTemp = (t) => padT + (1 - (t - tMin) / (tMax - tMin)) * plotH;
  const yRain = (p) => padT + (1 - Math.min(1, p / pMax)) * plotH;

  // Grid & 0°C Freezing Isotherm Reference Line!
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.7;
  for (const tVal of [-20, 0, 15, 30]) {
    const y = yTemp(tVal);
    ctx.beginPath();
    if (tVal === 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120, 215, 255, 0.55)';
      ctx.setLineDash([3, 3]);
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }

  // Highlight active month column if timeline is active
  const colW = plotW / 12;
  if (highlightMonth >= 1 && highlightMonth <= 12) {
    const mIdx = Math.floor(highlightMonth) - 1;
    ctx.fillStyle = 'rgba(244, 206, 130, 0.12)';
    ctx.fillRect(padL + mIdx * colW, padT, colW, plotH);
  }

  // 12 Monthly Precipitation Bars
  for (let m = 0; m < 12; m++) {
    const bx = padL + m * colW + colW * 0.2;
    const bw = colW * 0.6;
    const by = yRain(rains[m]);
    const bh = padT + plotH - by;
    const grad = ctx.createLinearGradient(0, by, 0, padT + plotH);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(1, 'rgba(30, 108, 185, 0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw, Math.max(1, bh));
  }

  // 12 Monthly Temperature Curve
  ctx.strokeStyle = '#ff6b57';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  for (let m = 0; m < 12; m++) {
    const cx = padL + (m + 0.5) * colW;
    const cy = yTemp(temps[m]);
    if (m === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Data Dots on Temp Curve
  ctx.fillStyle = '#ffd166';
  for (let m = 0; m < 12; m++) {
    const cx = padL + (m + 0.5) * colW;
    const cy = yTemp(temps[m]);
    ctx.beginPath();
    ctx.arc(cx, cy, 2.0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Axes Labels
  ctx.font = '9.5px "Inter", "PingFang SC", sans-serif';
  ctx.fillStyle = '#ff9a8b';
  ctx.textAlign = 'right';
  ctx.fillText('30℃', padL - 3, yTemp(30) + 3);
  ctx.fillStyle = '#8ad8ff';
  ctx.fillText('0℃', padL - 3, yTemp(0) + 3);
  ctx.fillStyle = 'rgba(200,215,235,0.6)';
  ctx.fillText('-20℃', padL - 3, yTemp(-20) + 3);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#67d4ff';
  ctx.fillText(`${pMax}`, w - padR + 3, padT + 6);
  ctx.fillText(`${Math.round(pMax / 2)}`, w - padR + 3, padT + plotH * 0.5 + 3);
  ctx.fillText('mm', w - padR + 3, padT + plotH);

  // Month X-axis ticks (1, 4, 7, 10, 12)
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220,230,242,0.72)';
  for (const m of [0, 3, 6, 9, 11]) {
    ctx.fillText(`${m + 1}月`, padL + (m + 0.5) * colW, h - 5);
  }

  return diagnostic;
}
