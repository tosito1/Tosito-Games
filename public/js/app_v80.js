// alert("DEBUG: app_v80.js v9.1.0 Loading..."); // Enable if still nothing happens
window.addEventListener('error', function (e) {
  alert("GLOBAL ERROR: " + e.message + " at " + e.filename + ":" + e.lineno);
});

// ---- Firebase Config ----
const firebaseConfig = {
  apiKey: "AIzaSyC1nq0H-TEep-ncVM-pV7NMiEHSdae94iw",
  authDomain: "tosito-chest.firebaseapp.com",
  projectId: "tosito-chest",
  storageBucket: "tosito-chest.firebasestorage.app",
  messagingSenderId: "645438147659",
  appId: "1:645438147659:web:658dda24a3ee3f401f11ce",
  measurementId: "G-9H38YSKSY4"
};

try {
  if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
} catch (e) {
  alert("FIREBASE INIT ERROR: " + e.message);
}

const auth = firebase.auth();
const db = firebase.firestore();
console.log("!!! VERSION V8.1 (Debug Restoration) !!!");


// ---- GSAP Init (Safety first) ----
try {
  gsap.registerPlugin(Flip);
  // CustomEase and ScrollTrigger are secondary and might fail from CDNs
} catch (e) {
  console.warn("[⚠️] GSAP Plugins failed to register, basic animations will scale:", e);
}
const GSAP_CONFIG = { duration: 0.6, ease: "power3.out" };

// ---- Safety Helpers (Prevents crashing if IDs are missing) ----
const getEl = (id) => document.getElementById(id) || {
  style: {},
  classList: { add: () => { }, remove: () => { }, toggle: () => { }, contains: () => false },
  appendChild: () => { },
  setAttribute: () => { },
  removeAttribute: () => { },
  textContent: '', innerHTML: '', value: '', src: '', disabled: false,
  _isMock: true
};
const isRealEl = (el) => el && el.nodeType && !el._isMock;
const safeGet = (id) => document.getElementById(id); // Native fallback for criticals
const safeSetText = (id, text) => { const el = getEl(id); if (isRealEl(el)) el.textContent = text; };
const safeSetHTML = (id, html) => { const el = getEl(id); if (isRealEl(el)) el.innerHTML = html; };
const safeSetSrc = (id, src) => { const el = getEl(id); if (isRealEl(el)) el.src = src; };
const safeToggleDisplay = (id, displayStyle) => { const el = getEl(id); if (isRealEl(el)) el.style.display = displayStyle; };

// ============================================================
//  API & FETCH HELPERS
// ============================================================
async function safeFetchJson(url, options = {}) {
  try {
    let targetUrl = url;
    const host = window.location.hostname;
    const protocol = window.location.protocol;

    // Environment detection
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const isLocalIP = host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    const isProd = host.includes('web.app') || host.includes('firebaseapp.com') || host.includes('.com');

    const isLocalEnv = isLocalhost || isLocalIP;

    // API Routing Logic:
    // 1. If we are on Production, we MUST use the Remote Backend (Cloud)
    if (url.startsWith('/api/') && (isProd || !isLocalEnv)) {
      if (remoteBackendUrl) {
        const base = remoteBackendUrl.endsWith('/') ? remoteBackendUrl.slice(0, -1) : remoteBackendUrl;
        targetUrl = base + url;
      }
    }
    // 2. If we are on Localhost or Local IP, we try Port 5001
    else if (url.startsWith('/api/') && isLocalEnv) {
      targetUrl = `${protocol}//${host}:5001${url}`;
    }

    const fetchOptions = {
      ...options,
      headers: {
        ...(options.headers || {}),
        'ngrok-skip-browser-warning': 'true'
      }
    };

    const res = await fetch(targetUrl, fetchOptions);
    const text = await res.text();

    // Safety check for HTML responses (usually 404s or landing pages)
    if (text.trim().startsWith('<!DOCTYPE')) {
      if (url.includes('api/')) return { success: false, error: 'BACKEND_MISSING' };
    }
    return JSON.parse(text);
  } catch (e) {
    console.error(`Fetch error ${url}:`, e);
    return { success: false, error: e.message };
  }
}

// ============================================================
//  STATE
// ============================================================
let currentUser = null;
let userProfile = {
  elo: 1200, wins: 0, losses: 0, username: '', displayName: '', isAdmin: false, friends: [], solved_puzzles: [], arcade_records: {}
};
let remoteBackendUrl = localStorage.getItem('tosito_manual_backend') || null;
let isManualBackend = !!localStorage.getItem('tosito_manual_backend');
let aiLevel = 'level_3';

async function loadUserProfile() {
  if (!currentUser) return;
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
      const d = doc.data();
      userProfile = {
        elo: d.elo || 1200,
        wins: d.wins || 0,
        losses: d.losses || 0,
        username: d.username || '',
        displayName: d.displayName || '',
        isAdmin: d.role === 'admin',
        friends: d.friends || [],
        solved_puzzles: d.solved_puzzles || [],
        arcade_records: d.arcade_records || {}
      };
    } else {
      const initialData = { elo: 1200, wins: 0, losses: 0, username: '', role: 'player', friends: [], solved_puzzles: [], uid: currentUser.uid };
      await db.collection('users').doc(currentUser.uid).set(initialData);
      userProfile = { ...initialData, isAdmin: false };
    }
    await checkLegacyMigration();
    updateLobbyUI();
  } catch (e) { console.error("Error loading profile:", e); }
}



async function checkLegacyMigration() {
  if (!currentUser) return;
  console.log("[📦] Checking for legacy arcade data migration...");
  const stackBest = parseInt(localStorage.getItem('tosito_stack_best') || 0);
  if (stackBest > 0) {
    console.log("[📦] Migrating legacy Cyber Stack score:", stackBest);
    if (window.saveArcadeScore) await window.saveArcadeScore('stack', stackBest);
    localStorage.removeItem('tosito_stack_best'); // Once synced, we can move on
  }
}

function updateLobbyUI() {
  const name = userProfile.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Jugador';

  // Lobby/Hub info
  safeSetText('lobby-sub', `Hola, ${name} · ELO ${userProfile.elo}`);
  safeSetText('hub-header-username', name);

  // Profile Dashboard Hydration
  safeSetText('profile-name', name);
  safeSetText('profile-email', currentUser?.email || '');
  safeSetText('profile-user-display', userProfile.username ? `@${userProfile.username}` : 'Sin @usuario');

  // Chess Card
  safeSetText('prof-elo', userProfile.elo);
  safeSetText('prof-wins', userProfile.wins);
  safeSetText('prof-losses', userProfile.losses);

  // Arcade Records (Retrieving from Firestore)
  const arcade = userProfile.arcade_records || {};
  safeSetText('prof-stack-best', `${arcade.stack || 0}m`);

  // Rank & XP Calculation Logic (Integrated with Arcade)
  const totalSolved = (userProfile.solved_puzzles || []).length;
  // Calculate total points including arcade bonus
  const arcadeBonus = Object.values(arcade).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) / 10;
  const xpValue = Math.max(0, (userProfile.elo - 800)) + (userProfile.wins * 30) + (totalSolved * 20) + Math.floor(arcadeBonus);

  safeSetText('prof-total-xp', xpValue);

  let rankCur = "BRONCE I";
  let rankNext = "PLATA II";
  let progress = 0;

  if (xpValue > 8000) { rankCur = "DIAMANTE IV"; rankNext = "MÁXIMO"; progress = 100; }
  else if (xpValue > 4000) { rankCur = "PLATINO V"; rankNext = "DIAMANTE IV"; progress = ((xpValue - 4000) * 100) / 4000; }
  else if (xpValue > 1800) { rankCur = "ORO III"; rankNext = "PLATINO V"; progress = ((xpValue - 1800) * 100) / 2200; }
  else if (xpValue > 600) { rankCur = "PLATA II"; rankNext = "ORO III"; progress = ((xpValue - 600) * 100) / 1200; }
  else { rankCur = "BRONCE I"; rankNext = "PLATA II"; progress = (xpValue * 100) / 600; }

  safeSetText('prof-xp-rank-cur', rankCur);
  safeSetText('prof-xp-rank-next', rankNext);
  safeSetText('prof-global-rank', `Rango Global: ${rankCur}`);

  const fill = document.getElementById('prof-xp-fill');
  if (fill) fill.style.width = `${Math.min(100, progress)}%`;

  // Favorite Game Detection
  let favorite = "Ajedrez";
  if ((arcade.stack || 0) > 50) favorite = "Cyber Stack";
  if ((arcade.anomalia || 0) > 5000) favorite = "Anomalía";
  if ((arcade.turbo || 0) > 1000) favorite = "Neon Drifter";
  if (totalSolved > 30) favorite = "Puzzles";
  safeSetText('prof-fav-game', favorite);

  // Badge Unlocks
  const badges = {
    'badge-first-win': userProfile.wins > 0,
    'badge-arcade-pro': (arcade.stack > 100 || arcade.anomalia > 10000 || arcade.turbo > 2000),
    'badge-puzzle-king': totalSolved > 15,
    'badge-social': (userProfile.friends || []).length > 0
  };
  Object.keys(badges).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (badges[id]) el.classList.add('unlocked');
      else el.classList.remove('unlocked');
    }
  });

  if (currentUser?.photoURL) {
    safeSetSrc('profile-avatar', currentUser.photoURL);
    safeToggleDisplay('profile-avatar', '');
    safeToggleDisplay('profile-avatar-ph', 'none');
  }

  updateBackendStatusUI();
  renderLevelButtons();
}

window.saveArcadeScore = async function (gameId, score) {
  if (!currentUser) return;
  console.log(`[Firebase] Checking record for ${gameId}: ${score}`);
  if (!userProfile.arcade_records) userProfile.arcade_records = {};
  const arcade = userProfile.arcade_records;
  const oldBest = arcade[gameId] || 0;

  if (score > oldBest) {
    arcade[gameId] = score;
    try {
      await db.collection('users').doc(currentUser.uid).set({
        arcade_records: arcade
      }, { merge: true });
      updateLobbyUI();
      if (typeof toast === 'function') toast(`¡Nuevo récord en ${gameId}! 🏆`);
    } catch (e) { console.error("Error saving score:", e); }
  }
};


// ============================================================
//  INIT & AUTH LIFECYCLE
// ============================================================
let isAppReady = false;

function hideAppLoader() {
  const loader = document.getElementById('app-loader');
  if (!loader) return;
  isAppReady = true;
  loader.style.display = 'none';
  console.log("[🚀] App Revealed");
}

// Global Safety Timer: Remove loader after 12s no matter what
setTimeout(() => { if (!isAppReady) hideAppLoader(); }, 12000);

auth.onAuthStateChanged(async user => {
  try {
    const authWall = document.getElementById('auth-wall');
    const appContainer = document.getElementById('app-container');
    const nav = document.getElementById('bottom-nav');

    if (user) {
      currentUser = user;

      // BOMB-PROOF REVEAL: Forget animations, just show it.
      if (authWall) authWall.style.display = 'none';
      if (appContainer) {
        appContainer.style.display = 'block';
        appContainer.style.opacity = '1';
        appContainer.classList.remove('is-hidden');
      }
      if (nav) nav.classList.remove('hidden');

      hideAppLoader();

      await loadUserProfile();
      updateLobbyUI();
      syncRemoteBackend();

      showScreen('hub');

      // Module Inits
      if (window.checkRemoteMode) checkRemoteMode();
    } else {
      // Show Auth login screen
      if (appContainer) appContainer.style.display = 'none';
      if (authWall) {
        authWall.style.display = 'flex';
        authWall.style.opacity = '1';
      }
      if (nav) nav.classList.add('hidden');
      hideAppLoader();
    }
  } catch (e) {
    console.error("FATAL INIT ERROR:", e);
    hideAppLoader();
  }
});

// ============================================================
//  AUTH HELPERS
// ============================================================
window.loginWithGoogle = function () {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => {
    const err = document.getElementById('auth-error');
    if (err) err.textContent = e.message;
  });
};
window.loginWithApple = function () {
  const provider = new firebase.auth.OAuthProvider('apple.com');
  auth.signInWithPopup(provider).catch(e => {
    const err = document.getElementById('auth-error');
    if (err) err.textContent = e.message;
  });
};
window.loginWithEmail = function () {
  const email = document.getElementById('auth-email').value;
  const pw = document.getElementById('auth-password').value;
  auth.signInWithEmailAndPassword(email, pw).catch(e => {
    const err = document.getElementById('auth-error');
    if (err) err.textContent = e.message;
  });
};
window.registerWithEmail = function () {
  const email = document.getElementById('auth-email').value;
  const pw = document.getElementById('auth-password').value;
  auth.createUserWithEmailAndPassword(email, pw).catch(e => {
    const err = document.getElementById('auth-error');
    if (err) err.textContent = e.message;
  });
};
window.signOut = function () { auth.signOut(); };

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg;
}

// ============================================================
//  NAVIGATION
// ============================================================
function showScreen(id) {
  const target = document.getElementById('screen-' + id);
  if (!isRealEl(target) || target.classList.contains('active')) return;

  const current = document.querySelector('.screen.active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + id);
  if (navBtn) navBtn.classList.add('active');

  if (typeof gsap !== 'undefined') {
    if (current) {
      gsap.to(current, {
        opacity: 0,
        scale: 0.95,
        y: 20,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => {
          current.classList.remove('active');
          target.classList.add('active');
          gsap.fromTo(target, { opacity: 0, scale: 1.05, y: -20 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.2)" });
        }
      });
    } else {
      target.classList.add('active');
      gsap.fromTo(target, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.6 });
    }
  } else {
    if (current) current.classList.remove('active');
    target.classList.add('active');
  }
}

function switchLobbyTab(tabId) {
  const target = document.getElementById(tabId);
  if (!isRealEl(target) || target.classList.contains('active')) return;

  const current = document.querySelector('#screen-lobby .tab-pane.active');
  document.querySelectorAll('#screen-lobby .tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick')?.includes(tabId));
  });

  if (typeof gsap !== 'undefined') {
    if (current) {
      gsap.to(current, {
        opacity: 0, x: -20, duration: 0.2, onComplete: () => {
          current.classList.remove('active');
          target.classList.add('active');
          gsap.fromTo(target, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.3 });
        }
      });
    } else {
      target.classList.add('active');
      gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }
  } else {
    if (current) current.classList.remove('active');
    target.classList.add('active');
  }
}


// ============================================================
//  ARCADE PLATFORM INTEGRATION (PRO)
// ============================================================

/**
 * Persists high scores to Firestore and updates local profile.
 * Standardized for all arcade games in the platform.
 */
window.saveArcadeScore = async function (gameId, score) {
  if (!currentUser) return;
  console.log(`[🏆] Saving score for ${gameId}: ${score}`);

  try {
    const currentBest = userProfile.arcade_records?.[gameId] || 0;
    if (score > currentBest) {
      const records = { ...userProfile.arcade_records, [gameId]: score };
      await db.collection('users').doc(currentUser.uid).update({
        arcade_records: records
      });
      userProfile.arcade_records = records;
      toast(`🔥 ¡NUEVO RECORD! ${score} en ${gameId.toUpperCase()}`);
    }
  } catch (e) { console.error("Error saving score:", e); }
};

/**
 * Builds a cross-origin URL with session credentials and config.
 */
function getHubGameUrl(path) {
  const token = currentUser ? currentUser.uid : 'anon';
  const config = encodeURIComponent(JSON.stringify(firebaseConfig));
  return `${path}?appId=tosito-games&token=${token}&config=${config}&user=${encodeURIComponent(userProfile.username || currentUser.displayName || 'Agente')}`;
}

window.showAnomaliaScreen = function () {
  document.body.classList.add('game-mode');
  const iframe = document.getElementById('anomalia-frame');
  if (iframe) iframe.src = getHubGameUrl('anomalia_game.html');
  showScreen('anomalia');
  if (typeof closeDrawer === 'function') closeDrawer();
};

window.showSlitherScreen = function () {
  document.body.classList.add('game-mode');
  const iframe = document.getElementById('slither-frame');
  if (iframe) iframe.src = getHubGameUrl('slither_game.html');
  showScreen('slither');
  if (typeof closeDrawer === 'function') closeDrawer();
};

window.showTurboDriftScreen = function () {
  document.body.classList.add('game-mode');
  const iframe = document.getElementById('turbo-drift-frame');
  if (iframe) iframe.src = getHubGameUrl('turbo-drift.html');
  showScreen('turbo-drift');
  if (typeof closeDrawer === 'function') closeDrawer();
};

