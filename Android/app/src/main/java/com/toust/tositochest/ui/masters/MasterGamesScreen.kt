package com.toust.tositochest.ui.masters

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
fun MasterGamesScreen(
    viewModel: MasterGamesViewModel = viewModel(),
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
        // Background Glow
        Box(
            modifier = Modifier
                .size(350.dp)
                .offset(x = 150.dp, y = (-50).dp)
                .background(Color(0xFF8B5CF6).copy(alpha = 0.1f), CircleShape)
                .blur(90.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 48.dp)
        ) {
            // Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = {
                    when {
                        uiState.selectedGame != null -> viewModel.deselectMaster() // Vuelve a la lista de partidas
                        uiState.selectedMaster != null -> viewModel.deselectMaster() // Vuelve a la lista de maestros
                        else -> onBack()
                    }
                }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = Color.White)
                }
                Text(
                    text = when {
                        uiState.selectedGame != null -> "Visor Histórico"
                        uiState.selectedMaster != null -> uiState.selectedMaster?.name ?: "Partidas"
                        else -> "Galería de Maestros"
                    },
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (uiState.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFF8B5CF6))
                }
            } else if (uiState.error != null) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(64.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        "Problemas de Conexión",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        if (uiState.error!!.contains("Quota")) "Límite de cuota diaria de Google alcanzado. Por favor, vuelve a intentarlo mañana." 
                        else uiState.error!!,
                        color = Color.White.copy(alpha = 0.6f),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                    Button(
                        onClick = { viewModel.loadMasters() },
                        modifier = Modifier.padding(top = 24.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8B5CF6))
                    ) {
                        Text("Reintentar")
                    }
                }
            } else if (uiState.selectedGame != null) {
                GameViewerView(uiState, viewModel)
            } else if (uiState.selectedMaster != null) {
                MasterGamesListView(uiState.masterGames, onGameClick = { game ->
                    viewModel.selectGame(game)
                })
            } else {
                MastersListView(uiState.masters, onMasterClick = { viewModel.selectMaster(it) })
            }
        }
    }
}

@Composable
fun MastersListView(masters: List<MasterPreview>, onMasterClick: (MasterPreview) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(masters) { master ->
            Surface(
                onClick = { onMasterClick(master) },
                color = Color.White.copy(alpha = 0.05f),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth(),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(50.dp)
                            .background(Color(0xFF38BDF8).copy(alpha = 0.05f), CircleShape)
                            .border(1.dp, Color(0xFF38BDF8).copy(0.2f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("♟", color = Color(0xFF38BDF8), fontSize = 24.sp)
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(master.name, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Text("Ver partidas inmortales", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                    }
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = Color.Gray)
                }
            }
        }
    }
}

@Composable
fun MasterGamesListView(games: List<Pair<String, GameData>>, onGameClick: (GameData) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(games) { (_, game) ->
            Surface(
                onClick = { onGameClick(game) },
                color = Color.White.copy(alpha = 0.05f),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    val displayDate = if (game.date.contains("?") || game.date.isEmpty()) "Fecha desconocida" else game.date
                    val displayResult = if (game.result == "*") "En curso / ?" else game.result
                    val displayEvent = if (game.event == "?" || game.event.isEmpty()) "Torneo / Evento Desconocido" else game.event

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(displayDate, color = Color(0xFF38BDF8), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text(displayResult, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("${game.white} vs ${game.black}", color = Color.White, fontWeight = FontWeight.Bold)
                    Text(displayEvent, color = Color.White.copy(alpha = 0.4f), fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
fun GameViewerView(uiState: MastersUiState, viewModel: MasterGamesViewModel) {
    val game = uiState.selectedGame!!
    val currentFen = if (uiState.currentFenIndex == 0) "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" 
                    else uiState.calculatedFens[uiState.currentFenIndex - 1]
    
    // Usamos ChessBoard (logica) para parsear el FEN con ruta completa para evitar conflicto con UI
    val board = remember(currentFen) { 
        com.toust.tositochest.engine.ChessBoard().apply { loadFen(currentFen) }.grid 
    }

    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.05f)),
            shape = RoundedCornerShape(16.dp)
        ) {
            val displayEvent = if (game.event == "?" || game.event.isEmpty()) "Evento Desconocido" else game.event
            val displayDate = if (game.date.contains("?") || game.date.isEmpty()) "" else "(${game.date})"
            
            Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("${game.white} vs ${game.black}", color = Color.White, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text("$displayEvent $displayDate", color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
            }
        }
        
        Spacer(modifier = Modifier.height(20.dp))

        Box(modifier = Modifier.fillMaxWidth().aspectRatio(1f)) {
            ChessBoard(
                board = board,
                selectedSquare = null,
                validMoves = emptyList(),
                onSquareClick = { _, _ -> },
                modifier = Modifier.fillMaxSize()
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { viewModel.prevMove() },
                enabled = uiState.currentFenIndex > 0,
                modifier = Modifier.size(56.dp).background(Color.White.copy(alpha = 0.1f), CircleShape)
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White)
            }
            
            Text(
                text = if (uiState.currentFenIndex == 0) "Inicio" else "Jugada ${uiState.currentFenIndex}",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )

            IconButton(
                onClick = { viewModel.nextMove() },
                enabled = uiState.currentFenIndex < uiState.calculatedFens.size,
                modifier = Modifier.size(56.dp).background(Color(0xFF38BDF8).copy(alpha = 0.2f), CircleShape)
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = Color(0xFF38BDF8))
            }
        }
        
        Spacer(modifier = Modifier.height(20.dp))
        
        Text(
            text = "Estudia la técnica de los grandes maestros paso a paso.",
            color = Color.White.copy(alpha = 0.4f),
            fontSize = 12.sp,
            textAlign = TextAlign.Center
        )
    }
}
