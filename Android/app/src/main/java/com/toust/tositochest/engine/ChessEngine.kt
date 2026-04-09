package com.toust.tositochest.engine

enum class PieceColor { WHITE, BLACK }
enum class PieceType(val char: Char) {
    PAWN('P'), ROOK('R'), KNIGHT('N'), BISHOP('B'), QUEEN('Q'), KING('K')
}

data class ChessPiece(
    val type: PieceType, 
    val color: PieceColor,
    var hasMoved: Boolean = false,
    val id: String = java.util.UUID.randomUUID().toString()
)

class ChessBoard {
    var grid: Array<Array<ChessPiece?>> = Array(8) { arrayOfNulls<ChessPiece>(8) }
    var turn: PieceColor = PieceColor.WHITE
    var history: MutableList<Move> = mutableListOf()
    var lastMove: Move? = null

    var halfMoveClock = 0
    var fullMoveNumber = 1
    var positionHistory: MutableMap<String, Int> = mutableMapOf()

    fun copy(): ChessBoard {
        val newBoard = ChessBoard()
        // Copiamos la grilla manteniendo las referencias de los objetos de las piezas para animaciones
        newBoard.grid = grid.map { row -> 
            row.map { it }.toTypedArray() 
        }.toTypedArray()
        newBoard.turn = turn
        newBoard.history = history.toMutableList()
        newBoard.lastMove = lastMove?.copy()
        newBoard.halfMoveClock = halfMoveClock
        newBoard.fullMoveNumber = fullMoveNumber
        newBoard.positionHistory = positionHistory.toMutableMap()
        return newBoard
    }

    init {
        setupDefaultBoard()
    }

    fun setupDefaultBoard() {
        val layout = arrayOf(
            PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP, PieceType.QUEEN,
            PieceType.KING, PieceType.BISHOP, PieceType.KNIGHT, PieceType.ROOK
        )
        
        // Black pieces
        for (i in 0..7) {
            grid[0][i] = ChessPiece(layout[i], PieceColor.BLACK)
            grid[1][i] = ChessPiece(PieceType.PAWN, PieceColor.BLACK)
        }
        
        // White pieces
        for (i in 0..7) {
            grid[6][i] = ChessPiece(PieceType.PAWN, PieceColor.WHITE)
            grid[7][i] = ChessPiece(layout[i], PieceColor.WHITE)
        }
    }

    fun getPiece(row: Int, col: Int): ChessPiece? {
        if (row !in 0..7 || col !in 0..7) return null
        return grid[row][col]
    }

