package com.toust.tositochest.ui.social

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
import org.json.JSONArray
import org.json.JSONObject

data class Friend(
    val uid: String = "",
    val displayName: String = "",
    val photoUrl: String? = null
)

data class FriendRequest(
    val id: String = "",
    val fromUid: String = "",
    val fromName: String = "",
    val toUid: String = "",
    val status: String = "pending"
)

data class GameChallenge(
    val id: String = "",
    val fromUid: String = "",
    val fromName: String = "",
    val roomId: String = "",
    val status: String = "pending"
)

data class LichessChallenge(
    val id: String,
    val challengerName: String,
    val challengerRating: Int?,
    val variant: String,
    val rated: Boolean,
    val speed: String,
    val status: String,
    val direction: String, // "in" or "out"
    val url: String
)

data class SocialUiState(
    val friends: List<Friend> = emptyList(),
    val incomingRequests: List<FriendRequest> = emptyList(),
    val challenges: List<GameChallenge> = emptyList(),
    val lichessChallenges: List<LichessChallenge> = emptyList(),
    val lichessToken: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null
)

class SocialViewModel : ViewModel() {
    private val auth = Firebase.auth
    private val db = Firebase.firestore
    
    private val _uiState = MutableStateFlow(SocialUiState())
    val uiState: StateFlow<SocialUiState> = _uiState.asStateFlow()

    init {
        loadSocialData()
        loadLichessToken()
    }

    private fun loadLichessToken() {
        val user = auth.currentUser ?: return
        db.collection("users").document(user.uid).get().addOnSuccessListener { doc ->
            val token = doc.getString("lichessToken")
            _uiState.update { it.copy(lichessToken = token) }
            if (token != null) {
                refreshLichessChallenges(token)
            }
        }
    }

    fun updateLichessToken(token: String) {
        val user = auth.currentUser ?: return
        db.collection("users").document(user.uid).update("lichessToken", token)
        _uiState.update { it.copy(lichessToken = token) }
        refreshLichessChallenges(token)
    }

    fun refreshLichessChallenges(token: String? = _uiState.value.lichessToken) {
        if (token.isNullOrBlank()) return
        
        viewModelScope.launch { 
            val result = com.toust.tositochest.engine.LichessChallengeClient.listChallenges(token)
            if (result != null) {
                val inArray = result.optJSONArray("in") ?: JSONArray()
                val outArray = result.optJSONArray("out") ?: JSONArray()
                
                val challenges = mutableListOf<LichessChallenge>()
                
                fun parseChallenge(obj: JSONObject, dir: String) {
                    challenges.add(LichessChallenge(
                        id = obj.getString("id"),
                        challengerName = obj.getJSONObject("challenger").getString("name"),
                        challengerRating = obj.getJSONObject("challenger").optInt("rating"),
                        variant = obj.getJSONObject("variant").getString("name"),
                        rated = obj.getBoolean("rated"),
                        speed = obj.getString("speed"),
                        status = obj.getString("status"),
                        direction = dir,
                        url = obj.getString("url")
                    ))
                }
                
                for (i in 0 until inArray.length()) parseChallenge(inArray.getJSONObject(i), "in")
                for (i in 0 until outArray.length()) parseChallenge(outArray.getJSONObject(i), "out")
                
                _uiState.update { it.copy(lichessChallenges = challenges) }
            }
        }
    }

    fun createLichessChallenge(username: String) {
        val token = _uiState.value.lichessToken ?: return
        val params = mapOf(
            "clock.limit" to "300",
            "clock.increment" to "5",
            "rated" to "false",
            "color" to "random",
            "variant" to "standard"
        )
        viewModelScope.launch {
            val result = com.toust.tositochest.engine.LichessChallengeClient.createChallenge(token, username, params)
            if (result != null) {
                refreshLichessChallenges(token)
            } else {
                _uiState.update { it.copy(error = "Error al crear reto en Lichess") }
            }
        }
    }

    fun acceptLichessChallenge(challengeId: String) {
        val token = _uiState.value.lichessToken ?: return
        viewModelScope.launch {
            if (com.toust.tositochest.engine.LichessChallengeClient.acceptChallenge(token, challengeId)) {
                refreshLichessChallenges(token)
            } else {
                _uiState.update { it.copy(error = "Error al aceptar reto de Lichess") }
            }
        }
    }

    fun declineLichessChallenge(challengeId: String) {
        val token = _uiState.value.lichessToken ?: return
        viewModelScope.launch {
            if (com.toust.tositochest.engine.LichessChallengeClient.declineChallenge(token, challengeId)) {
                refreshLichessChallenges(token)
            }
        }
    }

