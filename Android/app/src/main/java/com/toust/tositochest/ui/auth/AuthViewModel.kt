package com.toust.tositochest.ui.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.GetCredentialException
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

data class AuthUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false
)

class AuthViewModel : ViewModel() {
    private val auth = Firebase.auth
    private val db = Firebase.firestore
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    
    init {
        checkUserSession()
    }

    private fun checkUserSession() {
        val user = auth.currentUser
        if (user != null) {
            android.util.Log.d("AUTH_DEBUG", "Active session for: ${user.email}")
            // Entramos a la app inmediatamente si hay sesión activa
            _uiState.update { it.copy(isSuccess = true) }
            // Sincronizamos el perfil en segundo plano (sin bloquear)
            viewModelScope.launch {
                syncUserToFirestore(user)
            }
        }
    }

    fun onAnonymousSignIn() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                android.util.Log.d("AUTH_DEBUG", "Attempting anonymous sign in...")
                auth.signInAnonymously().await()
                android.util.Log.d("AUTH_DEBUG", "Anonymous sign in successful")
                _uiState.update { it.copy(isLoading = false, isSuccess = true) }
            } catch (e: Exception) {
                android.util.Log.e("AUTH_DEBUG", "Anonymous sign in error: ${e.message}")
                _uiState.update { it.copy(isLoading = false, error = "Error invitado: ${e.message}") }
            }
        }
    }

    fun onGoogleSignIn(context: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            val credentialManager = CredentialManager.create(context)
            
            // Actual Web Client ID from google-services.json
            val webClientId = "645438147659-rnv7bo0bk4gj7tvjgfhjj5ak6f00nksd.apps.googleusercontent.com"
            
            val googleIdOption: GetGoogleIdOption = GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(webClientId)
                .setAutoSelectEnabled(true)
                .build()

            val request = GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build()

            try {
                android.util.Log.d("AUTH_DEBUG", "Starting Google Sign-In with client ID: ${googleIdOption.serverClientId}")
                val result = credentialManager.getCredential(context, request)
                android.util.Log.d("AUTH_DEBUG", "Credential retrieved successfully")
                handleSignInResult(result)
            } catch (e: GetCredentialException) {
                android.util.Log.e("AUTH_DEBUG", "GetCredentialException: ${e.type} - ${e.message}")
                val errorMessage = when (e.type) {
                    "androidx.credentials.TYPE_NO_CREDENTIAL" -> 
                        "No hay cuentas configuradas. IMPORTANTE: Debes configurar tu WEB_CLIENT_ID real en AuthViewModel.kt y tener el SHA-1 correcto en Firebase."
                    else -> e.message ?: "Error de credenciales"
                }
                _uiState.update { it.copy(isLoading = false, error = errorMessage) }
            } catch (e: Exception) {
                android.util.Log.e("AUTH_DEBUG", "General Exception during Google Sign-In: ${e.message}")
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun onEmailSignIn(email: String, pssw: String) {
        if (email.isEmpty() || pssw.isEmpty()) {
            _uiState.update { it.copy(error = "Por favor, rellena todos los campos") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                android.util.Log.d("AUTH_DEBUG", "Attempting email sign in for: $email")
                val result = auth.signInWithEmailAndPassword(email, pssw).await()
                android.util.Log.d("AUTH_DEBUG", "Email sign in successful")
                _uiState.update { it.copy(isLoading = false, isSuccess = true) }
                
                // La sincronización se hace fuera del hilo UI para no bloquear si hay problemas de cuota
                result.user?.let { user ->
                    viewModelScope.launch { syncUserToFirestore(user) }
                }
            } catch (e: Exception) {
                android.util.Log.e("AUTH_DEBUG", "Email sign in error: ${e.message}")
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun onEmailSignUp(email: String, pssw: String) {
        if (email.isEmpty() || pssw.isEmpty()) {
            _uiState.update { it.copy(error = "Por favor, rellena todos los campos") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                android.util.Log.d("AUTH_DEBUG", "Attempting email sign up for: $email")
                val result = auth.createUserWithEmailAndPassword(email, pssw).await()
                android.util.Log.d("AUTH_DEBUG", "Email sign up successful")
                _uiState.update { it.copy(isLoading = false, isSuccess = true) }
                
                result.user?.let { user ->
                    viewModelScope.launch { syncUserToFirestore(user) }
                }
            } catch (e: Exception) {
                android.util.Log.e("AUTH_DEBUG", "Email sign up error: ${e.message}")
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    private suspend fun handleSignInResult(result: GetCredentialResponse) {
        val credential = result.credential
        android.util.Log.d("AUTH_DEBUG", "Handling credential type: ${credential.type}")
        
        try {
            val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
            val googleIdToken = googleIdTokenCredential.idToken
            val firebaseCredential = GoogleAuthProvider.getCredential(googleIdToken, null)
            
            android.util.Log.d("AUTH_DEBUG", "Signing in to Firebase with Google Credential...")
            val result = auth.signInWithCredential(firebaseCredential).await()
            android.util.Log.d("AUTH_DEBUG", "Firebase Sign-In SUCCESSFUL")
            _uiState.update { it.copy(isLoading = false, isSuccess = true) }
            
            result.user?.let { user ->
                viewModelScope.launch { syncUserToFirestore(user) }
            }
        } catch (e: Exception) {
            android.util.Log.e("AUTH_DEBUG", "Error parsing Google Credential: ${e.message}")
            _uiState.update { it.copy(isLoading = false, error = "Error al procesar Google: ${e.message}") }
        }
    }

    private suspend fun syncUserToFirestore(user: FirebaseUser) {
        val userRef = db.collection("users").document(user.uid)
        val userData = mapOf(
            "uid" to user.uid,
            "email" to user.email,
            "displayName" to (user.displayName ?: user.email?.split('@')?.get(0) ?: "Usuario"),
            "photoURL" to (user.photoUrl?.toString() ?: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"),
            "lastLogin" to java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
        )
        
        // No sobreescribimos si ya existen, usando FieldValue.serverTimestamp() no es necesario aquí
        // pero queremos asegurar que los campos numéricos existan para que el primer increment funcione bien.
        // Aunque increment funciona sin ellos, profile fetch los necesita.
        
        val statsDefaults = mapOf(
            "wins" to com.google.firebase.firestore.FieldValue.increment(0),
            "losses" to com.google.firebase.firestore.FieldValue.increment(0),
            "totalGames" to com.google.firebase.firestore.FieldValue.increment(0),
            "elo" to com.google.firebase.firestore.FieldValue.increment(0) // Mantiene el ELO actual si existe
        )
        
        val finalData = userData + statsDefaults
        
        try {
            android.util.Log.d("AUTH_DEBUG", "Syncing profile to Firestore for: ${user.uid}")
            // set with MergeOptions.merge() so we don't overwrite role/elo/wins/losses
            userRef.set(finalData, SetOptions.merge()).await()
            android.util.Log.d("AUTH_DEBUG", "Profile synced successfully")
        } catch (e: Exception) {
            android.util.Log.e("AUTH_DEBUG", "Error syncing profile: ${e.message}")
        }
    }
}
