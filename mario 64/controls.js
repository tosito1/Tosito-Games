const room = new WebsimSocket();
let isGamePaused = false;
let originalWidth = window.innerWidth;
let originalHeight = window.innerHeight;

// Audio setup
let audioContext;
let menuSoundBuffer;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        loadMenuSound();
    }
}

async function loadMenuSound() {
    if (!audioContext) return;
    try {
        const response = await fetch('/sm64_enter_course.wav');
        const arrayBuffer = await response.arrayBuffer();
        menuSoundBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error('Error loading menu sound:', error);
    }
}

function playMenuSound() {
    if (audioContext && menuSoundBuffer) {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        const source = audioContext.createBufferSource();
        source.buffer = menuSoundBuffer;
        source.connect(audioContext.destination);
        source.start(0);
    }
}

// Add after initial variable declarations:
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const fullscreenPrompt = document.getElementById('fullscreenPrompt');
const fullscreenButton = document.getElementById('fullscreenButton');
const controlsPanel = document.getElementById('controlsPanel');
const controlsHeader = document.getElementById('controlsHeader');

// Custom mobile cursor for title screen
const customCursor = document.getElementById('customCursor');
const titleScreen = document.getElementById('titleScreen');

// Unified cursor logic for both mobile and desktop on the title screen
function updateCursor(x, y) {
    customCursor.style.left = `${x}px`;
    customCursor.style.top = `${y}px`;
    customCursor.style.display = 'block';
}

// Mouse events for desktop
titleScreen.addEventListener('mousemove', (e) => {
    updateCursor(e.clientX, e.clientY);
});

titleScreen.addEventListener('mousedown', () => {
    initAudio();
    customCursor.style.backgroundImage = "url('/clickhand.png')";
});

titleScreen.addEventListener('mouseup', () => {
    customCursor.style.backgroundImage = "url('/hamnd.png')";
});

titleScreen.addEventListener('mouseenter', () => {
    customCursor.style.backgroundImage = "url('/hamnd.png')";
    customCursor.style.display = 'block';
});

titleScreen.addEventListener('mouseleave', () => {
    customCursor.style.display = 'none';
});


// Touch events for mobile
titleScreen.addEventListener('touchstart', (e) => {
    initAudio();
    const touch = e.touches[0];
    customCursor.style.backgroundImage = "url('/clickhand.png')";
    updateCursor(touch.clientX, touch.clientY);
}, { passive: true });

titleScreen.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    updateCursor(touch.clientX, touch.clientY);
}, { passive: false });

titleScreen.addEventListener('touchend', (e) => {
    const touch = e.changedTouches[0];
    customCursor.style.backgroundImage = "url('/hamnd.png')";
    updateCursor(touch.clientX, touch.clientY);
});

// Set up Module configuration first, before any script loading
window.Module = {
    canvas: document.getElementById('canvas'),
    onRuntimeInitialized: function() {
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
        }, 3000);
    },
    locateFile: function(path) {
        if(path.endsWith('.wasm')) {
            return '/sm64.wasm';
        }
        return path;
    }
};

// Move all control setup outside of the start button click handler
const mobileControls = document.getElementById('mobileControls');
const actionButtons = document.getElementById('actionButtons');
const controlsCheckbox = document.getElementById('controlsCheckbox');
const backgroundToggle = document.getElementById('backgroundToggle');
const dpadSizeSlider = document.getElementById('dpadSize');
const buttonSizeSlider = document.getElementById('buttonSize');
const dpadValue = document.getElementById('dpadValue');
const buttonValue = document.getElementById('buttonValue');
const focusPrompt = document.getElementById('focusPrompt');
const toggleChat = document.getElementById('toggleChat');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessage = document.getElementById('sendMessage');

// Initialize controls visibility
function updateControlsVisibility() {
    if (controlsCheckbox.checked) {
        mobileControls.classList.remove('hidden');
        actionButtons.classList.remove('hidden');
        document.querySelector('.size-control').classList.remove('hidden');
    } else {
        mobileControls.classList.add('hidden');
        actionButtons.classList.add('hidden');
        document.querySelector('.size-control').classList.add('hidden');
    }
}

