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

function spawnBlock() {
  const steps = STAGES[stageIndex].steps;
  const step = steps[Math.floor(Math.random() * steps.length)];
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
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

function update(dt) {
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
    const hit = blocks.find((k) => b.x >= k.x && b.x <= k.x + k.w && b.y >= k.y && b.y <= k.y + k.h);
    if (hit) {
      b.hit = true;
      hit.hit = true;
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

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // 탭 전환 등으로 큰 시간 간격 방지
  lastTime = now;
  update(dt);
  drawBackground();
  drawBlocks();
  drawBullets();
  drawPlayer();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
