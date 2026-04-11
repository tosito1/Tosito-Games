import { gameInfo } from './games.js';
import { WebsimSocket } from '@websim/websim-socket';

// Audio setup
const bgMusic = document.getElementById('bgMusic');
// HTML Audio elements for sound effects are no longer needed for playback,
// but are kept for settings logic to read their src.
const hoverSound = document.getElementById('hoverSound');
const selectSound = document.getElementById('selectSound');
const backSound = document.getElementById('backSound');

// --- Web Audio API Setup for Low-Latency SFX ---
let audioContext;
const soundBuffers = {};
let sfxGainNode;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sfxGainNode = audioContext.createGain();
        sfxGainNode.connect(audioContext.destination);
    } catch (e) {
        console.error('Web Audio API is not supported in this browser');
    }
}

async function loadSound(name, url) {
    if (!audioContext || !url) return;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        soundBuffers[name] = audioBuffer;
    } catch (e) {
        console.error(`Failed to load sound: ${name} from ${url}`, e);
    }
}

function playSound(buffer) {
    if (!audioContext || !buffer || !soundToggle.checked) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(sfxGainNode);
    source.start(0);
}

// --- Sound Playback Functions ---
function playHoverSound() {
    const pack = soundPackSelect.value;
    playSound(soundBuffers[`${pack}_hover`]);
}

function playSelectSound() {
    const pack = soundPackSelect.value;
    playSound(soundBuffers[`${pack}_select`]);
}

function playBackSound() {
    const pack = soundPackSelect.value;
    playSound(soundBuffers[`${pack}_back`]);
}

// --- CORE UI LOGIC ---

const gameContainer = document.getElementById('game-container');
const navTabs = document.querySelectorAll('.nav-tab');

function createGameCard(gameUrl, info) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.game = gameUrl;
    if (info.system === 'PC') card.dataset.external = 'true';
    
    card.innerHTML = `
        <img src="${info.cover}" alt="${info.title}" class="game-card-cover">
        <div class="game-card-info">
            <div class="game-card-title">${info.title}</div>
            <div class="game-card-year">(${info.year})</div>
        </div>
    `;

    card.addEventListener('mouseenter', playHoverSound);
    card.addEventListener('click', () => {
        playSelectSound();
        showGameInfo(card);
    });
    return card;
}

function renderGames() {
    gameContainer.innerHTML = '';
    const gamesBySystem = {};
    const sortOrder = document.getElementById('orderSelect').value;

    // Group games by system
    Object.entries(gameInfo).forEach(([url, info]) => {
        if (info.hidden) return; // Hide games marked as 'hidden'
        if (!gamesBySystem[info.system]) gamesBySystem[info.system] = [];
        gamesBySystem[info.system].push({ url, ...info });
    });

    // Create grids for each system
    for (const system in gamesBySystem) {
        if (system === '???') continue; // Skip secret game
        
        const grid = document.createElement('div');
        grid.className = 'game-grid';
        grid.id = `grid-${system}`;
        
        // Sort games
        gamesBySystem[system].sort((a, b) => {
            if (sortOrder === 'name') return a.title.localeCompare(b.title);
            return parseInt(a.year) - parseInt(b.year); // Default to year
        });

        // Populate grid
        gamesBySystem[system].forEach(game => {
            grid.appendChild(createGameCard(game.url, game));
        });
        
        // Add request button
        const requestBtnContainer = document.createElement('div');
        requestBtnContainer.className = 'add-game-btn-container';
        const addButton = document.createElement('div');
        addButton.className = 'add-game-btn';
        addButton.textContent = '+';
        addButton.addEventListener('click', () => showGameRequest(system));
        requestBtnContainer.appendChild(addButton);
        grid.appendChild(requestBtnContainer);

        gameContainer.appendChild(grid);
    }
    
    // Activate the current tab
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab) {
        document.getElementById(`grid-${activeTab.dataset.console}`).classList.add('active');
    }

    updateOwnerView();
}

// Console Tab Navigation
navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        navTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.game-grid').forEach(grid => grid.classList.remove('active'));
        document.getElementById(`grid-${tab.dataset.console}`).classList.add('active');
    });
});

// --- GAME INFO POPUP ---
const popupOverlay = document.querySelector('.popup-overlay');
const gameInfoPopup = document.querySelector('.game-info-popup');

