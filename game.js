const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const paddleWidth = 80;
const paddleHeight = 10;
const SYNC_INTERVAL_MS = 1000 / 24;
const CELEBRATION_MS = 1500;
const SCORE_PAUSE_MS = 2000;

import {
  supabase,
  createNewGame,
  fetchGameState,
  INITIAL_BALL_X,
  INITIAL_BALL_Y,
  INITIAL_BALL_DX,
  INITIAL_BALL_DY,
  INITIAL_P1_X,
  INITIAL_P2_X,
} from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const player = params.get("player");
let gameId = params.get("id");
const roomIdValue = document.getElementById("roomIdValue");
const p1ScoreEl = document.getElementById("p1ScoreValue");
const p2ScoreEl = document.getElementById("p2ScoreValue");

const createdGame = player === "1";

let waitingForPlayer = createdGame;
let isPaused = false;
let celebration = null;
let lastKnownP1Score = 0;
let lastKnownP2Score = 0;
let remoteP1Dx = 0;
let remoteP2Dx = 0;

function updateRoomIdDisplay() {
  if (roomIdValue) {
    roomIdValue.textContent = gameId ?? "—";
  }
}

function updateScoreDisplay() {
  if (p1ScoreEl) p1ScoreEl.textContent = p1Score;
  if (p2ScoreEl) p2ScoreEl.textContent = p2Score;
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

function startCelebration(youScored) {
  celebration = {
    text: youScored ? "GOAL!" : "They scored!",
    until: Date.now() + CELEBRATION_MS,
  };
}

function handleRemoteScoreChange(prevP1, prevP2) {
  if (createdGame || waitingForPlayer) return;

  const p1Scored = p1Score > prevP1;
  const p2Scored = p2Score > prevP2;

  if (!p1Scored && !p2Scored) return;

  isPaused = true;
  startCelebration(p2Scored);
  resetBallToCenter();
}

function handleRemoteResume() {
  if (createdGame || waitingForPlayer || !isPaused) return;

  if (ball.dx !== 0 || ball.dy !== 0) {
    ball.x = INITIAL_BALL_X;
    ball.y = INITIAL_BALL_Y;
    isPaused = false;
    celebration = null;
  }
}

function applyRemoteState(data) {
  if (createdGame) {
    if (data.p2_dx != null) {
      remoteP2Dx = data.p2_dx;
    }
    waitingForPlayer = data.p2_dx == null;

    if (waitingForPlayer) {
      ball.x = INITIAL_BALL_X;
      ball.y = INITIAL_BALL_Y;
      ball.dx = 0;
      ball.dy = 0;
    } else if (
      !isPaused &&
      data.ball_dx != null &&
      ball.dx === 0 &&
      ball.dy === 0
    ) {
      ball.dx = data.ball_dx;
      ball.dy = data.ball_dy;
    }

    return;
  }

  if (data.p1_dx != null) {
    remoteP1Dx = data.p1_dx;
  }

  if (data.ball_dx != null) ball.dx = data.ball_dx;
  if (data.ball_dy != null) ball.dy = data.ball_dy;

  const prevP1 = p1Score;
  const prevP2 = p2Score;

  if (data.p1_score != null) p1Score = data.p1_score;
  if (data.p2_score != null) p2Score = data.p2_score;

  updateScoreDisplay();
  handleRemoteScoreChange(prevP1, prevP2);
  handleRemoteResume();

  lastKnownP1Score = p1Score;
  lastKnownP2Score = p2Score;
}

function applyInitialState(data) {
  if (createdGame) {
    waitingForPlayer = data.p2_dx == null;
    if (data.p2_dx != null) {
      remoteP2Dx = data.p2_dx;
    }
  } else {
    if (data.p1_dx != null) {
      remoteP1Dx = data.p1_dx;
    }
    waitingForPlayer = false;
  }

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

  lastKnownP1Score = p1Score;
  lastKnownP2Score = p2Score;
  updateScoreDisplay();
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
      p1_dx: bottomPaddle.dx,
      updated_at: new Date().toISOString(),
    };

    if (!waitingForPlayer) {
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
        p2_dx: bottomPaddle.dx,
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

function drawWaitingText() {
  const text = "Waiting for the other player";
  ctx.font = "18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.textAlign = "left";
}

function drawCelebration() {
  if (!celebration || Date.now() > celebration.until) return;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);

  ctx.font = "bold 32px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "white";
  ctx.fillText(celebration.text, canvas.width / 2, canvas.height / 2 + 10);
  ctx.restore();
}

function resetBallToCenter() {
  ball.x = INITIAL_BALL_X;
  ball.y = INITIAL_BALL_Y;
  ball.dx = 0;
  ball.dy = 0;
}

function resetBallForPlay() {
  ball.x = INITIAL_BALL_X;
  ball.y = INITIAL_BALL_Y;
  ball.dx = INITIAL_BALL_DX;
  ball.dy = INITIAL_BALL_DY * (Math.random() > 0.5 ? 1 : -1);
}

async function handleScore(scorer) {
  if (!createdGame || isPaused || waitingForPlayer) return;

  isPaused = true;

  if (scorer === 1) {
    p1Score++;
  } else {
    p2Score++;
  }

  updateScoreDisplay();
  startCelebration(scorer === 1);
  resetBallToCenter();
  await syncToDatabase();

  lastKnownP1Score = p1Score;
  lastKnownP2Score = p2Score;

  setTimeout(async () => {
    resetBallForPlay();
    celebration = null;
    isPaused = false;
    await syncToDatabase();
  }, SCORE_PAUSE_MS);
}

function updatePlayerOneBall() {
  const scorer = updateBallPhysics();
  if (scorer === 1) handleScore(1);
  if (scorer === 2) handleScore(2);
}

function updateBallPhysics() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  if (ball.x <= ball.radius || ball.x >= canvas.width - ball.radius) {
    ball.dx *= -1;
    ball.x = Math.max(
      ball.radius,
      Math.min(canvas.width - ball.radius, ball.x)
    );
  }

  if (
    ball.y + ball.radius >= bottomPaddle.y &&
    ball.x >= bottomPaddle.x &&
    ball.x <= bottomPaddle.x + paddleWidth
  ) {
    ball.dy *= -1;
    ball.y = bottomPaddle.y - ball.radius;
  }

  if (
    ball.y - ball.radius <= topPaddle.y + paddleHeight &&
    ball.x >= topPaddle.x &&
    ball.x <= topPaddle.x + paddleWidth
  ) {
    ball.dy *= -1;
    ball.y = topPaddle.y + paddleHeight + ball.radius;
  }

  if (ball.y <= 0) {
    return 1;
  }

  if (ball.y >= canvas.height) {
    return 2;
  }

  return null;
}

function clampPaddle(paddle) {
  if (paddle.x <= 0) paddle.x = 0;
  if (paddle.x + paddleWidth >= canvas.width) {
    paddle.x = canvas.width - paddleWidth;
  }
}

function update() {
  if (!isPaused) {
    bottomPaddle.x += bottomPaddle.dx;
    clampPaddle(bottomPaddle);

    if (createdGame) {
      topPaddle.x -= remoteP2Dx;
    } else {
      topPaddle.x -= remoteP1Dx;
    }
    clampPaddle(topPaddle);
  }

  if (waitingForPlayer) {
    ball.x = INITIAL_BALL_X;
    ball.y = INITIAL_BALL_Y;
    ball.dx = 0;
    ball.dy = 0;
    return;
  }

  if (isPaused) {
    return;
  }

  if (createdGame) {
    updatePlayerOneBall();
  } else {
    updateBallPhysics();
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

  drawCelebration();
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
}, SYNC_INTERVAL_MS);
