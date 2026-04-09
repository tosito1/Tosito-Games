const rawMoves = [[52, 36, true], [12, 28, false], [62, 45, true], [3, 21, false], [57, 42, true], [6, 12, false], [61, 34, true], [1, 18, false], [51, 43, true], [18, 35, false], [45, 35, true], [28, 35, false], [42, 25, true], [21, 28, false], [53, 37, true], [28, 26, false], [59, 45, true], [8, 16, false], [25, 40, true], [9, 25, false], [34, 41, true], [12, 18, false], [41, 27, true], [0, 1, false], [27, 18, true], [26, 18, false], [45, 53, true], [5, 40, false], [49, 40, true], [18, 26, false], [58, 49, true], [7, 6, false], [56, 58, true], [26, 19, false], [60, 62, true], [10, 26, false], [58, 59, true], [19, 20, false], [59, 56, true], [1, 9, false], [37, 29, true], [20, 12, false], [50, 42, true], [35, 42, false], [49, 42, true], [26, 34, false], [43, 34, true], [12, 40, false], [42, 49, true], [40, 12, false], [34, 25, true], [9, 25, false], [56, 58, true], [2, 9, false], [48, 32, true], [25, 41, false], [58, 10, true], [12, 33, false], [49, 35, true], [33, 32, false], [61, 58, true], [32, 33, false], [10, 2, true], [9, 2, false], [58, 2, true], [4, 12, false], [35, 26, true], [33, 26, false], [53, 26, true], [12, 21, false], [2, 6, true], [41, 57, false], [62, 53, true], [57, 49, false], [53, 45, true], [49, 9, false], [26, 35, true], [21, 12, false], [35, 28, true]];

// Mock ChessBoard class (we need the minimal movePiece and boardToFen)
class Piece {
    constructor(color, type) {
        this.color = color;
        this.type = type;
        this.hasMoved = false;
    }
}

class ChessBoard {
    constructor() {
        this.grid = this.initBoard();
        this.turn = 'white';
        this.history = [];
    }

    initBoard() {
        let grid = Array(8).fill(null).map(() => Array(8).fill(null));
        const layout = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
        for (let i = 0; i < 8; i++) {
            grid[0][i] = new Piece(layout[i], 'black');
            grid[1][i] = new Piece('P', 'black');
            grid[6][i] = new Piece('P', 'white');
            grid[7][i] = new Piece(layout[i], 'white');
        }
        return grid;
    }

    getPiece(r, c) { return this.grid[r][c]; }

    movePiece(r1, c1, r2, c2) {
        const piece = this.grid[r1][c1];
        if (!piece) return false;
        
        // Record history
        this.history.push({
            start: [r1, c1],
            end: [r2, c2],
            piece: { type: piece.type, color: piece.color }
        });

        this.grid[r2][c2] = piece;
        this.grid[r1][c1] = null;
        piece.hasMoved = true;
        this.turn = piece.color === 'white' ? 'black' : 'white';
        return true;
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
                    let char = p.type;
                    if (char === 'N') char = 'n';
                    if (p.color === 'white') fen += char.toUpperCase();
                    else fen += char.toLowerCase();
                    // Fix 'N' conflict: R N B Q K P. Knight is n/N.
                    if (p.type === 'N') {
                        fen = fen.substring(0, fen.length - 1) + (p.color === 'white' ? 'N' : 'n');
                    }
                }
            }
            if (empty > 0) fen += empty;
            if (r < 7) fen += "/";
        }
        return fen;
    }
}

const board = new ChessBoard();
rawMoves.forEach(m => {
    const r1 = Math.floor(m[0] / 8);
    const c1 = m[0] % 8;
    const r2 = Math.floor(m[1] / 8);
    const c2 = m[1] % 8;
    board.movePiece(r1, c1, r2, c2);
});

console.log("FINAL_FEN:", board.boardToFen());
console.log("SERIALIZED_HISTORY:", JSON.stringify(board.history.map(m => ({
    start: m.start,
    end: m.end,
    color: m.piece.color,
    type: m.piece.type
}))));