function showGameInfo(gameCard) {
    const gameUrl = gameCard.dataset.game;
    const info = gameInfo[gameUrl];
    if (!info) return;

    const playCount = localStorage.getItem(`plays_${gameUrl}`) || 0;

    // Update popup content
    document.getElementById('popup-title').textContent = info.title;
    document.getElementById('popup-year').textContent = `(${info.year})`;
    document.getElementById('popup-cover').src = info.cover;
    
    let overviewHTML = '';
    if (info.warning) {
        overviewHTML += `<div class="popup-warning"><span class="warning-icon">⚠️</span>${info.warning}</div>`;
    }
    overviewHTML += `<p class="popup-description">${info.description || 'No description available.'}</p>`;
    document.getElementById('tab-overview').innerHTML = overviewHTML;

    document.getElementById('detail-system').textContent = info.system;
    document.getElementById('detail-plays').textContent = playCount;
    document.getElementById('detail-genre').textContent = info.genre || 'N/A';
    document.getElementById('detail-features').textContent = info.features || 'N/A';

    // Handle Prototype Tab
    const protoTab = document.querySelector('.popup-tab[data-tab="prototypes"]');
    const protoContent = document.getElementById('tab-prototypes');
    protoContent.innerHTML = ''; // Clear previous content

    if (info.prototypes && info.prototypes.length > 0) {
        protoTab.textContent = info.prototypes.length > 1 ? 'Prototype Builds' : 'Prototype Build';
        protoTab.style.display = 'block';

        info.prototypes.forEach(proto => {
            const entry = document.createElement('div');
            entry.className = 'prototype-entry';
            entry.innerHTML = `
                <img src="${proto.cover}" alt="${proto.title}" class="prototype-cover">
                <div class="prototype-info">
                    <h4>${proto.title}</h4>
                    <p>${proto.description}</p>
                </div>
                <button class="play-proto-button" data-game="${proto.url}">Play</button>
            `;
            entry.querySelector('.play-proto-button').addEventListener('click', (e) => {
                const protoGame = e.target.dataset.game;
                incrementPlayCount(protoGame);
                hideGameInfo();
                setTimeout(() => window.location.href = protoGame, 100);
            });
            protoContent.appendChild(entry);
        });
    } else {
        protoTab.style.display = 'none';
    }

    // Handle Lock-on Tab
    const lockOnTab = document.querySelector('.popup-tab[data-tab="lock-on"]');
    const lockOnContent = document.getElementById('tab-lock-on');
    lockOnContent.innerHTML = '';

    if (info.system === 'Genesis') {
        lockOnTab.style.display = 'block';
        let lockOnGameUrl;
        if (gameUrl === 'STH2.html') {
            lockOnGameUrl = 'KIS2.html';
        } else if (gameUrl === 'STH3.html') {
            lockOnGameUrl = 'S3&k.html';
        } else {
            lockOnGameUrl = 'BS.html';
        }

        const lockOnInfo = gameInfo[lockOnGameUrl];
        if (lockOnInfo) {
            const entry = document.createElement('div');
            entry.className = 'prototype-entry'; // Re-using style for consistency
            entry.innerHTML = `
                <img src="${lockOnInfo.cover}" alt="${lockOnInfo.title}" class="prototype-cover">
                <div class="prototype-info">
                    <h4>${lockOnInfo.title}</h4>
                    <p>${lockOnInfo.description}</p>
                </div>
                <button class="play-proto-button" data-game="${lockOnGameUrl}">Play</button>
            `;
            entry.querySelector('.play-proto-button').addEventListener('click', (e) => {
                const gameToPlay = e.target.dataset.game;
                incrementPlayCount(gameToPlay);
                hideGameInfo();
                setTimeout(() => window.location.href = gameToPlay, 100);
            });
            lockOnContent.appendChild(entry);
        }
    } else {
        lockOnTab.style.display = 'none';
    }

    // Store game data for play button
    const playButton = document.getElementById('play-button');
    playButton.dataset.game = gameUrl;
    playButton.dataset.external = gameCard.dataset.external || 'false';

    // Alt link for Mania and Master System versions
    const altButton = document.getElementById('alt-link-button');
    altButton.style.display = 'none'; // Reset
    altButton.onclick = null; // Clear previous listener

    const masterSystemLinks = {
        'STHGG.html': 'STHMS.html',
        'STH2GG.html': 'STH2MS.html',
        'SC.html': 'SCMS.html'
    };

    if (gameUrl === 'RSDKv5.html') {
        altButton.textContent = 'Alt Link';
        altButton.style.display = 'block';
        altButton.onclick = () => window.open('https://sonicmania.on.websim.com', '_blank');
    } else if (masterSystemLinks[gameUrl]) {
        altButton.textContent = 'Master System Version';
        altButton.style.display = 'block';
        altButton.onclick = () => {
            const msGameUrl = masterSystemLinks[gameUrl];
            incrementPlayCount(msGameUrl);
            hideGameInfo();
            setTimeout(() => window.location.href = msGameUrl, 100);
        };
    }

    popupOverlay.style.display = 'block';
    gameInfoPopup.style.display = 'block'; /* Use block, CSS will handle flex for mobile */
    resetPopupTabs();
}

function hideGameInfo() {
    playBackSound();
    popupOverlay.style.display = 'none';
    gameInfoPopup.style.display = 'none';
}

// Popup tab logic
const popupTabs = document.querySelectorAll('.popup-tab');
const popupTabContents = document.querySelectorAll('.popup-tab-content');

function resetPopupTabs() {
    popupTabs.forEach((t, i) => t.classList.toggle('active', i === 0));
    popupTabContents.forEach((c, i) => c.classList.toggle('active', i === 0));
}

popupTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        popupTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        popupTabContents.forEach(content => {
            content.classList.toggle('active', `tab-${tab.dataset.tab}` === content.id);
        });
    });
});

document.getElementById('play-button').addEventListener('click', (e) => {
    const game = e.target.dataset.game;
    const isExternal = e.target.dataset.external === 'true';
    
    incrementPlayCount(game);
    hideGameInfo();
    
    if (isExternal) {
      return window.open(game, '_blank');
    }
    
    setTimeout(() => window.location.href = game, 100);
});

document.getElementById('close-popup-btn').addEventListener('click', hideGameInfo);
popupOverlay.addEventListener('click', hideGameInfo);

function incrementPlayCount(gameUrl) {
    const currentCount = parseInt(localStorage.getItem(`plays_${gameUrl}`) || 0);
    localStorage.setItem(`plays_${gameUrl}`, currentCount + 1);
}

// --- SETTINGS ---
const settingsButton = document.querySelector('.settings-button');
const settingsMenu = document.querySelector('.settings-menu');
const musicToggle = document.getElementById('musicToggle');
const soundToggle = document.getElementById('soundToggle');
const orderSelect = document.getElementById('orderSelect');
const backgroundSelect = document.getElementById('backgroundSelect');
const bgMusicSelect = document.getElementById('bgMusicSelect');
const musicVolumeSlider = document.getElementById('musicVolumeSlider');
const sfxVolumeSlider = document.getElementById('sfxVolumeSlider');
const soundPackSelect = document.getElementById('soundPackSelect');

