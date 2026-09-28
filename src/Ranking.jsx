import { useQuery } from "convex/react";
import { anyApi } from "convex/server";

function formatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}

function RankingTable({ game }) {
  const rows = useQuery(anyApi.scores.getRanking, { game, limit: 20 });

  if (rows === undefined) return <p className="ranking-loading">Cargando ranking...</p>;
  if (rows.length === 0) return <p className="ranking-loading">Aún no hay puntuaciones. ¡Sé el primero!</p>;

  return (
    <div className="ranking-table-wrap">
      <table className="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>⏱ Tiempo</th>
            <th>🎯 Movs</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._id} className={i < 3 ? `top-${i + 1}` : ""}>
              <td>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
              <td className="player-cell">{r.player}</td>
              <td>{formatTime(r.timeSec)}</td>
              <td>{r.moves ?? "-"}</td>
              <td>{new Date(r.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Ranking() {
  const game = "memory";

  if (!import.meta.env.VITE_CONVEX_URL) {
    return (
      <div className="ranking-box">
        <p>⚠️ Falta configurar <code>VITE_CONVEX_URL</code> en tu archivo <code>.env.local</code>.</p>
        <p className="ranking-hint">Ejecuta <code>npx convex dev</code> y copia la URL.</p>
      </div>
    );
  }

  return (
    <div className="ranking-box">
      <RankingTable game={game} />
    </div>
  );
}
