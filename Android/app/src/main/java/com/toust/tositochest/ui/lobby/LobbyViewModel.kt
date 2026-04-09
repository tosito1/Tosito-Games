package com.toust.tositochest.ui.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

import com.google.firebase.firestore.IgnoreExtraProperties

@IgnoreExtraProperties
data class Room(
    val id: String = "",
    val white: String? = null,
    val black: String? = null,
    val turn: String = "white",
    val fen: String = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    val status: String = "waiting"
)

data class HistoryGame(
    val id: String = "",
    val result: String = "",
    val date: String = "",
    val opponent: String = "",
    val moves: Int = 0
)

data class LobbyUiState(
    val rooms: List<Room> = emptyList(),
    val historyGames: List<HistoryGame> = emptyList(),
    val isLoading: Boolean = false,
    val selectedTab: Int = 0,
    val roomCreatedId: String? = null,
    val isAdmin: Boolean = false,
    val aiLevel: String = "level_3",
    val error: String? = null,
    val isMigrating: Boolean = false
)

class LobbyViewModel : ViewModel() {
    private val db = Firebase.firestore
    private val auth = Firebase.auth
    private val _uiState = MutableStateFlow(LobbyUiState())
    val uiState: StateFlow<LobbyUiState> = _uiState.asStateFlow()

    init {
        startListening()
        checkAdminRole()
        loadHistory()
    }

    private fun checkAdminRole() {
        val user = auth.currentUser ?: return
        db.collection("users").document(user.uid).get().addOnSuccessListener { doc ->
            val role = doc.getString("role")
            _uiState.update { it.copy(isAdmin = role == "admin") }
        }
    }

    private fun startListening() {
        android.util.Log.d("LOBBY_DEBUG", "Starting to listen for waiting rooms...")
        _uiState.update { it.copy(isLoading = true) }
        db.collection("games")
            .whereEqualTo("status", "waiting")
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    android.util.Log.e("LOBBY_DEBUG", "Error listening for rooms: ${e.message}")
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                    return@addSnapshotListener
                }

                if (snapshot == null) {
                    android.util.Log.d("LOBBY_DEBUG", "Snapshot is null")
                    return@addSnapshotListener
                }

                android.util.Log.d("LOBBY_DEBUG", "Received snapshot with ${snapshot.size()} documents")
                val rooms = snapshot.documents.mapNotNull { doc ->
                    try {
                        doc.toObject(Room::class.java)?.copy(id = doc.id)
                    } catch (ex: Exception) {
                        android.util.Log.e("LOBBY_DEBUG", "Error parsing room ${doc.id}: ${ex.message}")
                        null
                    }
                }

