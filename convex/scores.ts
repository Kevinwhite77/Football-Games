import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const gameValidator = v.union(v.literal("memory"), v.literal("parques"));

// Guardar una partida terminada en el ranking de su juego
export const saveScore = mutation({
  args: {
    player: v.string(),
    game: gameValidator,
    timeSec: v.optional(v.number()),
    moves: v.optional(v.number()),
    words: v.optional(v.number()),
    team: v.optional(v.string()),
    turns: v.optional(v.number()),
    mode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = args.player.trim().slice(0, 20);
    if (!player) throw new Error("Falta nombre de jugador");

    if (args.game === "memory" && (args.timeSec === undefined || args.timeSec === null)) {
      throw new Error("Falta tiempo en memoria");
    }
    if (args.timeSec !== undefined) {
      if (args.timeSec < 0 || args.timeSec > 24 * 3600) throw new Error("Tiempo inválido");
    }

    const id = await ctx.db.insert("scores", {
      player,
      game: args.game,
      timeSec: args.timeSec === undefined ? undefined : Math.floor(args.timeSec),
      moves: args.moves,
      words: args.words,
      team: args.team?.slice(0, 30),
      turns: args.turns,
      mode: args.mode?.slice(0, 10),
      createdAt: Date.now(),
    });
    return id;
  },
});

// Tabla de posiciones por juego
// - memory: mejor tiempo primero (moves como desempate)
// - parques: partida más corta primero (menos turnos), luego más reciente
export const getRanking = query({
  args: {
    game: gameValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);
    const rows = await ctx.db
      .query("scores")
      .withIndex("by_game_created", (q) => q.eq("game", args.game))
      .order("desc")
      .take(100);

    if (args.game === "memory") {
      rows.sort((a, b) => {
        const ta = a.timeSec ?? Number.MAX_SAFE_INTEGER;
        const tb = b.timeSec ?? Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
        return (a.moves ?? 9999) - (b.moves ?? 9999);
      });
    } else {
      rows.sort((a, b) => {
        const ta = a.turns ?? Number.MAX_SAFE_INTEGER;
        const tb = b.turns ?? Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
        return b.createdAt - a.createdAt;
      });
    }
    return rows.slice(0, limit);
  },
});

// Récords personales por juego (para mostrar "tu mejor")
export const getBestByPlayer = query({
  args: {
    player: v.string(),
    game: gameValidator,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("scores")
      .withIndex("by_game_created", (q) => q.eq("game", args.game))
      .order("desc")
      .take(100);
    return rows.filter((r) => r.player === args.player).slice(0, 5);
  },
});

// Contador de partidas por juego (para las pestañas: "Memoria (12)")
export const getCounts = query({
  args: {},
  handler: async (ctx) => {
    const mem = await ctx.db
      .query("scores")
      .withIndex("by_game_created", (q) => q.eq("game", "memory"))
      .take(1000);
    const par = await ctx.db
      .query("scores")
      .withIndex("by_game_created", (q) => q.eq("game", "parques"))
      .take(1000);
    return { memory: mem.length, parques: par.length };
  },
});
