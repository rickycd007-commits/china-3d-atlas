// Classroom Interactive Suite:
// 1. Smartboard Laser / Chalk Annotation Canvas (3D 讲台电子粉笔 + 自动箭头绘制)
// 2. Blind-Map Rapid Quiz Engine (无字盲图随堂抢答测验：省区/省会/简称、山脉、江河三题库)

export function createChalkboardTool(canvasEl) {
  let active = false;
  let color = '#ff5a4e';
  let drawing = false;
  const strokes = []; // { color, pts: [[x,y], ...], arrow: bool }
  let currentStroke = null;
  let arrowMode = true;

  function resize() {
    if (!canvasEl) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvasEl.width = window.innerWidth * dpr;
    canvasEl.height = window.innerHeight * dpr;
    canvasEl.style.width = `${window.innerWidth}px`;
    canvasEl.style.height = `${window.innerHeight}px`;
    redraw();
  }

  function redraw() {
    if (!canvasEl) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ctx = canvasEl.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const all = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const s of all) {
      if (s.pts.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      s.pts.forEach(([x, y], idx) => {
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw crisp directional arrowhead at end of stroke if arrowMode
      if (s.arrow && s.pts.length >= 4) {
        const end = s.pts[s.pts.length - 1];
        const prev = s.pts[Math.max(0, s.pts.length - 6)];
        const dist = Math.hypot(end[0] - prev[0], end[1] - prev[1]);
        if (dist > 10) {
          const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
          const headLen = 14;
          ctx.beginPath();
          ctx.moveTo(end[0], end[1]);
          ctx.lineTo(end[0] - headLen * Math.cos(ang - 0.45), end[1] - headLen * Math.sin(ang - 0.45));
          ctx.lineTo(end[0] - headLen * Math.cos(ang + 0.45), end[1] - headLen * Math.sin(ang + 0.45));
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  if (canvasEl) {
    canvasEl.addEventListener('pointerdown', (e) => {
      if (!active || e.button !== 0) return;
      drawing = true;
      currentStroke = { color, arrow: arrowMode, pts: [[e.clientX, e.clientY]] };
    });
    canvasEl.addEventListener('pointermove', (e) => {
      if (!active || !drawing || !currentStroke) return;
      const last = currentStroke.pts[currentStroke.pts.length - 1];
      if (Math.hypot(e.clientX - last[0], e.clientY - last[1]) >= 3) {
        currentStroke.pts.push([e.clientX, e.clientY]);
        redraw();
      }
    });
    const finish = () => {
      if (drawing && currentStroke && currentStroke.pts.length >= 2) {
        strokes.push(currentStroke);
      }
      drawing = false;
      currentStroke = null;
      redraw();
    };
    canvasEl.addEventListener('pointerup', finish);
    canvasEl.addEventListener('pointercancel', finish);
    window.addEventListener('resize', resize);
    resize();
  }

  return {
    setActive(flag) {
      active = flag;
      if (canvasEl) canvasEl.classList.toggle('is-active', active);
    },
    toggle() {
      this.setActive(!active);
      return active;
    },
    setColor(c) {
      color = c;
    },
    setArrowMode(flag) {
      arrowMode = flag;
    },
    clear() {
      strokes.length = 0;
      currentStroke = null;
      redraw();
    },
    undo() {
      strokes.pop();
      redraw();
    },
    isActive: () => active,
  };
}

export function createClassroomQuiz(atlasData, callbacks) {
  let active = false;
  let category = 'all'; // 'province' | 'mountain' | 'river' | 'all'
  let score = 0;
  let total = 0;
  let currentQ = null;
  let answered = false;

  const modalEl = document.getElementById('quiz-panel');
  const promptEl = document.getElementById('quiz-prompt');
  const optionsEl = document.getElementById('quiz-options');
  const feedbackEl = document.getElementById('quiz-feedback');
  const scoreEl = document.getElementById('quiz-score');

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function nextQuestion() {
    answered = false;
    feedbackEl.textContent = '';
    feedbackEl.className = 'quiz-feedback';

    let kind = category;
    if (kind === 'all') kind = pickRandom(['province', 'province', 'mountain', 'river']);

    if (kind === 'province') {
      // Focus on distinct mainland & island provinces
      const pool = atlasData.provinces.filter((p) => p.adcode !== 810000 && p.adcode !== 820000);
      const target = pickRandom(pool);
      const distractors = shuffle(pool.filter((p) => p.id !== target.id)).slice(0, 3);
      const choices = shuffle([target, ...distractors]).map((p) => ({
        label: `${p.short}（${p.abbr} · ${p.capital}）`,
        correct: p.id === target.id,
      }));
      currentQ = {
        kind: 'province',
        target,
        question: '请观察 3D 沙盘上金色高亮的省级行政区轮廓与区位，它是：',
        choices,
        explanation: `✅ 正确答案：${target.name}（简称「${target.abbr}」，省会/首府：${target.capital}）。${target.landform}`,
      };
      callbacks.onFocusProvince(target);
    } else if (kind === 'mountain') {
      const target = pickRandom(atlasData.mountains);
      const distractors = shuffle(atlasData.mountains.filter((m) => m.id !== target.id)).slice(0, 3);
      const choices = shuffle([target, ...distractors]).map((m) => ({
        label: `${m.name}（${m.peak}）`,
        correct: m.id === target.id,
      }));
      currentQ = {
        kind: 'mountain',
        target,
        question: `请观察镜头聚焦的山脉位置与走向（主峰海拔 ${target.elev}m），该山脉是：`,
        choices,
        explanation: `✅ 正确答案：${target.name}（主峰 ${target.peak} ${target.elev}m）—— ${target.role}。`,
      };
      callbacks.onFocusMountain(target);
    } else {
      const target = pickRandom(atlasData.rivers);
      const distractors = shuffle(atlasData.rivers.filter((r) => r.id !== target.id)).slice(0, 3);
      const choices = shuffle([target, ...distractors]).map((r) => ({
        label: `${r.name}`,
        correct: r.id === target.id,
      }));
      currentQ = {
        kind: 'river',
        target,
        question: `请观察 3D 地表高亮闪烁的河流干流走向（全长 ${target.lengthKm} km），它是：`,
        choices,
        explanation: `✅ 正确答案：${target.name}（发源于${target.origin}，${target.outlet}）。${target.role}`,
      };
      callbacks.onFocusRiver(target);
    }

    promptEl.textContent = currentQ.question;
    optionsEl.innerHTML = '';
    currentQ.choices.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-opt-btn';
      btn.textContent = c.label;
      btn.addEventListener('click', () => submitAnswer(btn, c.correct));
      optionsEl.appendChild(btn);
    });
  }

  function submitAnswer(clickedBtn, isCorrect) {
    if (answered || !currentQ) return;
    answered = true;
    total++;
    if (isCorrect) score++;
    scoreEl.textContent = `得分 ${score} / ${total}`;

    optionsEl.querySelectorAll('.quiz-opt-btn').forEach((btn, idx) => {
      const opt = currentQ.choices[idx];
      if (opt.correct) btn.classList.add('is-correct');
      else if (btn === clickedBtn) btn.classList.add('is-wrong');
    });

    feedbackEl.textContent = currentQ.explanation;
    feedbackEl.classList.add(isCorrect ? 'ok' : 'reveal');
  }

  function revealAnswer() {
    if (!currentQ || answered) return;
    answered = true;
    optionsEl.querySelectorAll('.quiz-opt-btn').forEach((btn, idx) => {
      if (currentQ.choices[idx].correct) btn.classList.add('is-correct');
    });
    feedbackEl.textContent = currentQ.explanation;
    feedbackEl.classList.add('ok');
  }

  return {
    start() {
      active = true;
      document.body.classList.add('quiz-blind-mode');
      modalEl?.classList.add('is-open');
      nextQuestion();
    },
    stop() {
      active = false;
      document.body.classList.remove('quiz-blind-mode');
      modalEl?.classList.remove('is-open');
      callbacks.onExitQuiz();
    },
    toggle() {
      if (active) this.stop();
      else this.start();
      return active;
    },
    setCategory(cat) {
      category = cat;
      if (active) nextQuestion();
    },
    nextQuestion,
    revealAnswer,
    isActive: () => active,
  };
}
