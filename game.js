// 공정 슈터 - 게임 로직
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const GROUND_Y = H - 30; // 지면 높이
const HUD_H = 66; // 상단 정보 영역 높이 (블록은 이 아래에서 나타난다)

// 플레이어: 타워크레인 발사대
const player = { x: W / 2, w: 56, h: 40, speed: 360 };
const MUZZLE_Y = GROUND_Y - player.h - 30; // 탄이 나오는 높이(마스트 끝)
const BULLET_SPEED = 600;
const FIRE_INTERVAL = 0.25; // 연사 간격(초)
let bullets = [];
let fireCooldown = 0;

// 스테이지 데이터: 공정 순서와 학습 팁
// speed: 블록 낙하 속도(px/초), hint: 다음 공정 이름 표시 여부
const STAGES = [
  {
    title: '건물 전체 공정',
    speed: 70,
    hint: true,
    steps: [
      { name: '측량', tip: '대지 경계와 건물 위치를 먼저 정확히 잡는다.' },
      { name: '터파기', tip: '기초가 들어갈 깊이까지 땅을 판다.' },
      { name: '기초', tip: '건물 하중을 지반에 전달하는 부분. 모든 구조의 시작점.' },
      { name: '골조', tip: '기둥·보·슬래브 등 건물의 뼈대를 세운다.' },
      { name: '지붕', tip: '골조가 완성된 후 비·눈을 막는 지붕을 덮는다.' },
      { name: '마감', tip: '외벽·내장·설비 마감으로 건물을 완성한다.' },
    ],
  },
  {
    title: 'RC 기둥 시공',
    speed: 95,
    hint: false,
    steps: [
      { name: '먹매김', tip: '바닥에 기둥 위치를 먹줄로 표시한다.' },
      { name: '철근 배근', tip: '설계도대로 주근과 띠철근을 조립한다.' },
      { name: '거푸집 설치', tip: '콘크리트 모양을 잡아 줄 틀을 세운다.' },
      { name: '콘크리트 타설', tip: '거푸집 안에 콘크리트를 부어 넣는다.' },
      { name: '양생', tip: '콘크리트가 충분한 강도를 낼 때까지 습도·온도를 관리한다.' },
      { name: '거푸집 해체', tip: '정해진 강도 확보 후 거푸집을 떼어 낸다.' },
    ],
  },
  {
    title: '경량 목구조 주택',
    speed: 120,
    hint: false,
    steps: [
      { name: '기초', tip: '목조도 콘크리트 기초 위에 짓는다.' },
      { name: '토대', tip: '기초 위에 방부목 토대(씰 플레이트)를 고정한다.' },
      { name: '바닥 장선', tip: '토대 위에 장선을 걸고 바닥 합판을 깐다.' },
      { name: '벽체 프레임', tip: '스터드로 벽 틀을 짜서 세운다.' },
      { name: '지붕 트러스', tip: '벽 위에 지붕 트러스(서까래)를 올린다.' },
      { name: '외장 마감', tip: '외벽 시트·사이딩·지붕재로 마감한다.' },
    ],
  },
];

// 떨어지는 공정 블록
const BLOCK_H = 34;
const SPAWN_INTERVAL = 1.2; // 생성 간격(초)
const BLOCK_FONT = 'bold 16px "Malgun Gothic", sans-serif';
let blocks = [];
let spawnTimer = 0;
let stageIndex = 0;

// 진행 상태
const FONT_FAMILY = '"Malgun Gothic", sans-serif';
const START_HELMETS = 3;
const MESSAGE_TIME = 2; // 오류·안내 메시지 표시 시간(초)
const TIP_TIME = 3.5; // 정답 학습 팁은 끝까지 읽을 수 있게 더 오래 표시(초)
const STAGE_CLEAR_TIME = 3; // 스테이지 클리어 후 다음 스테이지까지 대기(초)
let score = 0;
let helmets = START_HELMETS;
let stepIndex = 0; // 다음에 해야 할 공정 번호
let gameOver = false;
let allClear = false; // 모든 스테이지 완료
let stageClearTimer = 0;
let message = null; // { text, color, time }
let mistakes = []; // 틀린 공정 기록 (게임 오버 화면 복습용)
let running = false; // 시작·결과 화면이 떠 있으면 false