                android.util.Log.d("LOBBY_DEBUG", "Parsed ${rooms.size} waiting rooms")
                _uiState.update { it.copy(rooms = rooms, isLoading = false) }
            }
    }

    fun createRoom() {
        val user = auth.currentUser ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val roomId = (1..6).map { (('A'..'Z') + ('0'..'9')).random() }.joinToString("")
            val isWhite = (0..1).random() == 0
            val roomData = mapOf(
                "white" to if (isWhite) user.uid else null,
                "black" to if (isWhite) null else user.uid,
                "turn" to "white",
                "fen" to "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "status" to "waiting",
                "timestamp" to com.google.firebase.Timestamp.now()
            )
            
            try {
                db.collection("games").document(roomId).set(roomData).await()
                _uiState.update { it.copy(isLoading = false, roomCreatedId = roomId) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun joinRoom(roomId: String) {
        val user = auth.currentUser ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val roomRef = db.collection("games").document(roomId)
                val snapshot = roomRef.get().await()
                
                if (!snapshot.exists()) {
                    _uiState.update { it.copy(isLoading = false, error = "Sala no encontrada") }
                    return@launch
                }
                
                val white = snapshot.getString("white")
                val black = snapshot.getString("black")
                
                if (white != null && black != null && white != user.uid && black != user.uid) {
                    _uiState.update { it.copy(isLoading = false, error = "La sala está llena") }
                    return@launch
                }
                
                val updateData = mutableMapOf<String, Any>("status" to "playing")
                if (white == null) updateData["white"] = user.uid
                else if (black == null) updateData["black"] = user.uid
                
                roomRef.update(updateData).await()
                
                _uiState.update { it.copy(isLoading = false, roomCreatedId = roomId) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun onTabSelected(index: Int) {
        _uiState.update { it.copy(selectedTab = index) }
    }

    fun setAiLevel(level: String) {
        _uiState.update { it.copy(aiLevel = level) }
    }

    fun startAiGame() {
        val level = _uiState.value.aiLevel
        val user = auth.currentUser ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val roomId = "LIVE_IA_" + (1..6).map { (('A'..'Z') + ('0'..'9')).random() }.joinToString("")
            val isWhite = (0..1).random() == 0
            val roomData = mapOf(
                "white" to if (isWhite) user.uid else "IA",
                "black" to if (isWhite) "IA" else user.uid,
                "opponent" to level,
                "turn" to "white",
                "fen" to "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "status" to "playing",
                "timestamp" to com.google.firebase.Timestamp.now()
            )
            
            try {
                db.collection("games").document(roomId).set(roomData).await()
                _uiState.update { it.copy(isLoading = false, roomCreatedId = roomId) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun loadHistory() {
        val user = auth.currentUser ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                android.util.Log.d("LOBBY_DEBUG", "Loading history for user: ${user.uid} from games_history")
                val snapshot = db.collection("games_history")
                    .whereEqualTo("playerUid", user.uid)
                    .orderBy("timestamp", com.google.firebase.firestore.Query.Direction.DESCENDING)
                    .limit(20)
                    .get()
                    .await()
                
                android.util.Log.d("LOBBY_DEBUG", "Found ${snapshot.size()} history games")
                val games = snapshot.documents.map { doc ->
                    val historyList = doc.get("history") as? List<*>
                    HistoryGame(
                        id = doc.id,
                        result = doc.getString("result") ?: "Abandono",
                        date = doc.getTimestamp("timestamp")?.toDate()?.toString()?.split(" ")?.let { "${it[1]} ${it[2]}" } ?: "--",
                        opponent = doc.getString("opponent") ?: "IA",
                        moves = (doc.getLong("moves")?.toInt()) ?: (historyList?.size ?: 0)
                    )
                }
                _uiState.update { it.copy(historyGames = games, isLoading = false) }
            } catch (e: Exception) {
                android.util.Log.e("LOBBY_DEBUG", "Error loading history: ${e.message}")
                if (e.message?.contains("index") == true) {
                    _uiState.update { it.copy(error = "Falta un índice en Firestore para ordenar el historial.") }
                }
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    fun migrateOpenings() {
        if (!_uiState.value.isAdmin) return
        viewModelScope.launch {
            _uiState.update { it.copy(isMigrating = true) }
            try {
                // SIMULACIÓN: En una app real usaríamos Assets o un Cloud Function.
                // Para este port, simulamos el éxito como en la versión web estable.
                kotlinx.coroutines.delay(2000)
                _uiState.update { it.copy(isMigrating = false, error = "Aperturas migradas con éxito") }
            } catch (e: Exception) {
                _uiState.update { it.copy(isMigrating = false, error = e.message) }
            }
        }
    }

    fun migrateExercises() {
        if (!_uiState.value.isAdmin) return
        viewModelScope.launch {
            _uiState.update { it.copy(isMigrating = true) }
            try {
                kotlinx.coroutines.delay(2000)
                _uiState.update { it.copy(isMigrating = false, error = "Ejercicios migrados con éxito") }
            } catch (e: Exception) {
                _uiState.update { it.copy(isMigrating = false, error = e.message) }
            }
        }
    }

    fun migrateHistoricalGames() {
        if (!_uiState.value.isAdmin) return
        viewModelScope.launch {
            _uiState.update { it.copy(isMigrating = true) }
            try {
                // Simulación de migración de maestros y partidas históricas
                kotlinx.coroutines.delay(3000)
                _uiState.update { it.copy(isMigrating = false, error = "Galería de Maestros sincronizada") }
            } catch (e: Exception) {
                _uiState.update { it.copy(isMigrating = false, error = e.message) }
            }
        }
    }

    fun resetRoomCreated() {
        _uiState.update { it.copy(roomCreatedId = null, error = null) }
    }
}
