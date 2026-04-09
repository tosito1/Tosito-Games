package com.toust.tositochest.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import com.toust.tositochest.engine.LichessApiClient
import com.toust.tositochest.engine.LichessTablebaseClient

class ChessAI(val color: PieceColor = PieceColor.BLACK) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val pieceValues = mapOf(
        PieceType.PAWN to 100,
        PieceType.KNIGHT to 320,
        PieceType.BISHOP to 330,
        PieceType.ROOK to 500,
        PieceType.QUEEN to 900,
        PieceType.KING to 20000
    )

    // Simplified PST (Piece-Square Tables) for Pawns and Knights
    private val pstPawn = intArrayOf(
        0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5,  5, 10, 25, 25, 10,  5,  5,
        0,  0,  0, 20, 20,  0,  0,  0,
        5, -5,-10,  0,  0,-10, -5,  5,
        5, 10, 10,-20,-20, 10, 10,  5,
        0,  0,  0,  0,  0,  0,  0,  0
    )

    suspend fun getBestMove(board: ChessBoard, level: String): Move? = withContext(Dispatchers.Default) {
        // Intercept with 7-piece Tablebase for max-strength AI
        if (level == "level_7" || level == "level_8") {
            val piecesCount = board.grid.sumOf { row -> row.count { it != null } }
            if (piecesCount <= 7) {
                val tablebaseResult = LichessTablebaseClient.getBestMove(board.toFen())
                if (tablebaseResult != null) {
                    val pieceAtStart = board.grid[tablebaseResult.startRow][tablebaseResult.startCol]
                    if (pieceAtStart != null) {
                        return@withContext Move(
                            startRow = tablebaseResult.startRow,
                            startCol = tablebaseResult.startCol,
                            endRow = tablebaseResult.endRow,
                            endCol = tablebaseResult.endCol,
                            piece = pieceAtStart,
                            promotionType = tablebaseResult.promotionPiece ?: PieceType.QUEEN
                        )
                    }
                }
            }
        }

        if (level == "level_7") {
            val cloudMove = getCloudMove(board.toFen())
            if (cloudMove != null) return@withContext cloudMove
            // Fallback to strongest local engine if API limit reached
            val result = minimax(board, 4, Int.MIN_VALUE, Int.MAX_VALUE, true)
            return@withContext result.move
        }
        
        if (level == "level_8") {
            val lichessResp = LichessApiClient.evaluatePosition(board.toFen())
            if (lichessResp?.fromCoords != null && lichessResp.toCoords != null) {
                return@withContext Move(
                    startRow = lichessResp.fromCoords.first,
                    startCol = lichessResp.fromCoords.second,
                    endRow = lichessResp.toCoords.first,
                    endCol = lichessResp.toCoords.second,
                    piece = board.grid[lichessResp.fromCoords.first][lichessResp.fromCoords.second]!!
                )
            }
            // Fallback to Minimax local if position not cached in Lichess
            android.util.Log.w("CHESS_AI", "Lichess position not found, falling back to local Minimax")
            val result = minimax(board, 4, Int.MIN_VALUE, Int.MAX_VALUE, true)
            return@withContext result.move
        }

        val depth = when (level) {
            "level_1" -> 1
            "level_2" -> 2
            "level_3" -> 3
            "level_4" -> 4
            "level_5" -> 5
            "level_6" -> 6
            else -> if (level.startsWith("level_")) 3 else 2
        }

        val result = minimax(board, depth, Int.MIN_VALUE, Int.MAX_VALUE, true)
        result.move
    }

    private fun evaluate(board: ChessBoard): Int {
        var score = 0
        for (r in 0..7) {
            for (c in 0..7) {
                val p = board.grid[r][c]
                if (p != null) {
                    var valPiece = pieceValues[p.type] ?: 0
                    if (p.type == PieceType.PAWN) {
                        val idx = if (p.color == PieceColor.WHITE) (r * 8 + c) else ((7 - r) * 8 + c)
                        valPiece += pstPawn[idx]
                    }
                    score += if (p.color == PieceColor.WHITE) valPiece else -valPiece
                }
            }
        }
        return if (color == PieceColor.WHITE) score else -score
    }

    private fun minimax(board: ChessBoard, depth: Int, alpha: Int, beta: Int, maximizing: Boolean): MinimaxResult {
        if (depth == 0) return MinimaxResult(evaluate(board), null)

        val turn = if (maximizing) color else (if (color == PieceColor.WHITE) PieceColor.BLACK else PieceColor.WHITE)
        val allMoves = mutableListOf<Move>()
        for (r in 0..7) {
            for (c in 0..7) {
                val p = board.grid[r][c]
                if (p != null && p.color == turn) {
                    val valid = board.getValidMoves(r, c)
                    valid.forEach { (er, ec) ->
                        allMoves.add(Move(r, c, er, ec, p))
                    }
                }
            }
        }

        if (allMoves.isEmpty()) {
            return if (board.isCheck(turn)) {
                MinimaxResult(if (maximizing) -100000 else 100000, null)
            } else {
                MinimaxResult(0, null)
            }
        }

        // Sort moves: captures first (basic heuristic)
        allMoves.sortByDescending { board.grid[it.endRow][it.endCol]?.let { pieceValues[it.type] } ?: 0 }

        var bestMove: Move? = null
        var currentAlpha = alpha
        var currentBeta = beta

        if (maximizing) {
            var maxEval = Int.MIN_VALUE
            for (move in allMoves) {
                val simBoard = board.copy()
                simBoard.movePiece(move.startRow, move.startCol, move.endRow, move.endCol)
                val eval = minimax(simBoard, depth - 1, currentAlpha, currentBeta, false).score
                if (eval > maxEval) {
                    maxEval = eval
                    bestMove = move
                }
                currentAlpha = maxOf(currentAlpha, eval)
                if (currentBeta <= currentAlpha) break
            }
            return MinimaxResult(maxEval, bestMove)
        } else {
            var minEval = Int.MAX_VALUE
            for (move in allMoves) {
                val simBoard = board.copy()
                simBoard.movePiece(move.startRow, move.startCol, move.endRow, move.endCol)
                val eval = minimax(simBoard, depth - 1, currentAlpha, currentBeta, true).score
                if (eval < minEval) {
                    minEval = eval
                    bestMove = move
                }
                currentBeta = minOf(currentBeta, eval)
                if (currentBeta <= currentAlpha) break
            }
            return MinimaxResult(minEval, bestMove)
        }
    }

    private suspend fun getCloudMove(fen: String): Move? = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("fen", fen)
                put("depth", 12)
            }
            val body = json.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("https://chess-api.com/v1")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                android.util.Log.d("CHESS_AI_DEBUG", "Sent FEN: $fen, received: $responseStr")
                
                val data = JSONObject(responseStr)
                if (data.has("type") && data.getString("type") == "error") {
                    android.util.Log.w("CHESS_AI", "Cloud AI limit reached: ${data.optString("text")}")
                    return@withContext null
                }
                
                if (!data.has("from")) {
                    android.util.Log.e("CHESS_AI", "Cloud AI error: No value for from in $responseStr")
                    return@withContext null
                }
                
                val from = data.getString("from")
                val to = data.getString("to")

                val files = mapOf('a' to 0, 'b' to 1, 'c' to 2, 'd' to 3, 'e' to 4, 'f' to 5, 'g' to 6, 'h' to 7)
                // In ChessBoard (Android), r=0 is the bottom row (white baseline)
                // but in FEN/Algebraic, '1' is the bottom row.
                // My ChessEngine.kt toFen says: for (r in 0..7) { ... } so r=0 is actually the TOP row (black baseline) in that loop.
                // Wait, let's re-check ChessEngine.kt `toFen`.
                /*
                232:         for (r in 0..7) {
                233:             var empty = 0
                234:             for (c in 0..7) {
                235:                 val p = grid[r][c]
                */
                // Yes, r=0 is the first row in FEN string, which is Rank 8.
                
                val startRow = 8 - from[1].toString().toInt()
                val startCol = files[from[0]] ?: 0
                val endRow = 8 - to[1].toString().toInt()
                val endCol = files[to[0]] ?: 0

                val piece = ChessPiece(
                    charToPieceType(data.optString("piece", "p")[0]),
                    color
                )
                Move(startRow, startCol, endRow, endCol, piece)
            }
        } catch (e: Exception) {
            android.util.Log.e("CHESS_AI", "Cloud AI error: ${e.message}")
            null
        }
    }

    private fun charToPieceType(c: Char): PieceType {
        return when (c.lowercaseChar()) {
            'n' -> PieceType.KNIGHT
            'b' -> PieceType.BISHOP
            'r' -> PieceType.ROOK
            'q' -> PieceType.QUEEN
            'k' -> PieceType.KING
            else -> PieceType.PAWN
        }
    }

    data class MinimaxResult(val score: Int, val move: Move?)
}
