package com.toust.tositochest.ui.admin

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class AdminUser(
    val uid: String = "",
    val displayName: String = "",
    val email: String = "",
    val role: String = "player",
    val photoUrl: String? = null,
    val wins: Int = 0,
    val losses: Int = 0,
    val totalGames: Int = 0
)

data class AdminRoom(
    val id: String = "",
    val white: String? = null,
    val black: String? = null,
    val status: String = "",
    val turn: String = "",
    val opponent: String? = null,
    val fen: String? = null,
    val timestamp: com.google.firebase.Timestamp? = null
)

data class AdminOpening(
    val id: String = "",
    val name: String = "",
    val eco: String = "",
    val description: String = "",
    val moves_lan: List<String> = emptyList(),
    val moves_san: List<String> = emptyList()
)

data class AdminExercise(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val fen: String = "",
    val solution: List<String> = emptyList()
)

data class AdminUiState(
    val users: List<AdminUser> = emptyList(),
    val rooms: List<AdminRoom> = emptyList(),
    val openings: List<AdminOpening> = emptyList(),
    val exercises: List<AdminExercise> = emptyList(),
    val totalUsers: Int = 0,
    val totalActiveRooms: Int = 0,
    val isLoading: Boolean = false
)

class AdminViewModel : ViewModel() {
    private val db = Firebase.firestore
    
    private val _uiState = MutableStateFlow(AdminUiState())
    val uiState: StateFlow<AdminUiState> = _uiState.asStateFlow()

    init {
        fetchData()
    }

    fun fetchData() {
        _uiState.update { it.copy(isLoading = true) }
        fetchUsers()
        fetchRooms()
        fetchOpenings()
        fetchExercises()
    }

    private fun fetchUsers() {
        db.collection("users").addSnapshotListener { snapshot, _ ->
            val users = snapshot?.documents?.mapNotNull { it.toObject(AdminUser::class.java)?.copy(uid = it.id) } ?: emptyList()
            _uiState.update { it.copy(users = users, totalUsers = users.size, isLoading = false) }
        }
    }

    private fun fetchRooms() {
        db.collection("games").addSnapshotListener { snapshot, _ ->
            val rooms = snapshot?.documents?.mapNotNull { it.toObject(AdminRoom::class.java)?.copy(id = it.id) } ?: emptyList()
            _uiState.update { it.copy(rooms = rooms, totalActiveRooms = rooms.size) }
        }
    }

    private fun fetchOpenings() {
        db.collection("openings").addSnapshotListener { snapshot, _ ->
            val ops = snapshot?.documents?.mapNotNull { it.toObject(AdminOpening::class.java)?.copy(id = it.id) } ?: emptyList()
            _uiState.update { it.copy(openings = ops) }
        }
    }

    private fun fetchExercises() {
        db.collection("exercises").addSnapshotListener { snapshot, _ ->
            val exs = snapshot?.documents?.mapNotNull { it.toObject(AdminExercise::class.java)?.copy(id = it.id) } ?: emptyList()
            _uiState.update { it.copy(exercises = exs) }
        }
    }

    fun updateUserRole(uid: String, currentRole: String) {
        val newRole = if (currentRole == "admin") "player" else "admin"
        db.collection("users").document(uid).update("role", newRole)
    }

    fun deleteRoom(roomId: String) {
        db.collection("games").document(roomId).delete()
    }

    fun deleteAllRooms() {
        _uiState.value.rooms.forEach { room ->
            db.collection("games").document(room.id).delete()
        }
    }

    fun addOpening(name: String, eco: String, description: String, moves_lan: List<String>, moves_san: List<String>) {
        val doc = db.collection("openings").document()
        doc.set(AdminOpening(id = doc.id, name = name, eco = eco, description = description, moves_lan = moves_lan, moves_san = moves_san))
    }

    fun deleteOpening(id: String) {
        db.collection("openings").document(id).delete()
    }

    fun addExercise(title: String, description: String, fen: String, solution: List<String>) {
        val doc = db.collection("exercises").document()
        doc.set(AdminExercise(id = doc.id, title = title, description = description, fen = fen, solution = solution))
    }

    fun resetUserStats(uid: String) {
        db.collection("users").document(uid).update(
            mapOf(
                "wins" to 0,
                "losses" to 0,
                "totalGames" to 0
            )
        )
    }

    fun deleteUserHistory(uid: String) {
        db.collection("games_history")
            .whereEqualTo("playerUid", uid)
            .get()
            .addOnSuccessListener { snapshot ->
                snapshot.documents.forEach { doc ->
                    db.collection("games_history").document(doc.id).delete()
                }
            }
    }

    fun deleteExercise(id: String) {
        db.collection("exercises").document(id).delete()
    }
}