    fun isValidMove(startRow: Int, startCol: Int, endRow: Int, endCol: Int): Boolean {
        val piece = getPiece(startRow, startCol) ?: return false
        if (piece.color != turn) return false
        
        val targetPiece = getPiece(endRow, endCol)
        if (targetPiece != null && targetPiece.color == piece.color) return false
        
        val rowDiff = Math.abs(endRow - startRow)
        val colDiff = Math.abs(endCol - startCol)
        
        val movePatternValid = when (piece.type) {
            PieceType.PAWN -> {
                val step = if (piece.color == PieceColor.WHITE) -1 else 1
                if (colDiff == 0) {
                    if (endRow - startRow == step) targetPiece == null
                    else if (endRow - startRow == 2 * step) {
                        val isStartRow = (piece.color == PieceColor.WHITE && startRow == 6) || (piece.color == PieceColor.BLACK && startRow == 1)
                        isStartRow && targetPiece == null && getPiece(startRow + step, startCol) == null
                    } else false
                } else if (colDiff == 1 && endRow - startRow == step) {
                    // Normal capture
                    if (targetPiece != null && targetPiece.color != piece.color) true
                    else {
                        // En Passant
                        val last = lastMove
                        if (last != null && last.piece.type == PieceType.PAWN && 
                            last.endCol == endCol && Math.abs(last.endRow - last.startRow) == 2 &&
                            last.endRow == startRow) {
                            true
                        } else false
                    }
                } else false
            }
            PieceType.KNIGHT -> (rowDiff == 2 && colDiff == 1) || (rowDiff == 1 && colDiff == 2)
            PieceType.BISHOP -> rowDiff == colDiff && isPathClear(startRow, startCol, endRow, endCol)
            PieceType.ROOK -> (startRow == endRow || startCol == endCol) && isPathClear(startRow, startCol, endRow, endCol)
            PieceType.QUEEN -> (rowDiff == colDiff || startRow == endRow || startCol == endCol) && isPathClear(startRow, startCol, endRow, endCol)
            PieceType.KING -> {
                if (rowDiff <= 1 && colDiff <= 1) true
                else if (rowDiff == 0 && colDiff == 2 && !piece.hasMoved && !isCheck(piece.color)) {
                    // Castling
                    val isKingside = endCol > startCol
                    val rookCol = if (isKingside) 7 else 0
                    val rook = grid[startRow][rookCol]
                    if (rook != null && !rook.hasMoved && isPathClear(startRow, startCol, startRow, rookCol)) {
                        val passedCol = if (isKingside) 5 else 3
                        !isSquareUnderAttack(startRow, passedCol, piece.color)
                    } else false
                } else false
            }
        }

        if (!movePatternValid) return false

        // Simulate move to check for check
        val originalTarget = grid[endRow][endCol]
        grid[endRow][endCol] = piece
        grid[startRow][startCol] = null
        val causesCheck = isCheck(piece.color)
        grid[startRow][startCol] = piece
        grid[endRow][endCol] = originalTarget
        
        return !causesCheck
    }

    private fun isPathClear(startRow: Int, startCol: Int, endRow: Int, endCol: Int): Boolean {
        val rowStep = if (endRow > startRow) 1 else if (endRow < startRow) -1 else 0
        val colStep = if (endCol > startCol) 1 else if (endCol < startCol) -1 else 0
        
        var r = startRow + rowStep
        var c = startCol + colStep
        
        while (r != endRow || c != endCol) {
            if (getPiece(r, c) != null) return false
            r += rowStep
            c += colStep
        }
        return true
    }

    fun movePiece(startRow: Int, startCol: Int, endRow: Int, endCol: Int, promotionType: PieceType = PieceType.QUEEN): Boolean {
        if (!isValidMove(startRow, startCol, endRow, endCol)) return false
        
        val piece = getPiece(startRow, startCol) ?: return false
        
        val isPawnMove = piece.type == PieceType.PAWN
        val isCapture = grid[endRow][endCol] != null || (isPawnMove && startCol != endCol)
        
        // Handle Castling Rook Movement
        if (piece.type == PieceType.KING && Math.abs(endCol - startCol) == 2) {
            val rookStartCol = if (endCol > startCol) 7 else 0
            val rookEndCol = if (endCol > startCol) 5 else 3
            val rook = grid[startRow][rookStartCol]
            grid[startRow][rookEndCol] = rook
            grid[startRow][rookStartCol] = null
            rook?.hasMoved = true
        }

        // Handle En Passant Capture
        if (piece.type == PieceType.PAWN && startCol != endCol && grid[endRow][endCol] == null) {
            val captureRow = if (piece.color == PieceColor.WHITE) endRow + 1 else endRow - 1
            grid[captureRow][endCol] = null
        }

        grid[endRow][endCol] = piece
        grid[startRow][startCol] = null
        piece.hasMoved = true

        // Handle Promotion
        if (piece.type == PieceType.PAWN && (endRow == 0 || endRow == 7)) {
            grid[endRow][endCol] = ChessPiece(promotionType, piece.color, true)
        }
        
        val move = Move(startRow, startCol, endRow, endCol, piece, promotionType)
        history.add(move)
        lastMove = move
        turn = if (turn == PieceColor.WHITE) PieceColor.BLACK else PieceColor.WHITE

        // Handle HalfMoveClock
        if (isPawnMove || isCapture) halfMoveClock = 0 else halfMoveClock++
        
        // Handle FullMoveNumber
        if (turn == PieceColor.WHITE) fullMoveNumber++ // Note: turn was just toggled! If it is now WHITE, BLACK just moved.

        // Track for threefold repetition
        val fenKey = toFen(false)
        positionHistory[fenKey] = (positionHistory[fenKey] ?: 0) + 1

        return true
    }

