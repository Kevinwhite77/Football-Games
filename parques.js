// ================================
// PARQUÉS SIMPLE (2 jugadores: Rojo vs Azul)
// Pista circular de 32 casillas + 4 de recta final por jugador.
// ================================

const TRACK_LEN = 32;
const FINAL_STEPS = 4;               // casillas de recta final
const GOAL_POS = TRACK_LEN + FINAL_STEPS; // 36 = meta (progreso total)
const SAFE = new Set([0, 8, 16, 24]);     // seguros (relativos a la pista)
const START = [0, 16];               // salida en la pista: rojo=0, azul=16

const parquesGameCard = document.getElementById("parquesGame");
const parquesScreen = document.getElementById("parquesScreen");
const gameMenuSection = document.getElementById("gameMenu");
const trackEl = document.getElementById("parquesTrack");
const diceEl = document.getElementById("parquesDice");
const turnEl = document.getElementById("parquesTurn");
const msgEl = document.getElementById("parquesMsg");
const rollBtn = document.getElementById("parquesRoll");
const modeSel = document.getElementById("parquesMode");
const jailR = document.getElementById("parquesJailR");
const jailB = document.getElementById("parquesJailB");
const goalR = document.querySelector("#parquesGoalR span");
const goalB = document.querySelector("#parquesGoalB span");
const scoreR = document.getElementById("parquesScoreR");
const scoreB = document.getElementById("parquesScoreB");

let P = null; // estado

function parquesNewGame() {
    P = {
        pieces: [[-1, -1, -1, -1], [-1, -1, -1, -1]], // -1 cárcel, 0..35 en juego, 36 meta
        turn: 0,
        dice: null,
        canRoll: true,
        over: false,
    };
    renderParques();
    setMsg("Turno del 🔴 rojo. ¡Lanza el dado!");
}

function boardIndex(player, pos) {
    if (pos < 0 || pos >= TRACK_LEN) return null; // cárcel, recta final o meta
    return (START[player] + pos) % TRACK_LEN;
}

function validMoves(player, dice) {
    const moves = [];
    P.pieces[player].forEach((pos, i) => {
        if (pos === GOAL_POS) return; // ya en meta
        if (pos === -1) {
            if (dice === 6) moves.push(i); // salir de la cárcel
        } else if (pos + dice <= GOAL_POS) {
            moves.push(i);
        }
    });
    return moves;
}

function setMsg(t) { if (msgEl) msgEl.textContent = t; }
function playerName(p) { return p === 0 ? "🔴 Rojo" : "🔵 Azul"; }

function rollDice() {
    if (!P || P.over || !P.canRoll) return;
    const d = 1 + Math.floor(Math.random() * 6);
    P.dice = d;
    P.canRoll = false;
    if (diceEl) { diceEl.textContent = "🎲..."; }
    // pequeña animación del dado
    let ticks = 0;
    const anim = setInterval(() => {
        if (diceEl) diceEl.textContent = 1 + Math.floor(Math.random() * 6);
        if (++ticks >= 6) {
            clearInterval(anim);
            if (diceEl) diceEl.textContent = d;
            afterRoll(d);
        }
    }, 70);
    try { beepLike(300 + d * 60); } catch (e) { /* sin sonido */ }
}

function beepLike(freq) {
    // reutiliza el sistema de sonido si existe (script.js expone sndFlip globalmente? no, así que mini-beep propio)
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        window.__pqCtx = window.__pqCtx || new Ctx();
        const ctx = window.__pqCtx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = freq; g.gain.value = 0.08;
        o.connect(g); g.connect(ctx.destination);
        o.start(); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        o.stop(ctx.currentTime + 0.12);
    } catch (e) { /* noop */ }
}

function afterRoll(d) {
    const me = P.turn;
    const moves = validMoves(me, d);
    renderParques();
    if (moves.length === 0) {
        setMsg(`${playerName(me)} sacó ${d} y no tiene movimientos. Turno perdido.`);
        setTimeout(nextTurn, 1100);
        return;
    }
    if (isCpuTurn()) {
        setMsg(`🤖 Azul sacó ${d}. Pensando...`);
        setTimeout(() => cpuMove(d), 800);
    } else {
        const jailOpt = moves.some((i) => P.pieces[me][i] === -1);
        setMsg(`${playerName(me)} sacó ${d}. ${jailOpt ? "Puedes salir de la cárcel con 6. " : ""}Toca una ficha iluminada para moverla.`);
    }
    renderParques();
}

function isCpuTurn() {
    return modeSel && modeSel.value === "cpu" && P.turn === 1 && !P.over;
}