window.showStackScreen = function () {
  document.body.classList.add('game-mode');
  const iframe = document.getElementById('stack-frame');
  if (iframe) iframe.src = getHubGameUrl('cyberstack_game.html');
  showScreen('stack');
  if (typeof closeDrawer === 'function') closeDrawer();
};

window.showHexaFallsScreen = function () {
  document.body.classList.add('game-mode');
  const iframe = document.getElementById('logicmaster-frame');
  if (iframe) iframe.src = 'hexa-falls.html';
  showScreen('logicmaster');
  if (typeof closeDrawer === 'function') closeDrawer();
};

window.showMario64Screen = function () {
  document.body.classList.add('game-mode');
  const iframe = document.getElementById('mario64-frame');
  if (iframe) iframe.src = 'mario64/index.html';
  showScreen('mario64');
  if (typeof closeDrawer === 'function') closeDrawer();
};

window.showSonicScreen = function () {
  document.body.classList.add('game-mode');
  const iframe = document.getElementById('sonic-frame');
  if (iframe) iframe.src = 'sonic/index.html';
  showScreen('sonic');
  if (typeof closeDrawer === 'function') closeDrawer();
};

window.exitHubGame = window.exitGame = function () {
  document.body.classList.remove('game-mode');
  const frames = ['anomalia-frame', 'slither-frame', 'turbo-drift-frame', 'stack-frame', 'logicmaster-frame', 'mario64-frame', 'sonic-frame'];
  frames.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.src = 'about:blank';
  });
  showScreen('hub');
};


// ============================================================
//  BACKEND DISCOVERY & STATUS
// ============================================================

/**
 * Periodically checks if the Python API on port 5001 is reachable.
 */
async function checkBackendHealth() {
  const host = window.location.hostname;
  const isLocalEnv = host.includes('localhost') || host.includes('127.0.0.1') ||
    host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');

  if (!isLocalEnv) return;

  try {
    const res = await fetch(`http://${host}:5001/ping`, {
      method: 'GET'
    });
    if (res.ok) {
      console.log("[✅] Python API (5001) is Online");
      window._apiStatus = 'online';
    } else {
      window._apiStatus = 'error';
    }
  } catch (e) {
    console.warn("[⚠️] Python API (5001) is Offline or Blocked by Firewall");
    window._apiStatus = 'offline';
  }
  updateBackendStatusUI();
}

function updateBackendStatusUI() {
  const el = document.getElementById('backend-status');
  const alertEl = document.getElementById('remote-api-warning');
  const host = window.location.hostname;
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const isLocalIP = host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
  const isProd = host.includes('web.app') || host.includes('firebaseapp.com');
  const isLocalEnv = isLocalhost || isLocalIP;

  let statusHTML = '';
  if (isLocalhost) {
    statusHTML = '<span class="badge badge-green">🏠 MODO LOCAL (PC)</span>';
  } else if (isProd) {
    statusHTML = '<span class="badge badge-sky">🚀 PROD: FIREBASE</span>';
  } else if (isLocalIP) {
    statusHTML = '<span class="badge badge-green">📶 RED LOCAL (MÓVIL)</span>';
  } else if (isManualBackend) {
    statusHTML = `<span class="badge badge-amber" onclick="promptNewBackend()">🔗 MANUAL: ${remoteBackendUrl.replace('https://', '')}</span>`;
  } else if (remoteBackendUrl) {
    statusHTML = '<span class="badge badge-sky">🌐 CLOUD SYNC (OK)</span>';
  } else {
    statusHTML = '<span class="badge badge-red" onclick="promptNewBackend()">❌ DESCONECTADO (Click para Manual)</span>';
  }

  // Detailed API check status
  if (isLocalEnv) {
    if (window._apiStatus === 'offline') {
      statusHTML += ' <span class="badge badge-red" style="cursor:help" title="El motor Python no responde. ¿Está abierto el puerto 5001?">⚠️ MOTOR OFF</span>';
      if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.innerHTML = `⚠️ <b>Motor Python offline en puerto 5001</b>. <br>Asegúrate de ejecutar 'web_app.py' y que tu red esté en modo <b>PRIVADO</b>.`;
      }
    } else if (window._apiStatus === 'online') {
      statusHTML += ' <span class="badge badge-green">✓ MOTOR OK</span>';
      if (alertEl) alertEl.style.display = 'none';
    }
  }

  if (el) el.innerHTML = statusHTML;

  const loaderStatus = document.getElementById('app-loader-status');
  if (loaderStatus && !isAppReady) {
    loaderStatus.textContent = remoteBackendUrl ? "Motor encontrado. Finalizando..." : "Buscando motor en la nube...";
  }
}

function promptNewBackend() {
  const current = isManualBackend ? remoteBackendUrl : '';
  const url = prompt("Introduce la URL de tu Ngrok (ej: https://abcd.ngrok-free.dev) o deja vacío para Auto-Discovery:", current);
  if (url !== null) setManualBackend(url.trim());
}

function setManualBackend(url) {
  if (!url) {
    localStorage.removeItem('tosito_manual_backend');
    isManualBackend = false;
    toast("📦 Autodescubrimiento activado (Cloud)");
    syncRemoteBackend();
  } else {
    if (!url.startsWith('http')) url = 'https://' + url;
    localStorage.setItem('tosito_manual_backend', url);
    remoteBackendUrl = url;
    isManualBackend = true;
    toast("🚀 Backend manual configurado");
  }
  updateBackendStatusUI();
}

function syncRemoteBackend() {
  if (isManualBackend) {
    updateBackendStatusUI();
    return;
  }
  console.log("[📡] Iniciando escucha de backend remoto en Firestore (globals/ai_config)...");
  db.collection('globals').doc('ai_config').onSnapshot(doc => {
    if (isManualBackend) return;
    if (doc.exists) {
      const data = doc.data();
      if (data.active && data.remote_url) {
        remoteBackendUrl = data.remote_url;
        console.log("[🚀] Backend remoto detectado:", remoteBackendUrl);
      } else {
        remoteBackendUrl = null;
      }
    } else {
      remoteBackendUrl = null;
    }
    updateBackendStatusUI();
  }, err => {
    console.error("[❌] Error Firestore backend:", err);
    updateBackendStatusUI();
  });
}

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf(el);
    gsap.fromTo(el,
      { y: -100, opacity: 0, x: "-50%", scale: 0.8 },
      { y: 0, opacity: 1, x: "-50%", scale: 1, duration: 0.5, ease: "back.out(1.7)" }
    );
    setTimeout(() => {
      gsap.to(el, { y: -100, opacity: 0, duration: 0.4, ease: "power2.in" });
    }, 3000);
  }
}

// ============================================================
//  UI HELPERS
// ============================================================
function renderLevelButtons() {
  const levels = [
    ['level_1', 'Nivel 1 — Novato 🐣'], ['level_2', 'Nivel 2 — Principiante'],
    ['level_3', 'Nivel 3 — Intermedio ⚡'], ['level_4', 'Nivel 4 — Avanzado'],
    ['level_7', 'Nivel 7 — Gran Maestro 🧠 ☁️'], ['level_8', 'Nivel 8 — Dios 😈 ☁️']
  ];
  const c = getEl('level-buttons');
  c.innerHTML = levels.map(([id, lbl]) =>
    `<button class="level-btn${aiLevel === id ? ' sel' : ''}" onclick="selectLevel('${id}')">${lbl}</button>`
  ).join('');
}
function selectLevel(id) { aiLevel = id; renderLevelButtons(); }

// ============================================================
//  NAVIGATION
// ============================================================
function switchLobbyTab(tabId) {
  const target = document.getElementById(tabId);
  if (!isRealEl(target) || target.classList.contains('active')) return;

  const current = document.querySelector('#screen-lobby .tab-pane.active');
  const buttons = document.querySelectorAll('#screen-lobby .tab-btn');

  if (buttons.length > 0) {
    buttons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('onclick')?.includes(tabId));
    });
  }

  if (typeof gsap !== 'undefined') {
    if (current) {
      gsap.to(current, {
        opacity: 0, x: -20, duration: 0.2, onComplete: () => {
          current.classList.remove('active');
          target.classList.add('active');
          gsap.fromTo(target, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.3 });
        }
      });
    } else {
      target.classList.add('active');
      gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }
  } else {
    if (current) current.classList.remove('active');
    target.classList.add('active');
  }
}

function switchExTab(id) {
  document.querySelectorAll('#screen-exercises .tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#screen-exercises .tab-btn').forEach(b => b.classList.remove('active'));
  getEl(id).classList.add('active');
  const btnId = id === 'ex-list-view' ? 'ex-tab-list' : 'ex-tab-explore';
  const btn = getEl(btnId);
  if (btn) btn.classList.add('active');
  if (id === 'ex-explore-view') loadCommunityPuzzles();
}
function showScreen(id) {
  const target = document.getElementById('screen-' + id);
  if (!isRealEl(target)) {
    console.error(`[🚨] Screen "screen-${id}" not found.`);
    return;
  }
  if (target.classList.contains('active')) return;

  const current = document.querySelector('.screen.active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + id);
  if (navBtn) navBtn.classList.add('active');

  if (typeof gsap !== 'undefined') {
    const tl = gsap.timeline();

    if (current) {
      // Depth Transition Out
      tl.to(current, {
        opacity: 0,
        scale: 0.9,
        filter: "blur(10px)",
        y: 30,
        duration: 0.5,
        ease: "power2.inOut",
        onComplete: () => {
          current.classList.remove('active');
          gsap.set(current, { clearProps: "all" });
        }
      });

      // Depth Transition In
      const isGameFull = id === 'stack' || id === 'slither';
      tl.fromTo(target,
        { opacity: 0, scale: isGameFull ? 1 : 1.1, filter: isGameFull ? "none" : "blur(10px)", y: isGameFull ? 0 : -30 },
        {
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          y: 0,
          duration: isGameFull ? 0.3 : 0.8,
          ease: isGameFull ? "power2.out" : "expo.out",
          onStart: () => {
            target.classList.add('active');
            if (!isGameFull) window.scrollTo({ top: 0, behavior: 'smooth' });
          },
          onComplete: () => {
            gsap.set(target, { clearProps: "all" });
            if (typeof initJuicyUI === 'function') initJuicyUI();
            const h1 = target.querySelector('h1, h2');
            if (h1 && !isGameFull) gsap.from(h1, { x: -30, opacity: 0, duration: 0.6, ease: "power2.out" });
          }
        },
        "-=0.2"
      );
    } else {
      target.classList.add('active');
      gsap.fromTo(target, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" });
    }
  } else {
    if (current) current.classList.remove('active');
    target.classList.add('active');
  }

  // Handle Navigation Visibility
  const nav = document.getElementById('bottom-nav');
  if (nav) {
    const hiddenScreens = ['hub', 'tictactoe', 'checkers', 'stack', 'slither', 'profile'];
    if (hiddenScreens.includes(id)) {
      nav.classList.add('hidden');
      if (typeof syncNavOpen === 'function') syncNavOpen(false);
    } else {
      nav.classList.remove('hidden');
      if (typeof syncNavOpen === 'function') syncNavOpen(true);
    }
  }
}

function triggerCelebration() {
  const colors = ['#FBBF24', '#38BDF8', '#10B981', '#F43F5E', '#8B5CF6'];
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = '-10px';
    document.body.appendChild(confetti);

    gsap.to(confetti, {
      y: '110vh',
      x: (Math.random() - 0.5) * 200 + 'px',
      rotation: Math.random() * 720,
      duration: Math.random() * 2 + 1.5,
      ease: "power1.out",
      onComplete: () => confetti.remove()
    });
  }
}

// Tab switcher removed duplicate

function switchSocTab(id) {
  const wrap = event.target.closest('.tabs-wrap');
  if (wrap) wrap.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.soc-pane').forEach(p => p.classList.remove('active'));
  getEl(id).classList.add('active');
  event.target.classList.add('active');
}

// ============================================================
//  GAME — START & INIT
// ============================================================
async function startGameFromMenu() {
  isAiGame = true;
  isGodMode = false;
  isLocalSim = false;
  getEl('tog-god').checked = false;
  getEl('tog-hint').checked = false;
  isHintEnabled = false;
  playerColor = 'white';
  getEl('resign-btn').style.display = '';
  getEl('admin-controls').style.display = userProfile.isAdmin ? '' : 'none';
  isFirstRender = true;

  console.log(`[🎮] Iniciando partida contra IA. Nivel: ${aiLevel}`);
  const resetRes = await safeFetchJson('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: aiLevel }) });
  console.log("[🏁] Reset Response:", resetRes);

  if (resetRes.error === 'BACKEND_MISSING') {
    const autonomous = (['level_1', 'level_2', 'level_3', 'level_7', 'level_8'].includes(aiLevel));
    console.log(`[❓] Backend missing. Autonomous? ${autonomous}`);
    if (autonomous) {
      console.log("[🤖] MODO SIMULACIÓN ACTIVADO. Cargando ChessBoard local...");
      isLocalSim = true;
      mainBoard = new ChessBoard();
      mainBoard.setupBoard();
      board = mainBoard.grid;
      turn = 'white'; gameStatus = 'playing';
      console.log("[✅] Motor local listo (ChessBoard). Grilla:", board);
    } else {
      toast("Servidor Nivel 4 offline.");
      return;
    }
  }

  startTimers(10);
  await fetchBoardState();
  showScreen('game');
  getEl('room-pill').textContent = 'vs IA · ' + aiLevel;
  getEl('bottom-nav').classList.add('hidden');
  syncNavOpen(false);
}

function exitGame() {
  closeModal('winner-modal');
  stopTimer();
  isGameMode = false;
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  getEl('bottom-nav').classList.remove('hidden');
  syncNavOpen(true);
  showScreen('lobby');
  fetchBoardState();
}

// ============================================================
//  GSAP UTILITIES
// ============================================================
function animateListItems(selector) {
  gsap.from(selector, {
    opacity: 0,
    y: 20,
    duration: 0.5,
    stagger: 0.05,
    ease: "power2.out"
  });
}

// ============================================================
//  BOARD RENDER
// ============================================================
const PIECES = { white: { P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔' }, black: { P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚' } };

function renderBoard(grid, boardElId = 'board', onClickFn = onSquareClick, flipped = false, hints = null, pre = null) {
  const el = getEl(boardElId);
  if (!el) return;

  // Initial render: Stagger the board intro if it's the first time
  const isFirstRender = el.children.length === 0;

  // Capture state across pieces for Flip
  const state = Flip.getState(".piece", { props: "opacity,transform" });

  el.innerHTML = '';

  // === SKELETAL LOADING STATE ===
  if (!grid || !Array.isArray(grid)) {
    for (let i = 0; i < 64; i++) {
      const sq = document.createElement('div');
      sq.className = 'sq ghost-sq';
      el.appendChild(sq);
    }
    gsap.fromTo(".ghost-sq",
      { opacity: 0.1, scale: 0.95 },
      { opacity: 0.3, scale: 1, duration: 1.2, repeat: -1, yoyo: true, stagger: { amount: 0.8, from: "center", grid: [8, 8] } }
    );
    return;
  }

  const sel = (boardElId === 'ex-board') ? exSel : (boardElId === 'board' ? selectedSq : null);
  const mvs = (boardElId === 'ex-board') ? exValid : (boardElId === 'board' ? validMoves : []);
  const lm = (boardElId === 'ex-board') ? exLastMove : lastMove;

  const isClassic = getEl('tog-board').checked;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dr = flipped ? 7 - r : r;
      const dc = flipped ? 7 - c : c;
      const cell = grid[dr]?.[dc];
      const isLight = (dr + dc) % 2 === 0;
      const sq = document.createElement('div');
      sq.className = 'sq ' + (isLight ? (isClassic ? 'classic-light' : 'light') : (isClassic ? 'classic-dark' : 'dark'));
      sq.dataset.r = dr; sq.dataset.c = dc;

      if (sel && sel[0] === dr && sel[1] === dc) {
        sq.classList.add('sel');
        gsap.to(sq, { scale: 0.95, duration: 0.2, yoyo: true, repeat: 1 });
      }
      if (mvs.some(m => m[0] === dr && m[1] === dc)) {
        sq.classList.add(cell ? 'valid-cap' : 'valid');
      }
      if (lm) {
        if ((lm.from[0] === dr && lm.from[1] === dc) || (lm.to[0] === dr && lm.to[1] === dc)) {
          sq.classList.add(lm.from[0] === dr && lm.from[1] === dc ? 'last-from' : 'last-to');
        }
      }
      if (hints) {
        if (hints.from[0] === dr && hints.from[1] === dc) sq.classList.add('hint-from');
        if (hints.to[0] === dr && hints.to[1] === dc) sq.classList.add('hint-to');
      }

      const isThisKingInCheck = isCheck && cell && str(cell) === 'K' && cell.color === turn;
      if (isThisKingInCheck) sq.classList.add('check-pulse');

      sq.onclick = () => onClickFn(dr, dc);
      if (cell) {
        const p = document.createElement('span');
        const pType = cell.type?.toUpperCase?.() || 'P';
        p.className = `piece ${cell.color}`;
        p.textContent = PIECES[cell.color]?.[pType] || '?';
        p.dataset.flipId = `${cell.color}-${pType}-${dr}-${dc}`;

        // Add Check Wiggle/Aura to King
        if (isThisKingInCheck) {
          const aura = document.createElement('div');
          aura.className = 'check-aura';
          p.appendChild(aura);
          gsap.to(p, { x: 2, repeat: -1, yoyo: true, duration: 0.1, ease: "none" });
        }

        // Piece Hover (Magnetic Effect)
        p.onmouseenter = () => gsap.to(p, { scale: 1.25, zIndex: 100, duration: 0.4, ease: "back.out(2)", filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.6))" });
        p.onmouseleave = () => gsap.to(p, { scale: 1, zIndex: 1, duration: 0.3, ease: "power2.out", filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))" });

        sq.appendChild(p);
      }
      // Stagger class for first entrance
      if (isFirstRender) sq.classList.add('sq-stagger');
      el.appendChild(sq);
    }
  }

  // Board Intro Stagger
  if (isFirstRender) {
    const tl = gsap.timeline({ onComplete: () => isFirstRender = false });
    tl.to(".sq", {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.8,
      stagger: { amount: 0.8, from: "center", grid: [8, 8] },
      ease: "back.out(1.4)"
    });
    tl.from(".piece", { opacity: 0, scale: 0.5, duration: 0.5, stagger: 0.01 }, "-=0.4");
  }

  // Execute Flip animation for pieces
  Flip.from(state, {
    duration: 0.6,
    absolute: true,
    ease: "power3.inOut",
    stagger: 0.01,
    onEnter: elements => gsap.from(elements, { opacity: 0, scale: 0.5, duration: 0.4 }),
    onLeave: elements => gsap.to(elements, { opacity: 0, scale: 0.5, duration: 0.4 })
  });

  renderCoords(flipped);
}

