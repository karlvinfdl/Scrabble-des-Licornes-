// ============================================================
// ============================
// GESTION AUDIO
// ============================
// ============================================================

// Contexte audio global (Web Audio API)
// Il est créé une seule fois puis réutilisé
let audioContext = null;

/**
 * Récupère ou crée le AudioContext
 * (obligatoire pour jouer des sons avec Web Audio API)
 */
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Joue un son selon son nom
 * Respecte le toggle son (soundEnabled)
 */
function playSound(soundName) {
  // Si le jeu existe et que le son est désactivé → on ne joue rien
  if (typeof gameState !== "undefined" && !gameState.soundEnabled) return;

  try {
    const ctx = getAudioContext();

    // Certains navigateurs bloquent l’audio tant qu’il n’y a pas d’interaction
    if (ctx.state === "suspended") ctx.resume();

    // Pour l’instant, un seul son géré : "click"
    if (soundName === "click") playTap(ctx);

  } catch (error) {
    console.error("Erreur audio:", error);
  }
}

/**
 * Utilitaire générique pour jouer un ton
 * (conservé même si pas utilisé directement ici)
 */
function playTone(ctx, frequency, duration, type = "sine", volume = 0.2) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

/**
 * Son "tap" : impression de tuile posée
 * → mélange d’un son grave + petit bruit sec
 */
function playTap(ctx) {
  const now = ctx.currentTime;

  // -----------------------
  // 1) Son grave ("thump")
  // -----------------------
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

  // -----------------------
  // 2) Petit bruit "click"
  // -----------------------
  const noiseDur = 0.03;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noiseDur), ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Bruit blanc aléatoire
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

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

// ============================================================
// ============================
// PLACEMENT DES LETTRES + BOUTON EFFACER
// ============================
// ============================================================

(function placementDesLettres() {

  // Conteneur des tuiles (lettres disponibles)
  const tilesWrap = document.querySelector(".tuiles");

  // Ligne contenant les emplacements de réponse
  const answerLine = document.querySelector(".reponse__ligne");

  // Bouton "Effacer"
  const clearBtn = document.querySelector('[aria-label="Effacer"]');

  // Sécurité : si les éléments n’existent pas, on arrête
  if (!tilesWrap || !answerLine) return;

  // Liste des emplacements (_ _ _ _ _)
  const slots = Array.from(answerLine.querySelectorAll(".reponse__lettre"));

  /**
   * Donne un identifiant unique à chaque tuile
   * Utile pour savoir quelle tuile correspond à quel slot
   */
  const ensureTileIds = () => {
    const tiles = Array.from(tilesWrap.querySelectorAll(".tuile"));
    tiles.forEach((tile, i) => {
      if (!tile.dataset.tileId) {
        tile.dataset.tileId = `tile-${Date.now()}-${i}`;
      }
    });
  };

  /**
   * Vérifie si un slot est vide
   */
  const isSlotEmpty = (slot) => {
    const value = (slot.textContent || "").trim();
    return value === "_" || value === "";
  };

  /**
   * Trouve le premier slot vide
   */
  const findFirstEmptySlot = () => slots.find(isSlotEmpty);

  /**
   * Active ou désactive une tuile
   */
  const setTileUsed = (tile, used) => {
    tile.classList.toggle("tuile--inactive", used);
    tile.style.pointerEvents = used ? "none" : "";
    tile.setAttribute("aria-disabled", used ? "true" : "false");
  };

  /**
   * Récupère la lettre d’une tuile
   */
  const getTileLetter = (tile) => {
    const letterEl = tile.querySelector(".tuile__lettre");
    return (letterEl ? letterEl.textContent : tile.textContent).trim();
  };

  /**
   * Place une tuile dans un slot
   */
  const placeTileIntoSlot = (tile, slot) => {
    if (!tile || !slot || !isSlotEmpty(slot)) return;

    const letter = getTileLetter(tile);
    if (!letter) return;

    slot.textContent = letter;
    slot.classList.add("reponse__lettre--pleine");
    slot.dataset.tileId = tile.dataset.tileId;

    setTileUsed(tile, true);
  };

  /**
   * Vide un slot précis
   */
  const clearSlot = (slot) => {
    if (!slot || isSlotEmpty(slot)) return;

    const tileId = slot.dataset.tileId;

    // Réactiver la tuile associée
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

  /**
   * Efface TOUT le mot
   */
  const clearAllSlots = () => {
    slots.forEach(clearSlot);
  };

  // ============================
  // INITIALISATION
  // ============================
  ensureTileIds();

  // ============================
  // INTERACTIONS
  // ============================

  // Clic sur une tuile → placer la lettre
  tilesWrap.addEventListener("click", (e) => {
    const tile = e.target.closest(".tuile");
    if (!tile) return;

    const slot = findFirstEmptySlot();
    if (!slot) return;

    playSound("click");
    placeTileIntoSlot(tile, slot);
  });

  // Clic sur un slot rempli → retirer la lettre
  answerLine.addEventListener("click", (e) => {
    const slot = e.target.closest(".reponse__lettre");
    if (!slot || isSlotEmpty(slot)) return;

    clearSlot(slot);
  });

  // 🗑️ Bouton "Effacer" → vider tout le mot
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      playSound("click");
      clearAllSlots();
    });
  }

})();


