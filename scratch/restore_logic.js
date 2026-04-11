const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../public/js/app_v80.js');
let js = fs.readFileSync(jsPath, 'utf8');

const remoteModule = `
/**
 * ANOMALÍA INTEGRATION
 */
window.showAnomaliaScreen = function() {
  showScreen('anomalia');
  
  const frame = document.getElementById('anomalia-frame');
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
window.showTurboDriftScreen = function() {
  showScreen('turbo-drift');
  
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

function checkRemoteMode() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const uid = params.get('uid');
  if (mode === 'remote' && uid) {
    const ctrl = document.getElementById('screen-remote-controller');
    if (ctrl) ctrl.style.display = 'flex';
    window._remoteTargetUid = uid;
    db.collection('users').doc(uid).get().then(doc => {
      if (doc.exists) {
        const name = doc.data().username || doc.data().displayName || "Jugador";
        const label = document.getElementById('remote-user-name');
        if (label) label.textContent = "MANDO DE " + name.toUpperCase();
      }
    });
  }
}

window.toggleRemoteLayout = function() {
  const s = document.getElementById('layout-simple');
  const g = document.getElementById('layout-gaming');
  const btn = document.getElementById('btn-toggle-layout');
  if (_remoteLayout === 'simple') {
    _remoteLayout = 'gaming';
    if (s) s.classList.remove('active');
    if (g) g.classList.add('active');
    if (btn) btn.textContent = "MODO: JUEGO";
  } else {
    _remoteLayout = 'simple';
    if (g) g.classList.remove('active');
    if (s) s.classList.add('active');
    if (btn) btn.textContent = "MODO: NAVEGACIÓN";
  }
};

window.openRemoteModal = function() {
  const modal = document.getElementById('remote-modal');
  if (modal) modal.classList.add('show');
  updateRemoteQR();
  initRemoteListener();
};

window.updateRemoteQR = function() {
  const hostInput = document.getElementById('remote-host-input');
  const host = (hostInput && hostInput.value) || window.location.hostname;
  const user = firebase.auth().currentUser;
  if (!user) return;
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent("http://" + host + ":5000/?mode=remote&uid=" + user.uid);
  const qrImg = document.getElementById('remote-qr');
  if (qrImg) qrImg.src = qrUrl;
};

window.closeRemoteModal = function() {
  const modal = document.getElementById('remote-modal');
  if (modal) modal.classList.remove('show');
};

function initRemoteListener() {
  if (_remoteUnsub) return;
  const user = firebase.auth().currentUser;
  if (!user) return;
  _remoteUnsub = db.collection('remotes').doc(user.uid).onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      if (data.type === 'input' && data.key && (Date.now() - data.timestamp < 3000)) {
        simulateRemoteKey(data.key, data.isDown);
      }
    }
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

function simulateRemoteKey(key, isDown) {
  if (isDown) activateRemoteConsoleMode();
  const hub = document.getElementById('screen-hub');
  const isHubActive = hub && hub.style.display !== 'none';
  
  if (isHubActive && isDown) {
    if (key.startsWith('Arrow')) {
      handleHubRemoteNavigation(key);
      return;
    }
    if (key === 'Enter') {
      triggerFocusedCard();
      return;
    }
  }

  const type = isDown ? 'keydown' : 'keyup';
  const event = new KeyboardEvent(type, { key: key, bubbles: true, code: key });
  document.dispatchEvent(event);
  document.querySelectorAll('iframe').forEach(f => {
    try {
      if (f.contentWindow) {
        f.contentWindow.document.dispatchEvent(new KeyboardEvent(type, { key: key, bubbles: true }));
        f.contentWindow.dispatchEvent(new KeyboardEvent(type, { key: key, bubbles: true }));
      }
    } catch(e) {}
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

window.remoteKey = function(key, isDown) {
  const uid = window._remoteTargetUid;
  if (!uid) return;
  if (isDown && window.navigator.vibrate) window.navigator.vibrate(15);
  db.collection('remotes').doc(uid).set({
    type: 'input', key: key, isDown: isDown, timestamp: Date.now()
  });
};

// Initial state check
window.addEventListener('load', () => {
  checkRemoteMode();
});
`;

// Only append if not already present
if (!js.includes('WIRELESS REMOTE CONTROL')) {
  fs.appendFileSync(jsPath, remoteModule, 'utf8');
  console.log('[SUCCESS] app_v80.js updated.');
} else {
  console.log('[INFO] app_v80.js already has the remote module.');
}