function str(cell) { return (cell?.type || '').toUpperCase(); }

function renderCoords(flipped = false) {
  const cols = getEl('coords-col');
  const rows = getEl('coords-row');
  if (!cols || !rows) return;
  const ranks = flipped ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];
  const files = flipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  cols.innerHTML = ranks.map(n => `<div class="coord">${n}</div>`).join('');
  rows.innerHTML = files.map(f => `<div class="coord">${f}</div>`).join('');
}

// ============================================================
//  GAME LOGIC — MAIN BOARD
// ============================================================
async function fetchBoardState() {
  if (isLocalSim && mainBoard) {
    board = mainBoard.grid;
    turn = mainBoard.turn;
    const isClassic = getEl('tog-board').checked;
    renderBoard(board, 'board', onSquareClick, playerColor === 'black', currentHint, premove);
    updateTurnUI();
    if (isHintEnabled) fetchHint(); // Persistencia de pistas
    return;
  }

  try {
    const data = await safeFetchJson('/api/state');
    if (data.error === 'BACKEND_MISSING') {
      renderBoard(null, 'board'); // Show waiting message
      return;
    }
    if (!data.success && data.grid === undefined) return;

    board = data.grid || [];
    turn = data.turn;
    isCheck = data.check || false;
    gameWinner = data.winner;
    lastMove = data.last_move ? { from: lanToRC(data.last_move.text?.split('->')[0]?.trim()), to: lanToRC(data.last_move.text?.split('->')[1]?.trim()) } : null;

    renderBoard(board, 'board', onSquareClick, playerColor === 'black', currentHint, premove);
    updateTurnUI();
    if (gameWinner) onGameEnd(gameWinner);
    if (isHintEnabled) fetchHint(); // Persistencia de pistas
  } catch (e) {
    console.error("Error fetching state:", e);
  }
}

function lanToRC(lan) {
  if (!lan) return null;
  const files = 'abcdefgh';
  const c = files.indexOf(lan[0]);
  const r = 8 - parseInt(lan[1]);
  return [r, c];
}

function updateTurnUI() {
  const pill = getEl('turn-pill');
  if (turn === 'white') {
    pill.textContent = 'TURNO BLANCAS ♖';
    pill.style.color = '#FBBF24';
    getEl('timer-white').classList.add('active');
    getEl('timer-black').classList.remove('active');
  } else {
    pill.textContent = 'TURNO NEGRAS ♜';
    pill.style.color = '#38BDF8';
    getEl('timer-black').classList.add('active');
    getEl('timer-white').classList.remove('active');
  }
  getEl('check-alert').style.display = isCheck ? '' : 'none';
}

async function onSquareClick(r, c) {
  if (gameStatus === 'finished' || isAiThinking) return;
  const canMove = isGodMode || (isAiGame ? turn === playerColor : turn === playerColor);

  if (selectedSq) {
    const [sr, sc] = selectedSq;
    if (validMoves.some(m => m[0] === r && m[1] === c)) {
      await makeMove(sr, sc, r, c);
      return;
    }
  }
  if (!canMove && !isGodMode) { selectedSq = null; validMoves = []; renderBoard(board, 'board', onSquareClick, playerColor === 'black', currentHint, premove); return; }

  const cell = board[r]?.[c];
  if (cell && (isGodMode || cell.color === turn)) {
    selectedSq = [r, c];
    if (isLocalSim && mainBoard) {
      validMoves = mainBoard.getLegalMoves(r, c);
    } else {
      const data = await safeFetchJson(`/api/moves?r=${r}&c=${c}`);
      validMoves = data.moves || [];
    }
  } else {
    selectedSq = null; validMoves = [];
  }
  renderBoard(board, 'board', onSquareClick, playerColor === 'black', currentHint, premove);
}

async function makeMove(sr, sc, er, ec) {
  const cell = board[sr]?.[sc];
  // Pawn promotion check
  if (str(cell) === 'P' && (er === 0 || er === 7)) {
    pendingMove = [sr, sc, er, ec];
    showPromoModal(cell.color);
    return;
  }
  await sendMove(sr, sc, er, ec, null);
}

let pendingMove = null;
function showPromoModal(color) {
  const pieces = color === 'white' ? ['♕', '♖', '♗', '♘'] : ['♛', '♜', '♝', '♞'];
  const names = ['Queen', 'Rook', 'Bishop', 'Knight'];
  getEl('promo-pieces').innerHTML = pieces.map((p, i) =>
    `<div class="promo-piece" onclick="selectPromo('${names[i]}')">${p}</div>`
  ).join('');

  const modal = getEl('promo-modal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  gsap.fromTo(modal.querySelector('.modal-content'),
    { scale: 0.8, y: 50 },
    { scale: 1, y: 0, duration: 0.6, ease: "back.out(1.7)" }
  );
}
async function selectPromo(piece) {
  getEl('promo-modal').classList.remove('show');
  if (pendingMove) { await sendMove(...pendingMove, piece); pendingMove = null; }
}

async function sendMove(sr, sc, er, ec, promo) {
  selectedSq = null; validMoves = []; currentHint = null;
  const body = { start: [sr, sc], end: [er, ec] };
  if (promo) body.promo = promo;

  // UI Impact: Show impact on the arrival square if there was a piece
  const targetSq = document.querySelector(`.sq[data-r="${er}"][data-c="${ec}"]`);
  if (targetSq && targetSq.querySelector('.piece')) {
    const flare = document.createElement('div');
    flare.className = 'impact-flare';
    targetSq.appendChild(flare);
    gsap.fromTo(flare, { opacity: 0.8, scale: 0.1 }, { opacity: 0, scale: 2.5, duration: 0.6, ease: "power2.out", onComplete: () => flare.remove() });
  }

  if (isLocalSim && mainBoard) {
    // Local Simulation Move
    const promoChar = promo ? promo.charAt(0).toUpperCase() : 'Q';
    mainBoard.movePiece(sr, sc, er, ec, promoChar);
    await fetchBoardState();
    if (isAiGame && !gameWinner) doAiMove();
    return;
  }

  const data = await safeFetchJson('/api/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (data.success) {
    await fetchBoardState();
    if (isAiGame && !gameWinner) doAiMove();
  }
}

async function doAiMove() {
  if (isAiThinking || gameWinner) return;
  isAiThinking = true;
  const fen = getFen();

  try {
    let bestMove = null;

    // === DISPATCHER BY AI LEVEL ===
    if (aiLevel === 'level_1' || aiLevel === 'level_2' || aiLevel === 'level_3') {
      // 🏘️ LOCAL JS ALGORITHM (1-3)
      await new Promise(r => setTimeout(r, 600)); // Artificial thinking time
      const localBoard = new ChessBoard();
      localBoard.loadFromFen(fen);
      const localAi = new ChessAI(turn, aiLevel);
      const res = await localAi.getBestMove(localBoard);

      if (res && res.start && res.end) {
        bestMove = {
          from: rcToLan(res.start[0], res.start[1]),
          to: rcToLan(res.end[0], res.end[1]),
          promo: res.promo || null
        };
      }
    } else if (aiLevel === 'level_7') {
      // 🦆 CHESS-API (Stockfish Cloud)
      bestMove = await fetchChessApiMove(fen);
    } else if (aiLevel === 'level_8') {
      // ♟️ LICHESS CLOUD EVAL
      bestMove = await fetchLichessMove(fen);
    } else {
      // 🔗 NGROK/LOCAL API (Level 4, etc.)
      const data = await safeFetchJson('/api/ai_move', { method: 'POST' });
      if (data.success) {
        await fetchBoardState();
        isAiThinking = false;
        hideBoardLoader();
        return;
      }
    }

    if (bestMove) {
      const scArr = lanToRC(bestMove.from);
      const ecArr = lanToRC(bestMove.to);
      await sendMove(scArr[0], scArr[1], ecArr[0], ecArr[1], bestMove.promo);
    }
  } catch (e) {
    console.error("Cloud/Local AI Error:", e);
    toast("Error en el motor de IA");
  } finally {
    isAiThinking = false;
    if (isHintEnabled && !gameWinner) fetchHint(); // Update hint after AI moves
  }
}

async function fetchChessApiMove(fen) {
  console.log("[☁️] Requesting Move from Chess-API.com...", { fen });
  try {
    const res = await fetch("https://chess-api.com/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, depth: 12 })
    });
    console.log("[☁️] Chess-API Status:", res.status);
    const data = await res.json();
    console.log("[☁️] Chess-API Response:", data);
    if (data.move) {
      return {
        from: data.from,
        to: data.to,
        promo: data.promotion || null
      };
    }
    console.warn("[☁️] No move found in Chess-API response.");
    return null;
  } catch (e) {
    console.error("[☁️] Chess-API Network/CORS Error:", e);
    return null;
  }
}

