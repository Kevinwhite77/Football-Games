// ================================
// FOOTBALL CHALLENGE
// ================================

// Cliente Convex para guardar ranking global (opcional: el juego funciona igual sin él).
// Se carga con import dinámico para que la página NO se quede bloqueada en la
// pantalla de carga si el paquete no se puede resolver (p. ej. abriendo
// index.html con Live Server en vez de con Vite).
function getConvexUrl() {
    try {
        return globalThis.__CONVEX_URL__
            || (typeof import.meta !== "undefined" && import.meta.env?.VITE_CONVEX_URL)
            || null;
    } catch (e) {
        return null;
    }
}

let convexCache = undefined; // undefined = aún no intentado, null = no disponible
function loadConvex() {
    if (convexCache !== undefined) return convexCache;
    const url = getConvexUrl();
    if (!url) {
        convexCache = Promise.resolve(null);
        return convexCache;
    }
    convexCache = Promise.all([import("convex/browser"), import("convex/server")])
        .then(([{ ConvexHttpClient }, { anyApi }]) => ({
            client: new ConvexHttpClient(url),
            api: anyApi,
        }))
        .catch((e) => {
            console.warn("Ranking global no disponible:", e);
            return null;
        });
    return convexCache;
}

async function saveScoreGlobal({ game, timeSec, moves }) {
    try {
        const convex = await loadConvex();
        if (!convex) return;
        await convex.client.mutation(convex.api.scores.saveScore, {
            player: getPlayer(),
            game,
            timeSec,
            moves,
        });
    } catch (e) {
        console.warn("No se pudo guardar en el ranking:", e);
    }
}

// Pantallas
const loading = document.getElementById("loading-screen");
const menu = document.getElementById("menu");
const gameMenu = document.getElementById("gameMenu");
const memoryScreen = document.getElementById("memoryScreen");
const rankingScreen = document.getElementById("rankingScreen");
const modal = document.getElementById("modal");

// Carga
const bar = document.getElementById("progress-bar");
const percent = document.getElementById("percent");
const text = document.getElementById("loading-text");

// Menú
const startBtn = document.getElementById("startBtn");
const playerName = document.getElementById("playerName");
const welcomePlayer = document.getElementById("welcomePlayer");
const changePlayer = document.getElementById("changePlayer");
const bestRecords = document.getElementById("bestRecords");

// Memory
const memoryGame = document.getElementById("memoryGame");
const playerMemory = document.getElementById("playerMemory");
const backMenu = document.getElementById("backMenu");
const restartMemory = document.getElementById("restartMemory");
const board = document.getElementById("board");
const memoryTimeEl = document.getElementById("memoryTime");
const memoryMovesEl = document.getElementById("memoryMoves");
const memoryPairsEl = document.getElementById("memoryPairs");

// Modal
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const modalRecord = document.getElementById("modalRecord");
const modalBtn = document.getElementById("modalBtn");

// ================================
// SONIDOS (Web Audio API, sin archivos)
// ================================
let audioCtx = null;
function beep(freq, duration = 0.15, type = "sine") {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* sin audio, no pasa nada */ }
}
const sndClick = () => beep(500, 0.1, "square");
const sndFlip = () => beep(400, 0.1);
const sndMatch = () => { beep(660, 0.12); setTimeout(() => beep(880, 0.15), 120); };
const sndWin = () => { beep(523, 0.15); setTimeout(() => beep(659, 0.15), 150); setTimeout(() => beep(784, 0.25), 300); };
const sndFail = () => beep(200, 0.25, "sawtooth");

// ================================
// UTILIDADES
// ================================
function showScreen(el) {
    [loading, menu, gameMenu, memoryScreen, rankingScreen, document.getElementById("parquesScreen")].forEach(s => {
        if (!s) return;
        s.classList.add("hidden");
        s.style.display = "none";
    });
    el.classList.remove("hidden");
    el.style.display = "flex";
    window.scrollTo(0, 0);
}

function getPlayer() {
    return localStorage.getItem("jugador") || "Jugador";
}

function updateRecords() {
    const bestTime = localStorage.getItem("bestTime");
    const bestMoves = localStorage.getItem("bestMoves");
    let html = "";
    if (bestTime) html += `🏆 Mejor memoria: ${bestTime} (${bestMoves} movs)`;
    if (bestRecords) bestRecords.innerHTML = html;
}

// ================================
// PANTALLA DE CARGA
// ================================
const messages = [
    "Inicializando...",
    "Cargando estadio...",
    "Preparando jugadores...",
    "Configurando desafíos...",
    "¡Todo listo!"
];

let value = 0;
const load = setInterval(() => {
    value++;
    bar.style.width = value + "%";
    percent.textContent = value + "%";
    if (value == 20) text.textContent = messages[1];
    if (value == 45) text.textContent = messages[2];
    if (value == 70) text.textContent = messages[3];
    if (value == 95) text.textContent = messages[4];
    if (value >= 100) {
        clearInterval(load);
        setTimeout(() => {
            updateRecords();
            showScreen(menu);
            playerName.focus();
        }, 500);
    }
}, 40);

// ================================
// BOTÓN COMENZAR / CAMBIAR JUGADOR
// ================================
function startGame() {
    const nombre = playerName.value.trim();
    if (nombre === "") {
        alert("Por favor escribe tu nombre.");
        return;
    }
    sndClick();
    localStorage.setItem("jugador", nombre);
    welcomePlayer.textContent = `Bienvenido, ${nombre} 👋`;
    showScreen(gameMenu);
}