const soundPacks = {
    smc: {
        hover: 'Hover.wav',
        select: 'Select.wav',
        back: 'Back.wav'
    },
    cd2011: {
        hover: 'HoverCD.wav',
        select: 'SelectCD.wav',
        back: 'BackCD.wav'
    },
    mania: {
        hover: 'HoverMania.wav',
        select: 'SelectMania.wav',
        back: 'BackMania.wav'
    },
    generations: {
        hover: 'HoverGenerations.wav',
        select: 'SelectGeneration.wav',
        back: 'BackGeneration.wav'
    }
};

settingsButton.addEventListener('click', () => settingsMenu.classList.toggle('visible'));
document.addEventListener('click', (e) => {
  if (!settingsMenu.contains(e.target) && !settingsButton.contains(e.target)) {
    settingsMenu.classList.remove('visible');
  }
});

musicToggle.addEventListener('change', () => { musicToggle.checked ? bgMusic.play().catch(e=>{}) : bgMusic.pause(); saveSettings(); });
soundToggle.addEventListener('change', saveSettings);
orderSelect.addEventListener('change', () => { renderGames(); saveSettings(); });
backgroundSelect.addEventListener('change', () => { document.body.style.backgroundImage = `url('${backgroundSelect.value}')`; saveSettings(); });
bgMusicSelect.addEventListener('change', () => { bgMusic.src = bgMusicSelect.value; if(musicToggle.checked) bgMusic.play(); saveSettings(); });
musicVolumeSlider.addEventListener('input', () => { bgMusic.volume = musicVolumeSlider.value / 100; saveSettings(); });
sfxVolumeSlider.addEventListener('input', () => { 
    if (sfxGainNode) {
        sfxGainNode.gain.value = sfxVolumeSlider.value / 100;
    }
    saveSettings(); 
});
soundPackSelect.addEventListener('change', () => {
    const selectedPack = soundPacks[soundPackSelect.value];
    if (selectedPack) {
        hoverSound.src = selectedPack.hover;
        selectSound.src = selectedPack.select;
        backSound.src = selectedPack.back;
    }
    saveSettings();
});

function saveSettings() {
    localStorage.setItem('settings', JSON.stringify({
        music: musicToggle.checked,
        sound: soundToggle.checked,
        soundPack: soundPackSelect.value,
        order: orderSelect.value,
        background: backgroundSelect.value,
        bgMusic: bgMusicSelect.value,
        volume: musicVolumeSlider.value,
        sfxVolume: sfxVolumeSlider.value
    }));
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('settings'));
    if (!settings) return;
    musicToggle.checked = settings.music ?? true;
    soundToggle.checked = settings.sound ?? true;
    soundPackSelect.value = settings.soundPack ?? 'smc';
    orderSelect.value = settings.order ?? 'year';
    backgroundSelect.value = settings.background ?? 'sonic_mania_menu_bg.gif';
    bgMusicSelect.value = settings.bgMusic ?? 'BG.mp3';
    musicVolumeSlider.value = settings.volume ?? '30';
    sfxVolumeSlider.value = settings.sfxVolume ?? '50';
    
    // Apply settings
    soundPackSelect.dispatchEvent(new Event('change'));
    soundToggle.dispatchEvent(new Event('change'));
    backgroundSelect.dispatchEvent(new Event('change'));
    bgMusicSelect.dispatchEvent(new Event('change'));
    musicVolumeSlider.dispatchEvent(new Event('input'));
    sfxVolumeSlider.dispatchEvent(new Event('input'));
    orderSelect.dispatchEvent(new Event('change'));
}

// --- MODALS (Changelog, Requests) ---
document.getElementById('changelog-btn').addEventListener('click', () => {
    document.getElementById('changelog-popup').style.display = 'block';
    popupOverlay.style.display = 'block';
});
document.querySelector('#changelog-popup .close-modal-btn').addEventListener('click', () => {
    playBackSound();
    document.getElementById('changelog-popup').style.display = 'none';
    popupOverlay.style.display = 'none';
});

async function showRequestsList(type, systemName = null) {
    let requests;
    if (type === 'game') {
        requests = await room.collection('requests').filter({ type: 'game', system: systemName }).getList();
    } else {
        requests = await room.collection('requests').filter({ type: 'system' }).getList();
    }
    
    // Sort requests from newest to oldest
    requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    alert(`Showing ${requests.length} requests for ${systemName || 'new systems'}. Check the browser console for details.`);
    console.log(`--- Requests for ${systemName || 'new systems'} ---`);
    requests.forEach(req => {
        if (req) {
            const timestamp = req.timestamp ? new Date(req.timestamp).toLocaleString() : 'No timestamp';
            const requester = req.requester || 'Anonymous';
            const name = req.name || 'No name';
            console.log(`[${timestamp}] From: ${requester}`);
            console.log(`  Name: ${name}`);
            if (req.link) console.log(`  Link: ${req.link}`);
        } else {
            console.log("Found a malformed request:", req);
        }
        console.log("--------------------");
    });
}