async function fetchLichessMove(fen) {
  console.log("[☁️] Requesting Move from Lichess Cloud Eval...", { fen });
  try {
    const res = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}`);
    console.log("[☁️] Lichess Status:", res.status);
    if (res.status === 404) {
      console.log("[☁️] Lichess: Posición no analizada. Reintentando con Chess-API...");
      return fetchChessApiMove(fen);
    }
    const data = await res.json();
    console.log("[☁️] Lichess Response:", data);
    if (data.pvs && data.pvs[0]) {
      const move = data.pvs[0].moves.split(' ')[0]; // Pick best PV
      console.log("[☁️] Lichess Move selected:", move);
      return {
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promo: move.length > 4 ? move[4] : null
      };
    }
    console.warn("[☁️] Lichess response format unexpected or missing PVs.");
    return fetchChessApiMove(fen);
  } catch (e) {
    console.error("[☁️] Lichess Network Error:", e);
    return fetchChessApiMove(fen);
  }
}

function rcToLan(r, c) {
  const files = 'abcdefgh';
  return files[c] + (8 - r);
}

function getFen() {
  let fen = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        if (empty > 0) { fen += empty; empty = 0; }
        let char = p.type.toLowerCase();
        if (char === 'p') char = 'p'; // already lower
        fen += (p.color === 'white' ? char.toUpperCase() : char);
      } else {
        empty++;
      }
    }
    if (empty > 0) fen += empty;
    if (r < 7) fen += "/";
  }
  fen += ` ${turn === 'white' ? 'w' : 'b'} KQkq - 0 1`; // Simplificado (sin enroque estricto/peon al paso en FEN actual)
  return fen;
}

async function fetchHint() {
  if (!isHintEnabled) return;
  const fen = getFen();
  let move = null;

  try {
    if (hintEngine === 'level_7') {
      move = await fetchChessApiMove(fen);
    } else if (hintEngine === 'level_8') {
      move = await fetchLichessMove(fen);
    } else if (['level_1', 'level_2', 'level_3'].includes(aiLevel)) {
      // Use local AI for hint if it's a basic level
      const localBoard = new ChessBoard();
      localBoard.loadFromFen(fen);
      const localAi = new ChessAI(turn, aiLevel);
      const res = await localAi.getBestMove(localBoard);
      if (res && res.start) {
        move = {
          from: rcToLan(res.start[0], res.start[1]),
          to: rcToLan(res.end[0], res.end[1])
        };
      }
    } else {
      // Backend hint
      const data = await safeFetchJson(`/api/hint?color=${turn}`);
      if (data.success) {
        currentHint = data;
        renderBoard(board, 'board', onSquareClick, playerColor === 'black', currentHint, premove);
      }
      return;
    }

    if (move) {
      currentHint = {
        success: true,
        move: `${move.from}->${move.to}`,
        from: lanToRC(move.from),
        to: lanToRC(move.to),
        reason: "Sugerencia de motor (Cloud/Local)"
      };
      renderBoard(board, 'board', onSquareClick, playerColor === 'black', currentHint, premove);
    }
  } catch (e) {
    console.error("Hint Error:", e);
  }
}

function toggleBoardTheme() { renderBoard(board, 'board', onSquareClick, playerColor === 'black', currentHint, premove); }
function toggleGodMode() { isGodMode = getEl('tog-god').checked; }
function toggleHint() {
  isHintEnabled = getEl('tog-hint').checked;
  getEl('hint-engine-row').style.display = isHintEnabled ? '' : 'none';
  if (isHintEnabled) {
    toast("🔍 Buscando pista óptima...");
    fetchHint();
  } else {
    currentHint = null;
    renderBoard(board, 'board', onSquareClick, playerColor === 'black', null, premove);
  }
}
function setHintEngine(e) {
  if (hintEngine === e) return;
  hintEngine = e;
  getEl('e-sf').classList.toggle('active', e === 'level_7');
  getEl('e-lc').classList.toggle('active', e === 'level_8');
  if (isHintEnabled) fetchHint();
}

// ============================================================
//  TIMERS
// ============================================================
function startTimers(minutes = 10) {
  whiteMs = blackMs = minutes * 60 * 1000;
  stopTimer();
  gameStatus = 'playing';
  updateTimerDisplay();
  timerInterval = setInterval(tickTimer, 100);
}
function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
function tickTimer() {
  if (gameStatus !== 'playing') return;
  if (turn === 'white') { whiteMs -= 100; if (whiteMs <= 0) { whiteMs = 0; onTimeOut('white'); } }
  else { blackMs -= 100; if (blackMs <= 0) { blackMs = 0; onTimeOut('black'); } }
  updateTimerDisplay();
}
function updateTimerDisplay() {
  setTimer('time-white', 'timer-white', whiteMs, turn === 'white');
  setTimer('time-black', 'timer-black', blackMs, turn === 'black');
}
function setTimer(elId, cardId, ms, active) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  const el = getEl(elId);
  const card = getEl(cardId);
  el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  card.classList.toggle('danger', active && ms < 30000);
}
function onTimeOut(color) {
  stopTimer(); gameStatus = 'finished';
  onGameEnd(`Tiempo agotado — Ganan las ${color === 'white' ? 'negras' : 'blancas'}`);
}

// ============================================================
//  GAME END
// ============================================================
function onGameEnd(winner) {
  gameStatus = 'finished';
  loadHistoricalGames();
  const modal = getEl('winner-modal');
  const title = getEl('winner-title');
  const msg = getEl('winner-msg');

  if (winner === 'draw') {
    title.textContent = '¡Empate!';
    msg.textContent = 'Tablas por acuerdo o posición.';
  } else {
    title.textContent = winner === 'white' ? '¡Victoria Blancas!' : '¡Victoria Negras!';
    msg.textContent = 'El juego ha finalizado.';
    if (winner === playerColor) triggerCelebration();
  }

  modal.style.display = 'flex';
  gsap.fromTo(modal.querySelector('.modal-content'), { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: "elastic.out(1, 0.5)" });
}
function showResignDialog() {
  const modal = getEl('resign-modal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  gsap.fromTo(modal.querySelector('.modal-content'),
    { y: 100, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
  );
}
function confirmResign() { closeModal('resign-modal'); setTimeout(() => onGameEnd('Abandono — ' + (playerColor === 'white' ? 'Ganan las Negras' : 'Ganan las Blancas')), 300); }
function closeModal(id) {
  const modal = getEl(id);
  gsap.to(modal.querySelector('.modal-content'), { scale: 0.8, opacity: 0, duration: 0.3, ease: "power2.in" });
  gsap.to(modal, {
    opacity: 0, duration: 0.4, onComplete: () => {
      modal.classList.remove('show');
      modal.style.display = 'none';
    }
  });
}

// ============================================================
//  DRAWER
// ============================================================
function openDrawer() { getEl('side-drawer').classList.add('open'); getEl('drawer-overlay').classList.add('show'); }
function closeDrawer() { getEl('side-drawer').classList.remove('open'); getEl('drawer-overlay').classList.remove('show'); }

// ============================================================
//  ADMIN CONTROLS (DRAWER)
// ============================================================
async function undoMove() {
  if (isLocalSim && mainBoard) mainBoard.undoMove();
  else await safeFetchJson('/api/undo', { method: 'POST' }).catch(() => { });
  await fetchBoardState(); closeDrawer();
}
async function skipTurn() {
  if (isLocalSim && mainBoard) mainBoard.turn = (mainBoard.turn === 'white' ? 'black' : 'white');
  else await safeFetchJson('/api/skip_turn', { method: 'POST' }).catch(() => { });
  await fetchBoardState(); closeDrawer();
}
async function resetBoard() {
  if (isLocalSim && mainBoard) {
    mainBoard.setupBoard();
    gameWinner = null; gameStatus = 'playing';
  } else {
    await safeFetchJson('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: aiLevel }) });
    gameWinner = null; gameStatus = 'playing';
  }
  startTimers(10); await fetchBoardState(); closeDrawer();
}

// ============================================================
//  ONLINE ROOMS (Firebase Firestore)
// ============================================================
async function fetchRooms() {
  try {
    const snap = await db.collection('games').where('status', '==', 'waiting').limit(20).get();
    const list = getEl('room-list');
  } catch (e) { console.error(e); }
}

let lobbySelectedGameType = 'chess';
window.setLobbyGameType = function (gt) {
  lobbySelectedGameType = gt;
  document.querySelectorAll('[id^="gt-"]').forEach(b => {
    b.classList.toggle('active', b.id === 'gt-' + gt);
    b.style.borderColor = (b.id === 'gt-' + gt) ? 'var(--sky)' : '';
  });
};

function renderRooms(snap) {
  try {
    const list = getEl('room-list');
    if (!list) return;
    list.innerHTML = '';
    if (snap.empty) { list.innerHTML = '<p style="color:var(--muted);font-size:.85rem;text-align:center">Sin salas disponibles</p>'; return; }

    snap.forEach(doc => {
      const d = doc.data();
      const gt = d.gameType || 'chess';
      const icon = gt === 'chess' ? '♟️' : (gt === 'checkers' ? '🔴' : '❌');
      const name = gt === 'chess' ? 'Ajedrez' : (gt === 'checkers' ? 'Damas' : 'Tres en Raya');

      list.innerHTML += `
        <div class="room-card" style="border-left:4px solid ${gt === 'chess' ? 'var(--sky)' : (gt === 'checkers' ? 'var(--red)' : 'var(--amber)')}">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:1.5rem;">${icon}</span>
            <div>
              <h4 style="margin:0">${name} - ${doc.id.substring(0, 4)}</h4>
              <div class="status" style="font-size:0.7rem; color:var(--muted)">${d.status === 'waiting' ? 'Esperando...' : 'En curso'}</div>
            </div>
          </div>
          <button class="btn btn-primary" style="width:auto; padding:8px 16px; font-size:0.8rem; background:var(--sky); color:black;" onclick="joinRoom('${doc.id}')">UNIRSE</button>
        </div>`;
    });
  } catch (e) { console.error(e); }
}

async function createRoom() {
  if (!currentUser) return;
  toast(`Creando sala de ${lobbySelectedGameType}...`);
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  const userName = userProfile.username || userProfile.displayName || currentUser.displayName || currentUser.email;

  await db.collection('games').doc(id).set({
    status: 'waiting',
    gameType: lobbySelectedGameType,
    white: currentUser.uid,
    whiteName: userName,
    black: null,
    blackName: null,
    board: null,
    turn: 'white',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await startOnlineGame(id, 'white');
}

async function joinRoom(code) {
  const id = code || getEl('room-code-input').value.trim().toUpperCase();
  if (!id) return;
  const ref = db.collection('games').doc(id);
  const doc = await ref.get();
  if (!doc.exists) { toast('Sala no encontrada'); return; }
  const d = doc.data();
  if (d.black && d.black !== currentUser.uid) { toast('Sala llena'); return; }
  const iAmWhite = d.white === currentUser.uid;
  if (!d.black && !iAmWhite) {
    const userName = userProfile.displayName || currentUser.displayName || currentUser.email;
    await ref.update({ black: currentUser.uid, blackName: userName, status: 'playing' });
  }
  await startOnlineGame(id, iAmWhite ? 'white' : 'black');
}

async function startOnlineGame(roomId, color) {
  const doc = await db.collection('games').doc(roomId).get();
  const d = doc.data();
  const gt = d.gameType || 'chess';

  currentRoom = roomId;
  playerColor = color;
  isAiGame = false;
  currentGameType = gt;

  if (gt === 'chess') {
    getEl('room-pill').textContent = `SALA: ${roomId}`;
    getEl('resign-btn').style.display = '';
    getEl('admin-controls').style.display = userProfile.isAdmin ? '' : 'none';
    await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'level_3' }) });
    startTimers(10);
    await fetchBoardState();
    showScreen('game');
  } else if (gt === 'ttt') {
    showTTTScreen();
    // TTT sync setup will go here
  } else if (gt === 'checkers') {
    showCheckersScreen();
    // Checkers sync setup will go here
  }

  getEl('bottom-nav').classList.add('hidden');
  if (typeof syncNavOpen === 'function') syncNavOpen(false);

  // Subscribe to room changes
  if (unsubRoom) unsubRoom();
  unsubRoom = db.collection('games').doc(roomId).onSnapshot(async snap => {
    const rd = snap.data();
    if (!rd) return;
    if (rd.status === 'finished') {
      if (gt === 'chess') onGameEnd(rd.result || 'Partida terminada');
      // TTT/Checkers handled in their own listeners
    }
  });
}

// ============================================================
//  HISTORY
// ============================================================
async function loadHistoryGames() {
  if (!currentUser) return;
  try {
    // Current Android structure uses root "games_history" with "playerUid"
    const snap = await db.collection('games_history')
      .where('playerUid', '==', currentUser.uid)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const loading = getEl('history-loading');
    const container = getEl('history-container');
    if (loading) loading.style.display = 'none';
    if (!container) return;

    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--muted);font-size:.85rem;text-align:center">Sin partidas registradas</p>';
      return;
    }
    container.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const date = d.timestamp ? new Date(parseInt(d.timestamp)).toLocaleDateString('es-ES') : '--';
      const win = d.result === 'win' || d.result?.includes('Victoria');
      container.innerHTML += `<div class="game-card item-card"><div><div style="font-weight:700">${d.title || d.openingName || 'Partida de Ajedrez'}</div><div style="font-size:.75rem;color:var(--muted)">${d.opponentName || 'IA'} · ${date}</div></div><span style="font-size:.8rem;font-weight:800;color:${win ? 'var(--green)' : 'var(--red)'}">${win ? 'VICTORIA' : 'DERROTA'}</span></div>`;
    });
    animateListItems('#history-container .item-card');
  } catch (e) { console.error("Error history:", e); }
}

async function exportCurrentGame() {
  const data = await safeFetchJson('/api/state');
  const json = JSON.stringify(data.history, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'partida.json'; a.click();
}
async function exportCurrentPgn() {
  const data = await safeFetchJson('/api/state');
  const pgn = `[Event "Tosito Chess"]\n[Site "Web"]\n[White "Jugador"]\n[Black "IA ${aiLevel}"]\n\n`;
  const blob = new Blob([pgn], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'partida.pgn'; a.click();
}
function importGameJson() { toast('Función en desarrollo 🛠'); }

// ============================================================
//  ADMIN DATA
// ============================================================
async function fetchAdminData() {
  try {
    const usersSnap = await db.collection('users').get();
    const roomsSnap = await db.collection('games').where('status', 'in', ['waiting', 'playing']).get();
    getEl('stat-users').textContent = usersSnap.size;
    getEl('stat-rooms').textContent = roomsSnap.size;
    const ul = getEl('admin-user-list');
    if (ul) {
      ul.innerHTML = '';
      usersSnap.forEach(doc => {
        const d = doc.data();
        ul.innerHTML += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:6px"><div><div style="font-size:.85rem;font-weight:700">${d.username || d.displayName || d.email || doc.id.substring(0, 8)}</div><div style="font-size:.7rem;color:var(--muted)">${d.role || 'player'} · ELO ${d.elo || 1200}</div></div></div>`;
      });
    }
    const rm = getEl('admin-room-monitor');
    if (rm) {
      rm.innerHTML = '';
      roomsSnap.forEach(doc => {
        const d = doc.data();
        rm.innerHTML += `<div style="padding:8px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:6px;font-size:.8rem"><div style="font-weight:700">Sala: ${doc.id} <span class="badge ${d.status === 'playing' ? 'badge-green' : 'badge-red'}">${d.status.toUpperCase()}</span></div><div style="color:var(--muted)">⬜${d.whiteName || d.white || '?'} vs ⬛${d.blackName || d.black || 'Esperando'}</div></div>`;
      });
    }
  } catch (e) { console.error("Admin data error:", e); toast('Error al cargar datos admin'); }
}

// ============================================================
//  EXERCISES
// ============================================================
async function loadExercises() {
  try {
    const snapshot = await db.collection('exercises').get();
    if (snapshot.empty) {
      console.warn("Firestore 'exercises' collection is empty. Falling back to local JSON.");
      const data = await safeFetchJson('api/exercises.json');
      if (data && Array.isArray(data)) {
        exercises = data;
        renderExerciseList();
      }
      return;
    }
    exercises = snapshot.docs.map(doc => doc.data());
    renderExerciseList();
  } catch (e) {
    console.error("Error loading exercises from Firestore:", e);
    const data = await safeFetchJson('api/exercises.json');
    if (data && Array.isArray(data)) {
      exercises = data;
      renderExerciseList();
    }
  }
}

async function migrateExercisesToFirestore() {
  const data = await safeFetchJson('api/exercises.json');
  if (!data || !Array.isArray(data)) return console.error("Could not load local exercises.");
  console.log(`Migrating ${data.length} exercises...`);
  for (let ex of data) {
    // Firestore doesn't support nested arrays [["e2","e4"]]. Flatten to ["e2e4"]
    if (ex.solution && Array.isArray(ex.solution)) {
      ex.solution = ex.solution.map(s => {
        if (Array.isArray(s)) return s.join('');
        return s;
      });
    }
    await db.collection('exercises').doc(ex.id).set(ex);
  }
  toast("Migración de ejercicios completa ✓");
  console.log("Migration complete!");
}

async function importManyPuzzlesFromLichess() {
  toast("⏳ Iniciando importación de Puzzles (Lote Local)...");
  try {
    const data = await safeFetchJson('api/more_puzzles.json');
    if (!data || !Array.isArray(data)) return toast("❌ No se pudo cargar el lote de puzzles");

    let count = 0;
    for (const pz of data) {
      console.log(`[FIREBASE] Migrating puzzle ${pz.id}...`);
      const res = await db.collection('puzzles').doc(pz.id).set(pz);
      count++;
    }
    toast(`✅ ¡Importados ${count} puzzles nuevos!`);
    loadCommunityPuzzles(); // Auto-refresh the lobby if in Explorer tab
  } catch (e) {
    console.error("Batch import failed:", e);
    toast("❌ Error en la importación: " + e.message);
  }
}

function getTurnFromFen(fen) {
  if (!fen) return 'w';
  const parts = fen.split(' ');
  return parts.length > 1 ? parts[1] : 'w';
}

function renderExerciseList() {
  const el = getEl('ex-list');
  const solved = userProfile.solved_puzzles || [];
  el.innerHTML = exercises.map(ex => {
    const isSolved = solved.includes(ex.id) || solved.includes(ex.puzzleId);
    return `<div class="ex-card ${isSolved ? 'solved' : ''}" onclick="selectExercise('${ex.id}')">
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <h4>${ex.title}</h4>
          ${isSolved ? '<span style="color:var(--green); font-size:1.2rem;">✓</span>' : ''}
        </div>
        <p>${ex.description}</p>
      </div>
      <span class="diff-badge diff-${ex.difficulty}">${ex.difficulty}</span>
    </div>`;
  }).join('');
}

async function loadCommunityPuzzles() {
  const el = getEl('ex-explore-list');
  if (!el) return;
  el.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem;">Buscando puzzles en la comunidad... 🌐</div>';
  try {
    const snapshot = await db.collection('puzzles').limit(20).get();
    if (snapshot.empty) {
      el.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--muted);">Aún no hay puzzles en la comunidad. ¡Sé el primero en resolver uno!</div>';
      return;
    }
    const data = snapshot.docs.map(doc => doc.data());
    renderCommunityList(data);
  } catch (e) {
    console.error("Error loading community puzzles:", e);
    el.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--red);">Error al conectar con la comunidad.</div>';
  }
}

function renderCommunityList(data) {
  const el = getEl('ex-explore-list');
  if (!el) return;
  const solved = userProfile.solved_puzzles || [];
  el.innerHTML = data.map(pz => {
    const isSolved = solved.includes(pz.id) || solved.includes(pz.puzzleId);
    return `<div class="ex-card ${isSolved ? 'solved' : ''}" onclick="loadPuzzleById('${pz.id}')">
      <h4>Puzzle #${pz.id.replace('li_', '')}</h4>
      <p>Nivel: ${pz.rating || '?'}</p>
      <div style="font-size:0.75rem; color:var(--sky); font-weight:700;">🌐 COMUNIDAD</div>
    </div>`;
  }).join('');
  animateListItems('#ex-explore-list .ex-card');
}

async function loadRandomPuzzle() {
  showScreen('exercises');
  switchExTab('ex-list-view');
  getEl('ex-loading').style.display = 'block';
  getEl('ex-list-view').style.display = 'none';

  try {
    // We try to get the daily puzzle as a placeholder for "infinite" variety
    await loadDailyPuzzle();
    toast("¡Puzzle cargado! 🧩");
  } catch (e) {
    console.error("Error loading random puzzle:", e);
    toast("Error al cargar puzzle aleatorio");
  } finally {
    getEl('ex-loading').style.display = 'none';
  }
}

function exercisesBack() {
  selectedEx = null; exBoard = []; exSel = null; exValid = [];
  getEl('ex-list-view').style.display = '';
  getEl('ex-detail-view').style.display = 'none';
  getEl('ex-screen-title').textContent = 'Ejercicios';
  getEl('ex-back-btn').style.display = 'none';
}

let exMoveIndex = 0;
let currentExSolution = [];

function selectExercise(id, puzzleData = null) {
  let ex;
  if (puzzleData) {
    ex = puzzleData;
    // Track it locally if not already
    if (!exercises.find(e => e.id === id)) exercises = [ex, ...exercises];
  } else {
    ex = exercises.find(e => e.id === id);
  }
  if (!ex) return;
  selectedEx = ex;
  getEl('ex-back-btn').style.display = '';

  // Normalize solution (legacy may use nested arrays or LAN strings)
  currentExSolution = (ex.solution || []).map(s => {
    if (Array.isArray(s)) return s[0] + s[1]; // ["e2","e4"] -> "e2e4"
    return s.replace(' ', '');
  });

  exBoard = fenToBoard(ex.fen);
  const turn = getTurnFromFen(ex.fen);
  exStartTurn = turn === 'w' ? 'white' : 'black';

  exMoveIndex = 0;
  exLastMove = null;

  updateExUI(ex, turn);
  exSel = null; exValid = [];
  renderBoard(exBoard, 'ex-board', onExSquareClick, turn === 'b', null, null);

  // Better scroll to board
  const boardEl = getEl('ex-board');
  if (boardEl) boardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateExUI(ex, turn) {
  getEl('ex-title').textContent = ex.title;
  getEl('ex-desc').textContent = ex.description;
  getEl('ex-feedback').style.display = 'none';
  getEl('ex-prompt').style.display = '';
  getEl('ex-next-btn').style.display = 'none';
  getEl('ex-list-view').style.display = 'none';
  getEl('ex-detail-view').style.display = '';
  getEl('ex-screen-title').textContent = 'Resolver Ejercicio';

  const tp = getEl('ex-turn-pill');
  if (tp) {
    tp.textContent = turn === 'w' ? 'MUEVEN BLANCAS ♖' : 'MUEVEN NEGRAS ♜';
    tp.style.background = turn === 'w' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)';
  }
}

