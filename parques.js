// ================================
// PARQUÉS CLÁSICO (tablero 15x15, 4 colores)
// Recorrido de 52 casillas + 6 pasos de pasillo hasta el centro.
// pos: -1 = cárcel, 0..50 = pista, 51..55 = pasillo propio, 56 = centro (meta)
// ================================

const COLORS = [
    { name: "Rojo", team: "Real Madrid", img: "img/escudos/real-madrid.png", emoji: "🔴", css: "ld-r", start: 0 },
    { name: "Verde", team: "Bayern", img: "img/escudos/bayern.png", emoji: "🟢", css: "ld-g", start: 13 },
    { name: "Amarillo", team: "Liverpool", img: "img/escudos/liverpool.png", emoji: "🟡", css: "ld-y", start: 26 },
    { name: "Azul", team: "Barcelona", img: "img/escudos/barcelona.png", emoji: "🔵", css: "ld-b", start: 39 },
];

// Recorrido principal de 52 casillas (fila, columna en cuadrícula 15x15)
const PATH = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
    [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
    [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
    [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

// Pasillos de cada color hacia el centro (5 casillas + centro)
const HOMES = [
    [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],     // rojo (entra desde el oeste)
    [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],     // verde (entra desde el norte)
    [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], // amarillo (entra desde el este)
    [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]], // azul (entra desde el sur)
];

const GOAL = 56;
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]); // salidas + estrellas
const BASE_AREA = [ // [filaIni, colIni] de cada cárcel 6x6
    [0, 0], [0, 9], [9, 9], [9, 0],
];

const $ = (id) => document.getElementById(id);
const parquesGameCard = $("parquesGame");
const parquesScreen = $("parquesScreen");
const gameMenuSection = $("gameMenu");
const boardEl = $("parquesBoard");
const diceEl = $("parquesDice");
const turnEl = $("parquesTurn");
const msgEl = $("parquesMsg");
const rollBtn = $("parquesRoll");
const modeSel = $("parquesMode");
const scoresEl = $("parquesScores");

let P = null;
const cellEls = {}; // "f_c" -> div

// ---------- ranking global (Convex, opcional) ----------
function getParquesConvexUrl() {
    try {
        return globalThis.__CONVEX_URL__
            || (typeof import.meta !== "undefined" && import.meta.env?.VITE_CONVEX_URL)
            || null;
    } catch (e) {
        return null;
    }
}

let parquesConvexCache = undefined;
function loadParquesConvex() {
    if (parquesConvexCache !== undefined) return parquesConvexCache;
    const url = getParquesConvexUrl();
    if (!url) {
        parquesConvexCache = Promise.resolve(null);
        return parquesConvexCache;
    }
    parquesConvexCache = Promise.all([import("convex/browser"), import("convex/server")])
        .then(([{ ConvexHttpClient }, { anyApi }]) => ({
            client: new ConvexHttpClient(url),
            api: anyApi,
        }))
        .catch((e) => {
            console.warn("Ranking Parqués no disponible:", e);
            return null;
        });
    return parquesConvexCache;
}

async function saveParquesWin({ team, turns, timeSec, mode, human }) {
    try {
        const convex = await loadParquesConvex();
        if (!convex) return;
        const stored = (localStorage.getItem("jugador") || "").trim();
        const player = human
            ? (stored || team).slice(0, 20)
            : `CPU ${team}`.slice(0, 20);
        await convex.client.mutation(convex.api.scores.saveScore, {
            player,
            game: "parques",
            timeSec,
            team,
            turns,
            mode,
        });
    } catch (e) {
        console.warn("No se pudo guardar Parqués en el ranking:", e);
    }
}

// ---------- estado ----------
function activeColors() {
    const m = modeSel ? modeSel.value : "cpu4";
    if (m === "cpu4") return [0, 1, 2, 3];
    return [0, 3]; // rojo vs azul
}
function isHuman(pi) {
    const m = modeSel ? modeSel.value : "cpu4";
    if (m === "2p") return true;
    return pi === 0;
}

function parquesNewGame() {
    const act = activeColors();
    P = {
        players: act.map((ci) => ({ ci, pieces: [-1, -1, -1, -1], human: isHuman(ci) })),
        turn: 0, // índice dentro de players
        dice: null,
        canRoll: true,
        over: false,
        rolls: 0,
        startedAt: Date.now(),
    };
    buildBoard();
    renderParques();
    const me = cur();
    setMsg(`Turno de ${label(me)}. Sal de la cárcel con un 6. ¡Lanza el dado!`);
    maybeCpuRoll();
}