function resetGame() {
  mistakes = [];
  score = 0;
  helmets = START_HELMETS;
  stageIndex = 0;
  stepIndex = 0;
  gameOver = false;
  allClear = false;
  stageClearTimer = 0;
  message = null;
  blocks = [];
  bullets = [];
  spawnTimer = 0;
  renderBuilding();
}

// 시작·결과 화면
const overlayEl = document.getElementById('overlay');
const cardEl = document.getElementById('card');
const RESULT_DELAY = 1000; // 마지막 장면을 잠깐 보여준 뒤 결과 화면(ms)

function startGame() {
  overlayEl.hidden = true;
  resetGame();
  running = true;
}

// 마지막 글자의 받침 유무에 맞춰 '은/는'을 고른다
function topicJosa(word) {
  return (word.charCodeAt(word.length - 1) - 0xac00) % 28 > 0 ? '은' : '는';
}

// 결과 화면 복습 노트: 공정 순서와 학습 팁
function stepsNote(stage) {
  return `<ol class="note">${stage.steps.map((s) => `<li><b>${s.name}</b><span>${s.tip}</span></li>`).join('')}</ol>`;
}

function showResult() {
  running = false;
  if (allClear) {
    cardEl.innerHTML = `
      <h1 class="win">모든 공정 완료!</h1>
      <p class="score">점수 ${score} · 실수 ${mistakes.length}회</p>
      ${STAGES.map((s, i) => `<h3>STAGE ${i + 1} · ${s.title}</h3>${stepsNote(s)}`).join('')}
      <button type="button">다시 하기 (Enter)</button>`;
  } else {
    const stage = STAGES[stageIndex];
    const review = mistakes
      .map((m) => `<li>'${m.shot}'${topicJosa(m.shot)} ${m.order}번째 공정 — 그때 필요한 공정은 '${m.needed}'</li>`)
      .join('');
    cardEl.innerHTML = `
      <h1 class="lose">게임 오버</h1>
      <p class="score">점수 ${score}</p>
      <h3>틀린 공정 복습</h3>
      <ul>${review}</ul>
      <h3>${stage.title} 올바른 순서</h3>
      ${stepsNote(stage)}
      <button type="button">다시 하기 (Enter)</button>`;
  }
  overlayEl.hidden = false;
}

overlayEl.addEventListener('click', (e) => {
  if (e.target.closest('button')) startGame();
});

function nextStage() {
  stageIndex++;
  stepIndex = 0;
  blocks = [];
  spawnTimer = 0;
  renderBuilding();
  const stage = STAGES[stageIndex];
  showMessage(`STAGE ${stageIndex + 1}: ${stage.title} 시작!${stage.hint ? '' : ' 이제 다음 공정 힌트가 없습니다.'}`, '#f2b705');
}

// 오른쪽 패널: 끝낸 공정을 아래부터 한 층씩 쌓아 보여준다
const FLOOR_COLORS = ['#7a5c3e', '#8d6e4a', '#6b7a8f', '#4f7cac', '#3d8b6e', '#b5651d'];
const stageTitleEl = document.getElementById('stage-title');
const buildingEl = document.getElementById('building');

function renderBuilding() {
  const stage = STAGES[stageIndex];
  stageTitleEl.textContent = `STAGE ${stageIndex + 1} · ${stage.title}`;
  buildingEl.innerHTML = '';
  stage.steps.slice(0, stepIndex).forEach((s, i) => {
    const floor = document.createElement('div');
    floor.className = 'floor';
    floor.style.background = FLOOR_COLORS[i];
    floor.textContent = `${i + 1}. ${s.name}`;
    buildingEl.appendChild(floor);
  });
}

function showMessage(text, color, time = MESSAGE_TIME) {
  message = { text, color, time };
}

function spawnBlock() {
  // 이미 끝낸 공정은 더 이상 떨어지지 않는다
  const remaining = STAGES[stageIndex].steps.slice(stepIndex);
  if (remaining.length === 0) return;
  // 화면에 정답 블록이 없으면 절반 확률로 정답 블록을 내보낸다
  // (항상 정답을 내면 '새 블록 = 정답' 요령이 생기므로 확률로 둔다)
  const next = remaining[0];
  const noAnswerOnScreen = !blocks.some((k) => k.step === next);
  const step = noAnswerOnScreen && Math.random() < 0.5 ? next : remaining[Math.floor(Math.random() * remaining.length)];
  ctx.font = BLOCK_FONT;
  const w = ctx.measureText(step.name).width + 24;
  const x = Math.random() * (W - w);
  blocks.push({ x, y: HUD_H - BLOCK_H, w, h: BLOCK_H, step });
}