function resetExercise() { if (selectedEx) selectExercise(selectedEx.id); }

function onExSquareClick(r, c) {
  if (!selectedEx) return;
  const files = 'abcdefgh';
  const currentTurn = (exMoveIndex % 2 === 0) ? 'white' : 'black';
  const playerSide = exStartTurn === 'black' ? 'black' : 'white';

  if (exSel) {
    if (exValid.some(m => m[0] === r && m[1] === c)) {
      const moveLAN = files[exSel[1]] + (8 - exSel[0]) + files[c] + (8 - r);
      const expected = currentExSolution[exMoveIndex];

      if (moveLAN === expected) {
        applyLanToBoard(exBoard, moveLAN);
        exMoveIndex++;
        exLastMove = { from: [exSel[0], exSel[1]], to: [r, c] };
        exSel = null; exValid = [];
        renderBoard(exBoard, 'ex-board', onExSquareClick, playerSide === 'black', null, null);

        if (exMoveIndex >= currentExSolution.length) {
          showExFeedback(true, '¡Correcto! Has resuelto el ejercicio. 🎉');
          getEl('ex-next-btn').style.display = '';
          markPuzzleAsSolved(selectedEx.id || selectedEx.puzzleId);
        } else {
          showExFeedback(true, '¡Bien! Continúa...');
          setTimeout(() => {
            if (!selectedEx || exMoveIndex >= currentExSolution.length) return;
            const oppMove = currentExSolution[exMoveIndex];
            applyLanToBoard(exBoard, oppMove);
            exMoveIndex++;
            exLastMove = {
              from: [8 - parseInt(oppMove[1]), files.indexOf(oppMove[0])],
              to: [8 - parseInt(oppMove[3]), files.indexOf(oppMove[2])]
            };
            renderBoard(exBoard, 'ex-board', onExSquareClick, playerSide === 'black', null, null);

            if (exMoveIndex >= currentExSolution.length) {
              showExFeedback(true, '¡Correcto! Has resuelto el ejercicio. 🎉');
              getEl('ex-next-btn').style.display = '';
              markPuzzleAsSolved(selectedEx.id || selectedEx.puzzleId);
            }
          }, 600);
        }
      } else {
        showExFeedback(false, '❌ Movimiento incorrecto.');
        exSel = null; exValid = [];
        renderBoard(exBoard, 'ex-board', onExSquareClick, playerSide === 'black', null, null);
      }
      return;
    }
    exSel = null; exValid = [];
  }

  const cell = exBoard[r]?.[c];
  if (cell && cell.color === currentTurn) {
    exSel = [r, c];
    exValid = getBasicMoves(exBoard, r, c);
  }
  renderBoard(exBoard, 'ex-board', onExSquareClick, playerSide === 'black', null, null);
}

async function markPuzzleAsSolved(id) {
  if (!currentUser || !id) return;
  if (!userProfile.solved_puzzles) userProfile.solved_puzzles = [];
  if (userProfile.solved_puzzles.includes(id)) return;

  try {
    userProfile.solved_puzzles.push(id);
    await db.collection('users').doc(currentUser.uid).update({
      solved_puzzles: firebase.firestore.FieldValue.arrayUnion(id)
    });
    console.log("Puzzle marked as solved:", id);
    renderExerciseList();
  } catch (e) { console.error("Error marking puzzle as solved:", e); }
}

function showExFeedback(correct, msg) {
  const fb = getEl('ex-feedback');
  fb.style.display = '';
  fb.className = 'ex-feedback ' + (correct ? 'correct' : 'wrong');
  fb.style.background = correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
  fb.style.color = correct ? 'var(--green)' : 'var(--red)';
  fb.textContent = msg;
  getEl('ex-prompt').style.display = 'none';
}

function getExerciseHint() {
  if (!selectedEx || exMoveIndex >= currentExSolution.length) return;
  const move = currentExSolution[exMoveIndex];
  const files = 'abcdefgh';
  const fr = 8 - parseInt(move[1]), fc = files.indexOf(move[0]);
  const tr = 8 - parseInt(move[3]), tc = files.indexOf(move[2]);

  // Highlight the from square
  const hint = { from: [fr, fc], to: [tr, tc] };
  const isFlipped = exStartTurn === 'black';
  renderBoard(exBoard, 'ex-board', onExSquareClick, isFlipped, hint, null);
  toast('Pista: Fíjate en la pieza resaltada 💡');
}

// ============================================================
//  LICHESS PUZZLES
// ============================================================
async function loadDailyPuzzle() {
  getEl('ex-loading').style.display = 'flex';
  try {
    const today = new Date().toISOString().split('T')[0];
    const puzzleDoc = await db.collection('puzzles').doc('daily-' + today).get();

    if (puzzleDoc.exists) {
      console.log("Loading daily puzzle from cache...");
      selectExercise(puzzleDoc.id, puzzleDoc.data());
      return;
    }

    const res = await fetch('https://lichess.org/api/puzzle/daily');
    const data = await res.json();
    if (!data.game || !data.game.fen) {
      console.warn("Lichess Daily Puzzle missing FEN. Using fallback.");
      const fallbacks = await safeFetchJson('api/more_puzzles.json');
      if (fallbacks && fallbacks.length > 0) {
        selectExercise(fallbacks[0].id, fallbacks[0]);
        return;
      }
    }
    const puzzle = {
      id: 'daily-' + new Date().toISOString().split('T')[0],
      puzzleId: data.puzzle.id,
      fen: data.game.fen,
      solution: data.puzzle.solution,
      isLichess: true
    };

    await db.collection('puzzles').doc(puzzle.id).set(puzzle);
    selectExercise(puzzle.id, puzzle);
  } catch (e) {
    console.error("Error loading daily puzzle:", e);
    toast('Error al cargar el puzzle diario.');
  } finally {
    getEl('ex-loading').style.display = 'none';
  }
}

async function loadPuzzleById(id) {
  if (!id) return;
  getEl('ex-loading').style.display = 'flex';
  try {
    const puzzleDoc = await db.collection('puzzles').doc(id).get();
    if (puzzleDoc.exists) {
      console.log("Loading puzzle from cache:", id);
      selectExercise(id, puzzleDoc.data());
      return;
    }

    const res = await fetch(`https://lichess.org/api/puzzle/${id}`);
    const data = await res.json();
    const puzzle = {
      id: id,
      puzzleId: id,
      fen: data.game.fen,
      solution: data.puzzle.solution,
      isLichess: true
    };

    await db.collection('puzzles').doc(id).set(puzzle);
    selectExercise(id, puzzle);
  } catch (e) {
    console.error("Error loading puzzle by ID:", e);
    toast('Error al cargar el puzzle.');
  } finally {
    getEl('ex-loading').style.display = 'none';
  }
}
async function loadRandomPuzzle() {
  if (exercises.length > 0) {
    const rnd = exercises[Math.floor(Math.random() * exercises.length)];
    selectExercise(rnd.id);
  } else {
    // If no local exercises yet, try daily
    loadDailyPuzzle();
  }
}
function loadLichessPuzzle(puzzle, game) {
  getEl('ex-loading').style.display = 'none';
  if (!puzzle) return;

  // Create a temporary exercise for the list and select it
  const puzzleId = 'lichess-' + puzzle.id;
  const ex = {
    id: puzzleId,
    title: 'Puzzle Lichess #' + puzzle.id,
    description: `Rating: ${puzzle.rating || '?'} · ${(puzzle.themes || []).slice(0, 3).join(', ')}`,
    fen: puzzle.fen,
    solution: puzzle.solution || [],
    difficulty: 'Avanzado',
    isLichess: true
  };

  // Add to local list so selectExercise can find it
  exercises = [ex, ...exercises.filter(e => !e.id.startsWith('lichess'))];
  selectExercise(puzzleId);
}

// ============================================================
//  FEN PARSER (simplified)
// ============================================================
function fenToBoard(fen) {
  const pieceMap = { p: 'P', r: 'R', n: 'N', b: 'B', q: 'Q', k: 'K' };
  const grid = Array(8).fill(null).map(() => Array(8).fill(null));
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let c = 0;
    for (let ch of row) {
      if (isNaN(ch)) {
        const isW = ch === ch.toUpperCase();
        grid[r][c] = { color: isW ? 'white' : 'black', type: ch.toUpperCase() };
        c++;
      } else c += parseInt(ch);
    }
  });
  return grid;
}

function boardToFen(grid, turn = 'w') {
  let fen = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = grid[r][c];
      if (!p) empty++;
      else {
        if (empty > 0) { fen += empty; empty = 0; }
        const char = p.type;
        fen += (p.color === 'white' ? char.toUpperCase() : char.toLowerCase());
      }
    }
    if (empty > 0) fen += empty;
    if (r < 7) fen += "/";
  }
  return `${fen} ${turn} - - 0 1`;
}

function getBasicMoves(grid, r, c) {
  const p = grid[r][c];
  if (!p) return [];
  const turn = p.color === 'white' ? 'w' : 'b';
  const currentFen = boardToFen(grid, turn);
  const engine = new ChessBoard();
  engine.loadFromFen(currentFen);
  // Ensure engine state matches grid exactly (Piece objects in engine vs literals in grid)
  const legal = engine.getLegalMoves(r, c);
  return legal; // Array of [r, c]
}

// ============================================================
//  OPENINGS
// ============================================================
async function loadOpenings() {
  try {
    const snapshot = await db.collection('openings').get();
    if (snapshot.empty) {
      console.warn("Firestore 'openings' collection is empty. Falling back to local JSON.");
      const data = await safeFetchJson('api/openings.json');
      if (data && Array.isArray(data)) {
        openings = data;
        renderOpeningsList();
      }
      return;
    }
    openings = snapshot.docs.map(doc => doc.data());
    renderOpeningsList();
    getEl('bootstrap-migration').style.display = 'none';
  } catch (e) {
    console.error("Error loading openings from Firestore:", e);
    // Fallback to local
    const data = await safeFetchJson('api/openings.json');
    if (data && Array.isArray(data)) {
      openings = data;
      renderOpeningsList();
    }
  }
}

async function checkMigrationStatus() {
  try {
    const opSnap = await db.collection('openings').limit(1).get();
    const exSnap = await db.collection('exercises').limit(1).get();
    if (opSnap.empty || exSnap.empty) {
      getEl('bootstrap-migration').style.display = 'block';
      const opBtn = getEl('btn-migrate-op');
      const exBtn = getEl('btn-migrate-ex');
      if (opBtn) opBtn.style.display = opSnap.empty ? '' : 'none';
      if (exBtn) exBtn.style.display = exSnap.empty ? '' : 'none';
    }
  } catch (e) { console.error("Migration check failed:", e); }
}

// Robust utility to migrate openings to Firestore with progress saving (Call from lobby button)
async function migrateOpeningsToFirestore() {
  const btn = getEl('btn-migrate-op');
  const originalText = btn ? btn.innerHTML : "📦 Migrar Aperturas";

  try {
    const data = await safeFetchJson('api/openings.json');
    if (!data || !Array.isArray(data)) return console.error("Could not load local openings.");

    // Check for saved progress in localStorage
    let startIdx = parseInt(localStorage.getItem('tosito_migration_idx') || '0');

    if (startIdx === 0) {
      const confirmPurge = confirm(`Se van a migrar ${data.length} aperturas. ¿Deseas ELIMINAR el contenido previo de la colección 'openings' para evitar duplicados?`);
      if (confirmPurge) {
        if (btn) btn.innerHTML = "🧹 Limpiando base de datos...";
        const oldDocs = await db.collection('openings').get();
        const deletePromises = oldDocs.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        console.log("Collection 'openings' purged.");
      }
    }

    if (startIdx >= data.length) startIdx = 0; // Reset if already done previously
    if (btn) btn.disabled = true;

    const BATCH_SIZE = 15;
    for (let i = startIdx; i < data.length; i += BATCH_SIZE) {
      const chunk = data.slice(i, i + BATCH_SIZE);
      const batchPromises = chunk.map(op => db.collection('openings').doc(op.id).set(op));

      await Promise.all(batchPromises);

      const currentProgress = Math.min(i + BATCH_SIZE, data.length);
      localStorage.setItem('tosito_migration_idx', currentProgress.toString());

      if (btn) btn.innerHTML = `📦 Procesando ${currentProgress}/${data.length}...`;
      console.log(`Uploaded batch up to ${currentProgress}`);

      await new Promise(r => setTimeout(r, 400)); // Slightly longer delay for safety
    }

    console.log("Migration complete!");
    localStorage.removeItem('tosito_migration_idx'); // Clear progress
    if (btn) {
      btn.innerHTML = "✅ Migración Completa";
      btn.classList.add('badge-success');
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.classList.remove('badge-success');
        // Hide migration panel if it was empty check
        checkMigrationStatus();
      }, 3000);
    }
    toast("Aperturas migradas correctamente! 🔥");

  } catch (e) {
    console.error("Migration failed:", e);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "❌ Error (Reintentar)";
    }
    toast("Error en la migración. Reintenta.");
  }
}

// Robust utility to migrate 248 masters and 5000+ games to Firestore
async function migrateHistoricalToFirestore() {
  const btn = getEl('btn-migrate-hist');
  const originalText = btn ? btn.innerHTML : "🏆 Migrar Histórico";

  try {
    const mastersData = await safeFetchJson('api/historical_masters.json?v=' + Date.now());
    const gamesData = await safeFetchJson('api/historical_games.json?v=' + Date.now());

    if (!mastersData || !gamesData) return toast("Error: No se cargaron los archivos JSON.");

    // Track progress by master index
    let startIdx = parseInt(localStorage.getItem('tosito_hist_migration_idx') || '0');

    // 1. Optional Purge on Start
    if (startIdx === 0) {
      const confirmPurge = confirm(`Se van a migrar ${mastersData.length} maestros y sus partidas. ¿Deseas ELIMINAR el contenido previo de 'historical_masters' y 'historical_games' para evitar duplicados?`);
      if (confirmPurge) {
        if (btn) btn.innerHTML = "🧹 Limpiando históricos...";
        // Batch delete is slow/limited, but these are small collections (indexed by ID)
        // For games, we can't delete 5000 in one go easily without a loop, but let's try a simple approach
        const oldMasters = await db.collection('historical_masters').get();
        await Promise.all(oldMasters.docs.map(doc => doc.ref.delete()));

        // Games might be too many (5000+), let's delete them in batches if they exist 
        // to avoid Firestore timeout/limit. But for now, a simple Promise.all on a small set 
        // or just rely on overwritten IDs since I use gameId = masterId_g...
        console.log("Historical collections purged or ready for overwrite.");
      }
    }

    if (startIdx >= mastersData.length) startIdx = 0;

    const totalSteps = mastersData.length;
    if (btn) btn.disabled = true;

    // 1. First, upload all Masters (they are few, 248)
    if (startIdx === 0) {
      if (btn) btn.innerHTML = "🔨 Registrando Maestros...";
      const mBatchPromises = mastersData.map(m => db.collection('historical_masters').doc(m.id).set(m));
      await Promise.all(mBatchPromises);
      console.log("All masters indexed.");
    }

    // 2. Upload Games in batches per master
    for (let i = startIdx; i < mastersData.length; i++) {
      const master = mastersData[i];
      const masterGames = gamesData.filter(g => g.masterId === master.id);

      console.log(`- Migration: [${i + 1}/${totalSteps}] ${master.name} (ID: ${master.id}) - Found ${masterGames.length} games.`);

      if (btn) btn.innerHTML = `🏆 Subiendo ${master.name} (${i + 1}/${totalSteps})...`;

      // Batch upload games for this master
      const BATCH_SIZE = 25;
      for (let j = 0; j < masterGames.length; j += BATCH_SIZE) {
        const chunk = masterGames.slice(j, j + BATCH_SIZE);
        const batchPromises = chunk.map(g => {
          // Generate a unique ID for the game to avoid duplicates (masterId + index)
          const gameId = `${g.masterId}_g${j + chunk.indexOf(g)}`;
          return db.collection('historical_games').doc(gameId).set(g);
        });
        await Promise.all(batchPromises);
      }

      // Save progress after each master
      localStorage.setItem('tosito_hist_migration_idx', (i + 1).toString());
      console.log(`Processed Master: ${master.name} (${i + 1}/${totalSteps})`);

      // Breath for Firestore and UI
      await new Promise(r => setTimeout(r, 200));
    }

    console.log("Historical migration complete!");
    localStorage.removeItem('tosito_hist_migration_idx');

    if (btn) {
      btn.innerHTML = "✅ Histórico Completo";
      btn.classList.add('badge-success');
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.classList.remove('badge-success');
      }, 5000);
    }
    toast("Base de datos histórica actualizada! 🏆");

  } catch (e) {
    console.error("Historical migration failed:", e);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "❌ Error (Reintentar)";
    }
    toast("Error en migración histórica. Reintenta.");
  }
}


