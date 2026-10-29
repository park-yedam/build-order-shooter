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
  drawBullets();
  drawPlayer();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
