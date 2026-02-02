// ============================================================
// GAME.JS COMPLET (corrigé + son + timeout/error + 1 seul DOMContentLoaded)
// - Charge /config.json (regles + mots FR)
// - Difficulté: easy -> medium -> hard -> easy (tourne à chaque mot)
// - Background dynamique (CSS --bg-image)
// - Timer 15s + timeout.mp3 à 0
// - Placement lettres + effacer + tap click
// - Validation auto quand complet + Enter + error.mp3 si faux
// - Musique + toggle son + unlock mobile
// ============================================================

// ------------------------------------------------------------
// ETAT GLOBAL
// ------------------------------------------------------------
window.gameState = window.gameState || {};
const gs = window.gameState;

// moi: valeurs par défaut
gs.soundEnabled = gs.soundEnabled ?? true;
gs.usedWords = Array.isArray(gs.usedWords) ? gs.usedWords : [];
gs.currentDifficulty = gs.currentDifficulty ?? "easy";
gs.currentWord = gs.currentWord ?? "";
gs.round = gs.round ?? 0;

// moi: timer
gs.timePerRound = gs.timePerRound ?? 15;
gs.timeLeft = gs.timeLeft ?? gs.timePerRound;
gs.timerId = gs.timerId ?? null;

// ------------------------------------------------------------
// JSON (/config.json)
// ------------------------------------------------------------
const gameData = {
  regles: {
    easy: { ptsWord: 8, bonusTemps: 1, tickets: 1 },
    medium: { ptsWord: 12, bonusTemps: 2, tickets: 2 },
    hard: { ptsWord: 18, bonusTemps: 3, tickets: 3 },
  },
  mots: { easy: [], medium: [], hard: [] },
};

