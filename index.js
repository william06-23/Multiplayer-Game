import { canAccessDatabase, joinGame } from "./supabase.js";

const newGameBtn = document.getElementById("newGameBtn");
const joinGameBtn = document.getElementById("joinGameBtn");
const joinForm = document.getElementById("joinForm");
const gameCodeInput = document.getElementById("gameCode");
const cancelJoinBtn = document.getElementById("cancelJoinBtn");
const newGameError = document.getElementById("newGameError");
const joinError = document.getElementById("joinError");
const connectBtn = joinForm.querySelector('button[type="submit"]');

function goToGame(gameId, player) {
  const url = new URL("game.html", window.location.href);
  url.searchParams.set("id", gameId);
  url.searchParams.set("player", player);
  window.location.href = url.toString();
}

function showJoinForm() {
  joinForm.classList.remove("hidden");
  clearJoinError();
  gameCodeInput.focus();
}

function hideJoinForm() {
  joinForm.classList.add("hidden");
  gameCodeInput.value = "";
  clearJoinError();
}

function showNewGameError(message) {
  newGameError.textContent = message;
  newGameError.classList.remove("hidden");
}

function clearNewGameError() {
  newGameError.textContent = "";
  newGameError.classList.add("hidden");
}

function showJoinError(message) {
  joinError.textContent = message;
  joinError.classList.remove("hidden");
}

function clearJoinError() {
  joinError.textContent = "";
  joinError.classList.add("hidden");
}

newGameBtn.addEventListener("click", async () => {
  clearNewGameError();
  newGameBtn.disabled = true;

  try {
    const accessible = await canAccessDatabase();
    if (!accessible) {
      showNewGameError("Database cannot be accessed.");
      newGameBtn.disabled = false;
      return;
    }

    window.location.href = new URL("game.html?player=1", window.location.href).toString();
  } catch {
    showNewGameError("Database cannot be accessed.");
    newGameBtn.disabled = false;
  }
});

joinGameBtn.addEventListener("click", () => {
  showJoinForm();
});

cancelJoinBtn.addEventListener("click", () => {
  hideJoinForm();
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearJoinError();

  const gameId = gameCodeInput.value.trim();
  if (!gameId) {
    gameCodeInput.focus();
    return;
  }

  connectBtn.disabled = true;
  connectBtn.textContent = "Connecting...";

  try {
    await joinGame(gameId);
    goToGame(gameId, "2");
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to join game. Please try again.";
    showJoinError(message);
    connectBtn.disabled = false;
    connectBtn.textContent = "Connect";
  }
});
