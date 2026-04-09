package com.toust.tositochest.ui.game
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import com.toust.tositochest.engine.ChessBoard
import com.toust.tositochest.engine.ChessPiece
import com.toust.tositochest.engine.PieceColor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.toust.tositochest.engine.ChessAI
import com.toust.tositochest.engine.Move as EngineMove
import com.toust.tositochest.ui.util.SoundManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.io.BufferedReader
import java.io.InputStreamReader

data class GameUiState(
    val gameId: String = "",
    val fen: String = "",
    val turn: PieceColor = PieceColor.WHITE,
    val selectedSquare: Pair<Int, Int>? = null,
    val validMoves: List<Pair<Int, Int>> = emptyList(),
    val board: Array<Array<ChessPiece?>> = Array(8) { arrayOfNulls<ChessPiece>(8) },
    val godMode: Boolean = false,
    val showHints: Boolean = false,
    val isAdmin: Boolean = false,
    val isCheck: Boolean = false,
    val myColor: PieceColor? = null,
    val status: String = "waiting",
    val whiteUid: String? = null,
    val blackUid: String? = null,
    val winner: String? = null,
    val aiLevel: String? = null,
    val isAiGame: Boolean = false,
    val aiColor: PieceColor? = null,
    val lastMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    val isFlipped: Boolean = false,
    val showPromotionDialog: Boolean = false,
    val hintMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    val isCustomBoard: Boolean = false, // false = Premium (Gold), true = Classic (Green)
    val pendingPromotionMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    val premove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    val premoveValidMoves: List<Pair<Int, Int>> = emptyList(),
    val whiteTimeRemaining: Long = 600000L,
    val blackTimeRemaining: Long = 600000L,
    val lastTurnTimestamp: Long? = null,
    val isHintEnabled: Boolean = false,
    val hintEngine: String = "level_7", // "level_7" (SF18) or "level_8" (Lichess)
    val eloChange: Int? = null,
    val historyDocId: String? = null
)

class GameViewModel : ViewModel() {
    private val db = Firebase.firestore
    private val auth = Firebase.auth
    private var engine = ChessBoard()
    private val _uiState = MutableStateFlow(GameUiState())
    val uiState: StateFlow<GameUiState> = _uiState.asStateFlow()
    
    private var timerJob: kotlinx.coroutines.Job? = null

    fun initGame(gameId: String) {
        _uiState.update { it.copy(gameId = gameId) }
        if (gameId != "new" && gameId.isNotEmpty()) {
            startListening(gameId)
        } else {
            updateState()
        }
    }

    private fun startListening(gameId: String) {
        val user = auth.currentUser
        db.collection("games").document(gameId)
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null || !snapshot.exists()) return@addSnapshotListener
                
                val fen = snapshot.getString("fen") ?: ""
                val turnStr = snapshot.getString("turn") ?: "white"
                val status = snapshot.getString("status") ?: "playing"
                val white = snapshot.getString("white")
                val black = snapshot.getString("black")
                val aiLevel = snapshot.getString("opponent")
                
                val isAiGame = white == "IA" || black == "IA"
                val aiColor = when {
                    white == "IA" -> PieceColor.WHITE
                    black == "IA" -> PieceColor.BLACK
                    else -> null
                }

                val myColor = when (user?.uid) {
                    white -> PieceColor.WHITE
                    black -> PieceColor.BLACK
                    else -> null
                }
                
                if (fen != engine.toFen()) {
                    val oldPieces = engine.grid.sumOf { row -> row.count { it != null } }
                    engine.loadFen(fen)
                    val newPieces = engine.grid.sumOf { row -> row.count { it != null } }
                    engine.turn = if (turnStr == "white") PieceColor.WHITE else PieceColor.BLACK
                    
                    val map = snapshot.get("positionHistory") as? Map<String, Number>
                    if (map != null) {
                        engine.positionHistory = map.mapValues { it.value.toInt() }.toMutableMap()
                    }

                    // Play sound for remote move (not my own move which is handled in executeMove)
                    if (myColor != engine.turn && status == "playing") {
                        if (engine.isCheck(engine.turn)) {
                            SoundManager.playCheck()
                        } else if (newPieces < oldPieces) {
                            SoundManager.playCapture()
                        } else {
                            SoundManager.playMove()
                        }
                    }
                }
                