// 키 입력 상태
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.code === 'Enter' && !running) startGame();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
// 키를 누른 채 다른 창으로 전환하면 keyup이 오지 않으므로 입력을 모두 해제
window.addEventListener('blur', () => {
  for (const code in keys) keys[code] = false;
  pointerDown = false;
});

// 터치·마우스: 누른 채 끌면 크레인이 따라오고 자동 발사
let pointerDown = false;
function movePlayerTo(clientX) {
  const rect = canvas.getBoundingClientRect();
  player.x = (clientX - rect.left) * (W / rect.width);
}
canvas.addEventListener('pointerdown', (e) => {
  pointerDown = true;
  canvas.setPointerCapture(e.pointerId);
  movePlayerTo(e.clientX);
});
canvas.addEventListener('pointermove', (e) => {
  if (pointerDown) movePlayerTo(e.clientX);
});
canvas.addEventListener('pointerup', () => {
  pointerDown = false;
});
canvas.addEventListener('pointercancel', () => {
  pointerDown = false;
});

// 블록을 맞혔을 때 공정 순서 판정
function onHit(block) {
  const steps = STAGES[stageIndex].steps;
  const next = steps[stepIndex];
  if (block.step === next) {
    score += 100;
    stepIndex++;
    showMessage(`✔ ${next.name}: ${next.tip}`, '#7ee787', TIP_TIME);
    // 끝낸 공정의 블록은 화면에서 치운다
    blocks = blocks.filter((k) => k.step !== next);
    renderBuilding();
    // 마지막 공정까지 끝내면 스테이지 클리어
    if (stepIndex === steps.length) {
      blocks = [];
      if (stageIndex === STAGES.length - 1) {
        allClear = true;
        setTimeout(showResult, RESULT_DELAY);
      } else {
        stageClearTimer = STAGE_CLEAR_TIME;
      }
    }
  } else {
    helmets--;
    const order = steps.indexOf(block.step) + 1;
    mistakes.push({ shot: block.step.name, order, needed: next.name });
    // 힌트를 숨긴 스테이지에서는 정답 공정 이름을 알려주지 않고 순서 번호만 알려준다
    const shot = block.step.name;
    const nextText = STAGES[stageIndex].hint ? `${stepIndex + 1}번째 공정인 '${next.name}'` : `${stepIndex + 1}번째 공정`;
    showMessage(`✖ 순서가 틀렸습니다! '${shot}'${topicJosa(shot)} ${order}번째 공정이고, 지금은 ${nextText} 차례입니다.`, '#ff7b72');
    if (helmets <= 0) {
      gameOver = true;
      setTimeout(showResult, RESULT_DELAY);
    }
  }
}

function update(dt) {
  if (!running || gameOver || allClear) return;

  if (message) {
    message.time -= dt;
    if (message.time <= 0) message = null;
  }

  if (stageClearTimer > 0) {
    stageClearTimer -= dt;
    if (stageClearTimer <= 0) nextStage();
  }

  // 좌우 이동
  let dir = 0;
  if (keys.ArrowLeft || keys.KeyA) dir -= 1;
  if (keys.ArrowRight || keys.KeyD) dir += 1;
  player.x += dir * player.speed * dt;
  player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));

  // 발사
  fireCooldown -= dt;
  if ((keys.Space || pointerDown) && fireCooldown <= 0) {
    bullets.push({ x: player.x, y: MUZZLE_Y });
    fireCooldown = FIRE_INTERVAL;
  }

  // 탄 이동, 상단 정보 영역에 닿은 탄 제거 (가려진 블록을 맞히지 않도록)
  for (const b of bullets) {
    b.prevY = b.y;
    b.y -= BULLET_SPEED * dt;
  }
  bullets = bullets.filter((b) => b.y > HUD_H);

  // 블록 생성과 낙하, 크레인 높이까지 내려온 블록 제거 (그보다 낮으면 맞힐 수 없으므로)
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnBlock();
    spawnTimer = SPAWN_INTERVAL;
  }
  for (const k of blocks) k.y += STAGES[stageIndex].speed * dt;
  blocks = blocks.filter((k) => k.y < MUZZLE_Y);

  // 탄과 블록 충돌: 맞은 탄과 블록을 함께 제거
  // 이번 프레임에 탄이 지나간 구간 전체로 검사해, 블록을 뚫고 지나가거나 블록 안에서 생긴 탄이 빠져나가지 않게 한다
  for (const b of bullets) {
    const hit = blocks.find((k) => !k.hit && b.x >= k.x && b.x <= k.x + k.w && b.y - 8 <= k.y + k.h && b.prevY + 4 >= k.y);
    if (hit) {
      b.hit = true;
      hit.hit = true;
      onHit(hit);
    }
  }
  bullets = bullets.filter((b) => !b.hit);
  blocks = blocks.filter((k) => !k.hit);
}

