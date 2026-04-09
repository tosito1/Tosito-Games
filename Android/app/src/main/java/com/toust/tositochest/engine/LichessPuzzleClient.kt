package com.toust.tositochest.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class LichessPuzzle(
    val id: String,
    val rating: Int,
    val fenReady: String,
    val lastMoveLan: String?,
    val solutionLAN: List<String>,
    val themes: List<String>
)

object LichessPuzzleClient {
    private const val BASE_URL = "https://lichess.org/api/puzzle"

    suspend fun fetchDailyPuzzle(): LichessPuzzle? = fetchPuzzle("$BASE_URL/daily")
    suspend fun fetchRandomPuzzle(): LichessPuzzle? = fetchPuzzle("$BASE_URL/next")

    private suspend fun fetchPuzzle(urlString: String): LichessPuzzle? = withContext(Dispatchers.IO) {
        try {
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "TositoChess-Android/1.0 (Contact: tosito@example.com)")

            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK) {
                android.util.Log.e("LichessPuzzleClient", "HTTP Error: $responseCode for $urlString")
                return@withContext null
            }

            val responseString = connection.inputStream.bufferedReader().use { it.readText() }
            val jsonObj = JSONObject(responseString)
            
            val gameObj = jsonObj.optJSONObject("game") ?: return@withContext null
            val puzzleObj = jsonObj.optJSONObject("puzzle") ?: return@withContext null
            
            val id = puzzleObj.getString("id")
            val rating = puzzleObj.getInt("rating")
            
            // Try to get FEN directly, otherwise reconstruct from PGN
            var initialFen = puzzleObj.optString("initialFen", puzzleObj.optString("fen", ""))
            val pgn = gameObj.optString("pgn", "")
            val initialPly = puzzleObj.optInt("initialPly", 0)

            val board = ChessBoard()
            if (initialFen.isNotEmpty()) {
                board.loadFen(initialFen)
            } else if (pgn.isNotEmpty()) {
                // Reconstruct from PGN moves up to initialPly
                board.setupDefaultBoard()
                val moves = pgn.split(" ").filter { it.isNotBlank() && !it.contains(".") }
                for (i in 0 until initialPly) {
                    val moveSan = moves.getOrNull(i) ?: break
                    val played = board.playSan(moveSan)
                    if (!played) {
                        android.util.Log.e("LichessPuzzleClient", "Reconstruction failed at move $i ($moveSan) for puzzle $id")
                        break
                    }
                }
                initialFen = board.toFen(true)
            }

            if (initialFen.isEmpty()) {
                android.util.Log.e("LichessPuzzleClient", "No FEN or PGN found in puzzle response for $id")
                return@withContext null
            }
            
            val solutionArray = puzzleObj.getJSONArray("solution")
            val solutionLAN = mutableListOf<String>()
            for (i in 0 until solutionArray.length()) {
                solutionLAN.add(solutionArray.getString(i))
            }
            
            val themesArray = puzzleObj.getJSONArray("themes")
            val themes = mutableListOf<String>()
            for (i in 0 until themesArray.length()) {
                themes.add(themesArray.getString(i))
            }

            // The first move of the solution is the move played by the opponent to reach the puzzle's start
            val firstMoveLan = solutionLAN.getOrNull(0)
            
            if (firstMoveLan != null && firstMoveLan.length >= 4) {
                // Refresh board to the deduced initialFen if we reconstructed it
                board.loadFen(initialFen)
                
                val sc = firstMoveLan[0] - 'a'
                val sr = 8 - firstMoveLan[1].digitToInt()
                val ec = firstMoveLan[2] - 'a'
                val er = 8 - firstMoveLan[3].digitToInt()
                
                val promo = if (firstMoveLan.length >= 5) {
                    when(firstMoveLan[4].lowercaseChar()) {
                        'q' -> PieceType.QUEEN
                        'r' -> PieceType.ROOK
                        'n' -> PieceType.KNIGHT
                        'b' -> PieceType.BISHOP
                        else -> PieceType.QUEEN
                    }
                } else PieceType.QUEEN

                val moved = board.movePiece(sr, sc, er, ec, promo)
                
                if (moved) {
                    return@withContext LichessPuzzle(
                        id = id,
                        rating = rating,
                        fenReady = board.toFen(true),
                        lastMoveLan = firstMoveLan,
                        solutionLAN = solutionLAN,
                        themes = themes
                    )
                } else {
                    android.util.Log.e("LichessPuzzleClient", "Failed to play initial move $firstMoveLan on FEN $initialFen")
                }
            } else {
                android.util.Log.e("LichessPuzzleClient", "Malformed solution or first move missing for puzzle $id")
            }
        } catch (e: Exception) {
            android.util.Log.e("LichessPuzzleClient", "Exception fetching puzzle: ${e.message}", e)
        }
        return@withContext null
    }
}
