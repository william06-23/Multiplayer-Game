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
  INITIAL_P1_X,
  INITIAL_P2_X,
} from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const player = params.get("player");
let gameId = params.get("id");
const roomIdValue = document.getElementById("roomIdValue");

// true if this client created the game (player 1), false if they joined (player 2)
const createdGame = player === "1";

let waitingForPlayer = createdGame;

function updateRoomIdDisplay() {
  if (roomIdValue) {
    roomIdValue.textContent = gameId ?? "—";
  }
}

updateRoomIdDisplay();

const bottomPaddle = {
  x: createdGame ? INITIAL_P1_X : INITIAL_P2_X,
  y: canvas.height - 20,
  dx: 0,
};

const topPaddle = {
  x: createdGame ? INITIAL_P2_X : INITIAL_P1_X,
  y: 10,
};

let ball = {
  x: INITIAL_BALL_X,
  y: INITIAL_BALL_Y,
  radius: 8,
  dx: 0,
  dy: 0,
};

let p1Score = 0;
let p2Score = 0;

function applyRemoteState(data) {
  if (createdGame) {
    if (data.p2_x != null) {
      topPaddle.x = data.p2_x;
    }
    waitingForPlayer = data.p2_x == null;

    if (waitingForPlayer) {
      ball.x = INITIAL_BALL_X;
      ball.y = INITIAL_BALL_Y;
      ball.dx = 0;
      ball.dy = 0;
    } else if (data.ball_dx != null && ball.dx === 0 && ball.dy === 0) {
      ball.dx = data.ball_dx;
      ball.dy = data.ball_dy;
    }
  } else {
    if (data.p1_x != null) {
      topPaddle.x = data.p1_x;
    }
    if (data.ball_x != null) ball.x = data.ball_x;
    if (data.ball_y != null) ball.y = data.ball_y;
    if (data.ball_dx != null) ball.dx = data.ball_dx;
    if (data.ball_dy != null) ball.dy = data.ball_dy;
  }

  if (data.p1_score != null) p1Score = data.p1_score;
  if (data.p2_score != null) p2Score = data.p2_score;
}

function applyInitialState(data) {
  if (createdGame) {
    if (data.p1_x != null) bottomPaddle.x = data.p1_x;
    if (data.p2_x != null) topPaddle.x = data.p2_x;
    waitingForPlayer = data.p2_x == null;
  } else {
    if (data.p2_x != null) bottomPaddle.x = data.p2_x;
    if (data.p1_x != null) topPaddle.x = data.p1_x;
    waitingForPlayer = false;
  }

  if (data.ball_x != null) ball.x = data.ball_x;
  if (data.ball_y != null) ball.y = data.ball_y;
  if (data.ball_dx != null) ball.dx = data.ball_dx;
  if (data.ball_dy != null) ball.dy = data.ball_dy;
  if (data.p1_score != null) p1Score = data.p1_score;
  if (data.p2_score != null) p2Score = data.p2_score;

  if (waitingForPlayer) {
    ball.x = INITIAL_BALL_X;
    ball.y = INITIAL_BALL_Y;
    ball.dx = 0;
    ball.dy = 0;
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "a") bottomPaddle.dx = -6;
  if (e.key === "d") bottomPaddle.dx = 6;
});

document.addEventListener("keyup", (e) => {
  if (e.key === "a" || e.key === "d") bottomPaddle.dx = 0;
});

async function syncToDatabase() {
  if (!gameId) return;

  if (createdGame) {
    const update = {
      p1_x: bottomPaddle.x,
      updated_at: new Date().toISOString(),
    };

    if (!waitingForPlayer) {
      update.ball_x = ball.x;
      update.ball_y = ball.y;
      update.ball_dx = ball.dx;
      update.ball_dy = ball.dy;
      update.p1_score = p1Score;
      update.p2_score = p2Score;
    }

    await supabase.from("MyNewGame").update(update).eq("id", gameId);
    return;
  }

  if (!waitingForPlayer) {
    await supabase
      .from("MyNewGame")
      .update({
        p2_x: bottomPaddle.x,
        updated_at: new Date().toISOString(),
      })
      .eq("id", gameId);
  }
}

async function fetchRemoteState() {
  if (!gameId) return;

  const data = await fetchGameState(gameId);
  applyRemoteState(data);
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
        applyRemoteState(payload.new);
      }
    )
    .subscribe();
}

async function initGame() {
  if (createdGame && !gameId) {
    gameId = await createNewGame();
    const url = new URL(window.location.href);
    url.searchParams.set("id", gameId);
    history.replaceState(null, "", url);
    updateRoomIdDisplay();
  }

  if (gameId) {
    const data = await fetchGameState(gameId);
    applyInitialState(data);
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

function updatePlayerOneBall() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  if (ball.x < ball.radius || ball.x > canvas.width - ball.radius) {
    ball.dx *= -1;
    ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x));
  }

  if (
    ball.y + ball.radius > bottomPaddle.y &&
    ball.x > bottomPaddle.x &&
    ball.x < bottomPaddle.x + paddleWidth
  ) {
    ball.dy *= -1;
    ball.y = bottomPaddle.y - ball.radius;
  }

  if (
    ball.y - ball.radius < topPaddle.y + paddleHeight &&
    ball.x > topPaddle.x &&
    ball.x < topPaddle.x + paddleWidth
  ) {
    ball.dy *= -1;
    ball.y = topPaddle.y + paddleHeight + ball.radius;
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

function updatePlayerTwoBall() {
  ball.x -= ball.dx;
  ball.y -= ball.dy;
}

function resetBall() {
  ball.x = INITIAL_BALL_X;
  ball.y = INITIAL_BALL_Y;
  ball.dy *= -1;
}

function update() {
  bottomPaddle.x += bottomPaddle.dx;

  if (bottomPaddle.x < 0) bottomPaddle.x = 0;
  if (bottomPaddle.x + paddleWidth > canvas.width) {
    bottomPaddle.x = canvas.width - paddleWidth;
  }

  if (waitingForPlayer) {
    ball.x = INITIAL_BALL_X;
    ball.y = INITIAL_BALL_Y;
    ball.dx = 0;
    ball.dy = 0;
    return;
  }

  if (createdGame) {
    updatePlayerOneBall();
  } else {
    updatePlayerTwoBall();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawRect(topPaddle.x, topPaddle.y, paddleWidth, paddleHeight);
  drawRect(bottomPaddle.x, bottomPaddle.y, paddleWidth, paddleHeight);
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

setInterval(() => {
  syncToDatabase();
  fetchRemoteState();
}, 50);
