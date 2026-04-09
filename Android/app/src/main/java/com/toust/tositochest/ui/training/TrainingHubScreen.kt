package com.toust.tositochest.ui.training

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.ElectricBolt
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.toust.tositochest.engine.*
import com.toust.tositochest.ui.game.ChessBoard

@Composable
fun TrainingHubScreen(
    onNavigateToExercises: () -> Unit,
    onNavigateToOpenings: () -> Unit,
    onNavigateToChallenges: () -> Unit,
    onNavigateToMasters: () -> Unit
) {
    // Usamos el nombre completo para evitar conflictos con el Composable ChessBoard
    val previewBoard = remember { com.toust.tositochest.engine.ChessBoard().grid }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFF020617), Color(0xFF0F172A), Color(0xFF1E293B))
                )
            )
    ) {
        // Decorative background elements
        Box(
            modifier = Modifier
                .size(400.dp)
                .offset(x = 200.dp, y = (-100).dp)
                .background(Color(0xFF38BDF8).copy(alpha = 0.1f), CircleShape)
                .blur(100.dp)
        )
        Box(
            modifier = Modifier
                .size(300.dp)
                .offset(x = (-150).dp, y = 400.dp)
                .background(Color(0xFF8B5CF6).copy(alpha = 0.1f), CircleShape)
                .blur(80.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp)
        ) {
            Spacer(modifier = Modifier.height(32.dp))
            
            Text(
                text = "Entrenamiento",
                color = Color.White,
                fontSize = 32.sp,
                fontWeight = FontWeight.Black
            )
            Text(
                text = "Mejora tu nivel de juego",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 16.sp
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Main Hub Cards
            TrainingCard(
                title = "Puzzles & Táctica",
                subtitle = "Mejora tu visión táctica",
                icon = Icons.Default.Star,
                gradientColors = listOf(Color(0xFFFBBF24), Color(0xFFD97706)),
                boardPreview = previewBoard,
                onClick = onNavigateToExercises
            )

            Spacer(modifier = Modifier.height(20.dp))

            TrainingCard(
                title = "Aperturas Maestras",
                subtitle = "Domina el juego temprano",
                icon = Icons.AutoMirrored.Filled.MenuBook,
                gradientColors = listOf(Color(0xFF38BDF8), Color(0xFF0284C7)),
                boardPreview = previewBoard,
                onClick = onNavigateToOpenings
            )

            Spacer(modifier = Modifier.height(20.dp))

            TrainingCard(
                title = "Retos Diarios",
                subtitle = "Resistencia y Velocidad",
                icon = Icons.Filled.ElectricBolt,
                gradientColors = listOf(Color(0xFFF43F5E), Color(0xFFBE123C)),
                boardPreview = previewBoard,
                onClick = onNavigateToChallenges
            )

            Spacer(modifier = Modifier.height(20.dp))

            TrainingCard(
                title = "Galería de Maestros",
                subtitle = "Estudia a las Leyendas",
                icon = Icons.Default.EmojiEvents,
                gradientColors = listOf(Color(0xFF8B5CF6), Color(0xFF6D28D9)),
                boardPreview = previewBoard,
                onClick = onNavigateToMasters
            )

            Spacer(modifier = Modifier.height(40.dp))

            // Stats or Achievement Section
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White.copy(alpha = 0.05f),
                shape = RoundedCornerShape(24.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Row(
                    modifier = Modifier.padding(24.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .background(Color(0xFF10B981).copy(alpha = 0.2f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Filled.EmojiEvents, contentDescription = null, tint = Color(0xFF10B981))
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text(
                            text = "Progreso Sugerido",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Completa tu racha hoy",
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 14.sp
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun TrainingCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    gradientColors: List<Color>,
    boardPreview: Array<Array<com.toust.tositochest.engine.ChessPiece?>>,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(160.dp),
        color = Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(24.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Visual accent/icon area (Mini Board Preview)
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(130.dp)
                    .background(
                        brush = Brush.verticalGradient(colors = gradientColors),
                        alpha = 0.2f
                    )
                    .padding(12.dp)
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.2f))
                ) {
                    ChessBoard(
                        board = boardPreview,
                        selectedSquare = null,
                        validMoves = emptyList(),
                        onSquareClick = { _, _ -> },
                        isMini = true,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                
                // Icon Overlay
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .offset(x = (-4).dp, y = (-4).dp)
                        .background(Brush.verticalGradient(gradientColors), CircleShape)
                        .align(Alignment.TopStart),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, null, tint = Color.White, modifier = Modifier.size(18.dp))
                }
            }

            Column(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .weight(1f)
            ) {
                Text(
                    text = title,
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = subtitle,
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 14.sp
                )
            }
            
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.3f),
                modifier = Modifier.padding(end = 16.dp)
            )
        }
    }
}
