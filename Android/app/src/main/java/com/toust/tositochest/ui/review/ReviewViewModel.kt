package com.toust.tositochest.ui.review

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import com.toust.tositochest.engine.ChessBoard
import com.toust.tositochest.engine.PieceColor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.toust.tositochest.engine.ChessApiClient
import com.toust.tositochest.engine.LichessApiClient
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import com.toust.tositochest.engine.ApiResponse
import com.toust.tositochest.ui.util.SoundManager

data class ReviewUiState(
    val gameId: String = "",
    val isLoading: Boolean = true,
    val engine: ChessBoard = ChessBoard(),
    val moves: List<Map<String, Any>> = emptyList(),
    val moveQualities: List<String> = emptyList(), // "!!", "!", "", "?!", "?", "??", "📖"
    val bestMoves: List<Pair<Pair<Int, Int>, Pair<Int, Int>>?> = emptyList(),
    val scores: List<Int> = emptyList(),
    val currentMoveIndex: Int = -1,
    val playerColor: PieceColor = PieceColor.WHITE,
    val selectedEngine: String = "stockfish",
    val error: String? = null
)

class ReviewViewModel : ViewModel() {
    private val db = Firebase.firestore
    private val _uiState = MutableStateFlow(ReviewUiState())
    val uiState: StateFlow<ReviewUiState> = _uiState.asStateFlow()

    private var backgroundAnalysisJob: Job? = null
    private var currentMoveAnalysisJob: Job? = null
    private val apiCache = mutableMapOf<String, ApiResponse>()

    fun setEngine(engineType: String) {
        val state = _uiState.value
        if (state.selectedEngine == engineType) return
        
        if (state.moves.isEmpty()) return
        
        apiCache.clear()
        backgroundAnalysisJob?.cancel()
        currentMoveAnalysisJob?.cancel()
        
        // Restart base local analysis
        val engine = ChessBoard()
        val analysis = analyzeMoves(engine, state.moves, state.playerColor)
        
        _uiState.update { 
            it.copy(
                selectedEngine = engineType,
                scores = analysis.scores,
                bestMoves = analysis.bestMoves,
                moveQualities = analysis.qualities
            )
        }
        
        backgroundAnalysisJob = fetchThrottledBackgroundAnalysis(state.playerColor, state.moves)
        analyzeCurrentMoveOnDemand()
    }

