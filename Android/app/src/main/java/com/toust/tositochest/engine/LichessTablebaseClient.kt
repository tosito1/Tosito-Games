package com.toust.tositochest.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class TablebaseResult(
    val startRow: Int,
    val startCol: Int,
    val endRow: Int,
    val endCol: Int,
    val promotionPiece: PieceType?
)

object LichessTablebaseClient {
    private const val BASE_URL = "https://tablebase.lichess.org/standard"

    suspend fun getBestMove(fen: String): TablebaseResult? = withContext(Dispatchers.IO) {
        try {
            val formattedFen = fen.replace(" ", "_")
            val url = URL("$BASE_URL?fen=$formattedFen")
            
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val responseString = connection.inputStream.bufferedReader().use { it.readText() }
                val jsonObj = JSONObject(responseString)
                
                if (jsonObj.has("moves")) {
                    val movesArray = jsonObj.getJSONArray("moves")
                    if (movesArray.length() > 0) {
                        val bestMoveObj = movesArray.getJSONObject(0)
                        val uci = bestMoveObj.getString("uci")
                        
                        return@withContext parseUciToResult(uci)
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("LichessTablebase", "Error: ${e.message}")
        }
        return@withContext null
    }

    private fun parseUciToResult(uci: String): TablebaseResult? {
        if (uci.length < 4) return null

        val startCol = uci[0] - 'a'
        val startRow = 8 - uci[1].digitToInt()
        val endCol = uci[2] - 'a'
        val endRow = 8 - uci[3].digitToInt()

        var promotionPiece: PieceType? = null
        if (uci.length == 5) {
            promotionPiece = when (uci[4].lowercaseChar()) {
                'q' -> PieceType.QUEEN
                'r' -> PieceType.ROOK
                'n' -> PieceType.KNIGHT
                'b' -> PieceType.BISHOP
                else -> PieceType.QUEEN
            }
        }

        return TablebaseResult(
            startRow = startRow,
            startCol = startCol,
            endRow = endRow,
            endCol = endCol,
            promotionPiece = promotionPiece
        )
    }
}
