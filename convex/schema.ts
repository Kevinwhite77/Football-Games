import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Ranking por juego: memory
// Ordenamos por timeSec ascendente (y moves como desempate en memoria)
export default defineSchema({
  scores: defineTable({
    player: v.string(),
    game: v.union(v.literal("memory")),
    timeSec: v.number(),
    moves: v.optional(v.number()), // solo memory
    words: v.optional(v.number()), // histórico (antes crossword), se conserva por compatibilidad
    createdAt: v.number(),
  })
    .index("by_game_time", ["game", "timeSec"])
    .index("by_game_created", ["game", "createdAt"]),
});
