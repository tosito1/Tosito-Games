package com.toust.tositochest.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.roundToInt

data class ApiResponse(
    val eval: Double?,
    val mate: Int?,
    val bestMoveLan: String?,
    val fromCoords: Pair<Int, Int>?,
    val toCoords: Pair<Int, Int>?
)

object ChessApiClient {
    private const val API_URL = "https://chess-api.com/v1"

    suspend fun evaluatePosition(fen: String): ApiResponse? = withContext(Dispatchers.IO) {
        try {
            val url = URL(API_URL)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.doOutput = true

            val jsonInputString = JSONObject().apply {
                put("fen", fen)
                put("depth", 12) // Default depth, fast enough
            }.toString()

            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
                writer.write(jsonInputString)
            }

            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val responseString = connection.inputStream.bufferedReader().use { it.readText() }
                val jsonObj = JSONObject(responseString)
                
                if (jsonObj.has("type") && jsonObj.getString("type") == "error") {
                    val errorMsg = if (jsonObj.has("text")) jsonObj.getString("text") else "Unknown API error"
                    android.util.Log.w("ChessApiClient", "API Limit Reached: $errorMsg")
                    return@withContext null
                }

                val eval = if (jsonObj.has("eval") && !jsonObj.isNull("eval")) jsonObj.getDouble("eval") else null
                val mate = if (jsonObj.has("mate") && !jsonObj.isNull("mate")) jsonObj.getInt("mate") else null
                
                val bestMoveLan = if (jsonObj.has("move")) jsonObj.getString("move") else null
                
                var fromCoords: Pair<Int, Int>? = null
                var toCoords: Pair<Int, Int>? = null
                
                if (jsonObj.has("from") && jsonObj.has("to")) {
                    val fromStr = jsonObj.getString("from")
                    val toStr = jsonObj.getString("to")
                    fromCoords = algebraicToCoords(fromStr)
                    toCoords = algebraicToCoords(toStr)
                }

                return@withContext ApiResponse(eval, mate, bestMoveLan, fromCoords, toCoords)
            }
        } catch (e: Exception) {
            android.util.Log.e("ChessApiClient", "Error fetching from API: ${e.message}")
        }
        return@withContext null
    }

    suspend fun getFenFromPgn(pgn: String): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL(API_URL)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.doOutput = true

            val jsonInputString = JSONObject().apply {
                put("input", pgn)
            }.toString()

            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
                writer.write(jsonInputString)
            }

            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val responseString = connection.inputStream.bufferedReader().use { it.readText() }
                val jsonObj = JSONObject(responseString)
                
                if (jsonObj.has("type") && jsonObj.getString("type") == "error") {
                    return@withContext null
                }

                if (jsonObj.has("fen") && !jsonObj.isNull("fen")) {
                    return@withContext jsonObj.getString("fen")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("ChessApiClient", "Error converting PGN to FEN: ${e.message}")
        }
        return@withContext null
    }
    
    // Convert e2 to Pair(6, 4)
    private fun algebraicToCoords(alg: String): Pair<Int, Int>? {
        if (alg.length < 2) return null
        val file = alg[0]
        val rank = alg[1]
        
        val col = file - 'a'
        val row = 8 - (rank - '0')
        if (col in 0..7 && row in 0..7) return Pair(row, col)
        return null
    }
    
    // Converts the API eval (which is physically pawn units from White's perspective normally, but let's check. 
    // Negative eval means black is winning, positive means white is winning)
    // We use centipawns internally (Int) based on White's perspective (+100 = 1 pawn advantage to white)
    fun apiEvalToCentipawns(apiResp: ApiResponse): Int {
        if (apiResp.mate != null) {
            // Mate in N means absolute victory.
            // Positive mate is for White, negative is for Black (usually)
            // Let's assume positive means White mates, negative means Black mates.
            return if (apiResp.mate > 0) {
                10000 - apiResp.mate // High score
            } else {
                -10000 - apiResp.mate // Low score
            }
        }
        
        if (apiResp.eval != null) {
            // eval is likely in pawns (e.g., +1.5 = +150 centipawns)
            return (apiResp.eval * 100).roundToInt()
        }
        return 0
    }
}
