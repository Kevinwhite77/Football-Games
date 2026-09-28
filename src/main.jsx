import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import Ranking from "./Ranking.jsx";

const url = import.meta.env.VITE_CONVEX_URL;
const rootEl = document.getElementById("ranking-root");

if (rootEl) {
  if (!url) {
    rootEl.innerHTML =
      "<p class='ranking-loading'>⚠️ Configura VITE_CONVEX_URL en .env.local (ejecuta npx convex dev)</p>";
  } else {
    const convex = new ConvexReactClient(url);
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ConvexProvider client={convex}>
          <Ranking />
        </ConvexProvider>
      </React.StrictMode>
    );
  }
}