function cur() { return P.players[P.turn]; }
function label(pl) { const c = COLORS[pl.ci]; return `${c.emoji} ${c.team}`; }
function setMsg(t) { if (msgEl) msgEl.textContent = t; }
function key(r, c) { return r + "_" + c; }

// Escudo del equipo (con insignia temporal si falta el archivo, p. ej. Milan)
function crestEl(ci) {
    const c = COLORS[ci];
    const s = document.createElement("span");
    s.className = "ld-crest";
    const img = document.createElement("img");
    img.src = c.img;
    img.alt = c.team;
    img.draggable = false;
    img.addEventListener("error", () => {
        s.innerHTML = "";
        const fb = document.createElement("span");
        fb.className = "ld-crest-fb";
        fb.textContent = c.team.slice(0, 3).toUpperCase();
        fb.title = c.team;
        s.appendChild(fb);
    });
    s.appendChild(img);
    return s;
}

function pathIdxOf(ci, pos) { return (COLORS[ci].start + pos) % 52; }

function cellOf(ci, pos) {
    if (pos < 0) return null; // cárcel
    if (pos <= 50) { const [r, c] = PATH[pathIdxOf(ci, pos)]; return { r, c, path: pathIdxOf(ci, pos) }; }
    if (pos <= 55) { const [r, c] = HOMES[ci][pos - 51]; return { r, c, path: null }; }
    return { center: true };
}

function validMoves(pl, dice) {
    const out = [];
    pl.pieces.forEach((pos, i) => {
        if (pos === GOAL) return;
        if (pos === -1) { if (dice === 6) out.push(i); }
        else if (pos + dice <= GOAL) out.push(i);
    });
    return out;
}

// ---------- dados y turnos ----------
function rollDice() {
    if (!P || P.over || !P.canRoll) return;
    if (!cur().human) return; // la CPU tira sola
    doRoll();
}

function doRoll() {
    if (!P || P.over || !P.canRoll) return;
    P.canRoll = false;
    P.rolls = (P.rolls || 0) + 1;
    const d = 1 + Math.floor(Math.random() * 6);
    let ticks = 0;
    const anim = setInterval(() => {
        if (diceEl) diceEl.textContent = 1 + Math.floor(Math.random() * 6);
        if (++ticks >= 6) {
            clearInterval(anim);
            P.dice = d;
            if (diceEl) diceEl.textContent = d;
            beep(300 + d * 60);
            afterRoll();
        }
    }, 70);
}

function afterRoll() {
    const me = cur();
    const moves = validMoves(me, P.dice);
    renderParques();
    if (moves.length === 0) {
        setMsg(`${label(me)} sacó ${P.dice} sin movimientos posibles. Pierde el turno.`);
        setTimeout(nextTurn, 1200);
        return;
    }
    if (me.human) {
        setMsg(`${label(me)} sacó ${P.dice}. Toca una ficha brillante para moverla.`);
    } else {
        setMsg(`${label(me)} sacó ${P.dice}. Pensando...`);
        setTimeout(() => cpuMove(), 850);
    }
}

function cpuMove() {
    if (!P || P.over || P.dice == null) return;
    const me = cur();
    if (me.human) return;
    const d = P.dice;
    const moves = validMoves(me, d);
    if (moves.length === 0) { nextTurn(); return; }
    let best = moves[0], bestScore = -1e9;
    for (const i of moves) {
        const pos = me.pieces[i];
        const dest = pos === -1 ? 0 : pos + d;
        let s = dest;
        if (dest === GOAL) s += 200;
        if (pos === -1) s += 90;
        if (dest <= 50) {
            const pi = pathIdxOf(me.ci, dest);
            if (!SAFE.has(pi)) {
                let victims = 0;
                for (const o of P.players) {
                    if (o === me) continue;
                    victims += o.pieces.filter((rp) => rp >= 0 && rp <= 50 && pathIdxOf(o.ci, rp) === pi).length;
                }
                s += victims * 120;
            } else s += 15; // prefiere seguros
        } else s += 40; // prefiere pasillo
        if (s > bestScore) { bestScore = s; best = i; }
    }
    movePiece(P.turn, best);
}

