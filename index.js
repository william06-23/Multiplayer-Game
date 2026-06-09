const newGameBtn = document.getElementById("newGameBtn");
const joinGameBtn = document.getElementById("joinGameBtn");
const joinForm = document.getElementById("joinForm");
const gameCodeInput = document.getElementById("gameCode");
const cancelJoinBtn = document.getElementById("cancelJoinBtn");

function goToGame(gameId) {
  const url = new URL("game.html", window.location.href);
  if (gameId) {
    url.searchParams.set("id", gameId);
  }
  window.location.href = url.toString();
}

function showJoinForm() {
  joinForm.classList.remove("hidden");
  gameCodeInput.focus();
}

function hideJoinForm() {
  joinForm.classList.add("hidden");
  gameCodeInput.value = "";
}

newGameBtn.addEventListener("click", () => {
  goToGame();
});

joinGameBtn.addEventListener("click", () => {
  showJoinForm();
});

cancelJoinBtn.addEventListener("click", () => {
  hideJoinForm();
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const gameId = gameCodeInput.value.trim();
  if (!gameId) {
    gameCodeInput.focus();
    return;
  }

  goToGame(gameId);
});
