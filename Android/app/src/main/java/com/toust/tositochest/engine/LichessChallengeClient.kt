package com.toust.tositochest.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

object LichessChallengeClient {
    private const val BASE_URL = "https://lichess.org/api/challenge"

    suspend fun listChallenges(token: String): JSONObject? = withContext(Dispatchers.IO) {
        try {
            val connection = URL(BASE_URL).openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "TositoChest Android App")

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                return@withContext JSONObject(response)
            }
        } catch (e: Exception) {
            android.util.Log.e("LichessChallenge", "Error listing challenges: ${e.message}")
        }
        return@withContext null
    }

    suspend fun createChallenge(
        token: String,
        username: String,
        params: Map<String, String>
    ): JSONObject? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/$username")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            connection.setRequestProperty("User-Agent", "TositoChest Android App")
            connection.doOutput = true

            val postData = params.entries.joinToString("&") {
                "${URLEncoder.encode(it.key, "UTF-8")}=${URLEncoder.encode(it.value, "UTF-8")}"
            }

            connection.outputStream.use { it.write(postData.toByteArray()) }

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                return@withContext JSONObject(response)
            }
        } catch (e: Exception) {
            android.util.Log.e("LichessChallenge", "Error creating challenge: ${e.message}")
        }
        return@withContext null
    }

    suspend fun acceptChallenge(token: String, challengeId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/$challengeId/accept")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("User-Agent", "TositoChest Android App")

            return@withContext connection.responseCode == HttpURLConnection.HTTP_OK
        } catch (e: Exception) {
            android.util.Log.e("LichessChallenge", "Error accepting challenge: ${e.message}")
        }
        return@withContext false
    }

    suspend fun declineChallenge(token: String, challengeId: String, reason: String = "generic"): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/$challengeId/decline")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            connection.setRequestProperty("User-Agent", "TositoChest Android App")
            connection.doOutput = true

            val postData = "reason=${URLEncoder.encode(reason, "UTF-8")}"
            connection.outputStream.use { it.write(postData.toByteArray()) }

            return@withContext connection.responseCode == HttpURLConnection.HTTP_OK
        } catch (e: Exception) {
            android.util.Log.e("LichessChallenge", "Error declining challenge: ${e.message}")
        }
        return@withContext false
    }

    suspend fun cancelChallenge(token: String, challengeId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/$challengeId/cancel")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("User-Agent", "TositoChest Android App")

            return@withContext connection.responseCode == HttpURLConnection.HTTP_OK
        } catch (e: Exception) {
            android.util.Log.e("LichessChallenge", "Error cancelling challenge: ${e.message}")
        }
        return@withContext false
    }
}
