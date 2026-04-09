/**
 * Tosito Chess Engine - Browser Edition
 * Independent Chess Logic & AI (Minimax + Cloud API)
 */

class Piece {
    constructor(color, type) {
        this.color = color; // 'white' or 'black'
        this.type = type;   // 'P', 'R', 'N', 'B', 'Q', 'K'
        this.hasMoved = false;
    }

    static isFriendly(p1, p2) {
        return p1 && p2 && p1.color === p2.color;
    }

    static isEnemy(p1, p2) {
        return p1 && p2 && p1.color !== p2.color;
    }
}

class ChessBoard {
    constructor() {
        this.grid = Array(8).fill(null).map(() => Array(8).fill(null));
        this.turn = 'white';
        this.history = [];
        this.setupBoard();
    }

    setupBoard() {
        this.loadFromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1");
    }

    loadFromFen(fen) {
        const parts = fen.split(' ');
        const rows = parts[0].split('/');
        
        this.grid = Array(8).fill(null).map(() => Array(8).fill(null));
        
        for (let r = 0; r < 8; r++) {
            let c = 0;
            for (let char of rows[r]) {
                if (/\d/.test(char)) {
                    c += parseInt(char);
                } else {
                    const color = (char === char.toUpperCase()) ? 'white' : 'black';
                    const type = char.toUpperCase();
                    const p = new Piece(color, type);
                    // Approximation for hasMoved if needed
                    if (type === 'P' && ( (color === 'white' && r !== 6) || (color === 'black' && r !== 1) )) p.hasMoved = true;
                    this.grid[r][c++] = p;
                }
            }
        }
        this.turn = (parts[1] === 'w') ? 'white' : 'black';
        this.history = []; // Reset history for synced state
    }

    getPiece(r, c) {
        if (r < 0 || r > 7 || c < 0 || c > 7) return null;
        return this.grid[r][c];
    }

