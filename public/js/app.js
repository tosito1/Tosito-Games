// ============================================================
//  Tosito Chess Web App — app.js
// ============================================================

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

if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
console.log("!!! VERSION V5.4 (Robust Recovery) !!!");

// ---- GSAP Init (Safety first) ----
try {
  gsap.registerPlugin(Flip);
  // CustomEase and ScrollTrigger are secondary and might fail from CDNs
} catch (e) {
  console.warn("[⚠️] GSAP Plugins failed to register, basic animations will scale:", e);
}
const GSAP_CONFIG = { duration: 0.6, ease: "power3.out" };

// ============================================================
//  STATE
// ============================================================
let currentUser = null;
let userProfile = { elo: 1200, wins: 0, losses: 0, username: '', isAdmin: false };
let currentRoom = null;
let unsubRoom = null;
let playerColor = null; // 'white'|'black'|null(spectator)
let isGameMode = false;

// Board state
let board = [];
let selectedSq = null;
let validMoves = [];
let lastMove = null;
let premove = null;
let isGodMode = false;
let isHintEnabled = false;
let hintEngine = 'level_7';
let isClassicBoard = false;
let gameWinner = null;
let isCheck = false;
let aiLevel = 'level_3';
let isAiGame = false;
let isAiThinking = false;
let currentHint = null;
let remoteBackendUrl = localStorage.getItem('tosito_manual_backend') || null; 
let isManualBackend = !!localStorage.getItem('tosito_manual_backend');

// Timers
let whiteMs = 600000, blackMs = 600000;
let timerInterval = null;
let turn = 'white';
let gameStatus = 'waiting'; // waiting|playing|finished
let mainBoard = null; // Backup local engine board for simulation
let isLocalSim = false; 
let isFirstRender = true; // For staggered entrance

// Exercise state
let exercises = [];
let selectedEx = null;
let exBoard = [];
let exSel = null;
let exValid = [];
let exLastMove = null;
let currentLichessPuzzle = null;
let exStartTurn = 'white';

// Openings state
let openings = [];
let selectedOp = null;
let opBoard = [];
let opMoveIdx = 0;
let opSel = null;
let opValid = [];

// Social state
let friends = [];
let friendRequests = [];
let challenges = [];

