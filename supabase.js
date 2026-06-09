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
    p1_x: INITIAL_P1_X,
    ball_x: INITIAL_BALL_X,
    ball_dx: INITIAL_BALL_DX,
    ball_dy: INITIAL_BALL_DY,
    p1_score: 0,
    updated_at: new Date().toISOString(),
  };
}

export function getPlayerTwoRow() {
  return {
    p2_x: INITIAL_P2_X,
    p2_score: 0,
    updated_at: new Date().toISOString(),
  };
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
    .select("id, p2_x, p2_score")
    .eq("id", gameId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!game) {
    throw new Error("Game not found.");
  }

  if (game.p2_x != null || game.p2_score != null) {
    throw new Error("This game is already full.");
  }

  const { data: updated, error: updateError } = await supabase
    .from("MyNewGame")
    .update(getPlayerTwoRow())
    .eq("id", gameId)
    .is("p2_x", null)
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
