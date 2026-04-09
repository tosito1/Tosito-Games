package com.toust.tositochest.ui.exercises

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Star
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
fun ExercisesScreen(
    viewModel: ExercisesViewModel = viewModel(),
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
        // Decorative Blurs
        Box(
            modifier = Modifier
                .size(300.dp)
                .offset(x = (-100).dp, y = (-100).dp)
                .background(Color(0xFF38BDF8).copy(alpha = 0.15f), CircleShape)
                .blur(80.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 48.dp)
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = {
                    if (uiState.selectedExercise != null) {
                        viewModel.resetSelection()
                    } else {
                        onBack()
                    }
                }) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Atrás",
                        tint = Color.White
                    )
                }
                Text(
                    text = if (uiState.selectedExercise != null) "Resolver Ejercicio" else "Ejercicios de Ajedrez",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (uiState.selectedExercise == null) {
                if (uiState.isLoadingLichess) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = Color(0xFF38BDF8))
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Cargando tablero FEN...", color = Color.White)
                        }
                    }
                } else {
                    // List of Exercises
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        item {
                            // Lichess Puzzle Buttons
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Button(
                                    onClick = { viewModel.loadDailyLichessPuzzle() },
                                    modifier = Modifier.weight(1f).height(64.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFBBF24)),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text("Diario", color = Color.Black, fontWeight = FontWeight.Black, fontSize = 16.sp)
                                        Text("Lichess Puzzles", color = Color.Black.copy(alpha = 0.7f), fontSize = 10.sp)
                                    }
                                }

                                Button(
                                    onClick = { viewModel.loadRandomLichessPuzzle() },
                                    modifier = Modifier.weight(1f).height(64.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8B5CF6)),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text("Aleatorio ☁️", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                        Text("Práctica Infinita", color = Color.White.copy(alpha = 0.7f), fontSize = 10.sp)
                                    }
                                }
                            }
                        }

                        if (uiState.exercises.isEmpty()) {
                        item {
                            Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                                Text("No hay ejercicios disponibles aún.", color = Color.White.copy(alpha = 0.5f))
                            }
                        }
                    }
                    items(uiState.exercises) { exercise ->
                        ExerciseCard(exercise = exercise, onClick = { viewModel.selectExercise(exercise) })
                    }
                }
            }
        } else {
            // Exercise Detail View
                val exercise = uiState.selectedExercise!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = exercise.title,
                        color = Color(0xFF38BDF8),
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Text(
                        text = exercise.description,
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )

                    // The Board
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                    ) {
                        ChessBoard(
                            board = uiState.board,
                            selectedSquare = uiState.selectedSquare,
                            validMoves = uiState.validMoves,
                            lastMove = uiState.lastMove,
                            onSquareClick = { r, c -> viewModel.onSquareClicked(r, c) },
                            isFlipped = false,
                            hintMove = null,
                            isCustomBoard = false,
                            modifier = Modifier.fillMaxSize()
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    val message = uiState.feedbackMessage
                    if (message != null) {
                        Surface(
                            color = when {
                                uiState.isCompleted -> Color(0xFF10B981).copy(alpha = 0.2f)
                                message.contains("incorrecto") -> Color(0xFFEF4444).copy(alpha = 0.2f)
                                else -> Color(0xFF38BDF8).copy(alpha = 0.2f)
                            },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.padding(16.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp, 
                                when {
                                    uiState.isCompleted -> Color(0xFF10B981)
                                    message.contains("incorrecto") -> Color(0xFFEF4444)
                                    else -> Color(0xFF38BDF8)
                                }
                            )
                        ) {
                            Text(
                                text = message,
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    } else if (!uiState.isCompleted) {
                        Text(
                            text = "Encuentra el mejor movimiento",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 16.sp,
                            modifier = Modifier.padding(16.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (uiState.isCompleted) {
                        Button(
                            onClick = { viewModel.resetSelection() },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("SIGUIENTE EJERCICIO", color = Color.White, fontWeight = FontWeight.ExtraBold)
                        }
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            IconButton(
                                onClick = { viewModel.resetExercise() },
                                modifier = Modifier
                                    .background(Color.White.copy(alpha = 0.1f), CircleShape)
                                    .size(56.dp)
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = "Reiniciar", tint = Color.White)
                            }
                            
                            // Potential Hint button could go here
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ExerciseCard(exercise: ChessExercise, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(50.dp)
                    .background(Color(0xFF38BDF8).copy(alpha = 0.2f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFF38BDF8))
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = exercise.title,
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = exercise.description,
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp,
                    maxLines = 1
                )
            }
            
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.3f)
            )
        }
    }
}