function movePiece(player, idx) {
    const d = P.dice;
    if (d == null) return;
    if (!validMoves(player, d).includes(idx)) return;

    let pos = P.pieces[player][idx];
    pos = (pos === -1) ? 0 : pos + d;
    P.pieces[player][idx] = pos;

    let msg = `${playerName(player)} movió ficha ${idx + 1} con ${d}.`;
    // comer rivales (solo en pista, no en seguros)
    const bi = boardIndex(player, pos);
    if (bi !== null && !SAFE.has(bi)) {
        const rival = 1 - player;
        let eaten = 0;
        P.pieces[rival] = P.pieces[rival].map((rp) => {
            if (rp >= 0 && rp < TRACK_LEN && boardIndex(rival, rp) === bi) { eaten++; return -1; }
            return rp;
        });
        if (eaten > 0) msg += ` 😋 ¡Comió ${eaten} ficha(s) rival! Repite turno.`;
    }
    const reachedGoal = pos === GOAL_POS;
    if (reachedGoal) msg += " 🏁 ¡Ficha en la meta!";

    // victoria
    if (P.pieces[player].every((x) => x === GOAL_POS)) {
        P.over = true;
        P.dice = null;
        renderParques();
        const winner = playerName(player);
        setMsg(`🏆 ¡${winner} ganó el juego!`);
        setTimeout(() => alert(`🏆 ¡${winner} ganó el Parqués! 🎲`), 300);
        return;
    }

    // repetir turno con 6, al comer o al llegar a meta; si no, pasa el turno
    const extra = (d === 6) || reachedGoal || msg.includes("😋");
    P.dice = null;
    if (extra) {
        P.canRoll = true;
        // si es CPU, sigue tirando
        renderParques();
        setMsg(msg + (player === 0 || modeSel.value === "2p" ? " Tira de nuevo." : " La CPU tira de nuevo."));
        if (isCpuTurnWith(player)) setTimeout(() => { if (P.canRoll && !P.over) rollDice(); }, 900);
    } else {
        P.turn = 1 - player;
        P.canRoll = true;
        renderParques();
        setMsg(msg + ` Turno de ${playerName(P.turn)}.`);
        if (isCpuTurn()) setTimeout(() => { if (P.canRoll && !P.over) rollDice(); }, 900);
    }
}

function isCpuTurnWith(player) {
    return modeSel && modeSel.value === "cpu" && player === 1 && !P.over;
}

function nextTurn() {
    if (P.over) return;
    P.turn = 1 - P.turn;
    P.dice = null;
    P.canRoll = true;
    renderParques();
    setMsg(`Turno de ${playerName(P.turn)}. ¡Lanza el dado!`);
    if (isCpuTurn()) setTimeout(() => { if (P.canRoll && !P.over) rollDice(); }, 900);
}

function cpuMove(d) {
    if (!P || P.over) return;
    const me = 1;
    const moves = validMoves(me, d);
    if (moves.length === 0) { nextTurn(); return; }
    // heurística: 1) comer 2) entrar a meta 3) salir de cárcel 4) ficha más adelantada
    let best = moves[0], bestScore = -1e9;
    for (const i of moves) {
        const pos = P.pieces[me][i];
        const dest = pos === -1 ? 0 : pos + d;
        let s = dest; // prefiere avanzar
        if (dest === GOAL_POS) s += 100;
        if (pos === -1) s += 60;
        const bi = boardIndex(me, dest);
        if (bi !== null && !SAFE.has(bi)) {
            const victims = P.pieces[0].filter((rp) => rp >= 0 && rp < TRACK_LEN && boardIndex(0, rp) === bi).length;
            s += victims * 80;
        }
        if (s > bestScore) { bestScore = s; best = i; }
    }
    movePiece(me, best);
}

