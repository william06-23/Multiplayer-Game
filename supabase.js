import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://bkigcatgfnqrkvszjnub.supabase.co",
  "sb_publishable_pNXP5rtZyUvuLewbKA0MBA_l9rPGO_i"
);

export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 800;
export const PADDLE_WIDTH = 80;

export const INITIAL_P1_X = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
export const INITIAL_P2_X = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
export const INITIAL_BALL_X = CANVAS_WIDTH / 2;
export const INITIAL_BALL_Y = CANVAS_HEIGHT / 2;
export const INITIAL_BALL_DX = 4;
export const INITIAL_BALL_DY = 4;

export function getNewGameRow() {
  return {
    p1_dx: 0,
    ball_dx: 0,
    ball_dy: 0,
    p1_score: 0,
    updated_at: new Date().toISOString(),
  };
}

export function getPlayerTwoRow() {
  return {
    p2_dx: 0,
    p2_score: 0,
    ball_dx: INITIAL_BALL_DX,
    ball_dy: INITIAL_BALL_DY,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchGameState(gameId) {
  const { data, error } = await supabase
    .from("MyNewGame")
    .select("p1_dx, p2_dx, ball_dx, ball_dy, p1_score, p2_score")
    .eq("id", gameId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function canAccessDatabase() {
  const { error } = await supabase.from("MyNewGame").select("id").limit(1);
  return !error;
}

export async function createNewGame() {
  const { data, error } = await supabase
    .from("MyNewGame")
    .insert(getNewGameRow())
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

export async function joinGame(gameId) {
  const { data: game, error: fetchError } = await supabase
    .from("MyNewGame")
    .select("id, p2_dx, p2_score")
    .eq("id", gameId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!game) {
    throw new Error("Game not found.");
  }

  if (game.p2_dx != null || game.p2_score != null) {
    throw new Error("This game is already full.");
  }

  const { data: updated, error: updateError } = await supabase
    .from("MyNewGame")
    .update(getPlayerTwoRow())
    .eq("id", gameId)
    .is("p2_dx", null)
    .is("p2_score", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!updated) {
    throw new Error("This game is already full.");
  }

  return updated.id;
}
