package com.toust.tositochest.ui.exercises

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import com.toust.tositochest.engine.ChessBoard
import com.toust.tositochest.engine.ChessPiece
import com.toust.tositochest.engine.PieceColor
import com.toust.tositochest.engine.PieceType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import com.toust.tositochest.engine.LichessPuzzleClient

data class ChessExercise(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val fen: String = "",
    val solution: List<String> = emptyList(),
    val difficulty: String = ""
)

data class ExercisesUiState(
    val exercises: List<ChessExercise> = emptyList(),
    val selectedExercise: ChessExercise? = null,
    val currentMoveIndex: Int = 0,
    val board: Array<Array<ChessPiece?>> = Array(8) { arrayOfNulls(8) },
    val selectedSquare: Pair<Int, Int>? = null,
    val validMoves: List<Pair<Int, Int>> = emptyList(),
    val feedbackMessage: String? = null,
    val isCompleted: Boolean = false,
    val lastMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    val isLoadingLichess: Boolean = false
)

class ExercisesViewModel : ViewModel() {
    private val db = Firebase.firestore
    private var engine = ChessBoard()
    
    private val _uiState = MutableStateFlow(ExercisesUiState())
    val uiState: StateFlow<ExercisesUiState> = _uiState.asStateFlow()

    init {
        loadExercises()
    }

    private fun loadExercises() {
        db.collection("exercises").addSnapshotListener { snapshot, e ->
            if (e != null || snapshot == null) return@addSnapshotListener
            val list = snapshot.documents.mapNotNull { 
                it.toObject(ChessExercise::class.java)?.copy(id = it.id) 
            }
            _uiState.update { it.copy(exercises = list) }
        }
    }

    fun selectExercise(exercise: ChessExercise) {
        engine = ChessBoard()
        engine.loadFen(exercise.fen)
        _uiState.update { 
            it.copy(
                selectedExercise = exercise,
                currentMoveIndex = 0,
                board = engine.grid,
                selectedSquare = null,
                validMoves = emptyList(),
                feedbackMessage = null,
                isCompleted = false,
                lastMove = engine.lastMove?.let { lm -> Pair(Pair(lm.startRow, lm.startCol), Pair(lm.endRow, lm.endCol)) }
            )
        }
    }

    fun resetSelection() {
        _uiState.update { it.copy(selectedExercise = null) }
    }

    fun resetExercise() {
        val exercise = _uiState.value.selectedExercise ?: return
        selectExercise(exercise)
    }

    fun loadDailyLichessPuzzle() {
        _uiState.update { it.copy(isLoadingLichess = true) }
        viewModelScope.launch {
            val puzzle = LichessPuzzleClient.fetchDailyPuzzle()
            if (puzzle != null) {
                val exercise = ChessExercise(
                    id = puzzle.id,
                    title = "Rompecabezas Diario #${puzzle.id}",
                    description = "Rating: ${puzzle.rating} | Temas: ${puzzle.themes.take(3).joinToString(", ")}",
                    fen = puzzle.fenReady,
                    solution = puzzle.solutionLAN
                )
                
                // Set the specific last move mathematically deduced!
                engine = ChessBoard()
                engine.loadFen(exercise.fen)
                
                val deducedLastMove = puzzle.lastMoveLan?.let { lan ->
                    // "c6e5" => startR, startC, endR, endC
                    if (lan.length == 4) {
                        val startC = lan[0] - 'a'
                        val startR = 8 - lan[1].digitToInt()
                        val endC = lan[2] - 'a'
                        val endR = 8 - lan[3].digitToInt()
                        Pair(Pair(startR, startC), Pair(endR, endC))
                    } else null
                }
                
                _uiState.update { 
                    it.copy(
                        selectedExercise = exercise,
                        currentMoveIndex = 1,
                        board = engine.grid,
                        selectedSquare = null,
                        validMoves = emptyList(),
                        feedbackMessage = null,
                        isCompleted = false,
                        lastMove = deducedLastMove,
                        isLoadingLichess = false
                    )
                }
            } else {
                _uiState.update { it.copy(isLoadingLichess = false, feedbackMessage = "Error cargando rompecabezas de Lichess") }
            }
        }
    }