    fun undoLastMove() {
        if (history.isEmpty()) return
        
        history.removeAt(history.size - 1)
        
        // Reset and Replay
        grid = Array(8) { arrayOfNulls<ChessPiece>(8) }
        setupDefaultBoard()
        turn = PieceColor.WHITE
        lastMove = null
        halfMoveClock = 0
        fullMoveNumber = 1
        positionHistory = mutableMapOf()
        
        val currentHistory = history.toList()
        history = mutableListOf()
        
        for (move in currentHistory) {
            movePiece(move.startRow, move.startCol, move.endRow, move.endCol, move.promotionType)
        }
    }

    fun loadFen(fen: String) {
        if (fen.isBlank()) return
        val parts = fen.split(" ")
        if (parts.isEmpty()) return
        
        val boardPart = parts[0]
        val rows = boardPart.split("/")
        if (rows.size < 8) return // Robustez ante FENs malformados
        
        for (i in 0..7) {
            val r = i
            var c = 0
            if (i >= rows.size) break
            for (char in rows[i]) {
                if (char.isDigit()) {
                    val emptyCount = char.toString().toInt()
                    for (j in 0 until emptyCount) {
                        grid[r][c + j] = null
                    }
                    c += emptyCount
                } else {
                    grid[r][c] = charToPiece(char)
                    c++
                }
            }
        }
        
        if (parts.size > 1) {
            turn = if (parts[1] == "w") PieceColor.WHITE else PieceColor.BLACK
        }

        if (parts.size > 2) {
            val castling = parts[2]
            if (!castling.contains("K") && !castling.contains("Q")) grid[7][4]?.hasMoved = true
            if (!castling.contains("k") && !castling.contains("q")) grid[0][4]?.hasMoved = true
            if (!castling.contains("K")) grid[7][7]?.hasMoved = true
            if (!castling.contains("Q")) grid[7][0]?.hasMoved = true
            if (!castling.contains("k")) grid[0][7]?.hasMoved = true
            if (!castling.contains("q")) grid[0][0]?.hasMoved = true
        }

        if (parts.size > 3) {
            val ep = parts[3]
            if (ep != "-" && ep.length == 2) {
                val epCol = ep[0] - 'a'
                val epRow = 8 - ep[1].toString().toInt()
                if (epRow == 5) { // rank 3
                    lastMove = Move(6, epCol, 4, epCol, ChessPiece(PieceType.PAWN, PieceColor.WHITE))
                } else if (epRow == 2) { // rank 6
                    lastMove = Move(1, epCol, 3, epCol, ChessPiece(PieceType.PAWN, PieceColor.BLACK))
                }
            } else {
                lastMove = null
            }
        }
        
        if (parts.size >= 6) {
            halfMoveClock = parts[4].toIntOrNull() ?: 0
            fullMoveNumber = parts[5].toIntOrNull() ?: 1
        }
        positionHistory.clear()
        positionHistory[toFen(false)] = 1
    }

    private fun charToPiece(char: Char): ChessPiece? {
        val color = if (char.isUpperCase()) PieceColor.WHITE else PieceColor.BLACK
        val type = when (char.lowercaseChar()) {
            'p' -> PieceType.PAWN
            'r' -> PieceType.ROOK
            'n' -> PieceType.KNIGHT
            'b' -> PieceType.BISHOP
            'q' -> PieceType.QUEEN
            'k' -> PieceType.KING
            else -> return null
        }
        return ChessPiece(type, color)
    }

    fun getValidMoves(row: Int, col: Int): List<Pair<Int, Int>> {
        val moves = mutableListOf<Pair<Int, Int>>()
        for (r in 0..7) {
            for (c in 0..7) {
                if (isValidMove(row, col, r, c)) {
                    moves.add(r to c)
                }
            }
        }
        return moves
    }

