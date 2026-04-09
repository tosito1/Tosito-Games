/**
 * TRES EN RAYA - Logic for Tosito Games
 */

let tttBoard = Array(9).fill(null);
let tttCurrentPlayer = 'X';
let tttGameActive = true;

const tttWinConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

function showTTTScreen() {
    initTicTacToe();
    showScreen('tictactoe');
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.add('hidden');
}

function exitTTT() {
    showScreen('hub');
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.remove('hidden');
}

function initTicTacToe() {
    console.log("[🎮] Iniciando Tres en Raya...");
    resetTicTacToe();
}

function handleTTTClick(index) {
    if (!tttGameActive || tttBoard[index]) return;

    // Player Move
    makeTTTMove(index, 'X');

    if (tttGameActive) {
        // AI Thinking Delay
        document.getElementById('ttt-status').textContent = "IA pensando...";
        setTimeout(() => {
            if (tttGameActive) makeAIMove();
        }, 600);
    }
}

function makeTTTMove(index, player) {
    tttBoard[index] = player;
    const cell = document.querySelector(`.ttt-cell[data-index="${index}"]`);
    
    // Create Symbol
    const symbol = document.createElement('span');
    symbol.className = `ttt-symbol ${player === 'X' ? 'ttt-x' : 'ttt-o'}`;
    symbol.textContent = player;
    cell.appendChild(symbol);
    cell.classList.add('taken');

    // Animate Symbol Appearance
    gsap.to(symbol, {
        opacity: 1,
        scale: 1,
        rotation: player === 'X' ? 0 : 360,
        duration: 0.4,
        ease: "back.out(1.7)"
    });

    checkWinner();

    if (tttGameActive) {
        tttCurrentPlayer = player === 'X' ? 'O' : 'X';
        updateTTTStatus();
    }
}

function makeAIMove() {
    // Basic AI: Pick a random empty spot
    // Priority 1: Check if it can win
    // Priority 2: Check if it must block
    // Priority 3: Random
    
    let move = -1;
    const emptyCells = tttBoard.map((v, i) => v === null ? i : null).filter(v => v !== null);

    if (emptyCells.length === 0) return;

    // 1 & 2: Win or Block
    move = findBestTTTMove('O') || findBestTTTMove('X');

    if (move === -1) {
        // Random
        move = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    makeTTTMove(move, 'O');
}

function findBestTTTMove(player) {
    for (let condition of tttWinConditions) {
        const [a, b, c] = condition;
        const vals = [tttBoard[a], tttBoard[b], tttBoard[c]];
        const playerCount = vals.filter(v => v === player).length;
        const emptyCount = vals.filter(v => v === null).length;

        if (playerCount === 2 && emptyCount === 1) {
            return condition[vals.indexOf(null)];
        }
    }
    return -1;
}

function checkWinner() {
    let roundWon = false;
    let winningCondition = null;

    for (let i = 0; i <= 7; i++) {
        const winCondition = tttWinConditions[i];
        let a = tttBoard[winCondition[0]];
        let b = tttBoard[winCondition[1]];
        let c = tttBoard[winCondition[2]];
        if (a === null || b === null || c === null) continue;
        if (a === b && b === c) {
            roundWon = true;
            winningCondition = winCondition;
            break;
        }
    }

    if (roundWon) {
        tttGameActive = false;
        const winner = tttBoard[winningCondition[0]];
        showTTTResult(winner, winningCondition);
        return;
    }

    let roundDraw = !tttBoard.includes(null);
    if (roundDraw) {
        tttGameActive = false;
        showTTTResult('Empate');
        return;
    }
}

function showTTTResult(winner, condition) {
    const status = document.getElementById('ttt-status');
    const badge = document.getElementById('ttt-winner-badge');
    
    if (winner === 'Empate') {
        status.textContent = "¡Es un empate!";
        badge.textContent = "🤝 EMPATE";
        badge.className = "badge badge-sky";
    } else {
        status.textContent = `¡${winner} ha ganado!`;
        badge.textContent = `🎉 GANADOR: ${winner}`;
        badge.className = winner === 'X' ? "badge badge-sky" : "badge badge-amber";
        
        // Highlight winning cells
        condition.forEach(idx => {
            document.querySelector(`.ttt-cell[data-index="${idx}"]`).classList.add('win');
        });
        
        triggerCelebration(); // Global function from app_v80.js
    }
    
    badge.style.display = 'inline-flex';
    gsap.from(badge, { scale: 0.5, opacity: 0, duration: 0.5, ease: "back.out(2)" });
}

function updateTTTStatus() {
    const status = document.getElementById('ttt-status');
    status.textContent = tttCurrentPlayer === 'X' ? "Tu turno (X)" : "IA pensando (O)...";
}

function resetTicTacToe() {
    tttBoard = Array(9).fill(null);
    tttCurrentPlayer = 'X';
    tttGameActive = true;
    
    const status = document.getElementById('ttt-status');
    status.textContent = "Tu turno (X)";
    
    document.getElementById('ttt-winner-badge').style.display = 'none';
    
    document.querySelectorAll('.ttt-cell').forEach(cell => {
        cell.innerHTML = '';
        cell.classList.remove('taken', 'win');
    });

    // Intro stagger for board cells
    gsap.from(".ttt-cell", {
        scale: 0.8,
        opacity: 0,
        y: 20,
        duration: 0.5,
        stagger: 0.05,
        ease: "back.out(1.7)"
    });
}
