package com.toust.tositochest.ui.openings

import androidx.lifecycle.ViewModel
import com.toust.tositochest.engine.ChessBoard
import com.toust.tositochest.engine.ChessPiece
import com.toust.tositochest.engine.PieceColor
import com.toust.tositochest.engine.PieceType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

/**
 * Representa una apertura de ajedrez con sus jugadas iniciales.
 */
data class ChessOpening(
    val id: String = "",
    val name: String = "",
    val eco: String = "",
    val description: String = "",
    val moves_lan: List<String> = emptyList(), 
    val moves_san: List<String> = emptyList() 
)

data class OpeningsUiState(
    val openings: List<ChessOpening> = emptyList(),
    val selectedOpening: ChessOpening? = null,
    val currentMoveIndex: Int = 0,
    val board: Array<Array<ChessPiece?>> = Array(8) { arrayOfNulls(8) },
    val lastMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null
)

class OpeningsViewModel : ViewModel() {
    private val db = Firebase.firestore
    private val engine = ChessBoard()
    
    private val _uiState = MutableStateFlow(OpeningsUiState())
    val uiState: StateFlow<OpeningsUiState> = _uiState.asStateFlow()

    init {
        loadOpenings()
        _uiState.update { it.copy(board = engine.grid) }
    }

    private fun loadOpenings() {
        db.collection("openings").addSnapshotListener { snapshot, e ->
            if (e != null || snapshot == null) return@addSnapshotListener
            val list = snapshot.documents.mapNotNull { 
                it.toObject(ChessOpening::class.java)?.copy(id = it.id) 
            }
            _uiState.update { it.copy(openings = list) }
        }
    }

    fun selectOpening(opening: ChessOpening) {
        engine.setupDefaultBoard()
        _uiState.update { 
            it.copy(
                selectedOpening = opening,
                currentMoveIndex = 0,
                board = engine.grid,
                lastMove = null
            )
        }
    }

    fun nextMove() {
        val opening = _uiState.value.selectedOpening ?: return
        val idx = _uiState.value.currentMoveIndex
        
        if (idx < opening.moves_lan.size) {
            val moveLAN = opening.moves_lan[idx]
            playLanMove(moveLAN)
            
            _uiState.update { 
                it.copy(
                    currentMoveIndex = idx + 1,
                    board = engine.grid,
                    lastMove = engine.lastMove?.let { lm -> Pair(Pair(lm.startRow, lm.startCol), Pair(lm.endRow, lm.endCol)) }
                )
            }
        }
    }

    fun previousMove() {
        val opening = _uiState.value.selectedOpening ?: return
        val idx = _uiState.value.currentMoveIndex
        
        if (idx > 0) {
            engine.setupDefaultBoard()
            var newLastMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null
            for (i in 0 until (idx - 1)) {
                playLanMove(opening.moves_lan[i])
            }
            if (idx - 1 > 0) {
                newLastMove = engine.lastMove?.let { lm -> Pair(Pair(lm.startRow, lm.startCol), Pair(lm.endRow, lm.endCol)) }
            }
            
            _uiState.update { 
                it.copy(
                    currentMoveIndex = idx - 1,
                    board = engine.grid,
                    lastMove = newLastMove
                )
            }
        }
    }
    
    fun resetBoard() {
        engine.setupDefaultBoard()
        _uiState.update { 
            it.copy(
                currentMoveIndex = 0,
                board = engine.grid,
                lastMove = null
            )
        }
    }
    
    fun resetSelection() {
        _uiState.update { 
            it.copy(selectedOpening = null)
        }
    }

    private fun playLanMove(lan: String) {
        if (lan.length < 4) return
        val startCol = lan[0] - 'a'
        val startRow = 8 - (lan[1] - '0')
        val endCol = lan[2] - 'a'
        val endRow = 8 - (lan[3] - '0')
        
        var promotionType: com.toust.tositochest.engine.PieceType? = null
        if (lan.length == 5) {
            promotionType = when (lan[4].lowercaseChar()) {
                'q' -> com.toust.tositochest.engine.PieceType.QUEEN
                'r' -> com.toust.tositochest.engine.PieceType.ROOK
                'n' -> com.toust.tositochest.engine.PieceType.KNIGHT
                'b' -> com.toust.tositochest.engine.PieceType.BISHOP
                else -> com.toust.tositochest.engine.PieceType.QUEEN
            }
        }
        
        engine.movePiece(startRow, startCol, endRow, endCol, promotionType ?: PieceType.QUEEN)
    }
}