// Set up control event listeners
controlsCheckbox.addEventListener('change', updateControlsVisibility);
updateControlsVisibility();

backgroundToggle.addEventListener('change', () => {
    const gameBackground = document.getElementById('game-background');
    const isGameRunning = document.getElementById('titleScreen').style.display === 'none';

    if (backgroundToggle.checked) {
        gameBackground.style.display = 'none';
    } else {
        if (isGameRunning) {
            gameBackground.style.display = 'block';
        }
    }
});

// Set up size sliders
document.documentElement.style.setProperty('--dpad-size', dpadSizeSlider.value + 'px');
document.documentElement.style.setProperty('--button-size', buttonSizeSlider.value + 'px');

dpadSizeSlider.addEventListener('input', function() {
    document.documentElement.style.setProperty('--dpad-size', this.value + 'px');
    dpadValue.textContent = this.value;
});

buttonSizeSlider.addEventListener('input', function() {
    document.documentElement.style.setProperty('--button-size', this.value + 'px');
    buttonValue.textContent = this.value;
});

// Set up chat functionality
toggleChat.addEventListener('click', () => {
    chatContainer.classList.toggle('visible');
    document.body.classList.toggle('chat-open');
    isGamePaused = chatContainer.classList.contains('visible');
});

messageInput.addEventListener('focus', () => {
    isGamePaused = true;
});

messageInput.addEventListener('blur', () => {
    if (!chatContainer.classList.contains('visible')) {
        isGamePaused = false;
    }
});

messageInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
});

messageInput.addEventListener('keyup', (e) => {
    e.stopPropagation();
});

function sendChatMessage() {
    const message = messageInput.value.trim();
    if (message) {
        room.send({
            type: 'chat',
            message: message
        });
        messageInput.value = '';
    }
}

