// 공정 슈터 - 게임 로직
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const GROUND_Y = H - 30; // 지면 높이

// 플레이어: 타워크레인 발사대
const player = { x: W / 2, w: 56, h: 40, speed: 360 };
const BULLET_SPEED = 600;
const FIRE_INTERVAL = 0.25; // 연사 간격(초)
let bullets = [];
let fireCooldown = 0;

// 스테이지 데이터: 공정 순서와 학습 팁
const STAGES = [
  {
    title: '건물 전체 공정',
    steps: [
      { name: '측량', tip: '대지 경계와 건물 위치를 먼저 정확히 잡는다.' },
      { name: '터파기', tip: '기초가 들어갈 깊이까지 땅을 판다.' },
      { name: '기초', tip: '건물 하중을 지반에 전달하는 부분. 모든 구조의 시작점.' },
      { name: '골조', tip: '기둥·보·슬래브 등 건물의 뼈대를 세운다.' },
      { name: '지붕', tip: '골조가 완성된 후 비·눈을 막는 지붕을 덮는다.' },
      { name: '마감', tip: '외벽·내장·설비 마감으로 건물을 완성한다.' },
    ],
  },
];

// 떨어지는 공정 블록
const BLOCK_H = 34;
const BLOCK_SPEED = 70; // 낙하 속도(px/초)
const SPAWN_INTERVAL = 1.2; // 생성 간격(초)
const BLOCK_FONT = 'bold 16px "Malgun Gothic", sans-serif';
let blocks = [];
let spawnTimer = 0;
let stageIndex = 0;

// 진행 상태
const FONT_FAMILY = '"Malgun Gothic", sans-serif';
const START_HELMETS = 3;
const MESSAGE_TIME = 2; // 팁·오류 메시지 표시 시간(초)
let score = 0;
let helmets = START_HELMETS;
let stepIndex = 0; // 다음에 해야 할 공정 번호
let gameOver = false;
let message = null; // { text, color, time }

function resetGame() {
  score = 0;
  helmets = START_HELMETS;
  stageIndex = 0;
  stepIndex = 0;
  gameOver = false;
  message = null;
  blocks = [];
  bullets = [];
  spawnTimer = 0;
}

function showMessage(text, color) {
  message = { text, color, time: MESSAGE_TIME };
}

function spawnBlock() {
  // 이미 끝낸 공정은 더 이상 떨어지지 않는다
  const remaining = STAGES[stageIndex].steps.slice(stepIndex);
  if (remaining.length === 0) return;
  const step = remaining[Math.floor(Math.random() * remaining.length)];
  ctx.font = BLOCK_FONT;
  const w = ctx.measureText(step.name).width + 24;
  const x = Math.random() * (W - w);
  blocks.push({ x, y: -BLOCK_H, w, h: BLOCK_H, step });
}

// 키 입력 상태
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.code === 'Enter' && gameOver) resetGame();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// 블록을 맞혔을 때 공정 순서 판정
function onHit(block) {
  const steps = STAGES[stageIndex].steps;
  const next = steps[stepIndex];
  if (block.step === next) {
    score += 100;
    stepIndex++;
    showMessage(`✔ ${next.name}: ${next.tip}`, '#7ee787');
    // 끝낸 공정의 블록은 화면에서 치운다
    blocks = blocks.filter((k) => k.step !== next);
  } else {
    helmets--;
    const order = steps.indexOf(block.step) + 1;
    showMessage(`✖ 아직 '${next.name}' 공정이 끝나지 않았습니다! '${block.step.name}'은(는) ${order}번째 공정입니다.`, '#ff7b72');
    if (helmets <= 0) gameOver = true;
  }
}

function update(dt) {
  if (gameOver) return;

  if (message) {
    message.time -= dt;
    if (message.time <= 0) message = null;
  }

  // 좌우 이동
  let dir = 0;
  if (keys.ArrowLeft || keys.KeyA) dir -= 1;
  if (keys.ArrowRight || keys.KeyD) dir += 1;
  player.x += dir * player.speed * dt;
  player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));

  // 발사
  fireCooldown -= dt;
  if (keys.Space && fireCooldown <= 0) {
    bullets.push({ x: player.x, y: GROUND_Y - player.h - 30 });
    fireCooldown = FIRE_INTERVAL;
  }

  // 탄 이동, 화면 밖 탄 제거
  for (const b of bullets) b.y -= BULLET_SPEED * dt;
  bullets = bullets.filter((b) => b.y > -10);

  // 블록 생성과 낙하, 바닥에 닿은 블록 제거
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnBlock();
    spawnTimer = SPAWN_INTERVAL;
  }
  for (const k of blocks) k.y += BLOCK_SPEED * dt;
  blocks = blocks.filter((k) => k.y + k.h < GROUND_Y);

  // 탄과 블록 충돌: 맞은 탄과 블록을 함께 제거
  for (const b of bullets) {
    const hit = blocks.find((k) => !k.hit && b.x >= k.x && b.x <= k.x + k.w && b.y >= k.y && b.y <= k.y + k.h);
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
  const steps = STAGES[stageIndex].steps;
  ctx.fillStyle = 'rgba(17, 21, 28, 0.85)';
  ctx.fillRect(0, 0, W, 66);
  ctx.textBaseline = 'top';
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`점수 ${score}`, 12, 12);
  ctx.textAlign = 'center';
  ctx.fillText(`헬멧 ${'⛑'.repeat(helmets)}`, W / 2, 12);
  ctx.textAlign = 'right';
  ctx.fillText(`STAGE ${stageIndex + 1}`, W - 12, 12);
  if (stepIndex < steps.length) {
    ctx.font = `16px ${FONT_FAMILY}`;
    ctx.fillStyle = '#f2b705';
    ctx.textAlign = 'center';
    ctx.fillText(`다음 공정: ${steps[stepIndex].name} (${stepIndex + 1}/${steps.length})`, W / 2, 40);
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

function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff7b72';
  ctx.font = `bold 40px ${FONT_FAMILY}`;
  ctx.fillText('게임 오버', W / 2, H / 2 - 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = `20px ${FONT_FAMILY}`;
  ctx.fillText(`점수 ${score}`, W / 2, H / 2 - 10);
  ctx.font = `16px ${FONT_FAMILY}`;
  ctx.fillText('Enter 키를 누르면 다시 시작', W / 2, H / 2 + 25);
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // 탭 전환 등으로 큰 시간 간격 방지
  lastTime = now;
  update(dt);
  drawBackground();
  drawBlocks();
  drawBullets();
  drawPlayer();
  drawHud();
  if (gameOver) drawGameOver();
  drawMessage();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