function showRequestForm(type, systemName = '') {
    // Remove existing form if any
    const existingPopup = document.querySelector('.request-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'request-popup';
    const title = type === 'game' ? `Request Game for ${systemName}` : 'Request New System';
    popup.innerHTML = `
        <button class="close-request-btn">×</button>
        <h2>${title}</h2>
        <form>
            <div class="form-group">
                <label for="req-name">${type === 'game' ? 'Game Name' : 'System Name'}</label>
                <input type="text" id="req-name" name="name" required>
            </div>
            <div class="form-group">
                <label for="req-link">Link (Optional)</label>
                <input type="url" id="req-link" name="link" placeholder="e.g., romhacking.net link">
            </div>
            <button type="submit" class="submit-btn">Submit Request</button>
        </form>
    `;
    document.body.appendChild(popup);
    popup.style.display = 'block';
    popup.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        try {
            const user = await window.websim.getCurrentUser();
            const data = {
                type: type,
                name: e.target.name.value,
                link: e.target.link.value,
                requester: user.username,
                timestamp: new Date().toISOString()
            };
            if (type === 'game') {
                data.system = systemName;
            }
            await room.collection('requests').create(data);
            alert('Request submitted! Thank you.');
            popup.remove();
        } catch (error) {
            console.error('Failed to submit request:', error);
            alert('There was an error submitting your request. Please try again.');
        }
    });
}

// --- Game/System Request Logic (condensed but functional)
const room = new WebsimSocket();
const creatorUsername = 'T4ctica1';

async function updateOwnerView() {
    try {
        const user = await window.websim.getCurrentUser();
        if (user && user.username === creatorUsername) {
            document.body.classList.add('owner');
        } else {
            document.body.classList.remove('owner');
        }
    } catch (error) {
        console.error("Could not update owner view:", error);
        document.body.classList.remove('owner');
    }
}

function showGameRequest(system) {
    window.websim.getCurrentUser().then(user => user.username === creatorUsername ? showRequestsList('game', system) : showRequestForm('game', system));
}
document.getElementById('system-request-btn').addEventListener('click', () => {
    window.websim.getCurrentUser().then(user => user.username === creatorUsername ? showRequestsList('system') : showRequestForm('system'));
});

function handleBugReportClick() {
    window.websim.getCurrentUser().then(user => {
        if (user.username === creatorUsername) {
            showBugReportsList();
        } else {
            showBugReportForm();
        }
    });
}

function showBugReportForm() {
    // Remove existing form if any
    const existingPopup = document.querySelector('.request-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'request-popup';
    popup.innerHTML = `
        <button class="close-request-btn">×</button>
        <h2>Bug Report</h2>
        <form>
            <div class="form-group">
                <label>Describe the bug (Required)</label>
                <textarea name="description" rows="5" required placeholder="Please be as detailed as possible. e.g., 'When I click on the Genesis tab, no games show up.'"></textarea>
            </div>
            <button type="submit" class="submit-btn">Submit Report</button>
        </form>
    `;
    document.body.appendChild(popup);
    popup.style.display = 'block';
    popup.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        try {
            const user = await window.websim.getCurrentUser();
            const data = {
                description: e.target.description.value,
                reporter: user.username,
                timestamp: new Date().toISOString()
            };
            await room.collection('bug_reports').create(data);
            alert('Bug report submitted! Thank you.');
            popup.remove();
        } catch (error) {
            console.error('Failed to submit bug report:', error);
            alert('There was an error submitting your bug report. Please try again.');
        }
    });
}

async function showBugReportsList() {
    const reports = await room.collection('bug_reports').getList();
    alert(`Showing ${reports.length} bug reports. Check the browser console for details.`);
    console.log("--- Bug Reports ---");
    reports.forEach(report => {
        if (report) {
            const timestamp = report.timestamp ? new Date(report.timestamp).toLocaleString() : 'No timestamp';
            const reporter = report.reporter || 'Anonymous';
            const description = report.description || 'No description';
            console.log(`[${timestamp}] From: ${reporter}\nDescription: ${description}`);
        } else {
            console.log("Found a malformed report:", report);
        }
        console.log("--------------------");
    });
}

// --- FAQ LOGIC ---
const faqPopup = document.getElementById('faq-popup');
const closeFaqBtn = faqPopup.querySelector('.close-modal-btn');
let faqSubscriptionUnsubscribe = null;

async function showFaqPopup() {
    faqPopup.style.display = 'block';
    popupOverlay.style.display = 'block';
    if (!faqSubscriptionUnsubscribe) {
        document.getElementById('faq-list').innerHTML = 'Loading FAQs...';
        faqSubscriptionUnsubscribe = room.collection('faqs').subscribe(renderFaqEntries);
    }
}

function hideFaqPopup() {
    playBackSound();
    faqPopup.style.display = 'none';
    if (!document.querySelector('.modal[style*="display: block"]')) {
       popupOverlay.style.display = 'none';
    }
    // Unsubscribe when the popup is closed to save resources
    if (faqSubscriptionUnsubscribe) {
        faqSubscriptionUnsubscribe();
        faqSubscriptionUnsubscribe = null;
    }
}
closeFaqBtn.addEventListener('click', hideFaqPopup);

