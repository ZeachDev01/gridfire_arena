/* Top-down shooter
   - WASD to move
   - Mouse to aim
   - Click or Space to shoot
   - Enemies spawn and move toward player
   - Circle-based collision detection
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const restartBtn2 = document.getElementById('restartBtn2');
const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');

let width = canvas.width;
let height = canvas.height;

// Game state
let running = false;
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 1000; // ms
let score = 0;

// Player
const player = {
  x: width / 5,
  y: height / 5,
  r: 18,
  speed: 220, // px/sec
  vx: 0,
  vy: 0,
  health: 100,
};

// Input
const keys = {};
let mouse = { x: 0, y: 0, down: false };

// Entities
const bullets = [];
const enemies = [];

// Utilities
function rand(min, max) { return Math.random() * (max - min) + min; }
function dist(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return Math.hypot(dx, dy); }

// Event listeners
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    shoot();
  }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
  mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});
canvas.addEventListener('mousedown', () => { mouse.down = true; shoot(); });
canvas.addEventListener('mouseup', () => { mouse.down = false; });

// Start / Restart handlers
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);
restartBtn2.addEventListener('click', restartGame);

// Game control functions
function startGame() {
  startScreen.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  running = true;
  reset();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function restartGame() {
  startScreen.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  running = true;
  reset();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function reset() {
  bullets.length = 0;
  enemies.length = 0;
  player.x = width/2;
  player.y = height/2;
  player.health = 100;
  score = 0;
  spawnTimer = 0;
  spawnInterval = 1000;
  updateUI();
}

// Shooting
function shoot() {
  if (!running) return;
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const speed = 1500;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  bullets.push({
    x: player.x + Math.cos(angle) * (player.r + 8),
    y: player.y + Math.sin(angle) * (player.r + 8),
    vx, vy, r: 5, life: 1500 // life in ms
  });
}

// Spawning enemies: spawn from random edge
function spawnEnemy() {
  // Choose an edge: 0=top,1=right,2=bottom,3=left
  const edge = Math.floor(rand(0, 4));
  let x, y;
  const margin = 20;
  if (edge === 0) { x = rand(-margin, width + margin); y = -margin; }
  else if (edge === 1) { x = width + margin; y = rand(-margin, height + margin); }
  else if (edge === 2) { x = rand(-margin, width + margin); y = height + margin; }
  else { x = -margin; y = rand(-margin, height + margin); }

  // Enemy speed scales slightly with score
  const speed = rand(40, 85) + Math.min(score * 0.4, 60);
  enemies.push({
    x, y,
    r: rand(14, 22),
    speed,
    hp: Math.ceil(rand(1, 3) + score * 0.02)
  });
}

// Update and draw loop
function loop(ts) {
  if (!running) return;
  const dt = Math.min(50, ts - lastTime); // ms, clamp
  lastTime = ts;
  update(dt / 1000);
  draw();
  if (running) requestAnimationFrame(loop);
}

// Update game objects
function update(delta) {
  // Movement input
  let mx = 0, my = 0;
  if (keys['w'] || keys['arrowup']) my -= 1;
  if (keys['s'] || keys['arrowdown']) my += 1;
  if (keys['a'] || keys['arrowleft']) mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  player.vx = (mx / len) * player.speed;
  player.vy = (my / len) * player.speed;
  player.x += player.vx * delta;
  player.y += player.vy * delta;

  // Keep player inside canvas
  player.x = Math.max(player.r, Math.min(width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(height - player.r, player.y));

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * delta;
    b.y += b.vy * delta;
    b.life -= delta * 1000;
    if (b.life <= 0 || b.x < -50 || b.y < -50 || b.x > width + 50 || b.y > height + 50) {
      bullets.splice(i, 1);
    }
  }

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // Move toward player
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(angle) * e.speed * delta;
    e.y += Math.sin(angle) * e.speed * delta;

    // Enemy collides with player
    if (dist(e, player) < e.r + player.r) {
      // Damage and knockback
      player.health -= 12;
      // simple knockback
      const dx = player.x - e.x, dy = player.y - e.y;
      const dlen = Math.hypot(dx, dy) || 1;
      player.x += (dx / dlen) * 10;
      player.y += (dy / dlen) * 10;

      enemies.splice(i, 1);
      if (player.health <= 0) {
        endGame();
        return;
      }
    }
  }

  // Bullets hit enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (dist(e, b) < e.r + b.r) {
        // Hit
        e.hp -= 1;
        bullets.splice(j, 1);
        if (e.hp <= 0) {
          // Kill enemy
          score += 10;
          enemies.splice(i, 1);
          break;
        }
      }
    }
  }

  // Spawn logic (speed up spawn over time)
  spawnTimer += delta * 500;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 1;
    spawnEnemy();
    // Gradually increase spawn rate up to a limit
    spawnInterval = Math.max(350, spawnInterval - 15);
  }

  // Update UI
  updateUI();
}

// Draw everything
function draw() {
  // clear
  ctx.clearRect(0, 0, width, height);

  // draw grid/background subtle
  drawBackground();

  // draw player (rotated to mouse)
  drawPlayer();

  // bullets
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff7';
    ctx.fill();
    ctx.strokeStyle = '#fff2';
    ctx.stroke();
  }

  // enemies
  for (const e of enemies) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    // color by hp remaining
    if (e.hp >= 3) ctx.fillStyle = '#ff6b6b';
    else if (e.hp === 2) ctx.fillStyle = '#ff9f43';
    else ctx.fillStyle = '#ffd166';
    ctx.fill();
    ctx.strokeStyle = '#0003';
    ctx.stroke();

    // little eyes
    ctx.beginPath();
    const ang = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.arc(e.x + Math.cos(ang) * (e.r * 0.5), e.y + Math.sin(ang) * (e.r * 0.5), Math.max(2, e.r * 0.18), 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
  }
}

function drawBackground() {
  // subtle grid
  const gap = 40;
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#fff';
  for (let x = 0; x < width; x += gap) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += gap) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  // body
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(player.r, 0);
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fillStyle = '#66f';
  ctx.fill();
  // barrel
  ctx.fillStyle = '#112';
  ctx.fillRect(player.r - 4, -5, 18, 10);
  ctx.restore();
}

function updateUI() {
  scoreEl.textContent = `Score: ${score}`;
  healthEl.textContent = `Health: ${Math.max(0, Math.floor(player.health))}`;
}

// End game
function endGame() {
  running = false;
  gameOverEl.classList.remove('hidden');
  finalScoreEl.textContent = `Score: ${score}`;
  // show restart button in hud
  document.getElementById('restartBtn').classList.remove('hidden');
}

// Resize handling (keeps canvas fixed, but you can add responsive scaling if you like)
window.addEventListener('resize', () => {
  // Optionally handle resizing; for now we keep fixed size.
});

// Helpful: pause when window loses focus
window.addEventListener('blur', () => { /* could pause */ });

// Start with start screen visible
startScreen.classList.remove('hidden');