function renderOpeningsList(query = '') {
  const el = getEl('op-list');
  if (!el) return;
  const q = query.toLowerCase();

  const filtered = openings.filter(op => {
    // If there is no query, show all
    if (!q) return true;

    // Check if query matches eco, name, or family (e.g., 'A', 'B')
    const matchEco = op.eco && op.eco.toLowerCase().includes(q);
    const matchName = op.name && op.name.toLowerCase().includes(q);

    // Determine family from the first letter of ECO if not explicitly in JSON
    const family = op.eco ? op.eco.charAt(0).toLowerCase() : '';
    const matchFamily = (family === q);

    return matchEco || matchName || matchFamily;
  });

  el.innerHTML = filtered.map(op =>
    `<div class="item-card" onclick="selectOpening('${op.id}')">
      <div>
        <div class="badge badge-sky" style="margin-bottom:6px;">${op.eco}</div>
        <h4 style="font-size:1.05rem">${op.name}</h4>
        <p style="font-size:.85rem;color:var(--muted);margin-top:4px">${(op.description || '').substring(0, 80)}...</p>
      </div>
      <span class="item-icon">›</span>
    </div>`
  ).join('');
}

function filterOpenings() {
  const q = getEl('op-search-input').value;
  renderOpeningsList(q);
}

function openingsBack() {
  if (selectedOp) {
    selectedOp = null; opBoard = [];
    getEl('op-list-view').style.display = '';
    getEl('op-detail-view').style.display = 'none';
    getEl('op-screen-title').textContent = 'Aperturas';
    getEl('op-back-btn').style.display = 'none';
  }
}

function selectOpening(id) {
  selectedOp = openings.find(o => o.id === id);
  if (!selectedOp) return;
  opMoveIdx = 0;
  opBoard = fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  getEl('op-eco').textContent = selectedOp.eco;
  getEl('op-name').textContent = selectedOp.name;
  getEl('op-desc').textContent = selectedOp.description;
  getEl('op-list-view').style.display = 'none';
  getEl('op-detail-view').style.display = '';
  getEl('op-screen-title').textContent = 'Apertura';
  getEl('op-back-btn').style.display = '';
  renderOpBoard(); updateOpLabel();
}

function resetOpening() { opMoveIdx = 0; opBoard = fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); renderOpBoard(); updateOpLabel(); }

function prevOpMove() { if (opMoveIdx > 0) { opMoveIdx--; rebuildOpBoard(); } }
function nextOpMove() {
  if (!selectedOp || opMoveIdx >= selectedOp.moves_lan.length) return;
  const lan = selectedOp.moves_lan[opMoveIdx];
  applyLanToBoard(opBoard, lan);
  opMoveIdx++;
  renderOpBoard(); updateOpLabel();
}
function rebuildOpBoard() {
  opBoard = fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  for (let i = 0; i < opMoveIdx; i++) applyLanToBoard(opBoard, selectedOp.moves_lan[i]);
  renderOpBoard(); updateOpLabel();
}
function applyLanToBoard(grid, lan) {
  const files = 'abcdefgh';
  const sc = files.indexOf(lan[0]), sr = 8 - parseInt(lan[1]);
  const ec = files.indexOf(lan[2]), er = 8 - parseInt(lan[3]);
  if (sc < 0 || ec < 0) return;
  grid[er][ec] = grid[sr][sc]; grid[sr][sc] = null;
  // Castling
  if (grid[er][ec]?.type === 'K') {
    if (ec - sc === 2) { grid[er][5] = grid[er][7]; grid[er][7] = null; }
    if (sc - ec === 2) { grid[er][3] = grid[er][0]; grid[er][0] = null; }
  }
}
function onOpSquareClick(r, c) {
  if (!selectedOp || opMoveIdx >= selectedOp.moves_lan.length) return;
  const turn = opMoveIdx % 2 === 0 ? 'white' : 'black';

  if (opSel) {
    if (opValid.some(m => m[0] === r && m[1] === c)) {
      const files = 'abcdefgh';
      const moveLAN = files[opSel[1]] + (8 - opSel[0]) + files[c] + (8 - r);
      const expected = selectedOp.moves_lan[opMoveIdx];

      if (moveLAN === expected) {
        applyLanToBoard(opBoard, moveLAN);
        opMoveIdx++;
        opSel = null; opValid = [];
        renderOpBoard();
        updateOpLabel();

        // Auto-reply for opponent
        if (opMoveIdx < selectedOp.moves_lan.length) {
          setTimeout(() => {
            const nextLAN = selectedOp.moves_lan[opMoveIdx];
            applyLanToBoard(opBoard, nextLAN);
            opMoveIdx++;
            renderOpBoard();
            updateOpLabel();
          }, 600);
        }
      } else {
        toast('❌ No es la jugada teórica.');
        opSel = null; opValid = [];
        renderOpBoard();
      }
      return;
    }
    opSel = null; opValid = [];
  }

  const cell = opBoard[r][c];
  if (cell && cell.color === turn) {
    opSel = [r, c];
    opValid = getBasicMoves(opBoard, r, c);
  }
  renderOpBoard();
}

function renderOpBoard() {
  const lastLan = opMoveIdx > 0 ? selectedOp.moves_lan[opMoveIdx - 1] : null;
  let lm = null;
  if (lastLan) {
    const files = 'abcdefgh';
    lm = { from: [8 - parseInt(lastLan[1]), files.indexOf(lastLan[0])], to: [8 - parseInt(lastLan[3]), files.indexOf(lastLan[2])] };
  }
  const prevLM = lastMove;
  const prevExSel = exSel; const prevExValid = exValid;
  const prevSelectedSq = selectedSq; const prevValidMoves = validMoves;

  // Use global variable names that renderBoard expects for selection/valid moves
  // This is a bit hacky but works with the current renderBoard structure
  exSel = opSel; exValid = opValid;
  renderBoard(opBoard, 'op-board', onOpSquareClick, false, null, null);

  // Restore
  exSel = prevExSel; exValid = prevExValid;
}
function updateOpLabel() {
  const el = getEl('op-move-label');
  const prev = getEl('op-prev');
  const next = getEl('op-next');
  if (opMoveIdx === 0) el.textContent = 'Posición Inicial';
  else { const san = selectedOp.moves_san?.[opMoveIdx - 1] || '?'; el.textContent = `Jugada ${opMoveIdx}: ${san}`; }
  prev.disabled = opMoveIdx === 0;
  next.disabled = !selectedOp || opMoveIdx >= selectedOp.moves_lan.length;
}

// ============================================================
//  PROFILE — USERNAME EDIT
// ============================================================
function startEditUser() {
  const disp = getEl('profile-user-display');
  const inp = getEl('profile-user-input');
  const save = getEl('profile-user-save');
  inp.value = userProfile.username;
  disp.style.display = 'none'; inp.style.display = ''; save.style.display = ''; inp.focus();
}
async function saveUsername() {
  const inp = getEl('profile-user-input');
  const val = inp.value.trim().replace('@', '');
  if (!val) return;
  await db.collection('users').doc(currentUser.uid).update({ username: val });
  userProfile.username = val;
  getEl('profile-user-display').textContent = `@${val}`;
  getEl('profile-user-display').style.display = '';
  getEl('profile-user-input').style.display = 'none';
  getEl('profile-user-save').style.display = 'none';
  toast('Usuario actualizado ✓');
}

// ============================================================
//  SOCIAL
// ============================================================
async function loadSocial() {
  if (!currentUser) return;
  try {
    const userUid = currentUser.uid;
    // 1. Friends from the array in userProfile
    friends = [];
    if (userProfile.friends && userProfile.friends.length > 0) {
      const fSnap = await db.collection('users').where('uid', 'in', userProfile.friends).get();
      fSnap.forEach(doc => friends.push({ id: doc.id, ...doc.data() }));
    }

    // 2. Incoming Requests (root collection)
    const rSnap = await db.collection('friend_requests')
      .where('toUid', '==', userUid)
      .where('status', '==', 'pending')
      .get();
    friendRequests = [];
    rSnap.forEach(doc => friendRequests.push({ id: doc.id, ...doc.data() }));

    // 3. Game Challenges (root collection)
    const cSnap = await db.collection('game_challenges')
      .where('toUid', '==', userUid)
      .where('status', '==', 'pending')
      .get();
    challenges = [];
    cSnap.forEach(doc => challenges.push({ id: doc.id, ...doc.data() }));

    renderSocial();
    // Badges
    const reqTab = getEl('soc-req-tab');
    const chalTab = getEl('soc-chal-tab');
    if (reqTab) reqTab.innerHTML = `SOLICITUDES ${friendRequests.length > 0 ? '<span class="notif-dot"></span>' : ''}`;
    if (chalTab) chalTab.innerHTML = `RETOS ${challenges.length > 0 ? '<span class="notif-dot"></span>' : ''}`;
  } catch (e) { console.error("Error loading social:", e); }
}

function renderSocial() {
  // Friends
  const fp = getEl('soc-friends');
  fp.innerHTML = friends.length ? friends.map(f => `<div class="friend-card"><div class="friend-avatar">👤</div><div><h5>${f.displayName || f.username || f.email || 'Amigo'}</h5><div class="fr-sub">@${f.username || '--'}</div></div><button onclick="challengeFriend('${f.id}')" class="btn btn-ghost" style="width:auto;padding:6px 12px;font-size:.75rem;margin-left:auto;border-color:rgba(16,185,129,.4);color:var(--green)">RETAR ⚔️</button></div>`).join('') : `<div class="empty-soc">Aún no tienes amigos 😔</div>`;
  // Requests
  const rp = getEl('soc-requests');
  rp.innerHTML = friendRequests.length ? friendRequests.map(r => `<div class="friend-card"><div class="friend-avatar">📨</div><div style="flex:1"><h5>${r.fromName || r.fromEmail || 'Alguien'}</h5><div class="fr-sub">Quiere ser tu amigo</div></div><div class="req-btns"><button class="btn-acc" onclick="acceptFriend('${r.id}','${r.fromUid}')">✓ Aceptar</button><button class="btn-rej" onclick="rejectFriend('${r.id}')">✕</button></div></div>`).join('') : `<div class="empty-soc">Sin solicitudes pendientes</div>`;
  // Challenges
  const cp = getEl('soc-challenges');
  cp.innerHTML = challenges.length ? challenges.map(c => `<div class="friend-card"><div class="friend-avatar">⚔️</div><div style="flex:1"><h5>${c.fromName || 'Alguien'} te reta</h5><div class="fr-sub">¿Aceptas el duelo?</div></div><div class="req-btns"><button class="btn-acc" onclick="acceptChallenge('${c.id}','${c.fromUid}')">Aceptar</button><button class="btn-rej" onclick="rejectChallenge('${c.id}')">✕</button></div></div>`).join('') : `<div class="empty-soc">Sin retos pendientes ⚔️</div>`;
}

async function sendFriendRequest() {
  const inputEl = getEl('friend-input');
  if (!inputEl || !currentUser) return;
  const val = inputEl.value.trim().toLowerCase();
  if (!val) return;
  try {
    // Find user by username_lowercase (Android convention)
    let snap = await db.collection('users').where('username_lowercase', '==', val).limit(1).get();
    if (snap.empty) snap = await db.collection('users').where('email', '==', val).limit(1).get();

    if (snap.empty) { toast('Usuario no encontrado'); return; }
    const target = snap.docs[0];
    const targetId = target.id;

    if (targetId === currentUser.uid) { toast('No puedes añadirte a ti mismo'); return; }

    await db.collection('friend_requests').add({
      fromUid: currentUser.uid,
      fromName: userProfile.displayName || userProfile.username || currentUser.displayName || 'Anon',
      toUid: targetId,
      status: 'pending',
      timestamp: Date.now().toString()
    });
    inputEl.value = '';
    toast('Solicitud enviada ✓');
  } catch (e) { console.error(e); toast('Error al enviar solicitud'); }
}

async function acceptFriend(reqId, fromUid) {
  try {
    const myUid = currentUser.uid;
    // 1. Update My Friends Array
    const myDoc = await db.collection('users').doc(myUid).get();
    let myFriends = myDoc.data().friends || [];
    if (!myFriends.includes(fromUid)) {
      myFriends.push(fromUid);
      await db.collection('users').doc(myUid).update({ friends: myFriends });
      userProfile.friends = myFriends;
    }

    // 2. Update Their Friends Array
    const theirDoc = await db.collection('users').doc(fromUid).get();
    let theirFriends = theirDoc.data().friends || [];
    if (!theirFriends.includes(myUid)) {
      theirFriends.push(myUid);
      await db.collection('users').doc(fromUid).update({ friends: theirFriends });
    }

    // 3. Delete Request
    await db.collection('friend_requests').doc(reqId).delete();

    loadSocial();
    toast('Amigo añadido ✓');
  } catch (e) { console.error(e); toast('Error al aceptar amigo'); }
}

async function rejectFriend(reqId) {
  try {
    await db.collection('friend_requests').doc(reqId).delete();
    loadSocial();
    toast('Solicitud rechazada');
  } catch (e) { console.error(e); }
}

async function challengeFriend(uid) { toast('Función de retos (root) en desarrollo 🛠'); }
async function acceptChallenge(cId, fromUid) { toast('Aceptando reto...'); }
async function rejectChallenge(cId) {
  try {
    await db.collection('game_challenges').doc(cId).update({ status: 'rejected' });
    loadSocial();
  } catch (e) { console.error(e); }
}