function linkify(text) {
    if (!text) return '';
    // Regex to find URLs (http, https, www)
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%?=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%?=~_|])/gi;
    return text.replace(urlRegex, function(url) {
        let fullUrl = url;
        if (!fullUrl.match(/^(https?|ftp):\/\//i)) {
            fullUrl = 'http://' + fullUrl;
        }
        return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

async function renderFaqEntries(faqs) {
    const faqList = document.getElementById('faq-list');
    const faqContentContainer = document.getElementById('faq-content-container');
    if (!faqList || !faqContentContainer) return;

    // This function is now the callback for the subscription.
    // The 'faqs' argument is provided by the subscription.

    const currentUser = await window.websim.getCurrentUser();
    const isOwner = currentUser.username === creatorUsername;

    // Clear list before re-rendering
    faqList.innerHTML = '';
    
    // Manage "Add" button
    const existingAddBtn = faqContentContainer.querySelector('.add-faq-btn');
    if (isOwner && !existingAddBtn) {
        const addFaqButton = document.createElement('button');
        addFaqButton.className = 'add-faq-btn';
        addFaqButton.textContent = '+ Add New FAQ';
        addFaqButton.onclick = () => showFaqForm();
        faqContentContainer.insertBefore(addFaqButton, faqList);
    } else if (!isOwner && existingAddBtn) {
        existingAddBtn.remove();
    }
    
    // Sort and render FAQs
    const sortedFaqs = faqs.sort((a, b) => (a.order || 0) - (b.order || 0));

    if (sortedFaqs.length === 0) {
        faqList.innerHTML = '<p>No questions have been added yet.</p>';
        return;
    }

    sortedFaqs.forEach(faq => {
        const entry = document.createElement('div');
        entry.className = 'faq-entry';
        entry.dataset.id = faq.id;
        
        let contentHtml = faq.content ? linkify(faq.content) : '';
        contentHtml = contentHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
        contentHtml = contentHtml.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
        contentHtml = contentHtml.replace(/\[img\](.*?)\[\/img\]/g, '<img src="$1" alt="FAQ Image">'); // Image tag
        contentHtml = contentHtml.replace(/\n/g, '<br>'); // Newlines

        entry.innerHTML = `
            <div class="faq-title">${faq.title}</div>
            <div class="faq-content-inner">
                <p>${contentHtml}</p>
            </div>
            ${isOwner ? `
                <button class="edit-faq-btn">✎</button>
                <button class="remove-faq-btn">×</button>
            ` : ''}
        `;

        if (isOwner) {
            entry.querySelector('.remove-faq-btn').onclick = async () => {
                if (confirm('Are you sure you want to delete this FAQ?')) {
                    await room.collection('faqs').delete(faq.id);
                    // No need to re-render, subscription will handle it
                }
            };
            entry.querySelector('.edit-faq-btn').onclick = () => showFaqForm(faq);
        }

        faqList.appendChild(entry);
    });
}

function showFaqForm(faqToEdit = null) {
    const existingPopup = document.querySelector('.faq-form-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'faq-form-popup';
    popup.innerHTML = `
        <button class="close-request-btn">&times;</button>
        <h2>${faqToEdit ? 'Edit FAQ' : 'Add FAQ'}</h2>
        <form>
            <div class="form-group">
                <label for="faq-title">Title</label>
                <input type="text" id="faq-title" name="title" required value="${faqToEdit?.title || ''}">
            </div>
            <div class="form-group">
                <label for="faq-content">Content</label>
                <textarea name="content" id="faq-content" rows="8" required placeholder="You can use **bold**, *italic*, [img]url[/img] for images, and links will be auto-detected.">${faqToEdit?.content || ''}</textarea>
            </div>
            <div class="form-group">
                <label for="faq-order">Order</label>
                <input type="number" id="faq-order" name="order" value="${faqToEdit?.order || 0}">
            </div>
            <button type="submit" class="submit-btn">${faqToEdit ? 'Update FAQ' : 'Create FAQ'}</button>
        </form>
    `;
    document.body.appendChild(popup);
    popup.style.display = 'block';

    popup.querySelector('.close-request-btn').onclick = () => popup.remove();
    popup.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            title: formData.get('title'),
            content: formData.get('content'),
            order: parseInt(formData.get('order'), 10) || 0,
        };

        try {
            if (faqToEdit) {
                // Use upsert for updates, merging the ID with the rest of the data
                await room.collection('faqs').upsert({ id: faqToEdit.id, ...data });
            } else {
                await room.collection('faqs').create(data);
            }
        } catch (error) {
            console.error('Failed to save FAQ:', error);
            alert('There was an error saving the FAQ. Please try again.');
        }
        
        popup.remove();
        // No need to call render, subscription will handle update
    });
}

// --- Sound Test Logic ---
const soundTestScreen = document.getElementById('sound-test-screen');
const soundTestHeader = document.querySelector('.sound-test-header');
const soundTestControls = document.querySelector('.sound-test-controls');
const soundTestSelect = document.getElementById('sound-test-select');
const soundTestPlayBtn = document.getElementById('sound-test-play');
const soundTestStopBtn = document.getElementById('sound-test-stop');
const soundTestAudio = document.getElementById('soundTestAudio');
const closeSoundTestBtn = document.getElementById('sound-test-close-btn');
let musicWasPlayingBeforeSoundTest = false;

// Easter Egg variables
let isEasterEggActive = false; // Track if an easter egg is active
const secretCodePast = [0, 5, 2, 0, 2, 5];
const secretCodeMajin = [4, 6, 1, 2, 2, 5];
const secretCodeCute = [4, 4, 1, 1, 0, 9];
const secretCodeKickit = [4, 2, 0, 3, 0, 1];
const secretCodeHowdoeson = [0, 0, 0, 0, 0, 0];
const secretCodeBathog = [4, 2, 0, 4, 2, 1];
const secretCodeSecret = [2, 2, 0, 8, 0, 9];
const secretCodeCoco = [1, 1, 2, 2, 1, 7];
let soundCodeSequence = [];
const easterEggOverlay = document.getElementById('easter-egg-overlay');
const easterEggVideo = document.getElementById('easter-egg-video');
let majinMusic;
let cuteMusic;
let kickitMusic;
let howdoesonMusic;
let bathogMusic;

const redirectToCollection = () => {
    window.location.href = "https://websim.com/@T4ctica1/sonic-mega-classics-collection";
};

const allSounds = [
    'BG.mp3', 'Back.wav', 'BackCD.wav', 'BackGeneration.wav', 'BackMania.wav',
    'GemsBG.mp3', 'GHBG.mp3', 'Hover.wav', 'HoverCD.wav', 'HoverGenerations.wav',
    'HoverMania.wav', 'ICBG.mp3', 'MGBG.mp3', 'S2BG.mp3', 'S3BG.mp3', 'SLBG.mp3',
    'Secret.mp3', 'Select.wav', 'SelectCD.wav', 'SelectGeneration.wav', 'SelectMania.wav'
];

function setupSoundTest() {
    allSounds.forEach((soundFile, index) => {
        const option = document.createElement('option');
        option.value = soundFile;
        option.textContent = `Sound ${index}`;
        soundTestSelect.appendChild(option);
    });

    soundTestPlayBtn.addEventListener('click', () => {
        const soundFile = soundTestSelect.value;
        const selectedIndex = soundTestSelect.selectedIndex;

        const { pastTriggered, majinTriggered, cuteTriggered, kickitTriggered, howdoesonTriggered, bathogTriggered, secretTriggered, cocoTriggered } = checkSoundCode(selectedIndex);

        // Handle special cases for easter eggs: don't play the last sound
        if (pastTriggered || majinTriggered || cuteTriggered || kickitTriggered || howdoesonTriggered || bathogTriggered || secretTriggered || cocoTriggered) {
            soundTestAudio.pause();
            soundTestAudio.currentTime = 0;
            return;
        }
        
        if (soundFile) {
            soundTestAudio.src = soundFile;
        }

        if (soundTestAudio.src) {
             // Use music volume for music tracks, SFX for effects
            const volume = soundTestAudio.src.includes('.mp3') ? musicVolumeSlider.value / 100 : sfxVolumeSlider.value / 100;
            soundTestAudio.volume = volume; 
            soundTestAudio.play().catch(e => console.error("Sound test playback failed:", e));
        }
    });

    soundTestStopBtn.addEventListener('click', () => {
        soundTestAudio.pause();
        soundTestAudio.currentTime = 0;
    });

    closeSoundTestBtn.addEventListener('click', closeSoundTest);
}

// Easter Egg Functions
function checkSoundCode(index) {
    soundCodeSequence.push(index);
    if (soundCodeSequence.length > 6) { // Length of the longest code
        soundCodeSequence.shift();
    }

    const sequenceString = JSON.stringify(soundCodeSequence);

    const result = {
        pastTriggered: false,
        majinTriggered: false,
        cuteTriggered: false,
        kickitTriggered: false,
        howdoesonTriggered: false,
        bathogTriggered: false,
        secretTriggered: false,
        cocoTriggered: false
    };

    if (sequenceString === JSON.stringify(secretCodePast)) {
        triggerEasterEggPast();
        soundCodeSequence = [];
        result.pastTriggered = true;
        return result;
    }
    
    if (sequenceString === JSON.stringify(secretCodeMajin)) {
        triggerEasterEggMajin();
        soundCodeSequence = [];
        result.majinTriggered = true;
        return result;
    }

    if (sequenceString === JSON.stringify(secretCodeCute)) {
        triggerEasterEggCute();
        soundCodeSequence = [];
        result.cuteTriggered = true;
        return result;
    }

    if (sequenceString === JSON.stringify(secretCodeKickit)) {
        triggerEasterEggKickit();
        soundCodeSequence = [];
        result.kickitTriggered = true;
        return result;
    }
    
    if (sequenceString === JSON.stringify(secretCodeHowdoeson)) {
        triggerEasterEggHowdoeson();
        soundCodeSequence = [];
        result.howdoesonTriggered = true;
        return result;
    }

    if (sequenceString === JSON.stringify(secretCodeBathog)) {
        triggerEasterEggBathog();
        soundCodeSequence = [];
        result.bathogTriggered = true;
        return result;
    }

    if (sequenceString === JSON.stringify(secretCodeSecret)) {
        triggerEasterEggSecret();
        soundCodeSequence = [];
        result.secretTriggered = true;
        return result;
    }

    if (sequenceString === JSON.stringify(secretCodeCoco)) {
        triggerEasterEggCoco();
        soundCodeSequence = [];
        result.cocoTriggered = true;
        return result;
    }

    return result;
}

function triggerEasterEggPast() {
    isEasterEggActive = true;
    // 1. Fade to white
    easterEggOverlay.style.display = 'block';
    setTimeout(() => {
        easterEggOverlay.style.opacity = '1';
    }, 10); // small delay to ensure transition triggers

    // 2. After fade, play video
    setTimeout(() => {
        easterEggVideo.style.display = 'block';
        easterEggVideo.play().catch(e => console.error("Easter egg video failed to play:", e));
    }, 1000); // Must match CSS transition duration

    // 3. When video ends, redirect
    easterEggVideo.addEventListener('ended', redirectToCollection);
}

function triggerEasterEggMajin() {
    isEasterEggActive = true;
    const enterSound = new Audio('Enter.wav');
    enterSound.volume = sfxVolumeSlider.value / 100;
    enterSound.play();

    // Hide controls
    soundTestHeader.style.display = 'none';
    soundTestControls.style.display = 'none';

    easterEggOverlay.style.display = 'block';
    setTimeout(() => {
        easterEggOverlay.style.opacity = '1';
    }, 10);

    enterSound.onended = () => {
        soundTestScreen.style.backgroundImage = "url('Majin.png')";
        soundTestScreen.style.backgroundSize = 'contain';
        soundTestScreen.style.backgroundRepeat = 'no-repeat';
        soundTestScreen.style.backgroundColor = 'black';
        
        if (majinMusic) {
            majinMusic.pause();
        }
        majinMusic = new Audio('Majin.mp3');
        majinMusic.volume = musicVolumeSlider.value / 100;
        majinMusic.loop = true;
        majinMusic.play();

        easterEggOverlay.style.opacity = '0';
        setTimeout(() => {
            easterEggOverlay.style.display = 'none';
        }, 1000);
    };
}

function triggerEasterEggCute() {
    isEasterEggActive = true;
    const enterSound = new Audio('Enter.wav');
    enterSound.volume = sfxVolumeSlider.value / 100;
    enterSound.play();

    // Hide controls
    soundTestHeader.style.display = 'none';
    soundTestControls.style.display = 'none';

    easterEggOverlay.style.display = 'block';
    setTimeout(() => {
        easterEggOverlay.style.opacity = '1';
    }, 10);

    enterSound.onended = () => {
        soundTestScreen.style.backgroundImage = "url('CuteS.png')";
        soundTestScreen.style.backgroundSize = 'contain';
        soundTestScreen.style.backgroundRepeat = 'no-repeat';
        soundTestScreen.style.backgroundColor = 'black';
        
        if (cuteMusic) {
            cuteMusic.pause();
        }
        cuteMusic = new Audio('CuteS.mp3');
        cuteMusic.volume = musicVolumeSlider.value / 100;
        cuteMusic.loop = true;
        cuteMusic.play();

        easterEggOverlay.style.opacity = '0';
        setTimeout(() => {
            easterEggOverlay.style.display = 'none';
        }, 1000);
    };
}

function triggerEasterEggKickit() {
    isEasterEggActive = true;
    const enterSound = new Audio('Enter.wav');
    enterSound.volume = sfxVolumeSlider.value / 100;
    enterSound.play();

    // Hide controls
    soundTestHeader.style.display = 'none';
    soundTestControls.style.display = 'none';

    easterEggOverlay.style.display = 'block';
    setTimeout(() => {
        easterEggOverlay.style.opacity = '1';
    }, 10);

    enterSound.onended = () => {
        soundTestScreen.style.backgroundImage = "url('Kickit.png')";
        soundTestScreen.style.backgroundSize = 'contain';
        soundTestScreen.style.backgroundRepeat = 'no-repeat';
        soundTestScreen.style.backgroundColor = 'black';
        
        if (kickitMusic) {
            kickitMusic.pause();
        }
        kickitMusic = new Audio('Kickit.mp3');
        kickitMusic.volume = musicVolumeSlider.value / 100;
        kickitMusic.loop = true;
        kickitMusic.play();

        easterEggOverlay.style.opacity = '0';
        setTimeout(() => {
            easterEggOverlay.style.display = 'none';
        }, 1000);
    };
}

function triggerEasterEggHowdoeson() {
    isEasterEggActive = true;
    const enterSound = new Audio('Enter.wav');
    enterSound.volume = sfxVolumeSlider.value / 100;
    enterSound.play();

    // Hide controls
    soundTestHeader.style.display = 'none';
    soundTestControls.style.display = 'none';

    easterEggOverlay.style.display = 'block';
    setTimeout(() => {
        easterEggOverlay.style.opacity = '1';
    }, 10);

    enterSound.onended = () => {
        soundTestScreen.style.backgroundImage = "url('Howdoeson.png')";
        soundTestScreen.style.backgroundSize = 'contain';
        soundTestScreen.style.backgroundRepeat = 'no-repeat';
        soundTestScreen.style.backgroundColor = 'black';
        
        if (howdoesonMusic) {
            howdoesonMusic.pause();
        }
        howdoesonMusic = new Audio('Howdoeson.mp3');
        howdoesonMusic.volume = musicVolumeSlider.value / 100;
        howdoesonMusic.loop = true;
        howdoesonMusic.play();

        easterEggOverlay.style.opacity = '0';
        setTimeout(() => {
            easterEggOverlay.style.display = 'none';
        }, 1000);
    };
}

function triggerEasterEggBathog() {
    isEasterEggActive = true;
    const enterSound = new Audio('Enter.wav');
    enterSound.volume = sfxVolumeSlider.value / 100;
    enterSound.play();

    // Hide controls
    soundTestHeader.style.display = 'none';
    soundTestControls.style.display = 'none';

    easterEggOverlay.style.display = 'block';
    setTimeout(() => {
        easterEggOverlay.style.opacity = '1';
    }, 10);

    enterSound.onended = () => {
        soundTestScreen.style.backgroundImage = "url('Bathog.png')";
        soundTestScreen.style.backgroundSize = 'contain';
        soundTestScreen.style.backgroundRepeat = 'no-repeat';
        soundTestScreen.style.backgroundColor = 'black';
        
        if (bathogMusic) {
            bathogMusic.pause();
        }
        bathogMusic = new Audio('Bathog.mp3');
        bathogMusic.volume = musicVolumeSlider.value / 100;
        bathogMusic.loop = true;
        bathogMusic.play();

        easterEggOverlay.style.opacity = '0';
        setTimeout(() => {
            easterEggOverlay.style.display = 'none';
        }, 1000);
    };
}

function triggerEasterEggSecret() {
    isEasterEggActive = true;
    const enterSound = new Audio('Enter.wav');
    enterSound.volume = sfxVolumeSlider.value / 100;
    enterSound.play();

    easterEggOverlay.style.display = 'block';
    setTimeout(() => {
        easterEggOverlay.style.opacity = '1';
    }, 10);

    enterSound.onended = () => {
        window.location.href = 'Secret.html';
    };
}

function triggerEasterEggCoco() {
    isEasterEggActive = true;
    const enterSound = new Audio('Enter.wav');
    enterSound.volume = sfxVolumeSlider.value / 100;
    enterSound.play();

    easterEggOverlay.style.display = 'block';
    setTimeout(() => {
        easterEggOverlay.style.opacity = '1';
    }, 10);

    enterSound.onended = () => {
        window.location.href = 'Coco.html';
    };
}

// Secret code listener
let keySequence = '';
document.addEventListener('keydown', (e) => {
    // Ignore input if user is typing in a form
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    keySequence += e.key.toLowerCase();
    if (keySequence.length > 10) {
        keySequence = keySequence.slice(-10);
    }
    if (keySequence.endsWith('test')) {
        keySequence = ''; // Reset sequence
        openSoundTest();
    }
});

document.addEventListener('keydown', (e) => {
    if (isEasterEggActive && e.key === 'Enter') {
        exitEasterEgg();
    }
});

function exitEasterEgg() {
    if (!isEasterEggActive) return;
    isEasterEggActive = false; // Prevent multiple triggers

    const enterSound = new Audio('Enter.wav');
    enterSound.volume = sfxVolumeSlider.value / 100;
    enterSound.play();

    // Fade to white
    easterEggOverlay.style.display = 'block';
    setTimeout(() => {
        easterEggOverlay.style.opacity = '1';
    }, 10);

    // Stop any active easter egg media
    if (majinMusic) {
        majinMusic.pause();
        majinMusic = null;
    }
    if (cuteMusic) {
        cuteMusic.pause();
        cuteMusic = null;
    }
    if (kickitMusic) {
        kickitMusic.pause();
        kickitMusic = null;
    }
    if (howdoesonMusic) {
        howdoesonMusic.pause();
        howdoesonMusic = null;
    }
    if (bathogMusic) {
        bathogMusic.pause();
        bathogMusic = null;
    }
    easterEggVideo.pause();
    easterEggVideo.style.display = 'none';
    easterEggVideo.removeEventListener('ended', redirectToCollection);

    enterSound.onended = () => {
        // This function will handle all cleanup and UI restoration
        closeSoundTest(true); // Pass true to skip back sound on exit

        // Switch to Genesis tab
        navTabs.forEach(t => t.classList.remove('active'));
        const genesisTab = document.querySelector('.nav-tab[data-console="Genesis"]');
        if(genesisTab) genesisTab.classList.add('active');
        
        document.querySelectorAll('.game-grid').forEach(grid => grid.classList.remove('active'));
        const genesisGrid = document.getElementById('grid-Genesis');
        if(genesisGrid) genesisGrid.classList.add('active');

        // Unfade from white
        easterEggOverlay.style.opacity = '0';
        setTimeout(() => {
            easterEggOverlay.style.display = 'none';
        }, 1000); // Corresponds to CSS transition
    };
}

function openSoundTest() {
    musicWasPlayingBeforeSoundTest = !bgMusic.paused && musicToggle.checked;
    if (musicWasPlayingBeforeSoundTest) {
        bgMusic.pause();
    }
    
    // Hide main content
    document.querySelector('header').style.display = 'none';
    document.querySelector('main').style.display = 'none';
    document.querySelector('footer').style.display = 'none';
    
    soundTestScreen.style.display = 'flex';
}

function closeSoundTest(isExitingEasterEgg = false) {
    if (!isExitingEasterEgg) {
        playBackSound();
    }

    isEasterEggActive = false; // Ensure state is reset

    soundTestAudio.pause();
    soundTestAudio.currentTime = 0;
    soundTestAudio.src = '';
    
    if (majinMusic) {
        majinMusic.pause();
        majinMusic = null;
    }
    if (cuteMusic) {
        cuteMusic.pause();
        cuteMusic = null;
    }
    if (kickitMusic) {
        kickitMusic.pause();
        kickitMusic = null;
    }
    if (howdoesonMusic) {
        howdoesonMusic.pause();
        howdoesonMusic = null;
    }
    if (bathogMusic) {
        bathogMusic.pause();
        bathogMusic = null;
    }
    // Restore original BG and controls
    soundTestScreen.style.backgroundImage = "url('SoundTestBG.png')";
    soundTestScreen.style.backgroundSize = 'cover';
    soundTestScreen.style.backgroundRepeat = '';
    soundTestScreen.style.backgroundColor = '';
    soundTestHeader.style.display = '';
    soundTestControls.style.display = '';

    soundTestScreen.style.display = 'none';

    // Show main content
    document.querySelector('header').style.display = '';
    document.querySelector('main').style.display = '';
    document.querySelector('footer').style.display = '';
    
    if (musicWasPlayingBeforeSoundTest) {
        bgMusic.play().catch(e => console.warn("Failed to resume music after sound test.", e));
    }
    musicWasPlayingBeforeSoundTest = false;
}

// --- Initialization ---
window.addEventListener('load', () => {
  bgMusic.volume = 0.3;
  
  // Start music on the first user interaction to comply with browser autoplay policies.
  const startAudio = () => {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (musicToggle.checked && bgMusic.paused) {
        bgMusic.play().catch(e => console.warn("Audio playback failed:", e));
    }
  };
  
  document.body.addEventListener('click', startAudio, { once: true });
  document.body.addEventListener('keydown', startAudio, { once: true });

  initAudio();
  loadSound('smc_hover', 'Hover.wav');
  loadSound('smc_select', 'Select.wav');
  loadSound('smc_back', 'Back.wav');
  loadSound('cd2011_hover', 'HoverCD.wav');
  loadSound('cd2011_select', 'SelectCD.wav');
  loadSound('cd2011_back', 'BackCD.wav');
  loadSound('mania_hover', 'HoverMania.wav');
  loadSound('mania_select', 'SelectMania.wav');
  loadSound('mania_back', 'BackMania.wav');
  loadSound('generations_hover', 'HoverGenerations.wav');
  loadSound('generations_select', 'SelectGeneration.wav');
  loadSound('generations_back', 'BackGeneration.wav');

  loadSettings();
  renderGames();
  setupSoundTest();
  document.getElementById('bug-report-btn').addEventListener('click', handleBugReportClick);
  document.getElementById('faq-btn').addEventListener('click', () => showFaqPopup());

  // FAQ popup close handling
  document.getElementById('faq-popup').querySelector('.close-modal-btn').addEventListener('click', hideFaqPopup);
});