                _uiState.update { it.copy(
                    myColor = myColor,
                    status = status,
                    whiteUid = white,
                    blackUid = black,
                    aiLevel = aiLevel,
                    isAiGame = isAiGame,
                    aiColor = aiColor,
                    isFlipped = myColor == PieceColor.BLACK,
                    gameId = gameId,
                    whiteTimeRemaining = snapshot.getLong("whiteTime") ?: 600000L,
                    blackTimeRemaining = snapshot.getLong("blackTime") ?: 600000L,
                    lastTurnTimestamp = snapshot.getLong("lastTurnTimestamp") ?: System.currentTimeMillis()
                )}
                
                // Fetch user role for admin features
                user?.let { u ->
                    db.collection("users").document(u.uid).get()
                        .addOnSuccessListener { userDoc ->
                            val isAdmin = userDoc.getString("role") == "admin"
                            val isCustomBoard = userDoc.getBoolean("isCustomBoard") ?: false
                            _uiState.update { it.copy(
                                isAdmin = isAdmin,
                                isCustomBoard = isCustomBoard
                            )}
                        }
                }

                // Timer Ticking Loop
                if (timerJob == null) {
                    timerJob = viewModelScope.launch {
                        while (true) {
                            delay(1000)
                            val state = _uiState.value
                            if (state.status == "playing") {
                                val now = System.currentTimeMillis()
                                val last = state.lastTurnTimestamp ?: now
                                
                                _uiState.update { current ->
                                    if (current.turn == com.toust.tositochest.engine.PieceColor.WHITE) {
                                        val newTime = (current.whiteTimeRemaining - 1000).coerceAtLeast(0)
                                        if (newTime == 0L) handleTimeOut("white")
                                        current.copy(whiteTimeRemaining = newTime)
                                    } else {
                                        val newTime = (current.blackTimeRemaining - 1000).coerceAtLeast(0)
                                        if (newTime == 0L) handleTimeOut("black")
                                        current.copy(blackTimeRemaining = newTime)
                                    }
                                }
                            }
                        }
                    }
                }
                updateState()
                