sendMessage.addEventListener('click', sendChatMessage);
messageInput.addEventListener('keypress', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

room.onmessage = (event) => {
    const data = event.data;
    if (data.type === 'chat') {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.innerHTML = `<span class="chat-username">${data.username}:</span> ${data.message}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
};

// Add collapsible controls functionality
controlsHeader.addEventListener('click', () => {
    controlsPanel.classList.toggle('collapsed');
});

// Add fullscreen handling for mobile
if (isMobile) {
    document.getElementById('fullscreenStartBtn').style.display = 'block';
    
    document.getElementById('fullscreenStartBtn').addEventListener('click', async () => {
        playMenuSound();
        try {
            await document.documentElement.requestFullscreen();
            screen.orientation.lock('landscape');
            document.body.classList.add('fullscreen-mode');
            startGame();
        } catch (err) {
            console.error('Fullscreen or orientation lock failed:', err);
            // Fall back to regular start if fullscreen fails
            startGame();
        }
    });
}

// Modify the start button click handler
document.getElementById('startGameBtn').addEventListener('click', function() {
    playMenuSound();
    startGame();
});

// Extract the game start logic into a separate function
async function startGame() {
    document.getElementById('titleScreen').style.display = 'none';
    
    if (!backgroundToggle.checked) {
        document.getElementById('game-background').style.display = 'block';
    }
    
    // Hide custom cursor when game starts
    customCursor.style.display = 'none';

    // Store initial dimensions BEFORE loading script
    originalWidth = window.innerWidth;
    originalHeight = window.innerHeight;
    
    const mainScript = document.createElement('script');
    mainScript.src = '/sm64.js';
    document.body.appendChild(mainScript);

    await new Promise(resolve => mainScript.onload = resolve);

    // Game-specific setup
    function simulateKeyEvent(keyCode, type) {
        const event = new KeyboardEvent(type, {
            code: keyCode,
            key: keyCode.replace('Key', '').toLowerCase(),
            bubbles: true
        });
        Module.canvas.dispatchEvent(event);
    }

    // Don't check focus on touchstart/touchend for mobile controls
    function setupMobileControl(element, keyCode) {
        if (!element) return;
        
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            simulateKeyEvent(keyCode, 'keydown');
            focusPrompt.style.display = 'none'; // Ensure prompt is hidden during touch
        });

        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            simulateKeyEvent(keyCode, 'keyup');
        });
    }

    // Set up mobile controls
    const dpad = document.getElementById('dpad');
    const toggleC = document.getElementById('toggleC');
    let isCStick = false;

    toggleC.addEventListener('click', (e) => {
        e.preventDefault();
        isCStick = !isCStick;
        dpad.classList.toggle('c-stick');
        updateDpadControls();
    });

    function updateDpadControls() {
        const up = document.getElementById('dpad-up');
        const down = document.getElementById('dpad-down');
        const left = document.getElementById('dpad-left');
        const right = document.getElementById('dpad-right');

        const clone = (element) => {
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
            return newElement;
        };

        if (isCStick) {
            setupMobileControl(clone(up), 'KeyW');    
            setupMobileControl(clone(down), 'KeyS');  
            setupMobileControl(clone(left), 'KeyA');  
            setupMobileControl(clone(right), 'KeyD'); 
        } else {
            setupMobileControl(clone(up), 'ArrowUp');
            setupMobileControl(clone(down), 'ArrowDown');
            setupMobileControl(clone(left), 'ArrowLeft');
            setupMobileControl(clone(right), 'ArrowRight');
        }
    }

    updateDpadControls();

    setupMobileControl(document.getElementById('buttonA'), 'KeyX');
    setupMobileControl(document.getElementById('buttonB'), 'KeyC');
    setupMobileControl(document.getElementById('buttonCrouch'), 'Space');
    setupMobileControl(document.getElementById('buttonStart'), 'Enter');
    setupMobileControl(document.getElementById('buttonSelect'), 'ShiftRight');

    function checkResize() {
        // Don't check resize during fullscreen changes
        if (document.fullscreenElement) return;
        
        const resizeWarning = document.getElementById('resizeWarning');
        const widthDiff = Math.abs(window.innerWidth - originalWidth);
        const heightDiff = Math.abs(window.innerHeight - originalHeight);
        
        if (widthDiff > 100 || heightDiff > 100) {
            resizeWarning.style.display = 'block';
            resizeWarning.onclick = null;
        }
    }

    function resizeCanvas() {
        const canvas = document.getElementById('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Only check resize if not in fullscreen
        if (!document.fullscreenElement) {
            checkResize();
        }
    }

    resizeCanvas();
    
    // Add delay before starting resize detection
    setTimeout(() => {
        window.addEventListener('resize', resizeCanvas);
        originalWidth = window.innerWidth;
        originalHeight = window.innerHeight;
    }, 100);

    document.addEventListener('keydown', (e) => {
        if (isGamePaused) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (isGamePaused) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }
    });

    Module.canvas.addEventListener('click', function() {
        Module.canvas.focus();
    });

    // Modify focus handling to only run after game is initialized
    function checkFocus() {
        // Only check focus if game has started and canvas exists
        if (!Module || !Module.canvas) return;
        
        // Check if the window itself has focus
        if (!document.hasFocus() || (document.activeElement === document.body && !document.querySelector('.dpad-button:active') && !document.querySelector('.action-button:active'))) {
            focusPrompt.style.display = 'flex';
        } else {
            focusPrompt.style.display = 'none';
        }
    }

    // Initially hide the focus prompt since we just started
    focusPrompt.style.display = 'none';

    // Wait a short moment before adding focus handlers to ensure everything is initialized
    setTimeout(() => {
        window.addEventListener('blur', checkFocus);
        document.addEventListener('focus', checkFocus);
        document.addEventListener('blur', (e) => {
            // Only check focus if we're not interacting with mobile controls
            if (!e.target.closest('#mobileControls') && !e.target.closest('#actionButtons')) {
                checkFocus();
            }
        });
    }, 1000);

    focusPrompt.addEventListener('click', function() {
        Module.canvas.focus();
        focusPrompt.style.display = 'none';
    });
}

// Modify fullscreen handling to update originalWidth/Height after entering fullscreen
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('fullscreen-mode')) {
        document.body.classList.remove('fullscreen-mode');
    } else if (document.fullscreenElement) {
        // Update original dimensions after entering fullscreen
        originalWidth = window.innerWidth;
        originalHeight = window.innerHeight;
    }
});