// Helper for APIs that might not be in production
async function safeFetchJson(url, options={}) {
  try {
    let targetUrl = url;
    const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
    
    if (url.startsWith('/api/') && !isLocal) {
      const isCloudLevel = (aiLevel === 'level_7' || aiLevel === 'level_8' || aiLevel === 'level_1' || aiLevel === 'level_2' || aiLevel === 'level_3');
      
      if (isCloudLevel) {
        console.log(`[🤖] Autonomous Level detected (${aiLevel}). URL: ${url}. Skipping discovery wait.`);
      } else {
        if (!remoteBackendUrl && !isManualBackend) {
          console.log(`[🕵️] Discovery needed for ${url} (Lvl: ${aiLevel}). Checking remoteBackendUrl...`);
          let attempts = 0;
          while (!remoteBackendUrl && attempts < 10) {
            console.log(`[⏳] Discovery Wait ${attempts+1}/10 for: ${url}...`);
            await new Promise(r => setTimeout(r, 500));
            attempts++;
          }
        }
      }

      if (!remoteBackendUrl && !isManualBackend) {
          if (isCloudLevel) return { success: false, error: 'BACKEND_MISSING' };
          console.warn(`[⚠️] Backend missing for ${url}. level was ${aiLevel}`);
          return { success: false, error: 'BACKEND_MISSING' };
      }
      const base = remoteBackendUrl.endsWith('/') ? remoteBackendUrl.slice(0, -1) : remoteBackendUrl;
      targetUrl = base + url;
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
    
    if (text.trim().startsWith('<!DOCTYPE')) {
      if (url.includes('api/')) return { success: false, error: 'BACKEND_MISSING' };
    }
    return JSON.parse(text);
  } catch(e) {
    console.error(`Fetch error ${url}:`, e);
    return { success: false, error: e.message };
  }
}

/**
 * Permite configurar manualmente la URL del PC (Ngrok).
 * Se guarda en localStorage para persistencia.
 */
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

function updateBackendStatusUI() {
  const el = document.getElementById('backend-status');
  const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
  
  let statusHTML = '';
  if (isLocal) {
    statusHTML = '<span class="badge badge-green">🏠 MODO LOCAL (PC)</span>';
  } else if (isManualBackend) {
    statusHTML = `<span class="badge badge-amber" onclick="promptNewBackend()">🔗 MANUAL: ${remoteBackendUrl.replace('https://','')}</span>`;
  } else if (remoteBackendUrl) {
    statusHTML = '<span class="badge badge-sky">🌐 CLOUD SYNC (OK)</span>';
  } else {
    statusHTML = '<span class="badge badge-red" onclick="promptNewBackend()">❌ DESCONECTADO (Click para Manual)</span>';
  }
  
  if (el) el.innerHTML = statusHTML;
  
  // Also update App Loader if visible
  const loaderStatus = document.getElementById('app-loader-status');
  if (loaderStatus && !isAppReady) {
    loaderStatus.textContent = remoteBackendUrl ? "Motor encontrado. Finalizando..." : "Buscando motor en la nube...";
  }
}

let isAppReady = false;
function hideAppLoader() {
  const loader = document.getElementById('app-loader');
  if (!loader) return;
  
  isAppReady = true;
  loader.style.display = 'none'; // Instant reveal
  
  // Minimalist entry animations that don't block visibility
  gsap.from(".section-header", { y: -20, opacity: 0, duration: 0.5 });
  gsap.from(".glass-panel", { y: 20, opacity: 0, duration: 0.5, stagger: 0.05 });
}

// Global Safety Timer: Remove loader after 6s no matter what
setTimeout(() => { if (!isAppReady) hideAppLoader(); }, 6000);

function showBoardLoader() {
  const bl = document.getElementById('board-loader');
  if (bl) {
    bl.style.display = 'flex';
    gsap.fromTo(bl, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.to(".board-loader-pawn", { y: -10, repeat: -1, yoyo: true, duration: 0.6, ease: "power1.inOut" });
  }
}
function hideBoardLoader() {
  const bl = document.getElementById('board-loader');
  if (bl) {
    gsap.to(bl, { opacity: 0, duration: 0.3, onComplete: () => {
      bl.style.display = 'none';
      gsap.killTweensOf(".board-loader-pawn");
    }});
  }
}

function promptNewBackend() {
  const current = isManualBackend ? remoteBackendUrl : '';
  const url = prompt("Introduce la URL de tu Ngrok (ej: https://abcd.ngrok-free.dev) o deja vacío para Auto-Discovery:", current);
  if (url !== null) setManualBackend(url.trim());
}

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  gsap.killTweensOf(el);
  gsap.fromTo(el, 
    { y: -100, opacity: 0, x: "-50%", scale: 0.8 }, 
    { y: 0, opacity: 1, x: "-50%", scale: 1, duration: 0.5, ease: "back.out(1.7)" }
  );
  setTimeout(() => {
    gsap.to(el, { y: -100, opacity: 0, duration: 0.4, ease: "power2.in" });
  }, 3000);
}

/**
 * Escucha la configuración global en Firestore para descubrir la URL de Ngrok.
 */
function syncRemoteBackend() {
  if (isManualBackend) {
    console.log("[ℹ️] Usando backend manual, saltando Firestore.");
    updateBackendStatusUI();
    return;
  }
  console.log("[📡] Iniciando escucha de backend remoto en Firestore (globals/ai_config)...");
  db.collection('globals').doc('ai_config').onSnapshot(doc => {
    if (isManualBackend) return; // Prioridad manual
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
    
    // If we've been waiting too long at startup, show the manual button
    if (!remoteBackendUrl && !isAppReady) {
      setTimeout(() => {
        if (!remoteBackendUrl && !isAppReady) {
          const btn = document.getElementById('app-loader-btn');
          if (btn) btn.style.display = 'block';
          const msg = document.getElementById('app-loader-msg');
          if (msg) msg.textContent = "El motor tarda en responder...";
        }
      }, 8000);
    }
    
    // Auto-hide loader is now handled by auth state
    // if (remoteBackendUrl && currentUser) hideAppLoader();
    
  }, err => {
    console.error("[❌] Error Firestore backend:", err);
    updateBackendStatusUI();
  });
}

// ============================================================
//  DRAWER & SIDE NAVIGATION
// ============================================================
function openDrawer() {
  document.getElementById('side-drawer').classList.add('show');
}
function closeDrawer() {
  document.getElementById('side-drawer').classList.remove('show');
}
function showAdminSection() {
  closeDrawer();
  switchLobbyTab('tab-admin');
}
function showMasterGallery() {
  closeDrawer();
  switchLobbyTab('tab-masters');
}

// Initial Loader Animation Sequence
window.addEventListener('DOMContentLoaded', () => {
  gsap.from(".loader-sq", {
    scale: 0,
    opacity: 0,
    duration: 1,
    stagger: { amount: 0.8, grid: [4,4], from: "edges" },
    ease: "back.out(1.7)"
  });
  gsap.from("#loader-pawn", {
    y: 100,
    opacity: 0,
    duration: 1.2,
    delay: 0.5,
    ease: "elastic.out(1, 0.3)"
  });
  gsap.to("#loader-pawn", {
    y: -20,
    repeat: -1,
    yoyo: true,
    duration: 2,
    ease: "power1.inOut"
  });
});

// ============================================================
//  INIT
// ============================================================
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
      loadExercises();
      loadOpenings();
      loadSocial();
      fetchRooms();
      loadHistoryGames();
      loadHistoricalGames();
      checkMigrationStatus();
      syncRemoteBackend();
      
      if (userProfile.isAdmin) {
        document.querySelectorAll('.admin-tab').forEach(e => e.style.display = '');
        document.getElementById('lobby-admin-badge').style.display = '';
        document.getElementById('prof-admin-btn').style.display = '';
      }
    } else {
      // Show Auth
      if (appContainer) appContainer.style.display = 'none';
      if (authWall) {
        authWall.style.display = 'flex';
        authWall.style.opacity = 1;
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
//  AUTH
// ============================================================
function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => showAuthError(e.message));
}
function loginWithApple() {
  const provider = new firebase.auth.OAuthProvider('apple.com');
  auth.signInWithPopup(provider).catch(e => showAuthError(e.message));
}
function loginWithEmail() {
  const email = document.getElementById('auth-email').value;
  const pw = document.getElementById('auth-password').value;
  auth.signInWithEmailAndPassword(email, pw).catch(e => showAuthError(e.message));
}
function registerWithEmail() {
  const email = document.getElementById('auth-email').value;
  const pw = document.getElementById('auth-password').value;
  auth.createUserWithEmailAndPassword(email, pw).catch(e => showAuthError(e.message));
}
function signOut() { auth.signOut(); }
function showAuthError(msg) { document.getElementById('auth-error').textContent = msg; }

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
        solved_puzzles: d.solved_puzzles || [] 
      };
    } else {
      // New user init
      const initialData = { elo: 1200, wins: 0, losses: 0, username: '', role: 'player', friends: [], solved_puzzles: [], uid: currentUser.uid };
      await db.collection('users').doc(currentUser.uid).set(initialData);
      userProfile = { ...initialData, isAdmin: false };
    }
  } catch(e) { console.error("Error loading profile:", e); }
}

function updateLobbyUI() {
  const name = userProfile.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Jugador';
  document.getElementById('lobby-sub').textContent = `Hola, ${name} · ELO ${userProfile.elo}`;
  // Profile
  document.getElementById('profile-name').textContent = name;
  document.getElementById('profile-email').textContent = currentUser?.email || '';
  document.getElementById('prof-elo').textContent = userProfile.elo;
  document.getElementById('prof-wins').textContent = userProfile.wins;
  document.getElementById('prof-losses').textContent = userProfile.losses;
  document.getElementById('profile-user-display').textContent = userProfile.username ? `@${userProfile.username}` : 'Sin @usuario';
  if (currentUser?.photoURL) {
    document.getElementById('profile-avatar').src = currentUser.photoURL;
    document.getElementById('profile-avatar').style.display = '';
    document.getElementById('profile-avatar-ph').style.display = 'none';
  }
  updateBackendStatusUI();
  // Level buttons
  renderLevelButtons();
}

function renderLevelButtons() {
  const levels = [
    ['level_1','Nivel 1 — Novato 🐣'],['level_2','Nivel 2 — Principiante'],
    ['level_3','Nivel 3 — Intermedio ⚡'],['level_4','Nivel 4 — Avanzado'],
    ['level_7','Nivel 7 — Gran Maestro 🧠 ☁️'],['level_8','Nivel 8 — Dios 😈 ☁️']
  ];
  const c = document.getElementById('level-buttons');
  c.innerHTML = levels.map(([id,lbl]) =>
    `<button class="level-btn${aiLevel===id?' sel':''}" onclick="selectLevel('${id}')">${lbl}</button>`
  ).join('');
}
function selectLevel(id) { aiLevel = id; renderLevelButtons(); }