function drawBackground() {
  ctx.fillStyle = '#1b2433';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
}

function drawPlayer() {
  const x = player.x;
  const top = GROUND_Y - player.h;
  // 하부 궤도
  ctx.fillStyle = '#3d4450';
  ctx.fillRect(x - player.w / 2, GROUND_Y - 10, player.w, 10);
  // 운전실
  ctx.fillStyle = '#f2b705';
  ctx.fillRect(x - 20, top, 40, player.h - 10);
  // 마스트(발사 기둥)
  ctx.fillRect(x - 4, top - 30, 8, 30);
  // 지브(가로 팔)
  ctx.fillRect(x - 24, top - 30, 48, 5);
}

function drawBlocks() {
  ctx.font = BLOCK_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const k of blocks) {
    ctx.fillStyle = '#55606e';
    ctx.fillRect(k.x, k.y, k.w, k.h);
    ctx.strokeStyle = '#d0d6de';
    ctx.lineWidth = 2;
    ctx.strokeRect(k.x, k.y, k.w, k.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(k.step.name, k.x + k.w / 2, k.y + k.h / 2 + 1);
  }
}

function drawBullets() {
  ctx.fillStyle = '#c9d1d9';
  for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
}

// 상단 정보: 점수, 헬멧, 스테이지, 다음 공정
function drawHud() {
  const stage = STAGES[stageIndex];
  const steps = stage.steps;
  ctx.fillStyle = 'rgba(17, 21, 28, 0.85)';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.textBaseline = 'top';
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`점수 ${score}`, 12, 12);
  ctx.textAlign = 'center';
  ctx.fillText(`헬멧 ${'⛑'.repeat(helmets)}`, W / 2, 12);
  ctx.textAlign = 'right';
  ctx.fillText(`STAGE ${stageIndex + 1}`, W - 12, 12);
  ctx.font = `16px ${FONT_FAMILY}`;
  ctx.fillStyle = '#f2b705';
  ctx.textAlign = 'center';
  if (stepIndex < steps.length) {
    const nextName = stage.hint ? steps[stepIndex].name : '???';
    ctx.fillText(`다음 공정: ${nextName} (${stepIndex + 1}/${steps.length})`, W / 2, 40);
  } else if (stageClearTimer > 0) {
    ctx.fillText(`STAGE ${stageIndex + 1} 클리어! 곧 다음 스테이지`, W / 2, 40);
  }
}

// 글자 폭에 맞춰 단어 단위로 줄바꿈
function wrapText(text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);
  return lines;
}

function drawMessage() {
  if (!message) return;
  ctx.font = `15px ${FONT_FAMILY}`;
  const lines = wrapText(message.text, W - 64);
  const lineH = 22;
  const boxH = lines.length * lineH + 16;
  const top = GROUND_Y - 110 - boxH;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(20, top, W - 40, boxH);
  ctx.fillStyle = message.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + 8 + i * lineH));
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // 탭 전환 등으로 큰 시간 간격 방지
  lastTime = now;
  update(dt);
  drawBackground();
  drawMessage(); // 메시지가 블록을 가리지 않도록 블록보다 먼저 그린다
  drawBlocks();
  drawBullets();
  drawPlayer();
  drawHud();
  requestAnimationFrame(loop);
}
resetGame();
requestAnimationFrame(loop);