    fun loadRandomLichessPuzzle() {
        _uiState.update { it.copy(isLoadingLichess = true) }
        viewModelScope.launch {
            val puzzle = LichessPuzzleClient.fetchRandomPuzzle()
            if (puzzle != null) {
                val exercise = ChessExercise(
                    id = puzzle.id,
                    title = "Práctica Aleatoria #${puzzle.id}",
                    description = "Rating: ${puzzle.rating} | Temas: ${puzzle.themes.take(3).joinToString(", ")}",
                    fen = puzzle.fenReady,
                    solution = puzzle.solutionLAN
                )
                
                engine = ChessBoard()
                engine.loadFen(exercise.fen)
                
                val deducedLastMove = puzzle.lastMoveLan?.let { lan ->
                    if (lan.length == 4) {
                        val startC = lan[0] - 'a'
                        val startR = 8 - lan[1].digitToInt()
                        val endC = lan[2] - 'a'
                        val endR = 8 - lan[3].digitToInt()
                        Pair(Pair(startR, startC), Pair(endR, endC))
                    } else null
                }
                
                _uiState.update { 
                    it.copy(
                        selectedExercise = exercise,
                        currentMoveIndex = 1,
                        board = engine.grid,
                        selectedSquare = null,
                        validMoves = emptyList(),
                        feedbackMessage = null,
                        isCompleted = false,
                        lastMove = deducedLastMove,
                        isLoadingLichess = false
                    )
                }
            } else {
                _uiState.update { it.copy(isLoadingLichess = false, feedbackMessage = "Error cargando rompecabezas de Lichess") }
            }
        }
    }

    fun onSquareClicked(row: Int, col: Int) {
        val state = _uiState.value
        if (state.isCompleted || state.selectedExercise == null) return

        val currentSelection = state.selectedSquare

        if (currentSelection == null) {
            val piece = engine.getPiece(row, col)
            if (piece != null && piece.color == engine.turn) {
                val moves = engine.getValidMoves(row, col)
                _uiState.update { it.copy(selectedSquare = row to col, validMoves = moves, feedbackMessage = null) }
            }
        } else {
            val (startRow, startCol) = currentSelection
            if (state.validMoves.contains(row to col)) {
                // Determine if this is the correct move in the solution
                val attemptedLan = "${(startCol + 'a'.code).toChar()}${8 - startRow}${(col + 'a'.code).toChar()}${8 - row}"
                val solution = state.selectedExercise.solution
                val correctLan = solution.getOrNull(state.currentMoveIndex)
                
                // Note: Ignoring promotion char in validation for simplicity unless required
                val isCorrect = correctLan != null && correctLan.startsWith(attemptedLan)

                if (isCorrect) {
                    var promoType = com.toust.tositochest.engine.PieceType.QUEEN
                    if (correctLan!!.length == 5) {
                        promoType = when(correctLan[4].lowercaseChar()) {
                            'q' -> com.toust.tositochest.engine.PieceType.QUEEN
                            'r' -> com.toust.tositochest.engine.PieceType.ROOK
                            'n' -> com.toust.tositochest.engine.PieceType.KNIGHT
                            'b' -> com.toust.tositochest.engine.PieceType.BISHOP
                            else -> com.toust.tositochest.engine.PieceType.QUEEN
                        }
                    }
                    
                    engine.movePiece(startRow, startCol, row, col, promoType)
                    val nextIndex = state.currentMoveIndex + 1
                    val isCompleted = nextIndex >= state.selectedExercise.solution.size

                    _uiState.update { 
                        it.copy(
                            board = engine.grid,
                            selectedSquare = null,
                            validMoves = emptyList(),
                            currentMoveIndex = nextIndex,
                            isCompleted = isCompleted,
                            feedbackMessage = if (isCompleted) "¡Felicidades! Ejercicio completado." else "¡Correcto!",
                            lastMove = engine.lastMove?.let { lm -> Pair(Pair(lm.startRow, lm.startCol), Pair(lm.endRow, lm.endCol)) }
                        )
                    }
                } else {
                    _uiState.update { 
                        it.copy(
                            selectedSquare = null,
                            validMoves = emptyList(),
                            feedbackMessage = "Movimiento incorrecto. Inténtalo de nuevo."
                        )
                    }
                }
            } else {
                val newPiece = engine.getPiece(row, col)
                if (newPiece != null && newPiece.color == engine.turn) {
                    val moves = engine.getValidMoves(row, col)
                    _uiState.update { it.copy(selectedSquare = row to col, validMoves = moves, feedbackMessage = null) }
                } else {
                    _uiState.update { it.copy(selectedSquare = null, validMoves = emptyList(), feedbackMessage = null) }
                }
            }
        }
    }
}