    fun isCheck(color: PieceColor): Boolean {
        val kingPos = findKing(color) ?: return false
        return isSquareUnderAttack(kingPos.first, kingPos.second, color)
    }

    private fun isSquareUnderAttack(row: Int, col: Int, color: PieceColor): Boolean {
        val opponentColor = if (color == PieceColor.WHITE) PieceColor.BLACK else PieceColor.WHITE
        for (r in 0..7) {
            for (c in 0..7) {
                val piece = getPiece(r, c)
                if (piece != null && piece.color == opponentColor) {
                    if (canAttack(r, c, row, col)) return true
                }
            }
        }
        return false
    }

    private fun findKing(color: PieceColor): Pair<Int, Int>? {
        for (r in 0..7) {
            for (c in 0..7) {
                val piece = getPiece(r, c)
                if (piece?.type == PieceType.KING && piece.color == color) return r to c
            }
        }
        return null
    }

    private fun canAttack(startRow: Int, startCol: Int, endRow: Int, endCol: Int): Boolean {
        val piece = getPiece(startRow, startCol) ?: return false
        val rowDiff = Math.abs(endRow - startRow)
        val colDiff = Math.abs(endCol - startCol)
        
        return when (piece.type) {
            PieceType.PAWN -> colDiff == 1 && rowDiff == 1 && endRow == startRow + (if (piece.color == PieceColor.WHITE) -1 else 1)
            PieceType.KNIGHT -> (rowDiff == 2 && colDiff == 1) || (rowDiff == 1 && colDiff == 2)
            PieceType.BISHOP -> rowDiff == colDiff && isPathClear(startRow, startCol, endRow, endCol)
            PieceType.ROOK -> (startRow == endRow || startCol == endCol) && isPathClear(startRow, startCol, endRow, endCol)
            PieceType.QUEEN -> (rowDiff == colDiff || startRow == endRow || startCol == endCol) && isPathClear(startRow, startCol, endRow, endCol)
            PieceType.KING -> rowDiff <= 1 && colDiff <= 1
        }
    }

    fun hasLegalMoves(color: PieceColor): Boolean {
        for (r in 0..7) {
            for (c in 0..7) {
                val piece = getPiece(r, c)
                if (piece != null && piece.color == color) {
                    if (getValidMoves(r, c).isNotEmpty()) return true
                }
            }
        }
        return false
    }

    fun isCheckmate(color: PieceColor): Boolean {
        return isCheck(color) && !hasLegalMoves(color)
    }

    fun isStalemate(color: PieceColor): Boolean {
        return !isCheck(color) && !hasLegalMoves(color)
    }

    fun isFiftyMoveRule(): Boolean = halfMoveClock >= 100

    fun isThreefoldRepetition(): Boolean {
        val current = toFen(false)
        return (positionHistory[current] ?: 0) >= 3
    }

    fun isInsufficientMaterial(): Boolean {
        val pieces = mutableListOf<ChessPiece>()
        for (r in 0..7) {
            for (c in 0..7) {
                grid[r][c]?.let { pieces.add(it) }
            }
        }
        if (pieces.size <= 2) return true
        if (pieces.size == 3) {
            val other = pieces.find { it.type != PieceType.KING }
            if (other?.type == PieceType.KNIGHT || other?.type == PieceType.BISHOP) return true
        }
        return false
    }

