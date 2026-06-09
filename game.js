const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const paddleWidth = 80;
const paddleHeight = 10;

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(
  'https://bkigcatgfnqrkvszjnub.supabase.co',
  'sb_publishable_pNXP5rtZyUvuLewbKA0MBA_l9rPGO_i'
);

const GAME_ID = 'id'; 

// Player 1 (BOTTOM - local)
let p1 = {
  x: canvas.width / 2 - paddleWidth / 2,
  y: canvas.height - 20,
  dx: 0
};

// Player 2 (TOP - server-controlled)
let p2 = {
  x: canvas.width / 2 - paddleWidth / 2,
  y: 10
};

// Ball
let ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 8,
  dx: 4,
  dy: 4
};

// Scores
let p1Score = 0;
let p2Score = 0;

// 🎮 Controls (LEFT/RIGHT now)
document.addEventListener("keydown", e => {
  if (e.key === "a") p1.dx = -6;
  if (e.key === "d") p1.dx = 6;
});

document.addEventListener("keyup", e => {
  if (e.key === "a" || e.key === "d") p1.dx = 0;
});

// 🧠 Simulated server update (replace later)
function updateFromServer() {
  // Fake movement for testing
  p2.x += Math.sin(Date.now() / 300) * 2;

  // Clamp inside canvas
  if (p2.x < 0) p2.x = 0;
  if (p2.x + paddleWidth > canvas.width)
    p2.x = canvas.width - paddleWidth;
}

async function sendPlayerData() {
  await supabase
    .from('MyNewGame')
    .update({
      p1_x: p1.x,
      updated_at: new Date()
    })
    .eq('id', GAME_ID);
}
supabase
  .channel('game-channel')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'MyNewGame',
      filter: `id=eq.${GAME_ID}`
    },
    payload => {
      const data = payload.new;

      // update Player 2
      p2.x = data.p2_x;

      // (optional) sync ball
      ball.x = data.ball_x;
      ball.y = data.ball_y;
    }
)
.subscribe();

// Draw functions
function drawRect(x, y, w, h) {
  ctx.fillStyle = "white";
  ctx.fillRect(x, y, w, h);
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawText(text, x, y) {
  ctx.font = "30px Arial";
  ctx.fillText(text, x, y);
}

// Update game
function update() {
  // Move Player 1 (horizontal)
  p1.x += p1.dx;

  if (p1.x < 0) p1.x = 0;
  if (p1.x + paddleWidth > canvas.width)
    p1.x = canvas.width - paddleWidth;

  // Update Player 2 from server
  updateFromServer();

  // Move ball
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Left/right wall bounce
  if (ball.x < 0 || ball.x > canvas.width) {
    ball.dx *= -1;
  }

  // Paddle collisions (BOTTOM)
  if (
    ball.y + ball.radius > p1.y &&
    ball.x > p1.x &&
    ball.x < p1.x + paddleWidth
  ) {
    ball.dy *= -1;
    ball.y = p1.y - ball.radius;
  }

  // Paddle collisions (TOP)
  if (
    ball.y - ball.radius < p2.y + paddleHeight &&
    ball.x > p2.x &&
    ball.x < p2.x + paddleWidth
  ) {
    ball.dy *= -1;
    ball.y = p2.y + paddleHeight + ball.radius;
  }

  // Scoring
  if (ball.y < 0) {
    p1Score++;
    resetBall();
  }

  if (ball.y > canvas.height) {
    p2Score++;
    resetBall();
  }
}

// Reset ball
function resetBall() {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.dy *= -1;
}

// Draw everything
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawRect(p1.x, p1.y, paddleWidth, paddleHeight);
  drawRect(p2.x, p2.y, paddleWidth, paddleHeight);
  drawBall();

  drawText(p1Score, 50, canvas.height / 2);
  drawText(p2Score, canvas.width - 80, canvas.height / 2);
}

// Loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
  setInterval(sendPlayerData, 50); // 20 times/sec
}

gameLoop();