                // If it's AI's turn, trigger move
                if (isAiGame && status == "playing" && engine.turn == aiColor) {
                    val level = _uiState.value.aiLevel ?: "level_3"
                    if (level == "level_pc") {
                        triggerRemoteAiMove()
                    } else {
                        triggerAiMove()
                    }
                }
            }
    }

    private fun triggerRemoteAiMove() {
        val fen = engine.toFen()

        viewModelScope.launch {
            _uiState.update { it.copy(status = "thinking...") }
            
            try {
                // 1. Obtener la URL dinámica de Firestore (Ngrok o Local fallback)
                val configDoc = try {
                    db.collection("globals").document("ai_config").get().await()
                } catch (e: Exception) {
                    null
                }
                
                // Si no hay URL en Firebase, usamos la IP local como último recurso
                val remoteUrl = configDoc?.getString("remote_url") ?: "http://192.168.1.135:5000"
                val urlString = if (remoteUrl.endsWith("/")) "${remoteUrl}api/external/ai_move" else "$remoteUrl/api/external/ai_move"

                val result = withContext(Dispatchers.IO) {
                    val url = URL(urlString)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.doOutput = true
                    conn.connectTimeout = 10000
                    
                    val jsonParam = JSONObject()
                    jsonParam.put("fen", fen)
                    jsonParam.put("level", "level_5") 
                    
                    val os = conn.outputStream
                    val writer = OutputStreamWriter(os, "UTF-8")
                    writer.write(jsonParam.toString())
                    writer.flush()
                    writer.close()
                    os.close()

                    if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                        val reader = BufferedReader(InputStreamReader(conn.inputStream))
                        val response = StringBuilder()
                        var line: String?
                        while (reader.readLine().also { line = it } != null) {
                            response.append(line)
                        }
                        reader.close()
                        JSONObject(response.toString())
                    } else {
                        android.util.Log.e("REMOTE_AI", "Server error: ${conn.responseCode}")
                        null
                    }
                }

                if (result != null && result.getBoolean("success")) {
                    val startRow = result.getInt("start_row")
                    val startCol = result.getInt("start_col")
                    val endRow = result.getInt("end_row")
                    val endCol = result.getInt("end_col")
                    
                    val isCapture = engine.grid[endRow][endCol] != null
                    if (engine.movePiece(startRow, startCol, endRow, endCol)) {
                        if (engine.isCheck(engine.turn)) SoundManager.playCheck()
                        else if (isCapture) SoundManager.playCapture()
                        else SoundManager.playMove()

                        _uiState.update { it.copy(status = "playing") }
                        updateState()
                        syncToFirestore()
                        checkGameOver()
                    }
                } else {
                    triggerAiMove()
                }
            } catch (e: Exception) {
                android.util.Log.e("REMOTE_AI", "Error calling remote AI: ${e.message}")
                triggerAiMove()
            }
        }
    }

    private fun triggerAiMove() {
        val level = _uiState.value.aiLevel ?: "level_3"
        val aiColor = engine.turn
        viewModelScope.launch {
            delay(1000) // Small delay for "thinking" effect
            val ai = ChessAI(aiColor)
            val bestMove = ai.getBestMove(engine, level)
            if (bestMove != null) {
                val isCapture = engine.grid[bestMove.endRow][bestMove.endCol] != null
                if (engine.movePiece(bestMove.startRow, bestMove.startCol, bestMove.endRow, bestMove.endCol)) {
                    if (engine.isCheck(engine.turn)) SoundManager.playCheck()
                    else if (isCapture) SoundManager.playCapture()
                    else SoundManager.playMove()

                    updateState()
                    syncToFirestore()
                }
            }
        }
    }

    private fun updateState() {
        _uiState.update { 
            it.copy(
                fen = engine.toFen(),
                turn = engine.turn,
                board = engine.grid.map { row -> row.copyOf() }.toTypedArray(),
                isCheck = engine.isCheck(engine.turn),
                lastMove = engine.lastMove?.let { (it.startRow to it.startCol) to (it.endRow to it.endCol) },
                hintMove = null // Clear hint on move
            )
        }
        
        // Auto-calculate hint if enabled
        if (_uiState.value.isHintEnabled && _uiState.value.status == "playing") {
            calculateHint()
        }
    }
    

    private fun syncToFirestore() {
        val gameId = _uiState.value.gameId
        if (gameId != "new" && gameId.isNotEmpty()) {
            val historySerialized = engine.history.map { m ->
                mapOf(
                    "start" to listOf(m.startRow, m.startCol),
                    "end" to listOf(m.endRow, m.endCol),
                    "type" to m.piece.type.char.toString(),
                    "color" to m.piece.color.name.lowercase()
                )
            }

            db.collection("games").document(gameId).update(
                mapOf(
                    "fen" to engine.toFen(),
                    "turn" to if (engine.turn == PieceColor.WHITE) "white" else "black",
                    "history" to historySerialized,
                    "status" to _uiState.value.status,
                    "winner" to _uiState.value.winner,
                    "whiteTime" to _uiState.value.whiteTimeRemaining,
                    "blackTime" to _uiState.value.blackTimeRemaining,
                    "lastTurnTimestamp" to System.currentTimeMillis(),
                    "lastUpdated" to com.google.firebase.Timestamp.now(),
                    "positionHistory" to engine.positionHistory
                )
            )
            
            checkGameOver()
        }
    }

    private fun checkGameOver() {
        val user = auth.currentUser ?: return
        val turn = engine.turn
        val isMate = engine.isCheckmate(turn)
        val isStale = engine.isStalemate(turn)
        val isFifty = engine.isFiftyMoveRule()
        val isRepetition = engine.isThreefoldRepetition()
        val isInsufficient = engine.isInsufficientMaterial()
        val isFinished = _uiState.value.status == "finished"

        if (isMate || isStale || isFifty || isRepetition || isInsufficient || isFinished) {
            val winner = if (isMate) (if (turn == PieceColor.WHITE) "Negras" else "Blancas") 
                        else if (isFinished) _uiState.value.winner ?: "Desonocido"
                        else "Tablas"
            
            val resultMessage = if (isMate) "¡Jaque Mate! Ganan las $winner" 
                               else if (isFinished) winner
                               else if (isFifty) "¡Tablas por regla de los 50 movimientos!"
                               else if (isRepetition) "¡Tablas por triple repetición!"
                               else if (isInsufficient) "¡Tablas por material insuficiente!"
                               else "¡Tablas por Ahogado!"
            
            _uiState.update { it.copy(winner = winner) }
            SoundManager.playNotify()

            viewModelScope.launch {
                try {
                    val playerColor = _uiState.value.myColor
                    val historySerialized = engine.history.map { m ->
                        mapOf(
                            "start" to listOf(m.startRow, m.startCol),
                            "end" to listOf(m.endRow, m.endCol),
                            "type" to m.piece.type.char.toString(),
                            "color" to m.piece.color.name.lowercase()
                        )
                    }

                    val historyList = engine.history
                    val movesCount = historyList.size
                    val opponentName = if (_uiState.value.isAiGame) {
                        _uiState.value.aiLevel?.replace("level_", "Nivel ") ?: "IA"
                    } else {
                        "Oponente Humano"
                    }

                    val historyData = mapOf(
                        "playerUid" to user.uid,
                        "playerName" to (user.displayName ?: "Jugador Android"),
                        "opponent" to opponentName,
                        "result" to resultMessage,
                        "playerColor" to (playerColor?.name ?: "UNKNOWN"),
                        "startFen" to "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                        "fen" to engine.toFen(),
                        "history" to historySerialized,
                        "moves" to movesCount,
                        "timestamp" to com.google.firebase.Timestamp.now()
                    )

                    val docRef = db.collection("games_history").add(historyData).await()
                    _uiState.update { it.copy(historyDocId = docRef.id) }
                    
                    db.collection("games").document(_uiState.value.gameId).update("status", "finished").await()
                    
                    // Actualizar estadísticas del usuario
                    if (playerColor != null) {
                        val userRef = db.collection("users").document(user.uid)
                        val updates = mutableMapOf<String, Any>(
                            "totalGames" to com.google.firebase.firestore.FieldValue.increment(1)
                        )
                        
                        var isWin = false
                        var isLoss = false
                        
                        when (winner) {
                            "Tablas" -> { /* No incrementamos wins ni losses */ }
                            "Blancas" -> {
                                if (playerColor == PieceColor.WHITE) {
                                    isWin = true
                                    updates["wins"] = com.google.firebase.firestore.FieldValue.increment(1)
                                } else {
                                    isLoss = true
                                    updates["losses"] = com.google.firebase.firestore.FieldValue.increment(1)
                                }
                            }
                            "Negras" -> {
                                if (playerColor == PieceColor.BLACK) {
                                    isWin = true
                                    updates["wins"] = com.google.firebase.firestore.FieldValue.increment(1)
                                } else {
                                    isLoss = true
                                    updates["losses"] = com.google.firebase.firestore.FieldValue.increment(1)
                                }
                            }
                        }
                        
                        // Elo Calculation
                        val state = _uiState.value
                        val userDoc = userRef.get().await()
                        val playerElo = userDoc.getLong("elo")?.toInt() ?: 1200
                        var opponentElo = 1200
                        
                        if (state.isAiGame) {
                            val level = state.aiLevel?.replace("level_", "")?.toIntOrNull() ?: 2
                            opponentElo = 800 + (level * 200)
                        } else {
                            val oppUid = if (playerColor == PieceColor.WHITE) state.blackUid else state.whiteUid
                            if (oppUid != null) {
                                val oppDoc = db.collection("users").document(oppUid).get().await()
                                opponentElo = oppDoc.getLong("elo")?.toInt() ?: 1200
                            }
                        }
                        
                        val expectedScore = 1.0 / (1.0 + Math.pow(10.0, (opponentElo - playerElo) / 400.0))
                        val actualScore = if (winner == "Tablas") 0.5 else if (isWin) 1.0 else 0.0
                        val eloChange = Math.round(32 * (actualScore - expectedScore)).toInt()
                        
                        updates["elo"] = com.google.firebase.firestore.FieldValue.increment(eloChange.toLong())
                        _uiState.update { it.copy(eloChange = eloChange) }
                        
                        // También actualizamos el historial para que muestre la ganancia de Elo en el Review
                        db.collection("games_history")
                            .whereEqualTo("timestamp", historyData["timestamp"])
                            .whereEqualTo("playerUid", user.uid)
                            .get().await().documents.firstOrNull()?.reference?.update("eloChange", eloChange)
                            
                        userRef.update(updates).await()
                    }

                    timerJob?.cancel()
                    timerJob = null

                    android.util.Log.d("GAME_DEBUG", "Game archived and stats updated successfully: $resultMessage")
                } catch (e: Exception) {
                    android.util.Log.e("GAME_DEBUG", "Error archiving game or updating stats: ${e.message}")
                }
            }
        }
    }
    
    fun updateGameName(name: String) {
        val hid = _uiState.value.historyDocId ?: return
        viewModelScope.launch {
            try {
                db.collection("games_history").document(hid).update("title", name).await()
            } catch (e: Exception) {
                android.util.Log.e("GAME_DEBUG", "Error updating game title: ${e.message}")
            }
        }
    }

    fun toggleGodMode() {
        _uiState.update { it.copy(godMode = !it.godMode) }
    }

    fun forceChangeTurn() {
        if (!_uiState.value.isAdmin) return
        engine.turn = if (engine.turn == PieceColor.WHITE) PieceColor.BLACK else PieceColor.WHITE
        updateState()
        syncToFirestore()
    }

    fun undoLastMove() {
        if (!_uiState.value.isAdmin) return
        if (engine.history.isNotEmpty()) {
            engine.undoLastMove()
            updateState()
            syncToFirestore()
        }
    }


    private fun handleTimeOut(color: String) {
        if (_uiState.value.status != "playing") return
        
        val winnerColor = if (color == "white") "Negras" else "Blancas"
        val result = "Ganan las $winnerColor (Tiempo)"
        
        _uiState.update { it.copy(
            status = "finished",
            winner = result
        )}
        syncToFirestore()
        checkGameOver()
    }

    fun resignGame() {
        val user = auth.currentUser ?: return
        val currentState = _uiState.value
        if (currentState.status != "playing") return
        
        val winnerColor = if (user.uid == currentState.whiteUid) PieceColor.BLACK else PieceColor.WHITE
        val result = if (winnerColor == PieceColor.WHITE) "Ganan las Blancas (Abandono)" else "Ganan las Negras (Abandono)"
        
        _uiState.update { it.copy(
            status = "finished",
            winner = result
        )}
        
        syncToFirestore()
        checkGameOver() // To trigger archival
    }

    fun toggleBoardTheme() {
        val user = auth.currentUser ?: return
        val newValue = !_uiState.value.isCustomBoard
        _uiState.update { it.copy(isCustomBoard = newValue) }
        
        // Persist to user profile
        db.collection("users").document(user.uid).update("isCustomBoard", newValue)
    }

    fun toggleHintEnabled() {
        if (!_uiState.value.isAdmin) return
        val newValue = !_uiState.value.isHintEnabled
        _uiState.update { it.copy(isHintEnabled = newValue) }
        if (newValue) calculateHint()
    }

    fun setHintEngine(engineId: String) {
        if (!_uiState.value.isAdmin) return
        _uiState.update { it.copy(hintEngine = engineId) }
        if (_uiState.value.isHintEnabled) {
            calculateHint()
        }
    }

    fun calculateHint() {
        if (!_uiState.value.isAdmin) return
        
        viewModelScope.launch {
            val engineType = _uiState.value.hintEngine
            val ai = ChessAI(engine.turn)
            val bestMove = ai.getBestMove(engine, engineType)
            if (bestMove != null) {
                _uiState.update { it.copy(
                    hintMove = (bestMove.startRow to bestMove.startCol) to (bestMove.endRow to bestMove.endCol)
                )}
            }
        }
    }

    fun resetBoard() {
        engine = ChessBoard()
        _uiState.update { it.copy(selectedSquare = null) }
        updateState()
        syncToFirestore()
    }

    fun onSquareClicked(row: Int, col: Int) {
        val state = _uiState.value
        val userColor = state.myColor
        
        if (state.showPromotionDialog) return

        val isMyTurn = state.godMode || (userColor != null && engine.turn == userColor)
        
        if (!isMyTurn) {
            handlePremoveClick(row, col)
            return
        }

        // Standard Turn Logic
        val currentSelection = state.selectedSquare
        if (currentSelection == null) {
            val piece = engine.getPiece(row, col)
            if (piece != null && (piece.color == engine.turn || state.godMode)) {
                val moves = engine.getValidMoves(row, col)
                _uiState.update { it.copy(selectedSquare = row to col, validMoves = moves, premove = null) }
            }
        } else {
            val (startRow, startCol) = currentSelection
            val piece = engine.getPiece(startRow, startCol)
            
            if (engine.isValidMove(startRow, startCol, row, col)) {
                if (piece?.type == com.toust.tositochest.engine.PieceType.PAWN && (row == 0 || row == 7)) {
                    _uiState.update { it.copy(
                        showPromotionDialog = true,
                        pendingPromotionMove = (startRow to startCol) to (row to col)
                    ) }
                } else {
                    executeMove(startRow, startCol, row, col)
                }
            } else {
                val newPiece = engine.getPiece(row, col)
                if (newPiece != null && (newPiece.color == engine.turn || state.godMode)) {
                    val moves = engine.getValidMoves(row, col)
                    _uiState.update { it.copy(selectedSquare = row to col, validMoves = moves) }
                } else {
                    _uiState.update { it.copy(selectedSquare = null, validMoves = emptyList()) }
                }
            }
        }
    }

    private fun handlePremoveClick(row: Int, col: Int) {
        val state = _uiState.value
        val userColor = state.myColor ?: return
        val currentPremoveSelection = state.selectedSquare

        if (currentPremoveSelection == null) {
            val piece = engine.getPiece(row, col)
            if (piece != null && piece.color == userColor) {
                // For premove evaluation, we use the CURRENT board state
                val moves = engine.getValidMoves(row, col)
                _uiState.update { it.copy(selectedSquare = row to col, validMoves = emptyList(), premoveValidMoves = moves) }
            }
        } else {
            val (startRow, startCol) = currentPremoveSelection
            if (state.premoveValidMoves.contains(row to col)) {
                _uiState.update { it.copy(
                    premove = (startRow to startCol) to (row to col),
                    selectedSquare = null,
                    premoveValidMoves = emptyList()
                )}
            } else {
                val piece = engine.getPiece(row, col)
                if (piece != null && piece.color == userColor) {
                    val moves = engine.getValidMoves(row, col)
                    _uiState.update { it.copy(selectedSquare = row to col, validMoves = emptyList(), premoveValidMoves = moves) }
                } else {
                    _uiState.update { it.copy(selectedSquare = null, premoveValidMoves = emptyList(), premove = null) }
                }
            }
        }
    }

    fun promotePawn(type: com.toust.tositochest.engine.PieceType) {
        val move = _uiState.value.pendingPromotionMove ?: return
        executeMove(move.first.first, move.first.second, move.second.first, move.second.second, type)
        _uiState.update { it.copy(showPromotionDialog = false, pendingPromotionMove = null) }
    }

    private fun executeMove(startRow: Int, startCol: Int, endRow: Int, endCol: Int, promotionType: com.toust.tositochest.engine.PieceType = com.toust.tositochest.engine.PieceType.QUEEN) {
        val isCapture = engine.grid[endRow][endCol] != null
        if (engine.movePiece(startRow, startCol, endRow, endCol, promotionType)) {
            if (engine.isCheck(engine.turn)) {
                SoundManager.playCheck()
            } else if (isCapture) {
                SoundManager.playCapture()
            } else {
                SoundManager.playMove()
            }
            _uiState.update { it.copy(
                selectedSquare = null,
                validMoves = emptyList(),
                lastTurnTimestamp = System.currentTimeMillis()
            )}
            updateState()
            syncToFirestore()
            checkGameOver()
        }
    }
}