async function loadGameJSON() {
  try {
    const res = await fetch("/config.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    // moi: règles
    if (data.regles) {
      gameData.regles.easy = data.regles.easy ?? gameData.regles.easy;
      gameData.regles.medium = data.regles.medium ?? gameData.regles.medium;
      gameData.regles.hard = data.regles.hard ?? gameData.regles.hard;
    }

    // moi: mots FR -> EN
    const mots = data.mots || {};
    gameData.mots.easy = Array.isArray(mots.facile) ? mots.facile : [];
    gameData.mots.medium = Array.isArray(mots.moyen) ? mots.moyen : [];
    gameData.mots.hard = Array.isArray(mots.difficile) ? mots.difficile : [];
  } catch (err) {
    console.error("Erreur chargement config.json:", err);

    // moi: fallback
    gameData.mots.easy = ["CHAT", "MER", "LUNE"];
    gameData.mots.medium = ["LICORNE", "CRISTAL"];
    gameData.mots.hard = ["ALCHIMIE"];
  }
}

// ------------------------------------------------------------
// DIFFICULTE (tourne à chaque nouveau mot)
// ------------------------------------------------------------
function updateDifficultyByRound() {
  const order = ["easy", "medium", "hard"];
  gs.currentDifficulty = order[(gs.round - 1) % order.length];
}

// ------------------------------------------------------------
// BACKGROUND dynamique (nécessite CSS --bg-image)
// ------------------------------------------------------------
function updateBackgroundByDifficulty() {
  const backgrounds = {
    easy: "/assets/images/backgroundeasy1.png",
    medium: "/assets/images/backgroundmedium1.png",
    hard: "/assets/images/backgroundhard1.png",
  };

  const image = backgrounds[gs.currentDifficulty] || backgrounds.easy;
  document.documentElement.style.setProperty("--bg-image", `url("${image}")`);

  // moi: texte difficulté
  const diffEl = document.querySelector(".niveau__texte");
  if (diffEl) {
    diffEl.textContent =
      gs.currentDifficulty === "hard"
        ? "Difficile"
        : gs.currentDifficulty === "medium"
        ? "Moyen"
        : "Facile";
  }
}

// ------------------------------------------------------------
// UTILS
// ------------------------------------------------------------
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomWord(diff) {
  const list = gameData.mots[diff] || [];
  if (!list.length) return "ERREUR";

  // moi: j'évite les répétitions
  let available = list.filter((w) => !gs.usedWords.includes(w));
  if (!available.length) {
    gs.usedWords = [];
    available = list.slice();
  }

  const word = available[Math.floor(Math.random() * available.length)];
  gs.usedWords.push(word);
  return String(word).toUpperCase();
}

// ------------------------------------------------------------
// RENDER mot (slots + tuiles)
// ------------------------------------------------------------
function renderWord(word) {
  const tilesWrap = document.querySelector(".tuiles");
  const answerLine = document.querySelector(".reponse__ligne");
  if (!tilesWrap || !answerLine) return;

  answerLine.innerHTML = "";
  tilesWrap.innerHTML = "";

  // moi: slots
  for (let i = 0; i < word.length; i++) {
    const slot = document.createElement("span");
    slot.className = "reponse__lettre";
    slot.textContent = "_";
    answerLine.appendChild(slot);
  }

  // moi: tuiles mélangées
  const letters = shuffleArray(word.split(""));
  const stamp = Date.now();

  letters.forEach((ch, i) => {
    const tile = document.createElement("div");
    tile.className = "tuile";
    tile.dataset.tileId = `tile-${stamp}-${i}`;
    tile.innerHTML = `<span class="tuile__lettre">${ch}</span>`;
    tilesWrap.appendChild(tile);
  });

  document.dispatchEvent(new CustomEvent("word:rendered"));
}

// ------------------------------------------------------------
// TOAST
// ------------------------------------------------------------
function toast(message, type = "info") {
  const el = document.createElement("div");
  el.textContent = message;
  document.body.appendChild(el);

  Object.assign(el.style, {
    position: "fixed",
    left: "50%",
    bottom: "20px",
    transform: "translateX(-50%)",
    padding: "10px 14px",
    borderRadius: "10px",
    zIndex: 9999,
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
    color: "#fff",
    background:
      type === "error"
        ? "rgba(255,80,80,0.92)"
        : type === "success"
        ? "rgba(70,200,120,0.92)"
        : "rgba(0,0,0,0.75)",
    maxWidth: "92vw",
    textAlign: "center",
    pointerEvents: "none",
  });

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 250ms";
    setTimeout(() => el.remove(), 260);
  }, 1400);
}

// ------------------------------------------------------------
// TIMER
// ------------------------------------------------------------
function stopTimer() {
  if (gs.timerId) clearInterval(gs.timerId);
  gs.timerId = null;
}

function renderTimer() {
  const txt = document.querySelector(".minuteur__texte");
  const prog = document.querySelector(".minuteur__progression");
  const bar = document.querySelector(".minuteur__barre");

  const t = Math.max(0, gs.timeLeft);
  if (txt) txt.textContent = `${Math.ceil(t)} sec`;

  const pct = (t / gs.timePerRound) * 100;
  if (prog) prog.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (bar) bar.setAttribute("aria-valuenow", String(Math.round(pct)));
}

function startTimer(onTimeUp) {
  stopTimer();
  gs.timeLeft = gs.timePerRound;
  renderTimer();

  gs.timerId = setInterval(() => {
    gs.timeLeft = Math.max(0, gs.timeLeft - 0.1);
    renderTimer();

    if (gs.timeLeft <= 0) {
      stopTimer();
      if (typeof onTimeUp === "function") onTimeUp();
    }
  }, 100);
}

function timeUp() {
  playSound("timeout"); // moi: son fin 15s
  toast(`⏳ Temps écoulé ! Réponse : ${gs.currentWord}`, "error");
  setTimeout(() => startNewRound(), 600);
}