// ============================================================
//  NAVIGATION
// ============================================================
function switchLobbyTab(tabId) {
  const target = document.getElementById(tabId);
  if (!target || target.classList.contains('active')) return;

  const current = document.querySelector('#screen-lobby .tab-pane.active');
  
  // Highlight correct button
  document.querySelectorAll('#screen-lobby .tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick')?.includes(tabId));
  });

  if (current) {
    gsap.to(current, { opacity: 0, x: -20, duration: 0.2, onComplete: () => {
      current.classList.remove('active');
      target.classList.add('active');
      gsap.fromTo(target, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.3 });
    }});
  } else {
    target.classList.add('active');
    gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  }
}

function switchExTab(id) {
  document.querySelectorAll('#screen-exercises .tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#screen-exercises .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const btnId = id === 'ex-list-view' ? 'ex-tab-list' : 'ex-tab-explore';
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');
  if (id === 'ex-explore-view') loadCommunityPuzzles();
}
function showScreen(id) {
  const target = document.getElementById('screen-' + id);
  if (target.classList.contains('active')) return;

  const current = document.querySelector('.screen.active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + id);
  if (navBtn) navBtn.classList.add('active');

  if (current) {
    // 3D-like transition: Scale down and fade
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
  document.getElementById(id).classList.add('active');
  event.target.classList.add('active');
}

// ============================================================
//  GAME — START & INIT
// ============================================================
async function startGameFromMenu() {
  isAiGame = true;
  isGodMode = false;
  isLocalSim = false; 
  document.getElementById('tog-god').checked = false;
  document.getElementById('tog-hint').checked = false;
  isHintEnabled = false;
  playerColor = 'white';
  document.getElementById('resign-btn').style.display = '';
  document.getElementById('admin-controls').style.display = userProfile.isAdmin ? '' : 'none';
  isFirstRender = true;
  
  console.log(`[🎮] Iniciando partida contra IA. Nivel: ${aiLevel}`);
  const resetRes = await safeFetchJson('/api/reset', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({level: aiLevel}) });
  console.log("[🏁] Reset Response:", resetRes);
  
  if (resetRes.error === 'BACKEND_MISSING') {
    const autonomous = (['level_1','level_2','level_3','level_7','level_8'].includes(aiLevel));
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
  document.getElementById('room-pill').textContent = 'vs IA · ' + aiLevel;
  document.getElementById('bottom-nav').classList.add('hidden');
}

function exitGame() {
  closeModal('winner-modal');
  stopTimer();
  isGameMode = false;
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  document.getElementById('bottom-nav').classList.remove('hidden');
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
const PIECES = {white:{P:'♙',R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔'},black:{P:'♟',R:'♜',N:'♞',B:'♝',Q:'♛',K:'♚'}};

function renderBoard(grid, boardElId='board', onClickFn=onSquareClick, flipped=false, hints=null, pre=null) {
  const el = document.getElementById(boardElId);
  if (!el) return;

  // Initial render: Stagger the board intro if it's the first time
  const isFirstRender = el.children.length === 0;

  // Capture state across pieces for Flip
  const state = Flip.getState(".piece", {props: "opacity,transform"});
  
  el.innerHTML = '';
  
  // === SKELETAL LOADING STATE ===
  if (!grid || !Array.isArray(grid)) {
    for (let i=0; i<64; i++) {
        const sq = document.createElement('div');
        sq.className = 'sq ghost-sq';
        el.appendChild(sq);
    }
    gsap.fromTo(".ghost-sq", 
        { opacity: 0.1, scale: 0.95 }, 
        { opacity: 0.3, scale: 1, duration: 1.2, repeat: -1, yoyo: true, stagger: { amount: 0.8, from: "center", grid: [8,8] } }
    );
    return;
  }
  
  const sel = (boardElId==='ex-board') ? exSel : (boardElId==='board' ? selectedSq : null);
  const mvs = (boardElId==='ex-board') ? exValid : (boardElId==='board' ? validMoves : []);
  const lm = (boardElId==='ex-board') ? exLastMove : lastMove;

  const isClassic = document.getElementById('tog-board').checked;
  for (let r=0; r<8; r++) {
    for (let c=0; c<8; c++) {
      const dr = flipped ? 7-r : r;
      const dc = flipped ? 7-c : c;
      const cell = grid[dr]?.[dc];
      const isLight = (dr+dc)%2===0;
      const sq = document.createElement('div');
      sq.className = 'sq ' + (isLight ? (isClassic?'classic-light':'light') : (isClassic?'classic-dark':'dark'));
      sq.dataset.r = dr; sq.dataset.c = dc;

      if (sel && sel[0]===dr && sel[1]===dc) {
        sq.classList.add('sel');
        gsap.to(sq, { scale: 0.95, duration: 0.2, yoyo: true, repeat: 1 });
      }
      if (mvs.some(m=>m[0]===dr&&m[1]===dc)) {
        sq.classList.add(cell ? 'valid-cap' : 'valid');
      }
      if (lm) {
        if ((lm.from[0]===dr&&lm.from[1]===dc)||(lm.to[0]===dr&&lm.to[1]===dc)) {
          sq.classList.add(lm.from[0]===dr&&lm.from[1]===dc?'last-from':'last-to');
        }
      }
      if (hints) {
        if (hints.from[0]===dr&&hints.from[1]===dc) sq.classList.add('hint-from');
        if (hints.to[0]===dr&&hints.to[1]===dc) sq.classList.add('hint-to');
      }
      
      const isThisKingInCheck = isCheck && cell && str(cell)==='K' && cell.color===turn;
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
        stagger: { amount: 0.8, from: "center", grid: [8,8] },
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

function str(cell) { return (cell?.type||'').toUpperCase(); }

function renderCoords(flipped=false) {
  const cols = document.getElementById('coords-col');
  const rows = document.getElementById('coords-row');
  if (!cols||!rows) return;
  const ranks = flipped ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
  const files = flipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
  cols.innerHTML = ranks.map(n=>`<div class="coord">${n}</div>`).join('');
  rows.innerHTML = files.map(f=>`<div class="coord">${f}</div>`).join('');
}

// ============================================================
//  GAME LOGIC — MAIN BOARD
// ============================================================
async function fetchBoardState() {
  if (isLocalSim && mainBoard) {
    board = mainBoard.grid;
    turn = mainBoard.turn;
    const isClassic = document.getElementById('tog-board').checked;
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
    
    renderBoard(board, 'board', onSquareClick, playerColor==='black', currentHint, premove);
    updateTurnUI();
    if (gameWinner) onGameEnd(gameWinner);
    if (isHintEnabled) fetchHint(); // Persistencia de pistas
  } catch(e) {
    console.error("Error fetching state:", e);
  }
}

function lanToRC(lan) {
  if (!lan) return null;
  const files='abcdefgh';
  const c = files.indexOf(lan[0]);
  const r = 8 - parseInt(lan[1]);
  return [r, c];
}

function updateTurnUI() {
  const pill = document.getElementById('turn-pill');
  if (turn==='white') {
    pill.textContent = 'TURNO BLANCAS ♖';
    pill.style.color = '#FBBF24';
    document.getElementById('timer-white').classList.add('active');
    document.getElementById('timer-black').classList.remove('active');
  } else {
    pill.textContent = 'TURNO NEGRAS ♜';
    pill.style.color = '#38BDF8';
    document.getElementById('timer-black').classList.add('active');
    document.getElementById('timer-white').classList.remove('active');
  }
  document.getElementById('check-alert').style.display = isCheck ? '' : 'none';
}

async function onSquareClick(r, c) {
  if (gameStatus === 'finished' || isAiThinking) return;
  const canMove = isGodMode || (isAiGame ? turn === playerColor : turn === playerColor);

  if (selectedSq) {
    const [sr, sc] = selectedSq;
    if (validMoves.some(m=>m[0]===r&&m[1]===c)) {
      await makeMove(sr, sc, r, c);
      return;
    }
  }
  if (!canMove && !isGodMode) { selectedSq=null; validMoves=[]; renderBoard(board,'board',onSquareClick,playerColor==='black',currentHint,premove); return; }

  const cell = board[r]?.[c];
  if (cell && (isGodMode || cell.color===turn)) {
    selectedSq = [r,c];
    if (isLocalSim && mainBoard) {
      validMoves = mainBoard.getLegalMoves(r, c); 
    } else {
      const data = await safeFetchJson(`/api/moves?r=${r}&c=${c}`);
      validMoves = data.moves || [];
    }
  } else {
    selectedSq = null; validMoves = [];
  }
  renderBoard(board,'board',onSquareClick,playerColor==='black',currentHint,premove);
}

async function makeMove(sr, sc, er, ec) {
  const cell = board[sr]?.[sc];
  // Pawn promotion check
  if (str(cell)==='P' && (er===0||er===7)) {
    pendingMove = [sr,sc,er,ec];
    showPromoModal(cell.color);
    return;
  }
  await sendMove(sr, sc, er, ec, null);
}

let pendingMove = null;
function showPromoModal(color) {
  const pieces = color==='white' ? ['♕','♖','♗','♘'] : ['♛','♜','♝','♞'];
  const names = ['Queen','Rook','Bishop','Knight'];
  document.getElementById('promo-pieces').innerHTML = pieces.map((p,i)=>
    `<div class="promo-piece" onclick="selectPromo('${names[i]}')">${p}</div>`
  ).join('');
  
  const modal = document.getElementById('promo-modal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  gsap.fromTo(modal.querySelector('.modal-content'), 
    { scale: 0.8, y: 50 }, 
    { scale: 1, y: 0, duration: 0.6, ease: "back.out(1.7)" }
  );
}
async function selectPromo(piece) {
  document.getElementById('promo-modal').classList.remove('show');
  if (pendingMove) { await sendMove(...pendingMove, piece); pendingMove=null; }
}

async function sendMove(sr, sc, er, ec, promo) {
  selectedSq=null; validMoves=[]; currentHint=null;
  const body = { start:[sr,sc], end:[er,ec] };
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

  const data = await safeFetchJson('/api/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
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
      const data = await safeFetchJson('/api/ai_move',{method:'POST'});
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
  } catch(e) { 
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
            from: move.slice(0,2), 
            to: move.slice(2,4), 
            promo: move.length > 4 ? move[4] : null 
        };
    }
    console.warn("[☁️] Lichess response format unexpected or missing PVs.");
    return fetchChessApiMove(fen);
  } catch(e) { 
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
  for (let r=0; r<8; r++) {
    let empty = 0;
    for (let c=0; c<8; c++) {
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
    } else if (['level_1','level_2','level_3'].includes(aiLevel)) {
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
        renderBoard(board,'board',onSquareClick,playerColor==='black',currentHint,premove);
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
      renderBoard(board,'board',onSquareClick,playerColor==='black',currentHint,premove);
    }
  } catch(e) {
    console.error("Hint Error:", e);
  }
}

function toggleBoardTheme() { renderBoard(board,'board',onSquareClick,playerColor==='black',currentHint,premove); }
function toggleGodMode() { isGodMode = document.getElementById('tog-god').checked; }
function toggleHint() {
  isHintEnabled = document.getElementById('tog-hint').checked;
  document.getElementById('hint-engine-row').style.display = isHintEnabled?'':'none';
  if (isHintEnabled) {
      toast("🔍 Buscando pista óptima...");
      fetchHint(); 
  } else { 
      currentHint=null; 
      renderBoard(board,'board',onSquareClick,playerColor==='black',null,premove); 
  }
}
function setHintEngine(e) {
  if (hintEngine === e) return;
  hintEngine=e;
  document.getElementById('e-sf').classList.toggle('active',e==='level_7');
  document.getElementById('e-lc').classList.toggle('active',e==='level_8');
  if (isHintEnabled) fetchHint();
}

// ============================================================
//  TIMERS
// ============================================================
function startTimers(minutes=10) {
  whiteMs = blackMs = minutes * 60 * 1000;
  stopTimer();
  gameStatus = 'playing';
  updateTimerDisplay();
  timerInterval = setInterval(tickTimer, 100);
}
function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval=null; } }
function tickTimer() {
  if (gameStatus !== 'playing') return;
  if (turn==='white') { whiteMs -= 100; if (whiteMs<=0) { whiteMs=0; onTimeOut('white'); } }
  else { blackMs -= 100; if (blackMs<=0) { blackMs=0; onTimeOut('black'); } }
  updateTimerDisplay();
}
function updateTimerDisplay() {
  setTimer('time-white','timer-white',whiteMs,turn==='white');
  setTimer('time-black','timer-black',blackMs,turn==='black');
}
function setTimer(elId, cardId, ms, active) {
  const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
  const el = document.getElementById(elId);
  const card = document.getElementById(cardId);
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  card.classList.toggle('danger', active && ms < 30000);
}
function onTimeOut(color) {
  stopTimer(); gameStatus='finished';
  onGameEnd(`Tiempo agotado — Ganan las ${color==='white'?'negras':'blancas'}`);
}

// ============================================================
//  GAME END
// ============================================================
function onGameEnd(winner) {
  gameStatus = 'finished';
  loadHistoricalGames();
  const modal = document.getElementById('winner-modal');
  const title = document.getElementById('winner-title');
  const msg = document.getElementById('winner-msg');
  
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
  const modal = document.getElementById('resign-modal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  gsap.fromTo(modal.querySelector('.modal-content'), 
    { y: 100, opacity: 0 }, 
    { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
  );
}
function confirmResign() { closeModal('resign-modal'); setTimeout(() => onGameEnd('Abandono — ' + (playerColor==='white'?'Ganan las Negras':'Ganan las Blancas')), 300); }
function closeModal(id) { 
  const modal = document.getElementById(id);
  gsap.to(modal.querySelector('.modal-content'), { scale: 0.8, opacity: 0, duration: 0.3, ease: "power2.in" });
  gsap.to(modal, { opacity: 0, duration: 0.4, onComplete: () => {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }});
}

// ============================================================
//  DRAWER
// ============================================================
function openDrawer() { document.getElementById('side-drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); }
function closeDrawer() { document.getElementById('side-drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); }

// ============================================================
//  ADMIN CONTROLS (DRAWER)
// ============================================================
async function undoMove() {
  if (isLocalSim && mainBoard) mainBoard.undoMove();
  else await safeFetchJson('/api/undo',{method:'POST'}).catch(()=>{});
  await fetchBoardState(); closeDrawer();
}
async function skipTurn() {
  if (isLocalSim && mainBoard) mainBoard.turn = (mainBoard.turn==='white'?'black':'white');
  else await safeFetchJson('/api/skip_turn',{method:'POST'}).catch(()=>{});
  await fetchBoardState(); closeDrawer();
}
async function resetBoard() {
  if (isLocalSim && mainBoard) {
      mainBoard.setupBoard();
      gameWinner=null; gameStatus='playing';
  } else {
      await safeFetchJson('/api/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({level:aiLevel})});
      gameWinner=null; gameStatus='playing';
  }
  startTimers(10); await fetchBoardState(); closeDrawer();
}

// ============================================================
//  ONLINE ROOMS (Firebase Firestore)
// ============================================================
async function fetchRooms() {
  try {
    const snap = await db.collection('games').where('status','==','waiting').limit(20).get();
    const list = document.getElementById('room-list');
    if(!list) return;
    list.innerHTML = '';
    if (snap.empty) { list.innerHTML = '<p style="color:var(--muted);font-size:.85rem;text-align:center">Sin salas disponibles</p>'; return; }
    snap.forEach(doc => {
      const d=doc.data();
      list.innerHTML += `<div class="room-card"><div><h4>Sala: ${doc.id.substring(0,6).toUpperCase()}</h4><div class="status">Esperando jugador</div><div style="font-size:.75rem;color:var(--muted)">Blanco: ${d.whiteName||d.whiteDisplayName||'Nadie'}</div></div><button class="btn btn-primary" style="width:auto;padding:8px 16px;font-size:.8rem" onclick="joinRoom('${doc.id}')">UNIRSE</button></div>`;
    });
  } catch(e) { console.error(e); }
}

async function createRoom() {
  if (!currentUser) return;
  toast('Creando sala...');
  const id = Math.random().toString(36).substring(2,8).toUpperCase();
  const userName = userProfile.displayName || currentUser.displayName || currentUser.email;
  await db.collection('games').doc(id).set({ 
    status:'waiting', 
    white:currentUser.uid, 
    whiteName:userName, 
    black:null, 
    blackName:null,
    board:null, 
    turn:'white', 
    createdAt: firebase.firestore.FieldValue.serverTimestamp() 
  });
  await startOnlineGame(id, 'white');
}

async function joinRoom(code) {
  const id = code || document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!id) return;
  const ref = db.collection('games').doc(id);
  const doc = await ref.get();
  if (!doc.exists) { toast('Sala no encontrada'); return; }
  const d = doc.data();
  if (d.black && d.black !== currentUser.uid) { toast('Sala llena'); return; }
  const iAmWhite = d.white === currentUser.uid;
  if (!d.black && !iAmWhite) {
    const userName = userProfile.displayName || currentUser.displayName || currentUser.email;
    await ref.update({ black:currentUser.uid, blackName:userName, status:'playing' });
  }
  await startOnlineGame(id, iAmWhite ? 'white' : 'black');
}

async function startOnlineGame(roomId, color) {
  currentRoom = roomId; playerColor = color; isAiGame = false;
  document.getElementById('room-pill').textContent = `SALA: ${roomId}`;
  document.getElementById('resign-btn').style.display = '';
  document.getElementById('admin-controls').style.display = userProfile.isAdmin ? '' : 'none';
  await fetch('/api/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({level:'level_3'})});
  startTimers(10);
  await fetchBoardState();
  showScreen('game');
  document.getElementById('bottom-nav').classList.add('hidden');
  // Subscribe to room changes
  if (unsubRoom) unsubRoom();
  unsubRoom = db.collection('rooms').doc(roomId).onSnapshot(async snap => {
    const rd = snap.data();
    if (rd?.status === 'finished') { onGameEnd(rd.result||'Partida terminada'); }
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
      
    const loading = document.getElementById('history-loading');
    const container = document.getElementById('history-container');
    if(loading) loading.style.display='none';
    if(!container) return;

    if (snap.empty) { 
      container.innerHTML='<p style="color:var(--muted);font-size:.85rem;text-align:center">Sin partidas registradas</p>'; 
      return; 
    }
    container.innerHTML='';
    snap.forEach(doc => {
      const d = doc.data();
      const date = d.timestamp ? new Date(parseInt(d.timestamp)).toLocaleDateString('es-ES') : '--';
      const win = d.result === 'win' || d.result?.includes('Victoria');
      container.innerHTML += `<div class="game-card item-card"><div><div style="font-weight:700">${d.title || d.openingName || 'Partida de Ajedrez'}</div><div style="font-size:.75rem;color:var(--muted)">${d.opponentName || 'IA'} · ${date}</div></div><span style="font-size:.8rem;font-weight:800;color:${win?'var(--green)':'var(--red)'}">${win?'VICTORIA':'DERROTA'}</span></div>`;
    });
    // Also render in profile
    const profGames = document.getElementById('profile-games');
    if(profGames) profGames.innerHTML = container.innerHTML;
    
    animateListItems('#history-container .item-card');
  } catch(e) { console.error("Error history:", e); }
}

async function exportCurrentGame() {
  const data = await safeFetchJson('/api/state');
  const json = JSON.stringify(data.history, null, 2);
  const blob = new Blob([json],{type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='partida.json'; a.click();
}
async function exportCurrentPgn() {
  const data = await safeFetchJson('/api/state');
  const pgn = `[Event "Tosito Chess"]\n[Site "Web"]\n[White "Jugador"]\n[Black "IA ${aiLevel}"]\n\n`;
  const blob = new Blob([pgn],{type:'text/plain'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='partida.pgn'; a.click();
}
function importGameJson() { toast('Función en desarrollo 🛠'); }

// ============================================================
//  ADMIN DATA
// ============================================================
async function fetchAdminData() {
  try {
    const usersSnap = await db.collection('users').get();
    const roomsSnap = await db.collection('games').where('status','in',['waiting','playing']).get();
    document.getElementById('stat-users').textContent = usersSnap.size;
    document.getElementById('stat-rooms').textContent = roomsSnap.size;
    const ul = document.getElementById('admin-user-list');
    if(ul) {
      ul.innerHTML='';
      usersSnap.forEach(doc => {
        const d=doc.data();
        ul.innerHTML += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:6px"><div><div style="font-size:.85rem;font-weight:700">${d.username||d.displayName||d.email||doc.id.substring(0,8)}</div><div style="font-size:.7rem;color:var(--muted)">${d.role||'player'} · ELO ${d.elo||1200}</div></div></div>`;
      });
    }
    const rm = document.getElementById('admin-room-monitor');
    if(rm) {
      rm.innerHTML = '';
      roomsSnap.forEach(doc => {
        const d = doc.data();
        rm.innerHTML += `<div style="padding:8px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:6px;font-size:.8rem"><div style="font-weight:700">Sala: ${doc.id} <span class="badge ${d.status==='playing'?'badge-green':'badge-red'}">${d.status.toUpperCase()}</span></div><div style="color:var(--muted)">⬜${d.whiteName||d.white||'?'} vs ⬛${d.blackName||d.black||'Esperando'}</div></div>`;
      });
    }
  } catch(e) { console.error("Admin data error:", e); toast('Error al cargar datos admin'); }
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
  } catch(e) { 
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
  } catch(e) {
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
  const el = document.getElementById('ex-list');
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
  const el = document.getElementById('ex-explore-list');
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
  } catch(e) { 
    console.error("Error loading community puzzles:", e);
    el.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--red);">Error al conectar con la comunidad.</div>';
  }
}

function renderCommunityList(data) {
  const el = document.getElementById('ex-explore-list');
  if (!el) return;
  const solved = userProfile.solved_puzzles || [];
  el.innerHTML = data.map(pz => {
    const isSolved = solved.includes(pz.id) || solved.includes(pz.puzzleId);
    return `<div class="ex-card ${isSolved ? 'solved' : ''}" onclick="loadPuzzleById('${pz.id}')">
      <h4>Puzzle #${pz.id.replace('li_','')}</h4>
      <p>Nivel: ${pz.rating || '?'}</p>
      <div style="font-size:0.75rem; color:var(--sky); font-weight:700;">🌐 COMUNIDAD</div>
    </div>`;
  }).join('');
  animateListItems('#ex-explore-list .ex-card');
}

async function loadRandomPuzzle() {
  showScreen('exercises');
  switchExTab('ex-list-view');
  document.getElementById('ex-loading').style.display = 'block';
  document.getElementById('ex-list-view').style.display = 'none';
  
  try {
    // We try to get the daily puzzle as a placeholder for "infinite" variety
    await loadDailyPuzzle();
    toast("¡Puzzle cargado! 🧩");
  } catch(e) {
    console.error("Error loading random puzzle:", e);
    toast("Error al cargar puzzle aleatorio");
  } finally {
    document.getElementById('ex-loading').style.display = 'none';
  }
}

function exercisesBack() {
  selectedEx = null; exBoard = []; exSel = null; exValid = [];
  document.getElementById('ex-list-view').style.display = '';
  document.getElementById('ex-detail-view').style.display = 'none';
  document.getElementById('ex-screen-title').textContent = 'Ejercicios';
  document.getElementById('ex-back-btn').style.display = 'none';
}

let exMoveIndex = 0;
let currentExSolution = [];

function selectExercise(id, puzzleData=null) {
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
  document.getElementById('ex-back-btn').style.display='';
  
  // Normalize solution (legacy may use nested arrays or LAN strings)
  currentExSolution = (ex.solution || []).map(s => {
    if (Array.isArray(s)) return s[0] + s[1]; // ["e2","e4"] -> "e2e4"
    return s.replace(' ','');
  });

  exBoard = fenToBoard(ex.fen);
  const turn = getTurnFromFen(ex.fen);
  exStartTurn = turn === 'w' ? 'white' : 'black';

  exMoveIndex = 0;
  exLastMove = null;

  updateExUI(ex, turn);
  exSel=null; exValid=[];
  renderBoard(exBoard, 'ex-board', onExSquareClick, turn === 'b', null, null);
  
  // Better scroll to board
  const boardEl = document.getElementById('ex-board');
  if (boardEl) boardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateExUI(ex, turn) {
  document.getElementById('ex-title').textContent = ex.title;
  document.getElementById('ex-desc').textContent = ex.description;
  document.getElementById('ex-feedback').style.display='none';
  document.getElementById('ex-prompt').style.display='';
  document.getElementById('ex-next-btn').style.display='none';
  document.getElementById('ex-list-view').style.display='none';
  document.getElementById('ex-detail-view').style.display='';
  document.getElementById('ex-screen-title').textContent='Resolver Ejercicio';
  
  const tp = document.getElementById('ex-turn-pill');
  if (tp) {
    tp.textContent = turn === 'w' ? 'MUEVEN BLANCAS ♖' : 'MUEVEN NEGRAS ♜';
    tp.style.background = turn === 'w' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)';
  }
}

function resetExercise() { if (selectedEx) selectExercise(selectedEx.id); }

function onExSquareClick(r,c) {
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
          document.getElementById('ex-next-btn').style.display = '';
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
              document.getElementById('ex-next-btn').style.display = '';
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
    exSel = [r,c]; 
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
  } catch(e) { console.error("Error marking puzzle as solved:", e); }
}

function showExFeedback(correct, msg) {
  const fb = document.getElementById('ex-feedback');
  fb.style.display='';
  fb.className = 'ex-feedback ' + (correct ? 'correct' : 'wrong');
  fb.style.background = correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
  fb.style.color = correct ? 'var(--green)' : 'var(--red)';
  fb.textContent = msg;
  document.getElementById('ex-prompt').style.display = 'none';
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
  document.getElementById('ex-loading').style.display='flex';
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
  } catch(e) {
    console.error("Error loading daily puzzle:", e);
    toast('Error al cargar el puzzle diario.');
  } finally {
    document.getElementById('ex-loading').style.display='none';
  }
}

async function loadPuzzleById(id) {
  if (!id) return;
  document.getElementById('ex-loading').style.display='flex';
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
  } catch(e) {
    console.error("Error loading puzzle by ID:", e);
    toast('Error al cargar el puzzle.');
  } finally {
    document.getElementById('ex-loading').style.display='none';
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
  document.getElementById('ex-loading').style.display='none';
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
  const pieceMap = {p:'P',r:'R',n:'N',b:'B',q:'Q',k:'K'};
  const grid=Array(8).fill(null).map(()=>Array(8).fill(null));
  const rows=fen.split(' ')[0].split('/');
  rows.forEach((row,r)=>{
    let c=0;
    for(let ch of row){
      if(isNaN(ch)){
        const isW=ch===ch.toUpperCase();
        grid[r][c]={color:isW?'white':'black',type:ch.toUpperCase()};
        c++;
      } else c+=parseInt(ch);
    }
  });
  return grid;
}

function boardToFen(grid, turn='w') {
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
    document.getElementById('bootstrap-migration').style.display = 'none';
  } catch(e) { 
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
      document.getElementById('bootstrap-migration').style.display = 'block';
      const opBtn = document.getElementById('btn-migrate-op');
      const exBtn = document.getElementById('btn-migrate-ex');
      if (opBtn) opBtn.style.display = opSnap.empty ? '' : 'none';
      if (exBtn) exBtn.style.display = exSnap.empty ? '' : 'none';
    }
  } catch(e) { console.error("Migration check failed:", e); }
}

// Robust utility to migrate openings to Firestore with progress saving (Call from lobby button)
async function migrateOpeningsToFirestore() {
  const btn = document.getElementById('btn-migrate-op');
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

  } catch(e) {
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
  const btn = document.getElementById('btn-migrate-hist');
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
        
        console.log(`- Migration: [${i+1}/${totalSteps}] ${master.name} (ID: ${master.id}) - Found ${masterGames.length} games.`);
        
        if (btn) btn.innerHTML = `🏆 Subiendo ${master.name} (${i+1}/${totalSteps})...`;
        
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
        console.log(`Processed Master: ${master.name} (${i+1}/${totalSteps})`);
        
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

  } catch(e) {
    console.error("Historical migration failed:", e);
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = "❌ Error (Reintentar)";
    }
    toast("Error en migración histórica. Reintenta.");
  }
}


function renderOpeningsList(query = '') {
  const el = document.getElementById('op-list');
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
        <p style="font-size:.85rem;color:var(--muted);margin-top:4px">${(op.description || '').substring(0,80)}...</p>
      </div>
      <span class="item-icon">›</span>
    </div>`
  ).join('');
}

function filterOpenings() {
  const q = document.getElementById('op-search-input').value;
  renderOpeningsList(q);
}

function openingsBack() {
  if (selectedOp) {
    selectedOp=null; opBoard=[];
    document.getElementById('op-list-view').style.display='';
    document.getElementById('op-detail-view').style.display='none';
    document.getElementById('op-screen-title').textContent='Aperturas';
    document.getElementById('op-back-btn').style.display='none';
  }
}

function selectOpening(id) {
  selectedOp = openings.find(o=>o.id===id);
  if (!selectedOp) return;
  opMoveIdx = 0;
  opBoard = fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  document.getElementById('op-eco').textContent = selectedOp.eco;
  document.getElementById('op-name').textContent = selectedOp.name;
  document.getElementById('op-desc').textContent = selectedOp.description;
  document.getElementById('op-list-view').style.display='none';
  document.getElementById('op-detail-view').style.display='';
  document.getElementById('op-screen-title').textContent='Apertura';
  document.getElementById('op-back-btn').style.display='';
  renderOpBoard(); updateOpLabel();
}

function resetOpening() { opMoveIdx=0; opBoard=fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); renderOpBoard(); updateOpLabel(); }

function prevOpMove() { if(opMoveIdx>0){ opMoveIdx--; rebuildOpBoard(); } }
function nextOpMove() {
  if(!selectedOp||opMoveIdx>=selectedOp.moves_lan.length) return;
  const lan=selectedOp.moves_lan[opMoveIdx];
  applyLanToBoard(opBoard, lan);
  opMoveIdx++;
  renderOpBoard(); updateOpLabel();
}
function rebuildOpBoard() {
  opBoard=fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  for(let i=0;i<opMoveIdx;i++) applyLanToBoard(opBoard,selectedOp.moves_lan[i]);
  renderOpBoard(); updateOpLabel();
}
function applyLanToBoard(grid, lan) {
  const files='abcdefgh';
  const sc=files.indexOf(lan[0]),sr=8-parseInt(lan[1]);
  const ec=files.indexOf(lan[2]),er=8-parseInt(lan[3]);
  if(sc<0||ec<0) return;
  grid[er][ec]=grid[sr][sc]; grid[sr][sc]=null;
  // Castling
  if(grid[er][ec]?.type==='K'){
    if(ec-sc===2){grid[er][5]=grid[er][7];grid[er][7]=null;}
    if(sc-ec===2){grid[er][3]=grid[er][0];grid[er][0]=null;}
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
  const el=document.getElementById('op-move-label');
  const prev=document.getElementById('op-prev');
  const next=document.getElementById('op-next');
  if(opMoveIdx===0) el.textContent='Posición Inicial';
  else { const san=selectedOp.moves_san?.[opMoveIdx-1]||'?'; el.textContent=`Jugada ${opMoveIdx}: ${san}`; }
  prev.disabled=opMoveIdx===0;
  next.disabled=!selectedOp||opMoveIdx>=selectedOp.moves_lan.length;
}

// ============================================================
//  PROFILE — USERNAME EDIT
// ============================================================
function startEditUser() {
  const disp=document.getElementById('profile-user-display');
  const inp=document.getElementById('profile-user-input');
  const save=document.getElementById('profile-user-save');
  inp.value=userProfile.username;
  disp.style.display='none'; inp.style.display=''; save.style.display=''; inp.focus();
}
async function saveUsername() {
  const inp=document.getElementById('profile-user-input');
  const val=inp.value.trim().replace('@','');
  if(!val) return;
  await db.collection('users').doc(currentUser.uid).update({username:val});
  userProfile.username=val;
  document.getElementById('profile-user-display').textContent=`@${val}`;
  document.getElementById('profile-user-display').style.display='';
  document.getElementById('profile-user-input').style.display='none';
  document.getElementById('profile-user-save').style.display='none';
  toast('Usuario actualizado ✓');
}

// ============================================================
//  SOCIAL
// ============================================================
async function loadSocial() {
  if(!currentUser) return;
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
    const reqTab = document.getElementById('soc-req-tab');
    const chalTab = document.getElementById('soc-chal-tab');
    if(reqTab) reqTab.innerHTML = `SOLICITUDES ${friendRequests.length > 0 ? '<span class="notif-dot"></span>' : ''}`;
    if(chalTab) chalTab.innerHTML = `RETOS ${challenges.length > 0 ? '<span class="notif-dot"></span>' : ''}`;
  } catch(e) { console.error("Error loading social:", e); }
}

function renderSocial() {
  // Friends
  const fp=document.getElementById('soc-friends');
  fp.innerHTML = friends.length ? friends.map(f=>`<div class="friend-card"><div class="friend-avatar">👤</div><div><h5>${f.displayName||f.username||f.email||'Amigo'}</h5><div class="fr-sub">@${f.username||'--'}</div></div><button onclick="challengeFriend('${f.id}')" class="btn btn-ghost" style="width:auto;padding:6px 12px;font-size:.75rem;margin-left:auto;border-color:rgba(16,185,129,.4);color:var(--green)">RETAR ⚔️</button></div>`).join('') : `<div class="empty-soc">Aún no tienes amigos 😔</div>`;
  // Requests
  const rp=document.getElementById('soc-requests');
  rp.innerHTML = friendRequests.length ? friendRequests.map(r=>`<div class="friend-card"><div class="friend-avatar">📨</div><div style="flex:1"><h5>${r.fromName||r.fromEmail||'Alguien'}</h5><div class="fr-sub">Quiere ser tu amigo</div></div><div class="req-btns"><button class="btn-acc" onclick="acceptFriend('${r.id}','${r.fromUid}')">✓ Aceptar</button><button class="btn-rej" onclick="rejectFriend('${r.id}')">✕</button></div></div>`).join('') : `<div class="empty-soc">Sin solicitudes pendientes</div>`;
  // Challenges
  const cp=document.getElementById('soc-challenges');
  cp.innerHTML = challenges.length ? challenges.map(c=>`<div class="friend-card"><div class="friend-avatar">⚔️</div><div style="flex:1"><h5>${c.fromName||'Alguien'} te reta</h5><div class="fr-sub">¿Aceptas el duelo?</div></div><div class="req-btns"><button class="btn-acc" onclick="acceptChallenge('${c.id}','${c.fromUid}')">Aceptar</button><button class="btn-rej" onclick="rejectChallenge('${c.id}')">✕</button></div></div>`).join('') : `<div class="empty-soc">Sin retos pendientes ⚔️</div>`;
}

async function sendFriendRequest() {
  const val = document.getElementById('friend-input').value.trim().toLowerCase();
  if(!val || !currentUser) return;
  try {
    // Find user by username_lowercase (Android convention)
    let snap = await db.collection('users').where('username_lowercase', '==', val).limit(1).get();
    if(snap.empty) snap = await db.collection('users').where('email', '==', val).limit(1).get();
    
    if(snap.empty) { toast('Usuario no encontrado'); return; }
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
    document.getElementById('friend-input').value = '';
    toast('Solicitud enviada ✓');
  } catch(e) { console.error(e); toast('Error al enviar solicitud'); }
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
  } catch(e) { console.error(e); toast('Error al aceptar amigo'); }
}

async function rejectFriend(reqId) {
  try {
    await db.collection('friend_requests').doc(reqId).delete();
    loadSocial();
    toast('Solicitud rechazada');
  } catch(e) { console.error(e); }
}

async function challengeFriend(uid) { toast('Función de retos (root) en desarrollo 🛠'); }
async function acceptChallenge(cId, fromUid) { toast('Aceptando reto...'); }
async function rejectChallenge(cId) {
  try {
    await db.collection('game_challenges').doc(cId).update({status:'rejected'});
    loadSocial();
  } catch(e) { console.error(e); }
}

// ============================================================
//  TOAST
// ============================================================
let toastTimer=null;
function toast(msg, duration=2800) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),duration);
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
  const el = document.getElementById('masters-list');
  if(!el) return;
  
  el.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem;">Cargando Galería de Maestros (Nube)... 🏆</div>';
  
  try {
    // Fetch from Firestore or fresh JSON if initial sync
    const mastersData = await safeFetchJson('api/historical_masters.json?v=' + Date.now());
    if (mastersData) historicalMasters = mastersData;
    renderMastersList();
  } catch(e) {
    console.error("Error loading masters from Firestore:", e);
    // Fallback if needed? No, let's keep it Cloud-focused as requested
    el.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--red);">Error al conectar con el archivo histórico de Firebase.</div>';
  }
}

function renderMastersList() {
  const el = document.getElementById('masters-list');
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
  if(!master) return;
  
  const listEl = document.getElementById('masters-list');
  if (listEl) listEl.style.display = 'none';
  const box = document.getElementById('master-games-box');
  box.style.display = 'block';
  document.getElementById('current-master-name').textContent = `Partidas de ${master.name}`;
  
  const list = document.getElementById('master-games-list');
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
    
    const games = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
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
  } catch(e) {
    console.error(e);
    list.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--red);">Error al recuperar partidas.</div>';
  }
}

function hideMasterGames() {
  const box = document.getElementById('master-games-box');
  const list = document.getElementById('masters-list');
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
    
    document.getElementById('op-eco').textContent = selectedOp.eco;
    document.getElementById('op-name').textContent = selectedOp.name;
    document.getElementById('op-desc').textContent = selectedOp.description;
    
    showScreen('openings');
    document.getElementById('op-list-view').style.display='none';
    document.getElementById('op-detail-view').style.display='';
    document.getElementById('op-screen-title').textContent='Visor Firebase';
    document.getElementById('op-back-btn').style.display='';
    
    renderOpBoard(); updateOpLabel();
  } catch(e) {
    console.error(e);
    toast('Error: ' + e.message);
  }
}

setInterval(()=>{ if(document.getElementById('screen-game').classList.contains('active')&&!isAiGame&&currentRoom) fetchBoardState(); },3000);
setInterval(()=>{ if(document.getElementById('screen-lobby').classList.contains('active')) fetchRooms(); },10000);