// ============================================================
//  TOAST
// ============================================================
let toastTimer = null;
function toast(msg, duration = 2800) {
  const el = getEl('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ============================================================
//  POLL (for multiplayer sync)
// ============================================================
// ============================================================
//  HISTORICAL MASTERS GALLERY
// ============================================================
let historicalMasters = [];
let viewingGame = null; // {moves: [], fens: [], index: 0}

async function loadHistoricalGames() {
  const el = getEl('masters-list');
  if (!el) return;

  el.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem;">Cargando Galería de Maestros (Nube)... 🏆</div>';

  try {
    // Fetch from Firestore or fresh JSON if initial sync
    const mastersData = await safeFetchJson('api/historical_masters.json?v=' + Date.now());
    if (mastersData) historicalMasters = mastersData;
    renderMastersList();
  } catch (e) {
    console.error("Error loading masters from Firestore:", e);
    // Fallback if needed? No, let's keep it Cloud-focused as requested
    el.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--red);">Error al conectar con el archivo histórico de Firebase.</div>';
  }
}

function renderMastersList() {
  const el = getEl('masters-list');
  el.innerHTML = historicalMasters.map((m) => `
    <div class="item-card" onclick="showMasterGames('${m.id}')">
      <div style="display:flex; align-items:center; gap:15px;">
        <div style="width:50px; height:50px; background:rgba(56,189,248,0.1); border:1px solid var(--sky); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">👤</div>
        <div>
          <h4 style="margin:0">${m.name}</h4>
          <p style="font-size:0.8rem; color:var(--muted)">Estudiar histórico →</p>
        </div>
      </div>
      <span class="item-icon">›</span>
    </div>
  `).join('');
}

async function showMasterGames(masterId) {
  console.log("Querying games for masterId:", masterId);
  const master = historicalMasters.find(m => m.id === masterId);
  if (!master) return;

  const listEl = getEl('masters-list');
  if (listEl) listEl.style.display = 'none';
  const box = getEl('master-games-box');
  box.style.display = 'block';
  getEl('current-master-name').textContent = `Partidas de ${master.name}`;

  const list = getEl('master-games-list');
  list.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem;">Consultando partidas en Firebase... 📡</div>';

  try {
    // DIAGNOSTIC CHECK: Print sample documents from DB
    const sample = await db.collection('historical_games').limit(5).get();
    if (!sample.empty) {
      console.log("DB Sample Doc [0]:", sample.docs[0].id, sample.docs[0].data());
    } else {
      console.warn("DB Collection 'historical_games' appears empty.");
    }

    const snapshot = await db.collection('historical_games')
      .where('masterId', '==', masterId)
      .limit(50)
      .get();

    if (snapshot.empty) {
      console.warn("No games found for:", masterId);
      list.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--muted);">No se encontraron partidas para ID: ${masterId}.</div>`;
      return;
    }

    const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    list.innerHTML = games.map((g) => `
      <div class="item-card" onclick="viewMasterGameFirestore('${g.id}')" style="transition:0.6s">
        <div style="flex:1">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span class="badge badge-sky">${g.date}</span>
            <span style="font-size:0.8rem; color:var(--muted)">${g.result}</span>
          </div>
          <h4 style="font-size:1rem">${g.white} vs ${g.black}</h4>
          <p style="font-size:0.8rem">${g.event}</p>
        </div>
        <span class="item-icon">👁️</span>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--red);">Error al recuperar partidas.</div>';
  }
}

function hideMasterGames() {
  const box = getEl('master-games-box');
  const list = getEl('masters-list');
  if (box) box.style.display = 'none';
  if (list) list.style.display = 'grid';
}



async function viewMasterGameFirestore(gameId) {
  toast('Cargando partida desde Firebase... 🔥');
  try {
    const doc = await db.collection('historical_games').doc(gameId).get();
    if (!doc.exists) throw new Error("La partida no existe en Firestore.");
    const data = doc.data();

    // Setup View Mode (Reusing openings screen UI)
    let movesArray = [];
    if (Array.isArray(data.moves)) {
      movesArray = data.moves;
    } else {
      movesArray = (data.moves || '').split(' ').filter(m => m !== '');
    }

    selectedOp = {
      name: `${data.white} vs ${data.black}`,
      description: `${data.event} (${data.date}) · ECO: ${data.eco}`,
      eco: data.eco || 'PGN',
      moves_lan: movesArray,
      moves_san: movesArray,
      fens: data.fens
    };

    opMoveIdx = 0;
    opBoard = fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

    getEl('op-eco').textContent = selectedOp.eco;
    getEl('op-name').textContent = selectedOp.name;
    getEl('op-desc').textContent = selectedOp.description;

    showScreen('openings');
    getEl('op-list-view').style.display = 'none';
    getEl('op-detail-view').style.display = '';
    getEl('op-screen-title').textContent = 'Visor Firebase';
    getEl('op-back-btn').style.display = '';

    renderOpBoard(); updateOpLabel();
  } catch (e) {
    console.error(e);
    toast('Error: ' + e.message);
  }
}

// ============================================================
//  JUICY UI & AMBIENT ANIMATIONS (V12.0)
// ============================================================

/**
 * Sistema de partículas premium en canvas para el fondo.
 */
function initAmbientBackground() {
  const canvas = document.createElement('canvas');
  canvas.id = 'ambient-bg';
  canvas.style.cssText = "position:fixed; inset:0; z-index:-1; opacity:0.6; pointer-events:none;";
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.size = Math.random() * 2 + 1;
      this.alpha = Math.random() * 0.5 + 0.1;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
    }
    draw() {
      ctx.fillStyle = `rgba(56, 189, 248, ${this.alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i < 60; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.update();
      p.draw();
    });

    // Draw connections
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
}

/**
 * Premium Interactive Background Mesh (Neon Grid)
 */
function initInteractiveMesh() {
  const canvas = document.getElementById('mesh-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, points = [];
  const spacing = 40;
  let mouse = { x: -1000, y: -1000 };

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    initPoints();
  }

  function initPoints() {
    points = [];
    for (let x = 0; x < w + spacing; x += spacing) {
      for (let y = 0; y < h + spacing; y += spacing) {
        points.push({ x, y, originX: x, originY: y });
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 0.5;

    points.forEach(p => {
      const dx = mouse.x - p.originX;
      const dy = mouse.y - p.originY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = Math.max(0, (150 - dist) / 150);

      p.x = p.originX - dx * force * 0.5;
      p.y = p.originY - dy * force * 0.5;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.8, 0, Math.PI * 2);
      ctx.fillStyle = force > 0 ? `rgba(56, 189, 248, ${0.1 + force * 0.4})` : 'rgba(56, 189, 248, 0.1)';
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }

  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('resize', resize);
  resize();
  animate();
}

/**
 * Advanced 3D Tilt Engine & Juicy UI
 */
window.initJuicyUI = function () {
  if (typeof gsap === 'undefined') return;

  const cards = document.querySelectorAll('.hub-card');
  cards.forEach(card => {
    if (card._tiltBound) return;
    card._tiltBound = true;

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -10;
      const rotateY = ((x - centerX) / centerX) * 10;

      gsap.to(card, {
        rotateX: rotateX,
        rotateY: rotateY,
        duration: 0.5,
        ease: "power2.out",
        overwrite: true
      });

      // Update glow position
      card.style.setProperty('--glow-x', `${x - 75}px`);
      card.style.setProperty('--glow-y', `${y - 75}px`);
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, duration: 1, ease: "elastic.out(1, 0.3)" });
    });
  });

  const buttons = document.querySelectorAll('.btn, .nav-btn, .item-card:not(.hub-card)');
  buttons.forEach(btn => {
    if (btn._juicyBound) return;
    btn._juicyBound = true;
    btn.addEventListener('mouseenter', () => gsap.to(btn, { scale: 1.05, duration: 0.3, ease: "back.out(2)" }));
    btn.addEventListener('mouseleave', () => gsap.to(btn, { scale: 1, duration: 0.3, ease: "power2.out" }));
    btn.addEventListener('mousedown', () => gsap.to(btn, { scale: 0.95, duration: 0.1 }));
    btn.addEventListener('mouseup', () => gsap.to(btn, { scale: 1.05, duration: 0.2 }));
  });
};

/**
 * Lanza una celebración masiva de victoria.
 */
window.triggerCelebration = function () {
  if (typeof gsap === 'undefined') return;
  toast("✨ ¡VICTORIA EXCEPCIONAL! ✨");

  const overlay = document.createElement('div');
  overlay.style.cssText = "position:fixed; inset:0; background:white; z-index:9999; pointer-events:none; opacity:0;";
  document.body.appendChild(overlay);

  gsap.to(overlay, {
    opacity: 0.3, duration: 0.1, repeat: 3, yoyo: true,
    onComplete: () => overlay.remove()
  });
  gsap.to("#app-container", { x: 10, duration: 0.05, repeat: 10, yoyo: true, ease: "none" });
};

// Global Init on Load
document.addEventListener('DOMContentLoaded', () => {
  initAmbientBackground();
  initInteractiveMesh();
  initJuicyUI();

  // Cinematic Load-in
  if (typeof gsap !== 'undefined') {
    gsap.from(".hub-header", { y: -50, opacity: 0, duration: 1, ease: "expo.out" });
    gsap.from(".hub-hero h1", { y: 50, opacity: 0, duration: 1.2, ease: "expo.out", delay: 0.5 });
    gsap.from(".hub-hero .hero-sub", { y: 30, opacity: 0, duration: 1, ease: "power2.out", delay: 0.8 });
  }

  // Init Stack Game Engine (Global)
  // Removed initStackGame() as it is now handled by the React MicroApp in the iframe
});

// ======================================================
// CYBER STACK BRIDGE (POSTMESSAGE)
// ======================================================
window.addEventListener('message', (event) => {
  // Simple origin check (optional, but good practice if origin is known)
  // if (event.origin !== window.location.origin) return;

  if (event.data && event.data.type === 'SAVE_SCORE') {
    const score = event.data.score;
    console.log(`[🕹️] Score received from Cyber Stack: ${score}`);
    updateArcadeRecord('stack', score);
  }
  if (event.data === 'exit_game') {
    if (typeof signalRemoteLayout === 'function') signalRemoteLayout('simple');
    showScreen('hub');
    // Clear frame to stop game logic/audio
    const frame = document.getElementById('hexa-falls-frame');
    if (frame) frame.src = 'about:blank';

    // HUB UI RESET: Hub should not have side nav or bottom nav
    getEl('bottom-nav')?.classList.add('hidden');
    syncNavOpen(false);
  }
});

/**
 * CYBER STACK INTEGRATION
 */
window.showStackScreen = function () {
  if (typeof signalRemoteLayout === 'function') signalRemoteLayout('gaming');
  showScreen('stack');

  const frame = document.getElementById('stack-frame');
  if (frame) {
    const appId = 'stack-game-default';
    const config = encodeURIComponent(JSON.stringify(firebaseConfig || {}));
    // Cache bust using timestamp
    const v = Date.now();
    const src = `/cyberstack_game.html?v=${v}&appId=${appId}&config=${config}`;

    // Always update src to force reload and avoid cache
    frame.src = src;
  }
};

/**
 * HEXA FALLS INTEGRATION
 */
window.showHexaFallsScreen = function () {
  if (typeof signalRemoteLayout === 'function') signalRemoteLayout('gaming');
  showScreen('hexa-falls');

  const frame = document.getElementById('hexa-falls-frame');
  if (frame) {
    const gameAppId = 'hexa-falls-v1';
    const config = encodeURIComponent(JSON.stringify(firebaseConfig || {}));
    // Extremely robust name resolution
    const authUser = firebase.auth().currentUser;
    const playerName = (userProfile.username && userProfile.username.trim()) ||
      (userProfile.displayName && userProfile.displayName.trim()) ||
      (authUser && authUser.displayName && authUser.displayName.trim()) ||
      (authUser && authUser.email && authUser.email.trim()) ||
      'Frijolito';

    console.log(`[🕹️] Launching Hexa Falls as: ${playerName}`);
    const v = Date.now();
    const src = `/hexa-falls.html?v=${v}&appId=${gameAppId}&config=${config}&playerName=${encodeURIComponent(playerName)}`;

    frame.src = src;
  }
};

/**
 * Global Record Updater for Arcade Games
 */
window.updateArcadeRecord = function (gameId, score) {
  if (gameId === 'stack') {
    const currentBest = parseInt(localStorage.getItem('tosito_stack_best') || '0');
    if (score > currentBest) {
      localStorage.setItem('tosito_stack_best', score);
      safeSetText('prof-stack-best', `${score}m`);
      toast(`🚀 ¡NUEVO RÉCORD EN STACK: ${score}m!`);

      if (currentUser && db) {
        // Sync with Platform Profile
        db.collection('users').doc(currentUser.uid).update({
          stack_best: score
        }).catch(err => console.log("Profile sync err:", err));

        // Sync with EXACT game artifact (leaderboard/stats)
        const appId = 'stack-game-default';
        const gameRef = db.collection('artifacts').doc(appId);

        // Personal highscore
        gameRef.collection('users').doc(currentUser.uid).collection('stats').doc('highscore').set({
          score: score,
          date: new Date().toISOString()
        }).catch(err => console.error("Game stats err:", err));

        // Public leaderboard
        gameRef.collection('public').doc('data').collection('leaderboard').doc(currentUser.uid).set({
          score: score,
          uid: currentUser.uid,
          date: new Date().toISOString()
        }).catch(err => console.error("Leaderboard err:", err));
      }

      updateLobbyUI();
      // ============================================================
      //  INIT & AUTH LIFECYCLE
      // ============================================================
      let isAppReady = false;

      function hideAppLoader() {
        const loader = document.getElementById('app-loader');
        if (!loader) return;
        isAppReady = true;
        loader.style.display = 'none';
        console.log("[🚀] App Revealed");
      }

      // Global Safety Timer
      setTimeout(() => { if (!isAppReady) hideAppLoader(); }, 10000);

      auth.onAuthStateChanged(async user => {
        try {
          const authWall = document.getElementById('auth-wall');
          const appContainer = document.getElementById('app-container');
          const nav = document.getElementById('bottom-nav');

          if (user) {
            currentUser = user;

            // Reveal App
            if (authWall) authWall.style.display = 'none';
            if (appContainer) {
              appContainer.style.display = 'block';
              appContainer.style.opacity = '1';
              appContainer.classList.remove('is-hidden');
            }
            if (nav) nav.classList.remove('hidden');

            hideAppLoader();

            await loadUserProfile();
            updateLobbyUI();

            // Module Inits
            if (window.checkRemoteMode) checkRemoteMode();
          } else {
            // Show Auth login screen
            if (appContainer) appContainer.style.display = 'none';
            if (authWall) {
              authWall.style.display = 'flex';
              authWall.style.opacity = '1';
            }
            if (nav) nav.classList.add('hidden');
            hideAppLoader();
          }
        } catch (e) {
          console.error("FATAL INIT ERROR:", e);
          hideAppLoader();
        }
      });

      // ============================================================
      //  AUTH HELPERS
      // ============================================================
      window.loginWithGoogle = function () {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(e => showAuthError(e.message));
      };
      window.loginWithApple = function () {
        const provider = new firebase.auth.OAuthProvider('apple.com');
        auth.signInWithPopup(provider).catch(e => showAuthError(e.message));
      };
      window.loginWithEmail = function () {
        const email = document.getElementById('auth-email').value;
        const pw = document.getElementById('auth-password').value;
        auth.signInWithEmailAndPassword(email, pw).catch(e => showAuthError(e.message));
      };
      window.registerWithEmail = function () {
        const email = document.getElementById('auth-email').value;
        const pw = document.getElementById('auth-password').value;
        auth.createUserWithEmailAndPassword(email, pw).catch(e => showAuthError(e.message));
      };
      window.signOut = function () { auth.signOut(); };
      function showAuthError(msg) {
        const el = document.getElementById('auth-error');
        if (el) el.textContent = msg;
      }
    }
  }
};

/**
 * SLITHER NEO INTEGRATION
 */
window.showSlitherScreen = function () {
  showScreen('slither');

  const frame = document.getElementById('slither-frame');
  if (frame) {
    const appId = 'slither-neo-evolved';
    const config = encodeURIComponent(JSON.stringify(firebaseConfig || {}));
    const v = Date.now();
    const name = encodeURIComponent(userProfile.displayName || userProfile.username || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Jugador');
    const src = `/slither_game.html?v=${v}&appId=${appId}&config=${config}&playerName=${name}`;

    // Always update src to force reload and avoid cache
    frame.src = src;
  }
};

/**
 * LOGIC MASTER INTEGRATION
 */
window.showLogicGame = function (gameId = null) {
  if (typeof signalRemoteLayout === 'function') signalRemoteLayout('gaming');
  // Hide main sidebar/nav
  syncNavOpen(false);
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.classList.add('hidden');

  showScreen('logicmaster');

  const frame = document.getElementById('logicmaster-frame');
  if (frame) {
    const v = Date.now();
    const name = encodeURIComponent(userProfile.displayName || userProfile.username || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Jugador');
    let src = `/logic_puzzles.html?v=${v}&playerName=${name}`;
    if (gameId) src += `&game=${gameId}`;

    // Always update src to force reload
    frame.src = src;
  }
};

window.exitLogicMaster = function () {
  if (typeof signalRemoteLayout === 'function') signalRemoteLayout('simple');
  showScreen('hub');
  // Clear src to save memory/resources
  const frame = document.getElementById('logicmaster-frame');
  if (frame) frame.src = 'about:blank';
};

/**
 * Signaling for Mobile Remote: Tells phone to change layout
 */
function signalRemoteLayout(mode) {
  const user = firebase.auth().currentUser;
  if (!user || !db) return;
  db.collection('remotes').doc(user.uid).set({ layout: mode }, { merge: true })
    .catch(e => console.error("Signal error:", e));
}

/**
 * ANOMALÍA INTEGRATION
 */
window.showAnomaliaScreen = function () {
  showScreen('anomalia');
  signalRemoteLayout('gaming');

  const frame = document.getElementById('anomalia-frame');
  // ... rest of function ...
  if (frame) {
    const appId = 'anomalia-shooter-v2';
    const config = encodeURIComponent(JSON.stringify(firebaseConfig || {}));
    const authUser = firebase.auth().currentUser;
    const playerName = (userProfile.username && userProfile.username.trim()) ||
      (userProfile.displayName && userProfile.displayName.trim()) ||
      (authUser && authUser.displayName && authUser.displayName.trim()) ||
      (authUser && authUser.email && authUser.email.trim()) ||
      'Piloto';

    console.log("[🕹️] Launching Anomalía as: " + playerName);
    const v = Date.now();
    const src = "/anomalia_game.html?v=" + v + "&appId=" + appId + "&config=" + config + "&playerName=" + encodeURIComponent(playerName);

    frame.src = src;
  }
};

/**
 * TURBO DRIFT INTEGRATION
 */
window.showTurboDriftScreen = function () {
  showScreen('turbo-drift');
  signalRemoteLayout('gaming');

  const frame = document.getElementById('turbo-drift-frame');
  if (frame) {
    const v = Date.now();
    const src = "/turbo-drift.html?v=" + v;
    frame.src = src;
  }
};

// ============================================================
//  MODULE: WIRELESS REMOTE CONTROL
// ============================================================
let _remoteUnsub = null;
let _remoteLayout = 'simple';
let _hubFocusIndex = -1;
let _activeControllers = {}; // { cid: { playerSlot, name, unsub } }

/**
 * Generates or retrieves a persistent unique ID for this device.
 */
function getControllerId() {
  let id = localStorage.getItem('tosito_controller_id');
  if (!id) {
    id = 'ctrl-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    localStorage.setItem('tosito_controller_id', id);
  }
  return id;
}

/**
 * AUTO-LAYOUT LISTENER (MOBILE SIDE)
 */
let _currentLayoutSig = 'simple';
function initLayoutSignalListener(uid) {
  if (typeof db === 'undefined') {
    console.error("[📡] Firestore (db) not initialized!");
    return;
  }
  db.collection('remotes').doc(uid).onSnapshot(doc => {
    if (doc.exists) {
      const layout = doc.data().layout;
      if (layout && layout !== _currentLayoutSig) {
        _currentLayoutSig = layout;
        applyRemoteLayout(layout);
      }
    }
  });
}

function applyRemoteLayout(mode) {
  const s = document.getElementById('layout-simple');
  const g = document.getElementById('layout-gaming');
  const p = document.getElementById('layout-pro');
  const btn = document.getElementById('btn-toggle-layout');
  if (!s || !g || !btn) return;

  // Hide all
  s.classList.remove('active');
  g.classList.remove('active');
  if (p) p.classList.remove('active');

  // Show target
  if (mode === 'gaming') {
    g.classList.add('active');
    btn.textContent = "MODO: JUEGO";
  } else if (mode === 'pro') {
    if (p) {
      p.classList.add('active');
      btn.textContent = "MODO: PRO";
    } else {
      g.classList.add('active');
      btn.textContent = "MODO: JUEGO";
    }
  } else {
    s.classList.add('active');
    btn.textContent = "MODO: NAVEGACIÓN";
  }

  if (window.navigator.vibrate) window.navigator.vibrate([10, 30, 10]);
}

/**
 * Called on mobile to check if we are in remote mode.
 */
function checkRemoteMode() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const uid = params.get('uid');
  if (mode === 'remote' && uid) {
    const ctrl = document.getElementById('screen-remote-controller');
    if (ctrl) ctrl.style.display = 'flex';
    window._remoteTargetUid = uid;

    // Fill previous name if any
    const savedName = localStorage.getItem('tosito_guest_name');
    const input = document.getElementById('setup-guest-name');
    if (input && savedName) input.value = savedName;

    // Listen for Auto-Layout (optional)
    if (typeof initLayoutSignalListener === 'function') {
      initLayoutSignalListener(uid);
    }

    db.collection('users').doc(uid).get().then(doc => {
      if (doc.exists) {
        const hostName = doc.data().username || doc.data().displayName || "Host";
        console.log("[📡] Target Host: " + hostName);
      }
    });
  }
}

/**
 * Triggered by the "UNIRSE" button on mobile.
 */
window.joinRemoteSession = function () {
  console.log("[📡] Join Attempted...");
  // alert("Join Button Clicked!"); // Enable if still nothing happens
  const input = document.getElementById('setup-guest-name');
  const name = (input && input.value.trim()) || "Invitado";
  localStorage.setItem('tosito_guest_name', name);

  const setupScreen = document.getElementById('screen-remote-setup');
  const controlsUi = document.getElementById('remote-controls-ui');
  const nameLabel = document.getElementById('remote-user-name');

  if (setupScreen) setupScreen.style.display = 'none';
  if (controlsUi) controlsUi.style.display = 'flex';
  if (nameLabel) nameLabel.textContent = name.toUpperCase();

  initRemoteController(name);
  if (window.navigator.vibrate) window.navigator.vibrate([50, 30, 50]);
};

function initRemoteController(guestName) {
  const uid = window._remoteTargetUid;
  const cid = getControllerId();
  console.log("[📡] Initializing Controller for UID:", uid, "CID:", cid);
  if (!uid) {
    alert("Error: ID de Sesión no encontrado. Por favor, re-escanea el QR.");
    return;
  }

  // Register in Firestore
  db.collection('remotes').doc(uid).collection('controllers').doc(cid).set({
    name: guestName,
    status: 'online',
    lastActive: Date.now()
  }, { merge: true });

  // Listen for assigned player slot
  db.collection('remotes').doc(uid).collection('controllers').doc(cid).onSnapshot(doc => {
    if (doc.exists && doc.data().playerSlot) {
      const label = document.getElementById('remote-status-label');
      if (label) label.textContent = "JUGADOR " + doc.data().playerSlot + " · " + guestName.toUpperCase();
    }
  });
}

window.editGuestName = function () {
  const current = localStorage.getItem('tosito_guest_name') || "Invitado";
  const name = prompt("Introduce tu nombre de jugador:", current);
  if (name && name.trim()) {
    const trimmed = name.trim().substring(0, 15);
    localStorage.setItem('tosito_guest_name', trimmed);
    const cid = getControllerId();
    const uid = window._remoteTargetUid;
    if (uid) {
      db.collection('remotes').doc(uid).collection('controllers').doc(cid).update({
        name: trimmed
      });
    }
    const label = document.getElementById('remote-user-name');
    if (label) label.textContent = trimmed.toUpperCase();
  }
};

window.toggleRemoteLayout = function () {
  const s = document.getElementById('layout-simple');
  const g = document.getElementById('layout-gaming');
  const p = document.getElementById('layout-pro');
  const btn = document.getElementById('btn-toggle-layout');

  const layouts = { 'simple': s, 'gaming': g, 'pro': p };
  const names = { 'simple': 'NAVEGACIÓN', 'gaming': 'JUEGO', 'pro': 'CONSOLA PRO' };

  // Hide current
  if (layouts[_remoteLayout]) layouts[_remoteLayout].classList.remove('active');

  // Cycle
  if (_remoteLayout === 'simple') _remoteLayout = 'gaming';
  else if (_remoteLayout === 'gaming') _remoteLayout = 'pro';
  else _remoteLayout = 'simple';

  // Show new
  if (layouts[_remoteLayout]) layouts[_remoteLayout].classList.add('active');
  if (btn) btn.textContent = "MODO: " + names[_remoteLayout];

  if (window.navigator.vibrate) window.navigator.vibrate(20);
};

window.openRemoteModal = function () {
  const modal = document.getElementById('remote-modal');
  if (modal) modal.classList.add('show');
  updateRemoteQR();
  initRemoteListener();
};

window.updateRemoteQR = function () {
  const hostInput = document.getElementById('remote-host-input');
  const alertBox = document.getElementById('remote-qr-alert');
  let host = (hostInput && hostInput.value) || window.location.hostname;

  // Detection of localhost/127.0.0.1 which won't work on mobile
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (alertBox) {
    if (isLocal) {
      alertBox.style.display = 'block';
      alertBox.innerHTML = `⚠️ <b>Detected: ${host}</b><br>Mobile devices cannot reach 'localhost'. Please enter your PC's IP address (e.g., 192.168.1.XX).`;
    } else {
      alertBox.style.display = 'none';
    }
  }

  // Use current port if not localhost (or if requested by input)
  const port = window.location.port ? `:${window.location.port}` : '';
  const protocol = window.location.protocol;

  const user = firebase.auth().currentUser;
  if (!user) {
    toast("Inicia sesión para generar el QR de mando");
    return;
  }

  // Construct URL. If host doesn't have a port, add the current one.
  let finalUrl = "";
  if (host.includes(':')) {
    finalUrl = protocol + "//" + host + "/?mode=remote&uid=" + user.uid;
  } else {
    finalUrl = protocol + "//" + host + port + "/?mode=remote&uid=" + user.uid;
  }

  console.log("[📡] QR Generator -> URL: " + finalUrl);

  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(finalUrl);
  const qrImg = document.getElementById('remote-qr');
  if (qrImg) qrImg.src = qrUrl;

  const linkLabel = document.getElementById('remote-debug-link');
  if (linkLabel) {
    linkLabel.textContent = finalUrl;
    linkLabel.href = finalUrl;
  }
};

window.closeRemoteModal = function () {
  const modal = document.getElementById('remote-modal');
  if (modal) modal.classList.remove('show');
};

function showPlayerJoinedAnimation(name, slot) {
  const container = document.body;
  const card = document.createElement('div');
  card.className = 'player-join-notif';

  const avatars = ['🎮', '🕹️', '👾', '🚀'];
  const avatar = avatars[(slot - 1) % avatars.length];

  card.innerHTML = `
    <div class="join-avatar">${avatar}</div>
    <div class="join-info">
      <div class="join-name">${name}</div>
      <div class="join-slot">JUGADOR ${slot} UNIDO</div>
    </div>
  `;

  container.appendChild(card);

  // Audio cue (optional, using standard sound if available)
  if (window.playSuccessSound) window.playSuccessSound();

  setTimeout(() => {
    card.classList.add('join-exit');
    setTimeout(() => card.remove(), 600);
  }, 4000);
}

function initRemoteListener() {
  if (_remoteUnsub) return;
  const user = firebase.auth().currentUser;
  if (!user) return;

  console.log("[📡] Starting Multi-Controller Listener...");
  _remoteUnsub = db.collection('remotes').doc(user.uid).collection('controllers').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      const cid = change.doc.id;
      const data = change.doc.data();

      if (change.type === 'added') {
        // Detect and Assign Player Slot
        if (!_activeControllers[cid]) {
          const usedSlots = Object.values(_activeControllers).map(c => c.playerSlot);
          let assignedSlot = 1;
          for (let i = 1; i <= 4; i++) {
            if (!usedSlots.includes(i)) { assignedSlot = i; break; }
          }

          _activeControllers[cid] = {
            playerSlot: assignedSlot,
            name: data.name || "Invitado",
            lastInput: Date.now()
          };

          // Update the controller doc with its assigned slot so the phone knows
          db.collection('remotes').doc(user.uid).collection('controllers').doc(cid).update({
            playerSlot: assignedSlot
          });

          toast(`🎮 ${data.name || 'Invitado'} conectado (Jugador ${assignedSlot})`);
          showPlayerJoinedAnimation(data.name || 'Invitado', assignedSlot);
        }
      }

      if (change.type === 'modified') {
        const ctrl = _activeControllers[cid];
        // Handle name change from profile edit on mobile
        if (ctrl && data.name && data.name !== ctrl.name) {
          ctrl.name = data.name;
        }

        if (ctrl && data.type === 'input' && data.timestamp > (ctrl.lastInput || 0)) {
          ctrl.lastInput = data.timestamp;
          if (Date.now() - data.timestamp < 3000) {
            simulateRemoteKey(data.key, data.isDown, ctrl.playerSlot);
          }
        }
      }

      if (change.type === 'removed') {
        if (_activeControllers[cid]) {
          const slot = _activeControllers[cid].playerSlot;
          const name = _activeControllers[cid].name;
          delete _activeControllers[cid];
          toast(`🔌 ${name} desconectado`);
        }
      }
    });
  });
}

