package com.toust.tositochest.ui.challenges

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.toust.tositochest.engine.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChallengeUiState(
    val currentPuzzle: LichessPuzzle? = null,
    val streak: Int = 0,
    val bestStreak: Int = 0,
    val isGameOver: Boolean = false,
    val board: Array<Array<ChessPiece?>> = Array(8) { arrayOfNulls(8) },
    val selectedSquare: Pair<Int, Int>? = null,
    val validMoves: List<Pair<Int, Int>> = emptyList(),
    val lastMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    val feedbackMessage: String? = null,
    val isLoading: Boolean = false,
    val currentMoveIndex: Int = 0
)

class ChallengeViewModel : ViewModel() {
    private var engine = ChessBoard()
    private val _uiState = MutableStateFlow(ChallengeUiState())
    val uiState: StateFlow<ChallengeUiState> = _uiState.asStateFlow()

    init {
        startNewChallenge()
    }

    fun startNewChallenge() {
        _uiState.update { it.copy(isLoading = true, isGameOver = false, streak = 0, feedbackMessage = null) }
        loadNextPuzzle()
    }

    private fun loadNextPuzzle() {
        _uiState.update { it.copy(isLoading = true, feedbackMessage = null) }
        viewModelScope.launch {
            val puzzle = LichessPuzzleClient.fetchRandomPuzzle()
            if (puzzle != null) {
                engine = ChessBoard()
                engine.loadFen(puzzle.fenReady)
                
                val deducedLastMove = puzzle.lastMoveLan?.let { lan ->
                    if (lan.length >= 4) {
                        val startC = lan[0] - 'a'
                        val startR = 8 - lan[1].digitToInt()
                        val endC = lan[2] - 'a'
                        val endR = 8 - lan[3].digitToInt()
                        Pair(Pair(startR, startC), Pair(endR, endC))
                    } else null
                }

                _uiState.update { 
                    it.copy(
                        currentPuzzle = puzzle,
                        board = engine.grid,
                        lastMove = deducedLastMove,
                        currentMoveIndex = 1, // Start after opponent's move
                        isLoading = false,
                        selectedSquare = null,
                        validMoves = emptyList()
                    )
                }
            } else {
                _uiState.update { it.copy(isLoading = false, feedbackMessage = "Error al cargar reto. Reintentando en 2s...") }
                kotlinx.coroutines.delay(2000)
                loadNextPuzzle()
            }
        }
    }

    fun onSquareClicked(row: Int, col: Int) {
        val state = _uiState.value
        if (state.isGameOver || state.isLoading || state.currentPuzzle == null) return

        val currentSelection = state.selectedSquare

        if (currentSelection == null) {
            val piece = engine.getPiece(row, col)
            if (piece != null && piece.color == engine.turn) {
                val moves = engine.getValidMoves(row, col)
                _uiState.update { it.copy(selectedSquare = row to col, validMoves = moves) }
            }
        } else {
            val (startRow, startCol) = currentSelection
            if (state.validMoves.contains(row to col)) {
                val attemptedLan = "${(startCol + 'a'.code).toChar()}${8 - startRow}${(col + 'a'.code).toChar()}${8 - row}"
                val solution = state.currentPuzzle.solutionLAN
                val correctLan = solution.getOrNull(state.currentMoveIndex)
                
                val isCorrect = correctLan != null && correctLan.startsWith(attemptedLan)

                if (isCorrect) {
                    var promoType = PieceType.QUEEN
                    if (correctLan!!.length == 5) {
                        promoType = when(correctLan[4].lowercaseChar()) {
                            'q' -> PieceType.QUEEN
                            'r' -> PieceType.ROOK
                            'n' -> PieceType.KNIGHT
                            'b' -> PieceType.BISHOP
                            else -> PieceType.QUEEN
                        }
                    }
                    
                    engine.movePiece(startRow, startCol, row, col, promoType)
                    val nextIndex = state.currentMoveIndex + 1
                    
                    if (nextIndex >= solution.size) {
                        // Puzzle solved!
                        val newStreak = state.streak + 1
                        val newBest = if (newStreak > state.bestStreak) newStreak else state.bestStreak
                        _uiState.update { 
                            it.copy(
                                streak = newStreak,
                                bestStreak = newBest,
                                feedbackMessage = "¡Excelente! +1 racha",
                                board = engine.grid,
                                lastMove = engine.lastMove?.let { lm -> Pair(Pair(lm.startRow, lm.startCol), Pair(lm.endRow, lm.endCol)) }
                            )
                        }
                        viewModelScope.launch {
                            kotlinx.coroutines.delay(1000)
                            loadNextPuzzle()
                        }
                    } else {
                        // Opponent's turn (next move in solution)
                        val opponentMove = solution[nextIndex]
                        playOpponentMove(opponentMove)
                        
                        _uiState.update { 
                            it.copy(
                                board = engine.grid,
                                selectedSquare = null,
                                validMoves = emptyList(),
                                currentMoveIndex = nextIndex + 1,
                                lastMove = engine.lastMove?.let { lm -> Pair(Pair(lm.startRow, lm.startCol), Pair(lm.endRow, lm.endCol)) }
                            )
                        }
                    }
                } else {
                    // Wrong move -> Game Over
                    _uiState.update { 
                        it.copy(
                            isGameOver = true,
                            feedbackMessage = "Movimiento incorrecto. Fin del reto."
                        )
                    }
                }
            } else {
                val newPiece = engine.getPiece(row, col)
                if (newPiece != null && newPiece.color == engine.turn) {
                    val moves = engine.getValidMoves(row, col)
                    _uiState.update { it.copy(selectedSquare = row to col, validMoves = moves) }
                } else {
                    _uiState.update { it.copy(selectedSquare = null, validMoves = emptyList()) }
                }
            }
        }
    }

    private fun playOpponentMove(lan: String) {
        if (lan.length < 4) return
        val sc = lan[0] - 'a'
        val sr = 8 - lan[1].digitToInt()
        val ec = lan[2] - 'a'
        val er = 8 - lan[3].digitToInt()
        val promo = if (lan.length == 5) {
            when(lan[4].lowercaseChar()) {
                'q' -> PieceType.QUEEN
                'r' -> PieceType.ROOK
                'n' -> PieceType.KNIGHT
                'b' -> PieceType.BISHOP
                else -> PieceType.QUEEN
            }
        } else PieceType.QUEEN
        engine.movePiece(sr, sc, er, ec, promo)
    }
}