    fun toFen(includeCounters: Boolean = true): String {
        val sb = StringBuilder()
        for (r in 0..7) {
            var empty = 0
            for (c in 0..7) {
                val p = grid[r][c]
                if (p == null) {
                    empty++
                } else {
                    if (empty > 0) {
                        sb.append(empty)
                        empty = 0
                    }
                    val char = if (p.color == PieceColor.WHITE) p.type.char.uppercaseChar() else p.type.char.lowercaseChar()
                    sb.append(char)
                }
            }
            if (empty > 0) sb.append(empty)
            if (r < 7) sb.append('/')
        }
        sb.append(" ${if (turn == PieceColor.WHITE) 'w' else 'b'}")
        
        var castling = ""
        val wK = getPiece(7, 4)
        if (wK?.type == PieceType.KING && !wK.hasMoved) {
            val wR1 = getPiece(7, 7)
            if (wR1?.type == PieceType.ROOK && !wR1.hasMoved) castling += "K"
            val wR2 = getPiece(7, 0)
            if (wR2?.type == PieceType.ROOK && !wR2.hasMoved) castling += "Q"
        }
        val bK = getPiece(0, 4)
        if (bK?.type == PieceType.KING && !bK.hasMoved) {
            val bR1 = getPiece(0, 7)
            if (bR1?.type == PieceType.ROOK && !bR1.hasMoved) castling += "k"
            val bR2 = getPiece(0, 0)
            if (bR2?.type == PieceType.ROOK && !bR2.hasMoved) castling += "q"
        }
        if (castling.isEmpty()) castling = "-"
        sb.append(" $castling")

        var ep = "-"
        val last = lastMove
        if (last != null && last.piece.type == PieceType.PAWN && Math.abs(last.endRow - last.startRow) == 2) {
            val opponentColor = if (last.piece.color == PieceColor.WHITE) PieceColor.BLACK else PieceColor.WHITE
            var hasAdjacentOpponentPawn = false
            if (last.endCol > 0) {
                val left = getPiece(last.endRow, last.endCol - 1)
                if (left?.type == PieceType.PAWN && left.color == opponentColor) hasAdjacentOpponentPawn = true
            }
            if (last.endCol < 7) {
                val right = getPiece(last.endRow, last.endCol + 1)
                if (right?.type == PieceType.PAWN && right.color == opponentColor) hasAdjacentOpponentPawn = true
            }

            if (hasAdjacentOpponentPawn) {
                val epRow = (last.startRow + last.endRow) / 2
                ep = "${(last.startCol + 'a'.code).toChar()}${8 - epRow}"
            }
        }
        sb.append(" $ep")
        
        if (includeCounters) {
            sb.append(" $halfMoveClock $fullMoveNumber")
        }
        return sb.toString()
    }

    fun fastEval(): Int {
        var score = 0
        val vals = mapOf(
            PieceType.PAWN to 100, PieceType.KNIGHT to 320, PieceType.BISHOP to 330,
            PieceType.ROOK to 500, PieceType.QUEEN to 900
        )
        val pst = mapOf(
            PieceType.PAWN to intArrayOf(
                0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
                0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0
            ),
            PieceType.KNIGHT to intArrayOf(
                -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
                -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50
            ),
            PieceType.BISHOP to intArrayOf(
                -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
                -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20
            ),
            PieceType.ROOK to intArrayOf(
                0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
                -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,5,5,0,0,-5, 0,0,0,5,5,0,0,0
            )
        )
        
        for (r in 0..7) {
            for (c in 0..7) {
                val p = grid[r][c] ?: continue
                val multiplier = if (p.color == PieceColor.WHITE) 1 else -1
                score += (vals[p.type] ?: 0) * multiplier
                
                val table = pst[p.type]
                if (table != null) {
                    val idx = if (p.color == PieceColor.WHITE) r * 8 + c else (7 - r) * 8 + c
                    score += table[idx] * multiplier
                }
            }
        }
        return score
    }

    // Encuentra el mejor movimiento (1-ply) evaluando todas las posibilidades legales
    fun findBestMove(): Pair<Pair<Int, Int>, Pair<Int, Int>>? {
        var bestMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null
        var bestScore = if (turn == PieceColor.WHITE) Int.MIN_VALUE else Int.MAX_VALUE

        for (r in 0..7) {
            for (c in 0..7) {
                val p = grid[r][c]
                if (p != null && p.color == turn) {
                    val moves = getValidMoves(r, c)
                    for (m in moves) {
                        val sim = this.copy()
                        if (sim.movePiece(r, c, m.first, m.second)) {
                            val score = sim.fastEval()
                            if (turn == PieceColor.WHITE) {
                                if (score > bestScore) {
                                    bestScore = score
                                    bestMove = Pair(Pair(r, c), Pair(m.first, m.second))
                                }
                            } else {
                                if (score < bestScore) {
                                    bestScore = score
                                    bestMove = Pair(Pair(r, c), Pair(m.first, m.second))
                                }
                            }
                        }
                    }
                }
            }
        }
        return bestMove
    }