function activateRemoteConsoleMode() {
  if (!document.body.classList.contains('remote-active')) {
    document.body.classList.add('remote-active');
  }
}

window.addEventListener('mousemove', (e) => {
  if (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2) {
    if (document.body.classList.contains('remote-active')) {
      document.body.classList.remove('remote-active');
    }
  }
}, { passive: true });

function simulateRemoteKey(key, isDown, playerSlot = 1) {
  if (isDown) activateRemoteConsoleMode();

  // Base Mapping for Emulator-friendly keys
  const baseMap = {
    'l': 'q', 'r': 'e', 'z': ' ' // L, R, Z triggers
  };
  let effectiveKey = baseMap[key] || key;

  // Player Mapping
  let targetKey = effectiveKey;
  if (playerSlot === 2) {
    const p2Map = {
      'ArrowUp': 'w', 'ArrowDown': 's', 'ArrowLeft': 'a', 'ArrowRight': 'd',
      'Enter': 'q', 'Escape': 'e', ' ': 'f', 'x': 'r', 'l': '1', 'r': '2', 'z': '3'
    };
    targetKey = p2Map[effectiveKey] || effectiveKey;
  } else if (playerSlot === 3) {
    const p3Map = {
      'ArrowUp': 'i', 'ArrowDown': 'k', 'ArrowLeft': 'j', 'ArrowRight': 'l',
      'Enter': 'u', 'Escape': 'o', ' ': 'h', 'x': 'y', 'l': '4', 'r': '5', 'z': '6'
    };
    targetKey = p3Map[effectiveKey] || effectiveKey;
  } else if (playerSlot === 4) {
    const p4Map = {
      'ArrowUp': '8', 'ArrowDown': '5', 'ArrowLeft': '4', 'ArrowRight': '6',
      'Enter': '7', 'Escape': '9', ' ': '0', 'x': 'v', 'l': '7', 'r': '9', 'z': '8'
    };
    targetKey = p4Map[effectiveKey] || effectiveKey;
  }

  const hub = document.getElementById('screen-hub');
  const isHubActive = hub && hub.style.display !== 'none';

  if (isHubActive && isDown && playerSlot === 1) { // Only P1 navigates hub
    if (targetKey.startsWith('Arrow')) {
      handleHubRemoteNavigation(targetKey);
      return;
    }
    if (targetKey === 'Enter') {
      triggerFocusedCard();
      return;
    }
  }

  const type = isDown ? 'keydown' : 'keyup';
  const event = new KeyboardEvent(type, { key: targetKey, bubbles: true, code: targetKey });
  document.dispatchEvent(event);
  document.querySelectorAll('iframe').forEach(f => {
    try {
      if (f.contentWindow) {
        f.contentWindow.document.dispatchEvent(new KeyboardEvent(type, { key: targetKey, bubbles: true }));
        f.contentWindow.dispatchEvent(new KeyboardEvent(type, { key: targetKey, bubbles: true }));
      }
    } catch (e) { }
  });
}

function handleHubRemoteNavigation(key) {
  const cards = Array.from(document.querySelectorAll('.hub-card'));
  if (cards.length === 0) return;

  if (_hubFocusIndex === -1) {
    _hubFocusIndex = 0;
  } else {
    if (key === 'ArrowRight') _hubFocusIndex++;
    if (key === 'ArrowLeft') _hubFocusIndex--;
    if (key === 'ArrowDown') _hubFocusIndex += 3;
    if (key === 'ArrowUp') _hubFocusIndex -= 3;
  }

  _hubFocusIndex = Math.max(0, Math.min(cards.length - 1, _hubFocusIndex));
  cards.forEach(c => c.classList.remove('remote-focus'));
  cards[_hubFocusIndex].classList.add('remote-focus');
  cards[_hubFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function triggerFocusedCard() {
  const card = document.querySelector('.hub-card.remote-focus');
  if (card) card.click();
}

window.remoteKey = function (key, isDown) {
  const uid = window._remoteTargetUid;
  if (!uid) return;
  if (isDown && window.navigator.vibrate) window.navigator.vibrate(15);

  // Handle C-Stick / Camera Mode translation
  let finalKey = key;
  if (window._cStickMode && key.startsWith('Arrow')) {
    const cMap = { 'ArrowUp': 'i', 'ArrowDown': 'k', 'ArrowLeft': 'j', 'ArrowRight': 'l' };
    finalKey = cMap[key] || key;
  }

  const cid = getControllerId();
  db.collection('remotes').doc(uid).collection('controllers').doc(cid).update({
    type: 'input', key: finalKey, isDown: isDown, timestamp: Date.now()
  }).catch(e => {
    // If update fails (doc might have been deleted), re-set it
    db.collection('remotes').doc(uid).collection('controllers').doc(cid).set({
      type: 'input', key: finalKey, isDown: isDown, timestamp: Date.now(), status: 'online'
    }, { merge: true });
  });
};

// Initial state check
window.addEventListener('load', () => {
  checkRemoteMode();
  checkBackendHealth();
  setInterval(checkBackendHealth, 45000); // Check every 45s
});
