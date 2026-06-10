const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const paddleWidth = 80;
const paddleHeight = 10;

import {
  supabase,
  createNewGame,
  fetchGameState,
  INITIAL_BALL_X,
  INITIAL_BALL_Y,
} from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const player = params.get("player");
let gameId = params.get("id");
const roomIdValue = document.getElementById("roomIdValue");

let waitingForPlayer = true;

function updateRoomIdDisplay() {
  if (roomIdValue) {
    roomIdValue.textContent = gameId ?? "—";
  }
}

updateRoomIdDisplay();

// Player 1 (BOTTOM - local)
let p1 = {
  x: canvas.width / 2 - paddleWidth / 2,
  y: canvas.height - 20,
  dx: 0,
};

// Player 2 (TOP - server-controlled)
let p2 = {
  x: canvas.width / 2 - paddleWidth / 2,
  y: 10,
};

// Ball
let ball = {
  x: INITIAL_BALL_X,
  y: INITIAL_BALL_Y,
  radius: 8,
  dx: 0,
  dy: 0,
};

// Scores
let p1Score = 0;
let p2Score = 0;

function applyGameState(data) {
  if (data.p1_x != null) p1.x = data.p1_x;
  if (data.p2_x != null) p2.x = data.p2_x;
  if (data.ball_x != null) ball.x = data.ball_x;
  if (data.ball_y != null) ball.y = data.ball_y;
  if (data.ball_dx != null) ball.dx = data.ball_dx;
  if (data.ball_dy != null) ball.dy = data.ball_dy;
  if (data.p1_score != null) p1Score = data.p1_score;
  if (data.p2_score != null) p2Score = data.p2_score;

  waitingForPlayer = data.p2_x == null;

  if (waitingForPlayer) {
    ball.x = INITIAL_BALL_X;
    ball.y = INITIAL_BALL_Y;
    ball.dx = 0;
    ball.dy = 0;
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "a") p1.dx = -6;
  if (e.key === "d") p1.dx = 6;
});

document.addEventListener("keyup", (e) => {
  if (e.key === "a" || e.key === "d") p1.dx = 0;
});

function updateFromServer() {
  p2.x += Math.sin(Date.now() / 300) * 2;

  if (p2.x < 0) p2.x = 0;
  if (p2.x + paddleWidth > canvas.width) {
    p2.x = canvas.width - paddleWidth;
  }
}

async function sendPlayerData() {
  if (!gameId) return;

  await supabase
    .from("MyNewGame")
    .update({
      p1_x: p1.x,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameId);
}

function subscribeToGame() {
  if (!gameId) return;

  supabase
    .channel(`game-channel-${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "MyNewGame",
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        applyGameState(payload.new);
      }
    )
    .subscribe();
}

async function initGame() {
  if (player === "1" && !gameId) {
    gameId = await createNewGame();
    const url = new URL(window.location.href);
    url.searchParams.set("id", gameId);
    history.replaceState(null, "", url);
    updateRoomIdDisplay();
  }

  if (gameId) {
    const data = await fetchGameState(gameId);
    applyGameState(data);
    subscribeToGame();
  }
}

initGame();

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

function drawWaitingText() {
  const text = "Waiting for the other player";
  ctx.font = "18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.textAlign = "left";
}

function update() {
  p1.x += p1.dx;

  if (p1.x < 0) p1.x = 0;
  if (p1.x + paddleWidth > canvas.width) {
    p1.x = canvas.width - paddleWidth;
  }

  if (waitingForPlayer) {
    ball.x = INITIAL_BALL_X;
    ball.y = INITIAL_BALL_Y;
    ball.dx = 0;
    ball.dy = 0;
    return;
  }

  updateFromServer();

  ball.x += ball.dx;
  ball.y += ball.dy;

  if (ball.x < 0 || ball.x > canvas.width) {
    ball.dx *= -1;
  }

  if (
    ball.y + ball.radius > p1.y &&
    ball.x > p1.x &&
    ball.x < p1.x + paddleWidth
  ) {
    ball.dy *= -1;
    ball.y = p1.y - ball.radius;
  }

  if (
    ball.y - ball.radius < p2.y + paddleHeight &&
    ball.x > p2.x &&
    ball.x < p2.x + paddleWidth
  ) {
    ball.dy *= -1;
    ball.y = p2.y + paddleHeight + ball.radius;
  }

  if (ball.y < 0) {
    p1Score++;
    resetBall();
  }

  if (ball.y > canvas.height) {
    p2Score++;
    resetBall();
  }
}

function resetBall() {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.dy *= -1;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawRect(p1.x, p1.y, paddleWidth, paddleHeight);
  drawRect(p2.x, p2.y, paddleWidth, paddleHeight);
  drawBall();

  if (waitingForPlayer) {
    drawWaitingText();
  }

  drawText(p1Score, 50, canvas.height / 2);
  drawText(p2Score, canvas.width - 80, canvas.height / 2);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
setInterval(sendPlayerData, 50);
