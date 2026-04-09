package com.toust.tositochest.ui.masters

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

import com.google.firebase.firestore.IgnoreExtraProperties

@IgnoreExtraProperties
data class MasterPreview(
    val id: String = "",
    val name: String = "",
    val last_updated: Any? = null
)

@IgnoreExtraProperties
data class GameData(
    val masterId: String = "",
    val white: String = "",
    val black: String = "",
    val date: String = "",
    val event: String = "",
    val site: String = "",
    val result: String = "",
    val eco: String = "",
    val moves: String = "", // Cambiado a String para parity con el JSON/Firestore
    val fens: List<String> = emptyList() // Se usará localmente para la navegación
)

data class MastersUiState(
    val masters: List<MasterPreview> = emptyList(),
    val selectedMaster: MasterPreview? = null,
    val selectedGame: GameData? = null,
    val masterGames: List<Pair<String, GameData>> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val currentFenIndex: Int = 0,
    val calculatedFens: List<String> = emptyList() // FENs calculados localmente
)

class MasterGamesViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(MastersUiState())
    val uiState = _uiState.asStateFlow()
    
    private val db = FirebaseFirestore.getInstance()

    init {
        loadMasters()
    }

    fun loadMasters() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val snapshot = db.collection("historical_masters")
                    .orderBy("name")
                    .get()
                    .await()
                
                val masters = snapshot.toObjects(MasterPreview::class.java)
                _uiState.value = _uiState.value.copy(masters = masters, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false, 
                    error = "Error al conectar con Firebase: ${e.message}"
                )
            }
        }
    }

    fun selectMaster(master: MasterPreview) {
        _uiState.value = _uiState.value.copy(selectedMaster = master, masterGames = emptyList())
        loadGamesForMaster(master.id)
    }

    private fun loadGamesForMaster(masterId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val snapshot = db.collection("historical_games")
                    .whereEqualTo("masterId", masterId)
                    .limit(50)
                    .get()
                    .await()
                
                val games = snapshot.documents.map { doc ->
                    doc.id to doc.toObject(GameData::class.java)!!
                }
                _uiState.value = _uiState.value.copy(masterGames = games, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = "Error al cargar partidas")
            }
        }
    }

    fun deselectMaster() {
        _uiState.value = _uiState.value.copy(selectedMaster = null, selectedGame = null, masterGames = emptyList())
    }

    fun selectGame(game: GameData) {
        // Generar FENs a partir de la cadena de movimientos (UCI)
        // Ejemplo: "e2e4 e7e5 g1f3..."
        val fens = calculateFens(game.moves)
        
        _uiState.value = _uiState.value.copy(
            selectedGame = game,
            calculatedFens = fens,
            currentFenIndex = 0
        )
    }

    private fun calculateFens(movesStr: String): List<String> {
        val fens = mutableListOf<String>()
        if (movesStr.isBlank()) return fens
        
        val engine = com.toust.tositochest.engine.ChessBoard()
        val moveList = movesStr.split(" ").filter { it.isNotBlank() }
        
        for (move in moveList) {
            // Un movimiento UCI suele tener 4 o 5 caracteres (e2e4, e7e8q)
            if (move.length >= 4) {
                val startCol = move[0] - 'a'
                val startRow = 8 - move[1].digitToInt()
                val endCol = move[2] - 'a'
                val endRow = 8 - move[3].digitToInt()
                
                var promo = com.toust.tositochest.engine.PieceType.QUEEN
                if (move.length == 5) {
                    promo = when (move[4].lowercaseChar()) {
                        'r' -> com.toust.tositochest.engine.PieceType.ROOK
                        'n' -> com.toust.tositochest.engine.PieceType.KNIGHT
                        'b' -> com.toust.tositochest.engine.PieceType.BISHOP
                        else -> com.toust.tositochest.engine.PieceType.QUEEN
                    }
                }
                
                engine.movePiece(startRow, startCol, endRow, endCol, promo)
                fens.add(engine.toFen())
            }
        }
        return fens
    }

    fun nextMove() {
        if (_uiState.value.currentFenIndex < _uiState.value.calculatedFens.size) {
            _uiState.value = _uiState.value.copy(currentFenIndex = _uiState.value.currentFenIndex + 1)
        }
    }

    fun prevMove() {
        if (_uiState.value.currentFenIndex > 0) {
            _uiState.value = _uiState.value.copy(currentFenIndex = _uiState.value.currentFenIndex - 1)
        }
    }

    fun resetGame() {
        _uiState.value = _uiState.value.copy(currentFenIndex = 0)
    }
}