// ------------------------------------------------------------
// ✅ VALIDATION
// ------------------------------------------------------------
function getSubmittedWord() {
  const slots = Array.from(
    document.querySelectorAll(".reponse__ligne .reponse__lettre")
  );
  return slots
    .map((s) => (s.textContent || "").trim())
    .filter((ch) => ch && ch !== "_")
    .join("")
    .toUpperCase();
}

function isAnswerComplete() {
  const slots = Array.from(
    document.querySelectorAll(".reponse__ligne .reponse__lettre")
  );
  return (
    slots.length > 0 &&
    slots.every((s) => (s.textContent || "").trim() !== "_")
  );
}

function validateAnswer() {
  if (!isAnswerComplete()) {
    playSound("error");
    toast("Remplis toutes les cases 😅", "error");
    return;
  }

  stopTimer();

  const submitted = getSubmittedWord();
  const expected = String(gs.currentWord || "").toUpperCase();

  if (submitted === expected) {
    toast("✅ Bien joué !", "success");
  } else {
    playSound("error");
    toast(`❌ Faux ! C'était : ${expected}`, "error");
  }

  setTimeout(() => startNewRound(), 700);
}

// Enter pour valider
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") validateAnswer();
});

// ------------------------------------------------------------
// PLACEMENT LETTRES + EFFACER
// ------------------------------------------------------------
(function placementDesLettres() {
  const tilesWrap = document.querySelector(".tuiles");
  const answerLine = document.querySelector(".reponse__ligne");
  const clearBtn = document.querySelector('[aria-label="Effacer"]');

  if (!tilesWrap || !answerLine) return;

  const slots = [];
  const refreshSlots = () => {
    slots.length = 0;
    slots.push(...Array.from(answerLine.querySelectorAll(".reponse__lettre")));
  };

  const isSlotEmptyLocal = (slot) => {
    const value = (slot.textContent || "").trim();
    return value === "_" || value === "";
  };

  const findFirstEmptySlot = () => slots.find(isSlotEmptyLocal);

  const setTileUsed = (tile, used) => {
    tile.classList.toggle("tuile--inactive", used);
    tile.style.pointerEvents = used ? "none" : "";
    tile.setAttribute("aria-disabled", used ? "true" : "false");
  };

  const getTileLetter = (tile) => {
    const letterEl = tile.querySelector(".tuile__lettre");
    return (letterEl ? letterEl.textContent : tile.textContent).trim();
  };

  const placeTileIntoSlot = (tile, slot) => {
    if (!tile || !slot || !isSlotEmptyLocal(slot)) return;

    const letter = getTileLetter(tile);
    if (!letter) return;

    slot.textContent = letter;
    slot.classList.add("reponse__lettre--pleine");
    slot.dataset.tileId = tile.dataset.tileId;

    setTileUsed(tile, true);

    // moi: auto validation quand c'est complet
    if (isAnswerComplete()) {
      setTimeout(validateAnswer, 120);
    }
  };

  const clearSlot = (slot) => {
    if (!slot || isSlotEmptyLocal(slot)) return;

    const tileId = slot.dataset.tileId;
    if (tileId) {
      const tile = tilesWrap.querySelector(
        `.tuile[data-tile-id="${CSS.escape(tileId)}"]`
      );
      if (tile) setTileUsed(tile, false);
    }

    slot.textContent = "_";
    slot.classList.remove("reponse__lettre--pleine");
    delete slot.dataset.tileId;
  };

  const clearAllSlots = () => slots.forEach(clearSlot);

  refreshSlots();
  document.addEventListener("word:rendered", refreshSlots);

  // clic tuile -> place
  tilesWrap.addEventListener("click", (e) => {
    const tile = e.target.closest(".tuile");
    if (!tile) return;

    const slot = findFirstEmptySlot();
    if (!slot) return;

    playSound("click");
    placeTileIntoSlot(tile, slot);
  });

  // clic slot -> retire
  answerLine.addEventListener("click", (e) => {
    const slot = e.target.closest(".reponse__lettre");
    if (!slot || isSlotEmptyLocal(slot)) return;
    playSound("click");
    clearSlot(slot);
  });

  // effacer -> vide
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      playSound("click");
      clearAllSlots();
    });
  }
})();

