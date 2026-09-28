import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const gameValidator = v.union(v.literal("memory"));

// Guardar una partida terminada en el ranking global
export const saveScore = mutation({
  args: {
    player: v.string(),
    game: gameValidator,
    timeSec: v.number(),
    moves: v.optional(v.number()),
    words: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const player = args.player.trim().slice(0, 20);
    if (!player) throw new Error("Falta nombre de jugador");
    if (args.timeSec < 0 || args.timeSec > 24 * 3600) throw new Error("Tiempo inválido");

    const id = await ctx.db.insert("scores", {
      player,
      game: args.game,
      timeSec: Math.floor(args.timeSec),
      moves: args.moves,
      words: args.words,
      createdAt: Date.now(),
    });
    return id;
  },
});

// Tabla de posiciones por juego, ordenada por mejor tiempo
export const getRanking = query({
  args: {
    game: gameValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);
    const rows = await ctx.db
      .query("scores")
      .withIndex("by_game_time", (q) => q.eq("game", args.game))
      .order("asc")
      .take(limit);
    return rows;
  },
});

// Récords personales (para mostrar "tu mejor")
export const getBestByPlayer = query({
  args: {
    player: v.string(),
    game: gameValidator,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("scores")
      .withIndex("by_game_time", (q) => q.eq("game", args.game))
      .order("asc")
      .take(100);
    return rows.filter((r) => r.player === args.player).slice(0, 5);
  },
});
