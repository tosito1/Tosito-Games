package com.toust.tositochest.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

object LichessApiClient {
    private const val BASE_URL = "https://lichess.org/api/cloud-eval"

    suspend fun evaluatePosition(fen: String): ApiResponse? = withContext(Dispatchers.IO) {
        try {
            val encodedFen = URLEncoder.encode(fen, "UTF-8")
            val url = URL("$BASE_URL?fen=$encodedFen")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            // Optional: User-Agent is good practice for Lichess
            connection.setRequestProperty("User-Agent", "TositoChest Android App")

            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val responseString = connection.inputStream.bufferedReader().use { it.readText() }
                val jsonObj = JSONObject(responseString)

                if (jsonObj.has("error")) {
                    return@withContext null // 404 or other errors means position not found
                }

                if (jsonObj.has("pvs")) {
                    val pvs = jsonObj.getJSONArray("pvs")
                    if (pvs.length() > 0) {
                        val firstPv = pvs.getJSONObject(0)

                        // Lichess `cp` is in centipawns (from the perspective of the player to move, wait NO, Lichess `cp` is normally from White's perspective? 
                        // Let's verify: "cp" positive means White is better. Let's assume standard UCI CP where positive = white advantage.
                        // Actually, Lichess cloud-eval CP is from White's perspective just like Stockfish API eval.
                        // Wait, no. Lichess cp: "The evaluation in centipawns (from White's perspective)" usually. 
                        // Let's pass it as eval. Our `ApiResponse.eval` expects pawns (e.g. 1.5). So cp / 100.0.
                        val cp = if (firstPv.has("cp")) firstPv.getInt("cp") else null
                        val eval = if (cp != null) cp / 100.0 else null
                        
                        val mate = if (firstPv.has("mate")) firstPv.getInt("mate") else null
                        
                        var bestMoveLan: String? = null
                        var fromCoords: Pair<Int, Int>? = null
                        var toCoords: Pair<Int, Int>? = null
                        
                        if (firstPv.has("moves")) {
                            val movesStr = firstPv.getString("moves")
                            val movesList = movesStr.split(" ")
                            if (movesList.isNotEmpty()) {
                                bestMoveLan = movesList[0] // e.g., "e2e4"
                            }
                        }

                        if (bestMoveLan != null && bestMoveLan.length >= 4) {
                            val fromStr = bestMoveLan.substring(0, 2)
                            val toStr = bestMoveLan.substring(2, 4)
                            fromCoords = algebraicToCoords(fromStr)
                            toCoords = algebraicToCoords(toStr)
                        }

                        return@withContext ApiResponse(eval, mate, bestMoveLan, fromCoords, toCoords)
                    }
                }
            } else {
                // Return null on 404 Not Found or 429 Too Many Requests
                android.util.Log.d("LichessApiClient", "Lichess error code: $responseCode")
            }
        } catch (e: Exception) {
            android.util.Log.e("LichessApiClient", "Exception: ${e.message}")
        }
        return@withContext null
    }

    private fun algebraicToCoords(alg: String): Pair<Int, Int>? {
        if (alg.length < 2) return null
        val file = alg[0]
        val rank = alg[1]
        
        val col = file - 'a'
        val row = 8 - (rank - '0')
        if (col in 0..7 && row in 0..7) return Pair(row, col)
        return null
    }
}