    fun cancelLichessChallenge(challengeId: String) {
        val token = _uiState.value.lichessToken ?: return
        viewModelScope.launch {
            if (com.toust.tositochest.engine.LichessChallengeClient.cancelChallenge(token, challengeId)) {
                refreshLichessChallenges(token)
            }
        }
    }

    private fun loadSocialData() {
        val user = auth.currentUser ?: return
        _uiState.update { it.copy(isLoading = true) }
        
        // 1. Fetch Friends from user document
        db.collection("users").document(user.uid).addSnapshotListener { snapshot, _ ->
            val friendUids = snapshot?.get("friends") as? List<String> ?: emptyList()
            if (friendUids.isEmpty()) {
                _uiState.update { it.copy(friends = emptyList()) }
            } else {
                fetchFriendDetails(friendUids)
            }
        }

        // 2. Fetch Incoming Friend Requests
        db.collection("friend_requests")
            .whereEqualTo("toUid", user.uid)
            .whereEqualTo("status", "pending")
            .addSnapshotListener { snapshot, _ ->
                val requests = snapshot?.documents?.mapNotNull { it.toObject(FriendRequest::class.java)?.copy(id = it.id) } ?: emptyList()
                _uiState.update { it.copy(incomingRequests = requests) }
            }

        // 3. Fetch Game Challenges
        db.collection("game_challenges")
            .whereEqualTo("toUid", user.uid)
            .whereEqualTo("status", "pending")
            .addSnapshotListener { snapshot, _ ->
                val challenges = snapshot?.documents?.mapNotNull { it.toObject(GameChallenge::class.java)?.copy(id = it.id) } ?: emptyList()
                _uiState.update { it.copy(challenges = challenges, isLoading = false) }
            }
    }

    private fun fetchFriendDetails(uids: List<String>) {
        db.collection("users").whereIn("uid", uids).get().addOnSuccessListener { snapshot ->
            val friends = snapshot.documents.map { 
                Friend(
                    uid = it.id,
                    displayName = it.getString("displayName") ?: "Usuario",
                    photoUrl = it.getString("photoURL")
                )
            }
            _uiState.update { it.copy(friends = friends) }
        }
    }

    fun sendFriendRequest(username: String) {
        val user = auth.currentUser ?: return
        val cleanUsername = username.trim().lowercase()
        
        db.collection("users").whereEqualTo("username_lowercase", cleanUsername).limit(1).get().addOnSuccessListener { snapshot ->
            if (snapshot.isEmpty) {
                _uiState.update { it.copy(error = "Usuario @$username no encontrado") }
                return@addOnSuccessListener
            }
            
            val targetUser = snapshot.documents[0]
            val targetUid = targetUser.id
            
            if (targetUid == user.uid) {
                _uiState.update { it.copy(error = "No puedes añadirte a ti mismo") }
                return@addOnSuccessListener
            }
            
            db.collection("friend_requests").add(hashMapOf(
                "fromUid" to user.uid,
                "fromName" to (_uiState.value.friends.find { it.uid == user.uid }?.displayName ?: user.displayName ?: "Anon"),
                "toUid" to targetUid,
                "status" to "pending",
                "timestamp" to System.currentTimeMillis().toString()
            ))
        }
    }

    fun acceptFriendRequest(request: FriendRequest) {
        val myUid = auth.currentUser?.uid ?: return
        val theirUid = request.fromUid
        
        // Update My Friends
        db.collection("users").document(myUid).get().addOnSuccessListener { doc ->
            val myFriends = (doc.get("friends") as? List<String>)?.toMutableList() ?: mutableListOf()
            if (!myFriends.contains(theirUid)) {
                myFriends.add(theirUid)
                db.collection("users").document(myUid).update("friends", myFriends)
            }
        }
        
        // Update Their Friends
        db.collection("users").document(theirUid).get().addOnSuccessListener { doc ->
            val theirFriends = (doc.get("friends") as? List<String>)?.toMutableList() ?: mutableListOf()
            if (!theirFriends.contains(myUid)) {
                theirFriends.add(myUid)
                db.collection("users").document(theirUid).update("friends", theirFriends)
            }
        }
        
        // Delete request
        db.collection("friend_requests").document(request.id).delete()
    }

    fun rejectFriendRequest(requestId: String) {
        db.collection("friend_requests").document(requestId).delete()
    }

    fun acceptChallenge(challenge: GameChallenge, onAccepted: (String) -> Unit) {
        db.collection("game_challenges").document(challenge.id).update("status", "accepted")
        db.collection("games").document(challenge.roomId).update(
            mapOf(
                "black" to auth.currentUser?.uid,
                "status" to "playing"
            )
        ).addOnSuccessListener {
            onAccepted(challenge.roomId)
        }
    }

    fun rejectChallenge(challengeId: String) {
        db.collection("game_challenges").document(challengeId).update("status", "rejected")
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
