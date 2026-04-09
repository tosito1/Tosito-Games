package com.toust.tositochest.ui.profile

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
import com.google.firebase.firestore.IgnoreExtraProperties

data class UserStats(
    val wins: Int = 0,
    val losses: Int = 0,
    val totalGames: Int = 0,
    val elo: Int = 1200
)

@IgnoreExtraProperties
data class GameHistory(
    val id: String = "",
    val title: String? = null,
    val opponent: String = "",
    val result: String = "",
    val timestamp: com.google.firebase.Timestamp? = null,
    val fen: String = ""
) {
    fun getFormattedDate(): String {
        val date = timestamp?.toDate() ?: return "Desconocida"
        val format = java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale.getDefault())
        return format.format(date)
    }
}

data class ProfileUiState(
    val name: String = "",
    val username: String = "",
    val usernameError: String? = null,
    val email: String = "",
    val photoUrl: String? = null,
    val stats: UserStats = UserStats(),
    val gamesHistory: List<GameHistory> = emptyList(),
    val isAdmin: Boolean = false,
    val isLoading: Boolean = false,
    val isLoggedOut: Boolean = false,
    val isUpdatingUsername: Boolean = false
)

class ProfileViewModel : ViewModel() {
    private val auth = Firebase.auth
    private val db = Firebase.firestore
    
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        loadUserProfile()
    }

    private fun loadUserProfile() {
        val user = auth.currentUser
        if (user != null) {
            _uiState.update { it.copy(
                name = user.displayName ?: "Usuario",
                email = user.email ?: "",
                photoUrl = user.photoUrl?.toString(),
                isLoading = true
            )}
            fetchStats(user.uid)
            fetchHistory(user.uid)
            checkAdminRole(user.uid)
            
            // Initial username fetch
            db.collection("users").document(user.uid).get().addOnSuccessListener { doc ->
                val username = doc.getString("username") ?: ""
                _uiState.update { it.copy(username = username) }
            }
        }
    }

    private fun fetchStats(userId: String) {
        db.collection("users").document(userId)
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null || !snapshot.exists()) {
                    _uiState.update { it.copy(isLoading = false) }
                    return@addSnapshotListener
                }
                
                val wins = snapshot.getLong("wins")?.toInt() ?: 0
                val losses = snapshot.getLong("losses")?.toInt() ?: 0
                val total = snapshot.getLong("totalGames")?.toInt() ?: 0
                val elo = snapshot.getLong("elo")?.toInt() ?: 1200
                
                _uiState.update { it.copy(
                    stats = UserStats(wins, losses, total, elo),
                    isLoading = false
                )}
                
                // Si el perfil muestra 0 pero el servidor acaba de cargar, 
                // hacemos una comprobación única para sincronizar con el historial real.
                if (wins == 0 && losses == 0) {
                    recalculateStatsFromHistory(userId)
                }
            }
    }

    private fun fetchHistory(userId: String) {
        db.collection("games_history")
            .whereEqualTo("playerUid", userId)
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null) return@addSnapshotListener
                
                val history = snapshot.documents.mapNotNull { doc ->
                    try {
                        // Intentar deserialización automática
                        doc.toObject(GameHistory::class.java)?.copy(id = doc.id)
                    } catch (e: Exception) {
                        // Si falla (ej. timestamp es String), mapear manualmente
                        val timestampObj = when (val raw = doc.get("timestamp")) {
                            is com.google.firebase.Timestamp -> raw
                            is String -> {
                                try {
                                    // Intentar parsear ISO string si es necesario, o retornar null
                                    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault())
                                    val date = sdf.parse(raw)
                                    date?.let { com.google.firebase.Timestamp(it) }
                                } catch (pe: Exception) { null }
                            }
                            else -> null
                        }

                        GameHistory(
                            id = doc.id,
                            opponent = doc.getString("opponent") ?: "",
                            result = doc.getString("result") ?: "",
                            timestamp = timestampObj,
                            fen = doc.getString("fen") ?: ""
                        )
                    }
                }.sortedByDescending { it.timestamp }
                
                _uiState.update { it.copy(gamesHistory = history) }
            }
    }
    private fun checkAdminRole(userId: String) {
        db.collection("users").document(userId)
            .get()
            .addOnSuccessListener { doc ->
                val role = doc.getString("role")
                _uiState.update { it.copy(isAdmin = role == "admin") }
            }
    }

    private fun recalculateStatsFromHistory(userId: String) {
        db.collection("games_history")
            .whereEqualTo("playerUid", userId)
            .get()
            .addOnSuccessListener { snapshot ->
                var wins = 0
                var losses = 0
                val total = snapshot.size()
                
                snapshot.documents.forEach { doc ->
                    val result = (doc.getString("result") ?: "").lowercase()
                    var playerColor = doc.getString("playerColor") ?: ""
                    
                    // Fallback: detectar color desde el historial de movimientos si falta el campo
                    if (playerColor.isEmpty()) {
                        val historyList = doc.get("history") as? List<Map<String, Any>>
                        if (historyList != null && historyList.isNotEmpty()) {
                            playerColor = (historyList[0]["color"] as? String)?.uppercase() ?: ""
                        }
                    }
                    
                    // Segundo Fallback: Para partidas muy antiguas, el creador solía ser Blancas
                    if (playerColor.isEmpty()) playerColor = "WHITE"
                    
                    if (result.contains("tablas") || result.contains("ahogado")) {
                        // Empate
                    } else if (result.contains("blancas")) {
                        if (playerColor == "WHITE") wins++ else if (playerColor == "BLACK") losses ++
                    } else if (result.contains("negras")) {
                        if (playerColor == "BLACK") wins++ else if (playerColor == "WHITE") losses ++
                    } else if (result.contains("humano") && result.contains("gana")) {
                        // "Gana el Humano" literal
                        wins++
                    } else if (result.contains("ia") && result.contains("gana")) {
                        // "Gana la IA" literal
                        losses++
                    }
                }
                
                if (total > 0) {
                    db.collection("users").document(userId).update(
                        mapOf(
                            "wins" to wins,
                            "losses" to losses,
                            "totalGames" to total
                        )
                    ).addOnSuccessListener {
                        android.util.Log.d("PROFILE_DEBUG", "Stats recalculated: W:$wins L:$losses T:$total")
                    }
                }
            }
    }

    fun updateUsername(newUsername: String) {
        val user = auth.currentUser ?: return
        val cleanUsername = newUsername.trim()
        
        if (cleanUsername.length < 3) {
            _uiState.update { it.copy(usernameError = "Mínimo 3 caracteres") }
            return
        }
        
        _uiState.update { it.copy(isUpdatingUsername = true, usernameError = null) }
        
        val usernameLower = cleanUsername.lowercase()
        
        // Check uniqueness
        db.collection("users")
            .whereEqualTo("username_lowercase", usernameLower)
            .get()
            .addOnSuccessListener { snapshot ->
                val existingUser = snapshot.documents.firstOrNull { it.id != user.uid }
                if (existingUser != null) {
                    _uiState.update { it.copy(usernameError = "El nombre de usuario ya está en uso", isUpdatingUsername = false) }
                } else {
                    // Update user doc
                    db.collection("users").document(user.uid).update(
                        mapOf(
                            "username" to cleanUsername,
                            "username_lowercase" to usernameLower
                        )
                    ).addOnSuccessListener {
                        _uiState.update { it.copy(username = cleanUsername, isUpdatingUsername = false) }
                    }.addOnFailureListener {
                        _uiState.update { it.copy(usernameError = "Error al actualizar", isUpdatingUsername = false) }
                    }
                }
            }
    }

    fun forceRecalculate() {
        val user = auth.currentUser ?: return
        recalculateStatsFromHistory(user.uid)
    }

    fun signOut() {
        auth.signOut()
        _uiState.update { it.copy(isLoggedOut = true) }
    }
}