startBtn.addEventListener("click", startGame);
playerName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
});

changePlayer.addEventListener("click", () => {
    sndClick();
    showScreen(menu);
    playerName.value = "";
    playerName.focus();
});

// ================================
// BUSCAR LA PAREJA 🧠
// ================================
// Equipos de la Champions League 2025/26 (8 mejores)
const TEAMS = [
    { name: "Real Madrid", img: "img/escudos/real-madrid.png" },
    { name: "Barcelona", img: "img/escudos/barcelona.png" },
    { name: "Man. City", img: "img/escudos/man-city.png" },
    { name: "Bayern", img: "img/escudos/bayern.png" },
    { name: "PSG", img: "img/escudos/psg.png" },
    { name: "Liverpool", img: "img/escudos/liverpool.png" },
    { name: "Arsenal", img: "img/escudos/arsenal.png" },
    { name: "Inter", img: "img/escudos/inter.png" }
];

let firstCard = null;
let lockBoard = false;
let moves = 0;
let pairsFound = 0;
let timerSec = 0;
let timerInterval = null;
let timerStarted = false;

function formatTime(s) {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
}

function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    timerInterval = setInterval(() => {
        timerSec++;
        memoryTimeEl.textContent = formatTime(timerSec);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function initMemory() {
    // Reset
    board.innerHTML = "";
    firstCard = null;
    lockBoard = false;
    moves = 0;
    pairsFound = 0;
    timerSec = 0;
    timerStarted = false;
    stopTimer();
    memoryTimeEl.textContent = "00:00";
    memoryMovesEl.textContent = "0";
    memoryPairsEl.textContent = "0/8";
    playerMemory.textContent = "👤 Jugador: " + getPlayer();

    // Crear y mezclar cartas (8 parejas de escudos)
    const deck = [...TEAMS, ...TEAMS].sort(() => Math.random() - 0.5);

    deck.forEach(team => {
        const card = document.createElement("div");
        card.className = "card-memory";
        card.dataset.team = team.name;
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-front">⚽</div>
                <div class="card-face card-back"><img src="${team.img}" alt="Escudo" draggable="false"></div>
            </div>`;
        card.addEventListener("click", () => flipCard(card));
        board.appendChild(card);
    });
}

function flipCard(card) {
    if (lockBoard) return;
    if (card === firstCard) return;
    if (card.classList.contains("flipped")) return;

    startTimer();
    sndFlip();
    card.classList.add("flipped");

    if (!firstCard) {
        firstCard = card;
        return;
    }

    // Segundo clic → contar movimiento
    moves++;
    memoryMovesEl.textContent = moves;

    const isMatch = firstCard.dataset.team === card.dataset.team;

    if (isMatch) {
        sndMatch();
        firstCard.classList.add("matched");
        card.classList.add("matched");
        firstCard = null;
        pairsFound++;
        memoryPairsEl.textContent = `${pairsFound}/8`;

        if (pairsFound === 8) {
            stopTimer();
            setTimeout(winMemory, 600);
        }
    } else {
        lockBoard = true;
        const c1 = firstCard;
        const c2 = card;
        firstCard = null;
        setTimeout(() => {
            c1.classList.remove("flipped");
            c2.classList.remove("flipped");
            lockBoard = false;
        }, 800);
    }
}

function winMemory() {
    sndWin();
    const timeStr = formatTime(timerSec);

    // Guardar récord local + ranking global en Convex
    saveScoreGlobal({ game: "memory", timeSec: timerSec, moves });

    // Guardar récord
    const prevMoves = parseInt(localStorage.getItem("bestMoves") || "9999");
    let isRecord = false;
    if (moves < prevMoves) {
        localStorage.setItem("bestMoves", moves);
        localStorage.setItem("bestTime", timeStr);
        isRecord = true;
    }

    modalTitle.textContent = "🏆 ¡Felicidades!";
    modalText.innerHTML = `${getPlayer()}, completaste el juego en <b>${timeStr}</b> con <b>${moves} movimientos</b>.`;
    modalRecord.textContent = isRecord ? "✨ ¡Nuevo récord! ✨" : "";
    modal.classList.remove("hidden");
}

memoryGame.addEventListener("click", () => {
    sndClick();
    showScreen(memoryScreen);
    initMemory();
});

restartMemory.addEventListener("click", () => {
    sndClick();
    initMemory();
});

backMenu.addEventListener("click", () => {
    sndClick();
    stopTimer();
    showScreen(gameMenu);
});

// ================================
// MODAL
// ================================
modalBtn.addEventListener("click", () => {
    sndClick();
    modal.classList.add("hidden");
    updateRecords();
    showScreen(gameMenu);
});

// ================================
// RANKING GLOBAL (React + Convex)
// ================================
const showRankingBtn = document.getElementById("showRanking");
const backMenuRanking = document.getElementById("backMenuRanking");
if (showRankingBtn) {
    showRankingBtn.addEventListener("click", () => {
        sndClick();
        showScreen(rankingScreen);
    });
}
if (backMenuRanking) {
    backMenuRanking.addEventListener("click", () => {
        sndClick();
        showScreen(gameMenu);
    });
}