function movePiece(turnIdx, idx) {
    const pl = P.players[turnIdx];
    const d = P.dice;
    if (d == null || P.over) return;
    if (!validMoves(pl, d).includes(idx)) return;

    let pos = pl.pieces[idx];
    pos = pos === -1 ? 0 : pos + d;
    pl.pieces[idx] = pos;

    const c = COLORS[pl.ci];
    let msg = `${c.emoji} ${c.team} movió su ficha ${idx + 1} (dado ${d}).`;
    let captured = false;

    if (pos <= 50) {
        const pi = pathIdxOf(pl.ci, pos);
        if (!SAFE.has(pi)) {
            let eaten = 0;
            for (const o of P.players) {
                if (o === pl) continue;
                o.pieces = o.pieces.map((rp) => {
                    if (rp >= 0 && rp <= 50 && pathIdxOf(o.ci, rp) === pi) { eaten++; return -1; }
                    return rp;
                });
            }
            if (eaten > 0) { captured = true; msg += ` 😋 ¡Capturó ${eaten} ficha(s)!`; }
        }
    }
    const crowned = pos === GOAL;
    if (crowned) msg += " 🏁 ¡Ficha en el centro!";

    if (pl.pieces.every((x) => x === GOAL)) {
        P.over = true; P.dice = null; P.canRoll = false;
        renderParques();
        setMsg(`🏆 ¡${c.emoji} ${c.team} ganó el Parqués!`);
        beep(880);
        saveParquesWin({
            team: c.team,
            turns: P.rolls || 0,
            timeSec: Math.floor((Date.now() - (P.startedAt || Date.now())) / 1000),
            mode: modeSel ? modeSel.value : "cpu4",
            human: !!pl.human,
        });
        setTimeout(() => alert(`🏆 ¡${c.team} ganó el Parqués! 🎲`), 350);
        return;
    }

    const extra = d === 6 || captured || crowned;
    P.dice = null;
    P.canRoll = true;
    renderParques();
    if (extra) {
        setMsg(msg + " Tiene otro turno.");
        maybeCpuRoll(900);
    } else {
        P.turn = (P.turn + 1) % P.players.length;
        setMsg(msg + ` Turno de ${label(cur())}.`);
        renderParques();
        maybeCpuRoll(900);
    }
}

function nextTurn() {
    if (!P || P.over) return;
    P.turn = (P.turn + 1) % P.players.length;
    P.dice = null;
    P.canRoll = true;
    renderParques();
    setMsg(`Turno de ${label(cur())}. ¡Lanza el dado!`);
    maybeCpuRoll(900);
}

function maybeCpuRoll(delay = 0) {
    if (!P || P.over || !P.canRoll) return;
    if (cur().human) return;
    setTimeout(() => { if (P && !P.over && P.canRoll && !cur().human) doRoll(); }, delay || 800);
}

function beep(freq) {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        window.__pqCtx = window.__pqCtx || new Ctx();
        const ctx = window.__pqCtx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = freq; g.gain.value = 0.06;
        o.connect(g); g.connect(ctx.destination);
        o.start(); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        o.stop(ctx.currentTime + 0.12);
    } catch (e) { /* sin audio */ }
}

// ---------- tablero ----------
function isArm(r, c) { return (r >= 6 && r <= 8) || (c >= 6 && c <= 8); }

function buildBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = "";
    for (const k in cellEls) delete cellEls[k];

    // cárceles de las 4 esquinas
    COLORS.forEach((col, ci) => {
        const [br, bc] = BASE_AREA[ci];
        const active = P.players.some((p) => p.ci === ci);
        const base = document.createElement("div");
        base.className = "ld-base " + col.css + (active ? "" : " ld-off");
        base.style.gridRow = `${br + 1} / span 6`;
        base.style.gridColumn = `${bc + 1} / span 6`;
        base.innerHTML = `<div class="ld-base-in"><div class="ld-team" id="ldTeam${ci}"></div><div class="ld-slots" id="ldSlots${ci}"></div></div>`;
        boardEl.appendChild(base);
        const teamBox = base.querySelector(`#ldTeam${ci}`);
        if (teamBox) {
            teamBox.appendChild(crestEl(ci));
            const nm = document.createElement("span");
            nm.textContent = col.team;
            teamBox.appendChild(nm);
        }
    });

    // centro (meta)
    const center = document.createElement("div");
    center.className = "ld-center";
    center.style.gridRow = "7 / span 3";
    center.style.gridColumn = "7 / span 3";
    center.title = "Meta";
    boardEl.appendChild(center);

    // casillas de los brazos
    const pathKeys = new Set(PATH.map(([r, c]) => key(r, c)));
    const homeKey = {};
    HOMES.forEach((cells, ci) => cells.forEach(([r, c]) => { homeKey[key(r, c)] = ci; }));
    const startKey = {};
    COLORS.forEach((col, ci) => {
        const [r, c] = PATH[col.start];
        startKey[key(r, c)] = ci;
    });

    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            if (!isArm(r, c)) continue;
            if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue; // centro
            const k = key(r, c);
            const cell = document.createElement("div");
            cell.className = "ld-cell";
            cell.style.gridRow = `${r + 1}`;
            cell.style.gridColumn = `${c + 1}`;
            if (k in startKey) {
                cell.classList.add(COLORS[startKey[k]].css, "ld-start");
            } else if (k in homeKey) {
                cell.classList.add(COLORS[homeKey[k]].css, "ld-home");
            } else if (pathKeys.has(k)) {
                const pi = PATH.findIndex(([pr, pc]) => pr === r && pc === c);
                if (SAFE.has(pi)) { cell.classList.add("ld-star"); cell.textContent = "⭐"; }
            } else {
                cell.classList.add("ld-plain");
            }
            boardEl.appendChild(cell);
            cellEls[k] = cell;
        }
    }
}

function tokenBtn(pl, idx, many) {
    const c = COLORS[pl.ci];
    const b = document.createElement("button");
    b.className = `ld-tok ${c.css}${many ? " many" : ""}`;
    b.textContent = idx + 1;
    b.title = `${c.team} ficha ${idx + 1}`;
    return b;
}

function renderParques() {
    if (!P || !boardEl) return;
    const me = cur();
    const moves = (P.dice != null && !P.over && me.human) ? validMoves(me, P.dice) : [];

    if (turnEl) {
        turnEl.textContent = P.over ? "🏁 Juego terminado" : `Turno: ${label(me)}`;
    }
    if (rollBtn) rollBtn.disabled = !P.canRoll || P.over || !me.human;
    if (diceEl && P.dice == null && P.canRoll) diceEl.textContent = "-";

    // marcador
    if (scoresEl) {
        scoresEl.innerHTML = "";
        P.players.forEach((pl, ti) => {
            const c = COLORS[pl.ci];
            const goals = pl.pieces.filter((x) => x === GOAL).length;
            const chip = document.createElement("span");
            chip.className = "pq-chip" + (ti === P.turn && !P.over ? " active" : "");
            chip.innerHTML = "";
            chip.appendChild(crestEl(pl.ci));
            const t = document.createElement("span");
            t.textContent = `${c.team.split(" ").pop()} ${goals}/4${pl.human ? "" : " 🤖"}`;
            chip.appendChild(t);
            chip.title = c.team + (pl.human ? "" : " (CPU)");
            scoresEl.appendChild(chip);
        });
    }

    // limpiar fichas de las casillas
    Object.values(cellEls).forEach((cell) => {
        cell.querySelectorAll(".ld-tokens").forEach((t) => t.remove());
    });

    // agrupar fichas por casilla
    const byCell = {};
    P.players.forEach((pl, ti) => {
        pl.pieces.forEach((pos, i) => {
            const cell = cellOf(pl.ci, pos);
            if (!cell || cell.center || pos < 0) return;
            const k = key(cell.r, cell.c);
            (byCell[k] = byCell[k] || []).push({ pl, ti, i });
        });
    });
    Object.entries(byCell).forEach(([k, list]) => {
        const cell = cellEls[k];
        if (!cell) return;
        const wrap = document.createElement("div");
        wrap.className = "ld-tokens";
        list.forEach(({ pl, ti, i }) => {
            const t = tokenBtn(pl, i, list.length > 1);
            if (ti === P.turn && moves.includes(i) && P.dice != null) {
                t.classList.add("can");
                t.addEventListener("click", (ev) => { ev.stopPropagation(); movePiece(ti, i); });
            }
            wrap.appendChild(t);
        });
        cell.appendChild(wrap);
    });

    // cárceles
    COLORS.forEach((col, ci) => {
        const box = $("ldSlots" + ci);
        if (!box) return;
        box.innerHTML = "";
        const pl = P.players.find((p) => p.ci === ci);
        for (let i = 0; i < 4; i++) {
            const slot = document.createElement("div");
            slot.className = "ld-slot";
            const inJail = pl && pl.pieces[i] === -1;
            if (inJail) {
                const ti = P.players.indexOf(pl);
                const t = tokenBtn(pl, i, false);
                if (ti === P.turn && moves.includes(i) && P.dice != null) {
                    t.classList.add("can");
                    t.addEventListener("click", (ev) => { ev.stopPropagation(); movePiece(ti, i); });
                }
                slot.appendChild(t);
            }
            box.appendChild(slot);
        }
    });
}

