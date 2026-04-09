package com.toust.tositochest.ui.review

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.toust.tositochest.engine.PieceColor
import com.toust.tositochest.ui.theme.SkyBlue
import com.toust.tositochest.ui.theme.AmberGold
import com.toust.tositochest.ui.theme.DeepIndigo
import com.toust.tositochest.ui.theme.SoftRose
import com.toust.tositochest.ui.game.ChessBoard
import kotlin.math.abs

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewScreen(
    gameId: String,
    onBack: () -> Unit,
    viewModel: ReviewViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(gameId) {
        viewModel.loadGame(gameId)
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("ANÁLISIS", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, letterSpacing = 2.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = Color.Transparent)
            )
        },
        containerColor = Color.Transparent
    ) { padding ->
        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFF38BDF8))
            }
        } else if (uiState.error != null) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(uiState.error!!, color = Color.Red, fontSize = 16.sp)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Engine Switcher
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Motor: ", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.width(8.dp))
                    
                    val isStockfish = uiState.selectedEngine == "stockfish"
                    
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1E293B)),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .background(if (isStockfish) Color(0xFF38BDF8) else Color.Transparent)
                                .clickable { viewModel.setEngine("stockfish") }
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text("Stockfish 18", color = if (isStockfish) Color.White else Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Box(
                            modifier = Modifier
                                .background(if (!isStockfish) Color(0xFF8B5CF6) else Color.Transparent)
                                .clickable { viewModel.setEngine("lichess") }
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text("Lichess ☁️", color = if (!isStockfish) Color.White else Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // Move Quality Banner
                val currentQuality = if (uiState.currentMoveIndex >= 0 && uiState.currentMoveIndex < uiState.moveQualities.size) {
                    uiState.moveQualities[uiState.currentMoveIndex]
                } else null

                if (currentQuality != null) {
                    val (text, color, icon) = when (currentQuality) {
                        "!!" -> Triple("Brillante", Color(0xFF10B981), Icons.Default.Star)
                        "!" -> Triple("Genial", Color(0xFF3B82F6), Icons.Default.Star)
                        "" -> Triple("Correcta", Color(0xFF94A3B8), Icons.Default.CheckCircle)
                        "?!" -> Triple("Imprecisión", Color(0xFFFBBF24), Icons.Default.Warning)
                        "?" -> Triple("Error", Color(0xFFF97316), Icons.Outlined.Close)
                        "??" -> Triple("Error Grave", Color(0xFFEF4444), Icons.Default.Close)
                        else -> Triple("Correcta", Color(0xFF94A3B8), Icons.Default.CheckCircle)
                    }

                    Surface(
                        color = color.copy(alpha = 0.15f),
                        modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                        shape = RoundedCornerShape(24.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(0.3f))
                    ) {
                        Row(
                            modifier = Modifier.padding(20.dp).fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                "$currentQuality $text",
                                color = color,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 20.sp
                            )
                        }
                    }
                } else {
                    Spacer(modifier = Modifier.height(72.dp)) // Placeholder
                }

                // Parse the last move to highlight it on the board
                val lastMoveCoords = if (uiState.currentMoveIndex >= 0 && uiState.currentMoveIndex < uiState.moves.size) {
                    val move = uiState.moves[uiState.currentMoveIndex]
                    val startList = move["start"] as List<Long>
                    val endList = move["end"] as List<Long>
                    Pair(
                        Pair(startList[0].toInt(), startList[1].toInt()),
                        Pair(endList[0].toInt(), endList[1].toInt())
                    )
                } else null
                
                val currentQualityColor = if (currentQuality != null) {
                    when (currentQuality) {
                        "📖" -> Color(0xFF8B5CF6) // Purple for Book
                        "!!" -> Color(0xFF10B981) // Green for Brilliant
                        "!" -> Color(0xFF3B82F6) // Blue for Great
                        "" -> Color(0xFF94A3B8)
                        "?!" -> Color(0xFFFBBF24) // Yellowish for Inaccuracy
                        "?" -> Color(0xFFF97316) // Orange for Mistake
                        "??" -> Color(0xFFEF4444) // Red for Blunder
                        else -> Color(0xFF94A3B8)
                    }
                } else null
                
                val currentBestMove = if (uiState.currentMoveIndex >= 0 && uiState.currentMoveIndex < uiState.bestMoves.size) {
                    uiState.bestMoves[uiState.currentMoveIndex]
                } else null
                
                val currentScore = if (uiState.currentMoveIndex + 1 < uiState.scores.size) {
                    uiState.scores[uiState.currentMoveIndex + 1]
                } else if (uiState.scores.isNotEmpty()) uiState.scores.first() else 0

                // Board and Eval Bar Row
                Row(
                    modifier = Modifier.fillMaxWidth().aspectRatio(1f),
                    horizontalArrangement = Arrangement.Center
                ) {
                    EvaluationBar(
                        score = currentScore,
                        isFlipped = uiState.playerColor == PieceColor.BLACK,
                        modifier = Modifier
                            .fillMaxHeight()
                            .width(20.dp)
                            .padding(end = 8.dp)
                            .clip(RoundedCornerShape(4.dp))
                    )

                    // Chess Board
                    ChessBoard(
                        board = uiState.engine.grid,
                        selectedSquare = null,
                        validMoves = emptyList(),
                        lastMove = lastMoveCoords,
                        lastMoveQualityColor = currentQualityColor,
                        bestMove = currentBestMove,
                        isFlipped = uiState.playerColor == PieceColor.BLACK,
                        onSquareClick = { _, _ -> }, // View only
                        modifier = Modifier.fillMaxHeight().aspectRatio(1f)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Navigation Controls
                Row(
                    modifier = Modifier.fillMaxWidth().height(64.dp).padding(top = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Button(
                        onClick = { viewModel.prevMove() },
                        enabled = uiState.currentMoveIndex >= 0,
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(0.1f)),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.weight(1f).fillMaxHeight()
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White)
                        Spacer(Modifier.width(8.dp))
                        Text("ATRÁS", fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = { viewModel.nextMove() },
                        enabled = uiState.currentMoveIndex < uiState.moves.size - 1,
                        colors = ButtonDefaults.buttonColors(containerColor = SkyBlue),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.weight(1f).fillMaxHeight()
                    ) {
                        Text("SIGUIENTE", fontWeight = FontWeight.ExtraBold)
                        Spacer(Modifier.width(8.dp))
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
fun EvaluationBar(score: Int, isFlipped: Boolean, modifier: Modifier = Modifier) {
    // Score is in centipawns. Positive is white advantage.
    // We cap it at +/- 500 for the visual bar (5 pawns)
    val cap = 500f
    val clampedScore = score.toFloat().coerceIn(-cap, cap)
    
    // Calculate percentage (0.0 to 1.0). 0.5 is equal.
    // Sigmoid-like scaling makes smaller differences more visible
    val advantagePercent = (clampedScore + cap) / (2 * cap)
    
    // Invert if black is at the bottom (isFlipped = true)
    // Actually, traditionally White is always at the bottom of the bar if White is playing,
    // but a standard Eval Bar has White on top (if White is filling upwards from bottom).
    // Let's standardise: White bar grows from bottom up logically. 
    val whitePercentage = advantagePercent
    val (topColor, bottomColor) = if (isFlipped) {
        Pair(Color.White, Color.DarkGray) // White on top, Black on bottom
    } else {
        Pair(Color.DarkGray, Color.White) // Black on top, White on bottom
    }
    
    val topWeight = if (isFlipped) whitePercentage else (1f - whitePercentage)
    val bottomWeight = if (isFlipped) (1f - whitePercentage) else whitePercentage

    val displayScore = String.format("%.1f", abs(score) / 100f)
    
    Box(
        modifier = modifier
            .background(Color.DarkGray)
            .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(4.dp))
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(if (topWeight > 0f) topWeight else 0.001f)
                    .background(topColor)
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(if (bottomWeight > 0f) bottomWeight else 0.001f)
                    .background(bottomColor)
            )
        }
        
        // Show score text near the middle or at advantage side
        Text(
            text = displayScore,
            color = Color.Gray,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.align(Alignment.Center)
        )
    }
}