    fun loadGame(gameId: String) {
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isLoading = true, gameId = gameId) }
                
                val doc = db.collection("games_history").document(gameId).get().await()
                if (!doc.exists()) {
                    _uiState.update { it.copy(error = "Partida no encontrada.", isLoading = false) }
                    return@launch
                }
                
                val startFen = doc.getString("startFen") ?: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                val pColorStr = doc.getString("playerColor") ?: "WHITE"
                val pColor = if (pColorStr.equals("BLACK", true)) PieceColor.BLACK else PieceColor.WHITE
                
                // Firestore returns array of maps for history
                val rawHistory = doc.get("history") as? List<Map<String, Any>> ?: emptyList()
                
                val engine = ChessBoard()
                // If it's a custom fen, we'd need to load it. For now, we assume standard start or ignore.
                // Assuming startFen is standard for 99% of games.
                
                val analysis = analyzeMoves(engine, rawHistory, pColor)
                
                // Reset engine to start for viewing
                val viewingEngine = ChessBoard()
                
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        engine = viewingEngine,
                        moves = rawHistory,
                        moveQualities = analysis.qualities,
                        bestMoves = analysis.bestMoves,
                        scores = analysis.scores,
                        currentMoveIndex = -1,
                        playerColor = pColor
                    )
                }
                
                // Launch background API fetching with throttling
                backgroundAnalysisJob?.cancel()
                backgroundAnalysisJob = fetchThrottledBackgroundAnalysis(pColor, rawHistory)
                
                // Analyze current move immediately (which is move -1/start initially)
                analyzeCurrentMoveOnDemand()
                
            } catch (e: Exception) {
                android.util.Log.e("REVIEW", "Error loading game", e)
                _uiState.update { it.copy(error = "Error al cargar la partida.", isLoading = false) }
            }
        }
    }
    
    data class AnalysisResult(
        val qualities: List<String>,
        val bestMoves: List<Pair<Pair<Int, Int>, Pair<Int, Int>>?>,
        val scores: List<Int>
    )

    // Analyzes all moves and returns a list of symbols, best moves, and scores
    private fun analyzeMoves(engine: ChessBoard, moves: List<Map<String, Any>>, playerColor: PieceColor): AnalysisResult {
        val qualities = mutableListOf<String>()
        val bestMoves = mutableListOf<Pair<Pair<Int, Int>, Pair<Int, Int>>?>()
        val scores = mutableListOf<Int>()
        
        var prevScore = engine.fastEval() // from White perspective
        scores.add(prevScore) // Initial score before move 0
        
        for ((index, move) in moves.withIndex()) {
            val startCoords = move["start"] as? List<Long> ?: continue
            val endCoords = move["end"] as? List<Long> ?: continue
            val start = Pair(startCoords[0].toInt(), startCoords[1].toInt())
            val end = Pair(endCoords[0].toInt(), endCoords[1].toInt())
            
            // engine turn before move
            val currentTurn = engine.turn
            
            val bestMoveForTurn = engine.findBestMove()
            bestMoves.add(bestMoveForTurn)
            
            // engine.movePiece expects: startRow, startCol, endRow, endCol
            engine.movePiece(start.first, start.second, end.first, end.second)
            
            val newScore = engine.fastEval()
            scores.add(newScore)
            
            // Calculate difference relative to the player who just moved
            val diff = if (currentTurn == PieceColor.WHITE) {
                newScore - prevScore
            } else {
                prevScore - newScore
            }
            
            // Book move heuristic
            val isBook = index < 10 && diff > -150
            
            // Classify 
            val quality = when {
                isBook -> "📖"     // Libro
                diff > 150 -> "!!" // Brillante
                diff > 50 -> "!"   // Genial
                diff > -20 -> ""   // Correcta
                diff > -100 -> "?!" // Imprecisión
                diff > -250 -> "?"  // Error
                else -> "??"       // Error Grave
            }
            qualities.add(quality)
            
            prevScore = newScore
        }
        return AnalysisResult(qualities, bestMoves, scores)
    }

    private fun fetchThrottledBackgroundAnalysis(playerColor: PieceColor, moves: List<Map<String, Any>>): Job {
        return viewModelScope.launch {
            val engine = ChessBoard()
            
            // Get start FEN and evaluate
            val startFen = engine.toFen()
            val startResp = getCachedOrFetch(startFen)
            var prevScore = if (startResp != null) ChessApiClient.apiEvalToCentipawns(startResp) else engine.fastEval()
            
            updateStateWithApiResult(-1, startResp, prevScore, null)
            
            for ((index, move) in moves.withIndex()) {
                val startCoords = move["start"] as? List<Long> ?: continue
                val endCoords = move["end"] as? List<Long> ?: continue
                
                val currentTurn = engine.turn
                engine.movePiece(startCoords[0].toInt(), startCoords[1].toInt(), endCoords[0].toInt(), endCoords[1].toInt())
                
                // IMPORTANT: Throttling to avoid HIGH_USAGE
                delay(1200) 
                
                val fen = engine.toFen()
                val apiResp = getCachedOrFetch(fen)
                
                if (apiResp != null) {
                    val newScore = ChessApiClient.apiEvalToCentipawns(apiResp)
                    updateStateWithApiResult(index, apiResp, newScore, currentTurn, prevScore)
                    prevScore = newScore
                } else {
                    prevScore = engine.fastEval()
                }
            }
        }
    }

    private suspend fun getCachedOrFetch(fen: String): ApiResponse? {
        apiCache[fen]?.let { return it }
        val engineType = _uiState.value.selectedEngine
        
        val response = if (engineType == "lichess") {
            LichessApiClient.evaluatePosition(fen)
        } else {
            ChessApiClient.evaluatePosition(fen)
        }
        
        if (response != null) {
            apiCache[fen] = response
        }
        return response
    }

    private fun updateStateWithApiResult(index: Int, apiResp: ApiResponse?, newScore: Int, currentTurn: PieceColor? = null, prevScore: Int? = null) {
        val state = _uiState.value
        val currentScores = state.scores.toMutableList()
        val currentQualities = state.moveQualities.toMutableList()
        val currentBestMoves = state.bestMoves.toMutableList()

        if (index + 1 < currentScores.size) currentScores[index + 1] = newScore
        
        if (apiResp != null) {
            val bestMoveRaw = if (apiResp.fromCoords != null && apiResp.toCoords != null) {
                Pair(apiResp.fromCoords, apiResp.toCoords)
            } else null
            
            if (index >= 0 && index < currentBestMoves.size) currentBestMoves[index] = bestMoveRaw

            if (index >= 0 && index < currentQualities.size && currentTurn != null && prevScore != null) {
                val diff = if (currentTurn == PieceColor.WHITE) newScore - prevScore else prevScore - newScore
                val isBook = index < 10 && diff > -150
                currentQualities[index] = when {
                    isBook -> "📖"
                    diff > 150 -> "!!"
                    diff > 50 -> "!"
                    diff > -20 -> ""
                    diff > -100 -> "?!"
                    diff > -250 -> "?"
                    else -> "??"
                }
            }
        }

        _uiState.update { 
            it.copy(
                scores = currentScores,
                moveQualities = currentQualities,
                bestMoves = currentBestMoves
            ) 
        }
    }

    private fun analyzeCurrentMoveOnDemand() {
        val state = _uiState.value
        val index = state.currentMoveIndex
        val fen = state.engine.toFen()
        
        currentMoveAnalysisJob?.cancel()
        currentMoveAnalysisJob = viewModelScope.launch {
            val apiResp = getCachedOrFetch(fen)
            if (apiResp != null) {
                val newScore = ChessApiClient.apiEvalToCentipawns(apiResp)
                // We just update the score and best move for the current position UI
                updateStateWithApiResult(index, apiResp, newScore)
            }
        }
    }

    fun nextMove() {
        val state = _uiState.value
        if (state.currentMoveIndex + 1 < state.moves.size) {
            val move = state.moves[state.currentMoveIndex + 1]
            val engine = state.engine.copy()
            val startCoords = move["start"] as List<Long>
            val endCoords = move["end"] as List<Long>
            val start = startCoords[0].toInt() to startCoords[1].toInt()
            val end = endCoords[0].toInt() to endCoords[1].toInt()
            val isCapture = engine.grid[end.first][end.second] != null
            
            engine.movePiece(start.first, start.second, end.first, end.second)
            
            if (engine.isCheck(engine.turn)) {
                SoundManager.playCheck()
            } else if (isCapture) {
                SoundManager.playCapture()
            } else {
                SoundManager.playMove()
            }
            
            _uiState.update {
                it.copy(
                    currentMoveIndex = state.currentMoveIndex + 1,
                    engine = engine
                )
            }
            analyzeCurrentMoveOnDemand()
        }
    }

    fun prevMove() {
        val state = _uiState.value
        if (state.currentMoveIndex >= 0) {
            // Rebuild from scratch (simplest reliable way to undo without tracking full captures local history)
            val engine = ChessBoard()
            for (i in 0 until state.currentMoveIndex) {
                 val move = state.moves[i]
                 val startCoords = move["start"] as List<Long>
                 val endCoords = move["end"] as List<Long>
                 engine.movePiece(
                     startCoords[0].toInt(), startCoords[1].toInt(),
                     endCoords[0].toInt(), endCoords[1].toInt()
                 )
            }
            _uiState.update {
                it.copy(
                    currentMoveIndex = state.currentMoveIndex - 1,
                    engine = engine
                )
            }
            SoundManager.playMove()
            analyzeCurrentMoveOnDemand()
        }
    }
}