// ---------- navegación ----------
if (parquesGameCard) {
    parquesGameCard.addEventListener("click", () => {
        ["loading-screen", "menu", "gameMenu", "memoryScreen", "rankingScreen"].forEach((id) => {
            const s = $(id);
            if (s) { s.classList.add("hidden"); s.style.display = "none"; }
        });
        parquesScreen.classList.remove("hidden");
        parquesScreen.style.display = "flex";
        window.scrollTo(0, 0);
        showParquesIntro();
    });
}
if (rollBtn) rollBtn.addEventListener("click", rollDice);
const restartBtn = $("restartParques");
if (restartBtn) restartBtn.addEventListener("click", () => parquesNewGame());
const backBtn = $("backMenuParques");
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
if (modeSel) modeSel.addEventListener("change", () => parquesNewGame());

// ---------- portada estilo Champions (antes de jugar) ----------
const CH_CRESTS = [
    "img/escudos/real-madrid.png",
    "img/escudos/barcelona.png",
    "img/escudos/bayern.png",
    "img/escudos/psg.png",
    "img/escudos/man-city.png",
    "img/escudos/liverpool.png",
    "img/escudos/arsenal.png",
    "img/escudos/inter.png",
];

function buildChTrack() {
    const track = $("chTrack");
    if (!track || track.children.length) return;
    // perímetro 9x9 = 32 casillas: arriba(9) → derecha(7) → abajo(9) → izquierda(7)
    const cells = [];
    for (let c = 0; c < 9; c++) cells.push([0, c]);
    for (let r = 1; r <= 7; r++) cells.push([r, 8]);
    for (let c = 8; c >= 0; c--) cells.push([8, c]);
    for (let r = 7; r >= 1; r--) cells.push([r, 0]);
    let crest = 0;
    cells.forEach(([r, c], idx) => {
        const d = document.createElement("div");
        d.className = "ch-cell";
        d.style.gridRow = `${r + 1}`;
        d.style.gridColumn = `${c + 1}`;
        if (idx === 0) { d.classList.add("ch-corner"); d.innerHTML = "<span>⭐</span><b>INICIO</b>"; }
        else if (idx === 16) { d.classList.add("ch-corner"); d.innerHTML = "<span>⭐</span><b>FINAL</b>"; }
        else if (idx % 4 === 2) { d.classList.add("ch-star"); d.textContent = "⭐"; }
        else {
            const img = document.createElement("img");
            img.src = CH_CRESTS[crest++ % CH_CRESTS.length];
            img.alt = "Escudo";
            img.draggable = false;
            img.onerror = () => { d.textContent = "⭐"; };
            d.appendChild(img);
        }
        track.appendChild(d);
    });
}

function showParquesIntro() {
    const intro = $("parquesIntro");
    const wrap = $("parquesGameWrap");
    if (intro) intro.classList.remove("hidden");
    if (wrap) wrap.classList.add("hidden");
    buildChTrack();
    window.scrollTo(0, 0);
}

function startParquesMatch() {
    const intro = $("parquesIntro");
    const wrap = $("parquesGameWrap");
    if (intro) intro.classList.add("hidden");
    if (wrap) wrap.classList.remove("hidden");
    parquesNewGame();
    window.scrollTo(0, 0);
}

const playBtn = $("parquesPlay");
if (playBtn) playBtn.addEventListener("click", startParquesMatch);
const backIntroBtn = $("backMenuParquesIntro");
if (backIntroBtn) {
    backIntroBtn.addEventListener("click", () => {
        parquesScreen.classList.add("hidden");
        parquesScreen.style.display = "none";
        if (gameMenuSection) {
            gameMenuSection.classList.remove("hidden");
            gameMenuSection.style.display = "flex";
        }
        window.scrollTo(0, 0);
    });
}

parquesNewGame();