// ---------- render ----------
function renderParques() {
    if (!P) return;
    // turno + marcador
    if (turnEl) {
        turnEl.textContent = P.over ? "🏁 Juego terminado" : `Turno: ${playerName(P.turn)}`;
        turnEl.classList.toggle("turn-blue", P.turn === 1);
    }
    const gR = P.pieces[0].filter((x) => x === GOAL_POS).length;
    const gB = P.pieces[1].filter((x) => x === GOAL_POS).length;
    if (goalR) goalR.textContent = `${gR}/4`;
    if (goalB) goalB.textContent = `${gB}/4`;
    if (scoreR) scoreR.textContent = `${gR}/4`;
    if (scoreB) scoreB.textContent = `${gB}/4`;
    if (rollBtn) rollBtn.disabled = !P.canRoll || P.over;

    // pista
    trackEl.innerHTML = "";
    const moves = (P.dice != null && !P.over) ? validMoves(P.turn, P.dice) : [];
    const clickable = !isCpuTurn() && P.dice != null;

    for (let c = 0; c < TRACK_LEN; c++) {
        const cell = document.createElement("div");
        cell.className = "pq-cell" + (SAFE.has(c) ? " pq-safe" : "");
        if (c === START[0]) cell.classList.add("pq-start-r");
        if (c === START[1]) cell.classList.add("pq-start-b");
        const num = document.createElement("span");
        num.className = "pq-num";
        num.textContent = SAFE.has(c) ? "⭐" : (c + 1);
        cell.appendChild(num);

        // fichas de cada jugador en esta casilla
        [0, 1].forEach((pl) => {
            P.pieces[pl].forEach((pos, i) => {
                if (pos >= 0 && pos < TRACK_LEN && boardIndex(pl, pos) === c) {
                    const t = document.createElement("button");
                    t.className = `pq-token p${pl}` + (clickable && pl === P.turn && moves.includes(i) ? " pq-can" : "");
                    t.textContent = i + 1;
                    t.title = `${playerName(pl)} ficha ${i + 1}`;
                    if (clickable && pl === P.turn && moves.includes(i)) {
                        t.addEventListener("click", (ev) => { ev.stopPropagation(); movePiece(pl, i); });
                    }
                    cell.appendChild(t);
                }
            });
        });
        trackEl.appendChild(cell);
    }

    // cárceles + recta final
    renderHome(0, jailR, moves, clickable);
    renderHome(1, jailB, moves, clickable);
}

function renderHome(pl, jailEl, moves, clickable) {
    if (!jailEl) return;
    jailEl.innerHTML = "";
    P.pieces[pl].forEach((pos, i) => {
        // en cárcel
        if (pos === -1) {
            const t = document.createElement("button");
            t.className = `pq-token p${pl}` + (clickable && pl === P.turn && moves.includes(i) ? " pq-can pq-jail" : "");
            t.textContent = i + 1;
            t.title = `En la cárcel — sale con 6`;
            if (clickable && pl === P.turn && moves.includes(i)) {
                t.addEventListener("click", (ev) => { ev.stopPropagation(); movePiece(pl, i); });
            }
            jailEl.appendChild(t);
        }
    });
    if (jailEl.children.length === 0) {
        const s = document.createElement("span");
        s.className = "pq-empty";
        s.textContent = "Vacía 🎉";
        jailEl.appendChild(s);
    }
    // recta final: mostrar progreso de fichas entre 32 y 35 como mini-barra
    let home = jailEl.parentElement.querySelector(".pq-final");
    if (!home) {
        home = document.createElement("div");
        home.className = "pq-final";
        jailEl.parentElement.insertBefore(home, jailEl.nextSibling);
    }
    home.innerHTML = "";
    P.pieces[pl].forEach((pos, i) => {
        if (pos >= TRACK_LEN && pos < GOAL_POS) {
            const t = document.createElement("button");
            t.className = `pq-token p${pl} pq-final-t` + (clickable && pl === P.turn && moves.includes(i) ? " pq-can" : "");
            t.textContent = `${i + 1}:${GOAL_POS - pos}`;
            t.title = `Recta final — le faltan ${GOAL_POS - pos}`;
            if (clickable && pl === P.turn && moves.includes(i)) {
                t.addEventListener("click", (ev) => { ev.stopPropagation(); movePiece(pl, i); });
            }
            home.appendChild(t);
        }
    });
}

// ---------- navegación ----------
function showParques(el) {
    ["loading-screen", "menu", "gameMenu", "memoryScreen", "rankingScreen"].forEach((id) => {
        const s = document.getElementById(id);
        if (s) { s.classList.add("hidden"); s.style.display = "none"; }
    });
    parquesScreen.classList.remove("hidden");
    parquesScreen.style.display = "flex";
    window.scrollTo(0, 0);
}

if (parquesGameCard) {
    parquesGameCard.addEventListener("click", () => {
        showParques();
        if (!P) parquesNewGame();
        else renderParques();
    });
}
if (rollBtn) rollBtn.addEventListener("click", rollDice);
const restartBtn = document.getElementById("restartParques");
if (restartBtn) restartBtn.addEventListener("click", () => { parquesNewGame(); });
const backBtn = document.getElementById("backMenuParques");
if (backBtn) {
    backBtn.addEventListener("click", () => {
        parquesScreen.classList.add("hidden");
        parquesScreen.style.display = "none";
        if (gameMenuSection) {
            gameMenuSection.classList.remove("hidden");
            gameMenuSection.style.display = "flex";
        }
        window.scrollTo(0, 0);
    });
}
if (modeSel) modeSel.addEventListener("change", () => { parquesNewGame(); });

parquesNewGame();