// ------------------------------------------------------------
// NOUVELLE MANCHE
// ------------------------------------------------------------
function startNewRound() {
  gs.round += 1;

  updateDifficultyByRound();
  updateBackgroundByDifficulty();

  const word = pickRandomWord(gs.currentDifficulty);
  gs.currentWord = word;

  renderWord(word);
  startTimer(timeUp);
}

// ============================================================
// 🔊 SON COMPLET (musique + toggle + timeout/error + tap)
// ============================================================

// musique
const bgMusic = { audio: null, inited: false };

function initBackgroundMusic() {
  if (bgMusic.inited) return;
  bgMusic.inited = true;

  const a = new Audio("/assets/sounds/musique.mp3");
  a.loop = true;
  a.preload = "auto";
  a.volume = 0.4;
  bgMusic.audio = a;
}

function playBackgroundMusic() {
  if (!bgMusic.audio) initBackgroundMusic();
  if (!gs.soundEnabled) return;
  bgMusic.audio.play().catch(() => {});
}

function pauseBackgroundMusic() {
  if (!bgMusic.audio) return;
  bgMusic.audio.pause();
}

// effets mp3
const soundEffects = {
  timeout: new Audio("/assets/sounds/timeout.mp3"),
  error: new Audio("/assets/sounds/error.mp3"),
};

Object.values(soundEffects).forEach((a) => {
  a.preload = "auto";
  a.volume = 0.6;
});

// tap webaudio
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playTap(ctx) {
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.13);

  const noiseDur = 0.03;
  const buffer = ctx.createBuffer(
    1,
    Math.floor(ctx.sampleRate * noiseDur),
    ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(1200, now);

  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.0001, now);
  nGain.gain.exponentialRampToValueAtTime(0.09, now + 0.002);
  nGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDur);

  noise.connect(hp);
  hp.connect(nGain);
  nGain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + noiseDur);
}

function playSound(name) {
  if (!gs.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    if (name === "click") playTap(ctx);

    if (soundEffects[name]) {
      soundEffects[name].currentTime = 0;
      soundEffects[name].play().catch(() => {});
    }
  } catch (e) {
    console.error("Erreur audio:", e);
  }
}

// toggle bouton
function updateSoundButtonUI() {
  const btn = document.querySelector(".actions__btn--sound");
  if (!btn) return;

  const icon = btn.querySelector("i");
  const enabled = !!gs.soundEnabled;

  btn.classList.toggle("is-muted", !enabled);
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  btn.setAttribute("aria-label", enabled ? "Son activé" : "Son coupé");

  if (icon) {
    icon.className = enabled
      ? "fa-solid fa-volume-high"
      : "fa-solid fa-volume-xmark";
  }
}

function setSoundEnabled(enabled) {
  gs.soundEnabled = !!enabled;
  if (gs.soundEnabled) playBackgroundMusic();
  else pauseBackgroundMusic();
  updateSoundButtonUI();
}

function toggleSound() {
  setSoundEnabled(!gs.soundEnabled);
}

// unlock mobile
function setupAudioUnlock() {
  const unlock = () => {
    initBackgroundMusic();
    if (gs.soundEnabled) playBackgroundMusic();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };

  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

// ------------------------------------------------------------
// BOOT (UN SEUL)
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  // moi: j'init le son d'abord
  initBackgroundMusic();
  setupAudioUnlock();
  updateSoundButtonUI();

  const soundBtn = document.querySelector(".actions__btn--sound");
  if (soundBtn) {
    soundBtn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleSound();
    });
  }

  // moi: je charge le json puis je démarre le jeu
  await loadGameJSON();
  updateBackgroundByDifficulty();
  startNewRound();

  // moi: si son ON, je tente la musique (sera débloquée au 1er tap)
  if (gs.soundEnabled) playBackgroundMusic();
});