    getAllValidMoves(color) {
        let moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.grid[r][c];
                if (p && p.color === color) {
                    const valid = this.getLegalMoves(r, c);
                    valid.forEach(m => moves.push({ start: [r, c], end: m }));
                }
            }
        }
        return moves;
    }

    getPseudoLegalMoves(r, c) {
        const p = this.grid[r][c];
        if (!p) return [];
        let moves = [];

        const directions = {
            'R': [[0, 1], [0, -1], [1, 0], [-1, 0]],
            'B': [[1, 1], [1, -1], [-1, 1], [-1, -1]],
            'Q': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
            'N': [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
            'K': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
            'P': [] // Handled separately
        };

        if (p.type === 'P') {
            const dir = p.color === 'white' ? -1 : 1;
            // Forward 1
            if (this.getPiece(r + dir, c) === null) {
                moves.push([r + dir, c]);
                // Forward 2
                if (!p.hasMoved && this.getPiece(r + 2 * dir, c) === null) {
                    moves.push([r + 2 * dir, c]);
                }
            }
            // Captures
            for (let dc of [-1, 1]) {
                const target = this.getPiece(r + dir, c + dc);
                if (target && target.color !== p.color) {
                    moves.push([r + dir, c + dc]);
                }
            }
        } else if (directions[p.type]) {
            const isSingleStep = (p.type === 'N' || p.type === 'K');
            for (let [dr, dc] of directions[p.type]) {
                for (let i = 1; i < 8; i++) {
                    const nr = r + dr * i, nc = c + dc * i;
                    const target = this.getPiece(nr, nc);
                    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
                    
                    if (!target) {
                        moves.push([nr, nc]);
                        if (isSingleStep) break;
                    } else {
                        if (target.color !== p.color) moves.push([nr, nc]);
                        break;
                    }
                }
            }
        }

        // Castling logic (Pseudo-legal)
        if (p.type === 'K' && !p.hasMoved) {
            // Kingside
            if (this.getPiece(r, c + 1) === null && this.getPiece(r, c + 2) === null) {
                const rook = this.getPiece(r, 7);
                if (rook && rook.type === 'R' && !rook.hasMoved) moves.push([r, c + 2]);
            }
            // Queenside
            if (this.getPiece(r, c - 1) === null && this.getPiece(r, c - 2) === null && this.getPiece(r, c - 3) === null) {
                const rook = this.getPiece(r, 0);
                if (rook && rook.type === 'R' && !rook.hasMoved) moves.push([r, c - 2]);
            }
        }

        return moves;
    }

    getLegalMoves(r, c) {
        const p = this.grid[r][c];
        if (!p) return [];
        const pseudo = this.getPseudoLegalMoves(r, c);
        return pseudo.filter(m => this.isMoveSafe(r, c, m[0], m[1]));
    }

    isMoveSafe(sr, sc, er, ec) {
        const p = this.grid[sr][sc];
        const target = this.grid[er][ec];
        
        // Simulation
        this.grid[er][ec] = p;
        this.grid[sr][sc] = null;
        const inCheck = this.isInCheck(p.color);
        
        // Undo
        this.grid[sr][sc] = p;
        this.grid[er][ec] = target;
        
        if (inCheck) return false;

        // Castling constraints
        if (p.type === 'K' && Math.abs(ec - sc) === 2) {
            if (this.isInCheck(p.color)) return false;
            const midC = (sc + ec) / 2;
            this.grid[sr][midC] = p;
            this.grid[sr][sc] = null;
            const midCheck = this.isInCheck(p.color);
            this.grid[sr][sc] = p;
            this.grid[sr][midC] = null;
            if (midCheck) return false;
        }

        return true;
    }

    isInCheck(color) {
        let kingPos = null;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.grid[r][c];
                if (p && p.type === 'K' && p.color === color) {
                    kingPos = [r, c]; break;
                }
            }
            if (kingPos) break;
        }
        if (!kingPos) return false;

        const enemy = color === 'white' ? 'black' : 'white';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.grid[r][c];
                if (p && p.color === enemy) {
                    const moves = this.getPseudoLegalMoves(r, c);
                    if (moves.some(m => m[0] === kingPos[0] && m[1] === kingPos[1])) {
                        console.log(`[BOARD-LOG] isInCheck(${color}) is TRUE! Attacker: ${p.type} at ${r},${c}`);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    movePiece(sr, sc, er, ec, promoType = 'Q') {
        const p = this.grid[sr][sc];
        if (!p) return false;

        const moveData = {
            start: [sr, sc],
            end: [er, ec],
            piece: p,
            captured: this.grid[er][ec],
            hasMovedPrev: p.hasMoved,
            prevTurn: this.turn,
            castling: null
        };

        // Handle Castling
        if (p.type === 'K' && Math.abs(ec - sc) === 2) {
            if (ec > sc) { // Kingside
                const rook = this.grid[sr][7];
                if (rook) {
                    this.grid[sr][5] = rook;
                    this.grid[sr][7] = null;
                    rook.hasMoved = true;
                }
                moveData.castling = 'kingside';
            } else { // Queenside
                const rook = this.grid[sr][0];
                if (rook) {
                    this.grid[sr][3] = rook;
                    this.grid[sr][0] = null;
                    rook.hasMoved = true;
                }
                moveData.castling = 'queenside';
            }
        }

        // Apply Move
        this.grid[er][ec] = p;
        this.grid[sr][sc] = null;
        p.hasMoved = true;

        // Promotion
        if (p.type === 'P' && (er === 0 || er === 7)) {
            this.grid[er][ec] = new Piece(p.color, promoType);
            moveData.promotion = true;
        }

        this.turn = (this.turn === 'white') ? 'black' : 'white';
        this.history.push(moveData);
        return true;
    }

    undoMove() {
        if (this.history.length === 0) return false;
        const m = this.history.pop();
        const [sr, sc] = m.start;
        const [er, ec] = m.end;

        this.grid[sr][sc] = m.piece;
        this.grid[er][ec] = m.captured;
        m.piece.hasMoved = m.hasMovedPrev;
        this.turn = m.prevTurn;

        if (m.castling === 'kingside') {
            const rook = this.grid[sr][5];
            this.grid[sr][7] = rook;
            this.grid[sr][5] = null;
            if (rook) rook.hasMoved = false;
        } else if (m.castling === 'queenside') {
            const rook = this.grid[sr][3];
            this.grid[sr][0] = rook;
            this.grid[sr][3] = null;
            if (rook) rook.hasMoved = false;
        }
        return true;
    }

    isCheckmate(color) {
        console.log(`[BOARD-LOG] isCheckmate called for ${color}`);
        if (!this.isInCheck(color)) {
            console.log(`[BOARD-LOG] Not in check, so not mate.`);
            return false;
        }
        const moves = this.getAllValidMoves(color);
        console.log(`[BOARD-LOG] In check. Valid moves found: ${moves.length}`);
        return moves.length === 0;
    }

    isStalemate(color) {
        if (this.isInCheck(color)) return false;
        return this.getAllValidMoves(color).length === 0;
    }

    boardToFen() {
        let fen = "";
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                const p = this.grid[r][c];
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
        const t = this.turn === 'white' ? 'w' : 'b';
        return `${fen} ${t} - - 0 1`;
    }
}

class ChessAI {
    constructor(color = 'black', level = 'level_3') {
        this.color = color;
        this.level = level;
        this.depths = { 'level_1': 1, 'level_2': 2, 'level_3': 3, 'level_4': 4 };
        
        this.pieceValues = { 'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000 };
        
        // PST Tables (Simplified)
        this.pst = {
            'P': [0,  0,  0,  0,  0,  0,  0,  0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5,  5, 10, 25, 25, 10,  5,  5, 0,  0,  0, 20, 20,  0,  0,  0, 5, -5,-10,  0,  0,-10, -5,  5, 5, 10, 10,-20,-20, 10, 10,  5, 0,  0,  0,  0,  0,  0,  0,  0],
            'N': [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,  0,  0,  0,  0,-20,-40, -30,  0, 10, 15, 15, 10,  0,-30, -30,  5, 15, 20, 20, 15,  5,-30, -30,  0, 15, 20, 20, 15,  0,-30, -30,  5, 10, 15, 15, 10,  5,-30, -40,-20,  0,  5,  5,  0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50]
        };
    }

    async getBestMove(board) {
        if (this.level === 'level_7') return this.getCloudMove(board);
        
        const depth = this.depths[this.level] || 2;
        const res = this.minimax(board, depth, -Infinity, Infinity, true);
        return { ...res.move, eval: res.score };
    }

    evaluate(board) {
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.grid[r][c];
                if (p) {
                    let val = this.pieceValues[p.type];
                    // PST Bonus
                    if (this.pst[p.type]) {
                        const idx = p.color === 'white' ? (r * 8 + c) : ((7 - r) * 8 + c);
                        val += this.pst[p.type][idx];
                    }
                    score += (p.color === 'white' ? val : -val);
                }
            }
        }
        return this.color === 'white' ? score : -score;
    }

    minimax(board, depth, alpha, beta, maximizing) {
        if (depth === 0) return { score: this.evaluate(board) };

        const moves = board.getAllValidMoves(board.turn);
        if (moves.length === 0) {
            if (board.isInCheck(board.turn)) return { score: maximizing ? -100000 : 100000 };
            return { score: 0 };
        }

        // Sort moves: captures first
        moves.sort((a,b) => (board.grid[b.end[0]][b.end[1]] ? 1 : 0) - (board.grid[a.end[0]][a.end[1]] ? 1 : 0));

        let bestMove = null;
        if (maximizing) {
            let maxScore = -Infinity;
            for (let m of moves) {
                board.movePiece(m.start[0], m.start[1], m.end[0], m.end[1]);
                const res = this.minimax(board, depth - 1, alpha, beta, false);
                board.undoMove();
                if (res.score > maxScore) {
                    maxScore = res.score;
                    bestMove = m;
                }
                alpha = Math.max(alpha, res.score);
                if (beta <= alpha) break;
            }
            return { score: maxScore, move: bestMove };
        } else {
            let minScore = Infinity;
            for (let m of moves) {
                board.movePiece(m.start[0], m.start[1], m.end[0], m.end[1]);
                const res = this.minimax(board, depth - 1, alpha, beta, true);
                board.undoMove();
                if (res.score < minScore) {
                    minScore = res.score;
                    bestMove = m;
                }
                beta = Math.min(beta, res.score);
                if (beta <= alpha) break;
            }
            return { score: minScore, move: bestMove };
        }
    }

    async getCloudMove(board) {
        console.log("[JS-AI] Consultando Nivel 7 (Cloud API)...");
        const fen = board.boardToFen();
        try {
            const res = await fetch("https://chess-api.com/v1", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fen, depth: 12 })
            });
            const data = await res.json();
            const files = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5, 'g': 6, 'h': 7 };
            const start = [8 - parseInt(data.from[1]), files[data.from[0]]];
            const end = [8 - parseInt(data.to[1]), files[data.to[0]]];
            
            // Eval: Si es mate, devolver un valor muy alto
            let evalScore = data.eval || 0;
            if (data.mate) evalScore = (data.mate > 0 ? 100000 : -100000);
            
            return { start, end, reasoning: data.text, eval: evalScore };
        } catch (e) {
            console.error("Cloud API error (CORS or Network):", e);
            console.log("Iniciando motor local de emergencia (Profundidad 3)...");
            console.time("Minimax_Fallback");
            const res = this.minimax(board, 3, -Infinity, Infinity, true);
            console.timeEnd("Minimax_Fallback");
            const move = res.move;
            if (!move) return null;
            return { 
                start: move.start, 
                end: move.end, 
                eval: res.score,
                reasoning: "⚠️ Cloud API no disponible. Motor local Nivel 4 (profundidad 3) activado." 
            };
        }
    }
}
