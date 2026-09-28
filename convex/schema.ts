import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Ranking por juego: memory | parques
// - memory: se ordena por timeSec asc (moves como desempate)
// - parques: se ordena por turns asc (partida más corta gana) y luego reciente
export default defineSchema({
  scores: defineTable({
    player: v.string(),
    game: v.union(v.literal("memory"), v.literal("parques")),
    timeSec: v.optional(v.number()), // memory: obligatorio · parques: duración partida
    moves: v.optional(v.number()), // memory: movimientos
    words: v.optional(v.number()), // histórico (antes crossword), se conserva por compatibilidad
    team: v.optional(v.string()), // parques: equipo ganador (Real Madrid, Barcelona...)
    turns: v.optional(v.number()), // parques: nº de tiradas totales de la partida
    mode: v.optional(v.string()), // parques: cpu4 | cpu | 2p
    createdAt: v.number(),
  })
    .index("by_game_time", ["game", "timeSec"])
    .index("by_game_created", ["game", "createdAt"]),
});
