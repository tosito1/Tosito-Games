package com.toust.tositochest.ui.challenges

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ElectricBolt
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.toust.tositochest.ui.game.ChessBoard
import com.toust.tositochest.engine.*

@Composable
fun SurvivalModeScreen(
    viewModel: ChallengeViewModel = viewModel(),
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFF020617), Color(0xFF0F172A), Color(0xFF1E293B))
                )
            )
    ) {
        // Decorative background
        Box(
            modifier = Modifier
                .size(300.dp)
                .offset(x = 150.dp, y = (-50).dp)
                .background(Color(0xFFF43F5E).copy(alpha = 0.1f), CircleShape)
                .blur(80.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 48.dp, start = 16.dp, end = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Atrás", tint = Color.White)
                }
                Text(
                    text = "Modo Supervivencia",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Streak Counter
            Surface(
                color = Color.White.copy(alpha = 0.05f),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.padding(bottom = 24.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.ElectricBolt, contentDescription = null, tint = Color(0xFFFBBF24), modifier = Modifier.size(32.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = uiState.streak.toString(),
                            color = Color.White,
                            fontSize = 36.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = "RACHA ACTUAL",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.width(24.dp))
                    VerticalDivider(modifier = Modifier.height(40.dp), color = Color.White.copy(alpha = 0.1f))
                    Spacer(modifier = Modifier.width(24.dp))
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = uiState.bestStreak.toString(),
                            color = Color(0xFF10B981),
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "MEJOR",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // The Board
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.1f)),
                shadowElevation = 12.dp
            ) {
                Box(contentAlignment = Alignment.Center) {
                    ChessBoard(
                        board = uiState.board,
                        selectedSquare = uiState.selectedSquare,
                        validMoves = uiState.validMoves,
                        lastMove = uiState.lastMove,
                        onSquareClick = { r, c -> viewModel.onSquareClicked(r, c) },
                        modifier = Modifier.fillMaxSize()
                    )
                    
                    if (uiState.isLoading) {
                        Box(
                            modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = Color(0xFF38BDF8))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Feedback / Game Over
            AnimatedVisibility(
                visible = uiState.feedbackMessage != null,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                Surface(
                    color = if (uiState.isGameOver) Color(0xFFEF4444).copy(alpha = 0.2f) else Color(0xFF10B981).copy(alpha = 0.2f),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (uiState.isGameOver) Color(0xFFEF4444) else Color(0xFF10B981))
                ) {
                    Text(
                        text = uiState.feedbackMessage ?: "",
                        color = Color.White,
                        modifier = Modifier.padding(16.dp),
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            if (uiState.isGameOver) {
                Button(
                    onClick = { viewModel.startNewChallenge() },
                    modifier = Modifier.fillMaxWidth().height(64.dp).padding(bottom = 16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF38BDF8)),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null)
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("REINTENTAR", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                }
            }
        }
        
        // Success Overlay (Brief)
        if (uiState.feedbackMessage?.contains("¡Excelente!") == true) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    color = Color(0xFF10B981).copy(alpha = 0.8f),
                    shape = CircleShape,
                    modifier = Modifier.size(120.dp)
                ) {
                    Icon(
                        Icons.Default.EmojiEvents, 
                        contentDescription = null, 
                        tint = Color.White, 
                        modifier = Modifier.padding(24.dp)
                    )
                }
            }
        }
    }
}