    fun playSan(san: String): Boolean {
        if (san.isBlank()) return false
        val cleanSan = san.replace("+", "").replace("#", "").replace("!", "").replace("?", "").replace("x", "")
        
        // Castling
        if (cleanSan == "O-O" || cleanSan == "0-0") {
            val row = if (turn == PieceColor.WHITE) 7 else 0
            return movePiece(row, 4, row, 6)
        }
        if (cleanSan == "O-O-O" || cleanSan == "0-0-0") {
            val row = if (turn == PieceColor.WHITE) 7 else 0
            return movePiece(row, 4, row, 2)
        }

        // Promotion
        var promoType = PieceType.QUEEN
        var moveStr = cleanSan
        if (cleanSan.contains("=")) {
            val parts = cleanSan.split("=")
            moveStr = parts[0]
            promoType = when (parts[parts.size - 1].uppercase()) {
                "Q" -> PieceType.QUEEN
                "R" -> PieceType.ROOK
                "B" -> PieceType.BISHOP
                "N" -> PieceType.KNIGHT
                else -> PieceType.QUEEN
            }
        } else if (cleanSan.length > 2 && cleanSan.last().isUpperCase() && !moveStr[0].isUpperCase()) {
            // Case like "e7e8Q" or similar suffix promotion
            promoType = when (cleanSan.last().uppercase()) {
                "Q" -> PieceType.QUEEN
                "R" -> PieceType.ROOK
                "B" -> PieceType.BISHOP
                "N" -> PieceType.KNIGHT
                else -> PieceType.QUEEN
            }
            moveStr = cleanSan.substring(0, cleanSan.length - 1)
        }

        val type: PieceType
        val destStr: String
        val hint: String

        if (moveStr[0].isUpperCase()) {
            type = when (moveStr[0]) {
                'N' -> PieceType.KNIGHT
                'B' -> PieceType.BISHOP
                'R' -> PieceType.ROOK
                'Q' -> PieceType.QUEEN
                'K' -> PieceType.KING
                else -> PieceType.PAWN
            }
            destStr = moveStr.substring(moveStr.length - 2)
            hint = moveStr.substring(1, moveStr.length - 2)
        } else {
            type = PieceType.PAWN
            destStr = moveStr.substring(moveStr.length - 2)
            hint = moveStr.substring(0, moveStr.length - 2)
        }

        if (destStr.length < 2 || !destStr[1].isDigit()) return false
        val endCol = destStr[0] - 'a'
        val endRow = 8 - destStr[1].digitToInt()

        // Find candidate pieces
        val candidates = mutableListOf<Pair<Int, Int>>()
        for (r in 0..7) {
            for (c in 0..7) {
                val p = grid[r][c]
                if (p != null && p.color == turn && p.type == type) {
                    if (isValidMove(r, c, endRow, endCol)) {
                        // Disambiguation check
                        var match = true
                        for (h in hint) {
                            if (h.isDigit()) {
                                if (8 - h.digitToInt() != r) match = false
                            } else if (h.isLetter()) {
                                if (h - 'a' != c) match = false
                            }
                        }
                        if (match) candidates.add(r to c)
                    }
                }
            }
        }

        if (candidates.isNotEmpty()) {
            // Usually there's only one, if more, the hint should have disambiguated. 
            // We'll take the first one that works.
            val (sr, sc) = candidates[0]
            return movePiece(sr, sc, endRow, endCol, promoType)
        }

        return false
    }
}

data class Move(
    val startRow: Int, val startCol: Int,
    val endRow: Int, val endCol: Int,
    val piece: ChessPiece,
    val promotionType: PieceType = PieceType.QUEEN
)
