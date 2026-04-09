package com.toust.tositochest.ui.game

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.OutlinedFlag
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.Divider
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import com.toust.tositochest.ui.theme.SkyBlue
import com.toust.tositochest.ui.theme.AmberGold
import com.toust.tositochest.ui.theme.EmeraldGreen
import com.toust.tositochest.ui.theme.SoftRose
import com.toust.tositochest.ui.theme.DeepIndigo
import com.toust.tositochest.ui.game.ChessBoard
import com.toust.tositochest.ui.game.PromotionDialog

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameScreen(
    gameId: String,
    onBack: () -> Unit,
    onReviewClick: (String) -> Unit = {},
    viewModel: GameViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(gameId) {
        viewModel.initGame(gameId)
    }
    
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var showResignDialog by remember { mutableStateOf(false) }
    var gameName by remember { mutableStateOf("") }

    // Dialogs with Glassmorphism
    if (showResignDialog) {
        AlertDialog(
            onDismissRequest = { showResignDialog = false },
            title = { Text("¿Abandonar Partida?", color = Color.White, fontWeight = FontWeight.Bold) },
            text = { Text("¿Estás seguro de que quieres rendirte? El oponente ganará automáticamente.", color = Color.White.copy(alpha = 0.7f)) },
            containerColor = DeepIndigo.copy(0.9f),
            shape = RoundedCornerShape(24.dp),
            confirmButton = {
                TextButton(onClick = { 
                    viewModel.resignGame()
                    showResignDialog = false 
                    onBack()
                }) {
                    Text("ABANDONAR", color = SoftRose, fontWeight = FontWeight.ExtraBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResignDialog = false }) {
                    Text("CANCELAR", color = Color.White.copy(alpha = 0.5f))
                }
            }
        )
    }

    if (uiState.winner != null) {
        // ... (Similar styling for Game Over Dialog)
        AlertDialog(
            onDismissRequest = onBack,
            title = { Text(if (uiState.winner == "Tablas") "¡Empate!" else "¡Ganan las ${uiState.winner}!", color = AmberGold, fontWeight = FontWeight.ExtraBold) },
            text = { 
                Column {
                    val eloText = if (uiState.eloChange != null) {
                        val prefix = if (uiState.eloChange!! >= 0) "+" else ""
                        "Variación de Elo: $prefix${uiState.eloChange}"
                    } else ""
                    Text("La partida ha terminado en esta sala.\n$eloText", color = Color.White.copy(alpha = 0.8f))
                    Spacer(modifier = Modifier.height(16.dp))
                    androidx.compose.material3.OutlinedTextField(
                        value = gameName,
                        onValueChange = { gameName = it },
                        label = { Text("Nombre de la Partida", color = Color.White.copy(alpha=0.5f)) },
                        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = SkyBlue
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            containerColor = DeepIndigo.copy(0.95f),
            shape = RoundedCornerShape(28.dp),
            confirmButton = {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    TextButton(onClick = { 
                        if (gameName.isNotBlank()) viewModel.updateGameName(gameName)
                        onBack()
                    }) {
                        Text("FINALIZAR", color = Color.White.copy(alpha=0.5f))
                    }
                    Button(
                        onClick = { 
                            if (gameName.isNotBlank()) viewModel.updateGameName(gameName)
                            uiState.historyDocId?.let { onReviewClick(it) }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = SkyBlue)
                    ) {
                        Text("REVISAR JUGADAS", fontWeight = FontWeight.Bold)
                    }
                }
            }
        )
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = DeepIndigo.copy(alpha = 0.95f),
                modifier = Modifier.width(320.dp)
            ) {
                // ... (Estilo premium para el cajón lateral)
                Column(modifier = Modifier.padding(24.dp)) {
                    Text("ESTRATEGIA", color = SkyBlue, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp)
                    Spacer(Modifier.height(32.dp))
                    
                    AdminToggle(label = "Tablero Clásico", isEnabled = uiState.isCustomBoard, onToggle = { viewModel.toggleBoardTheme() })
                    
                    if (uiState.isAdmin) {
                        Divider(color = Color.White.copy(0.1f), modifier = Modifier.padding(vertical = 16.dp))
                        Text("ADMINISTRACIÓN", color = AmberGold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(16.dp))
                        AdminToggle(label = "Modo Dios", isEnabled = uiState.godMode, onToggle = { viewModel.toggleGodMode() })
                        AdminToggle(label = "Pistas IA", isEnabled = uiState.isHintEnabled, onToggle = { viewModel.toggleHintEnabled() })
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = { viewModel.undoLastMove() }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = AmberGold), shape = RoundedCornerShape(12.dp)) {
                            Text("DESHACER JUGADA", color = DeepIndigo, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    ) {
        Scaffold(
            topBar = {
                CenterAlignedTopAppBar(
                    title = { 
                        Surface(color = Color.White.copy(0.1f), shape = RoundedCornerShape(12.dp)) {
                            Text("SALA #${uiState.gameId.take(6)}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, null, tint = Color.White)
                        }
                    },
                    actions = {
                        if (uiState.status == "playing" && uiState.myColor != null) {
                            IconButton(onClick = { showResignDialog = true }) {
                                Icon(Icons.Default.OutlinedFlag, null, tint = SoftRose)
                            }
                        }
                    },
                    colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = Color.Transparent)
                )
            },
            containerColor = Color.Transparent
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Tablero con sombra premium
                Box(modifier = Modifier.shadow(32.dp, RoundedCornerShape(16.dp))) {
                    ChessBoard(
                        board = uiState.board,
                        selectedSquare = uiState.selectedSquare,
                        validMoves = uiState.validMoves,
                        lastMove = uiState.lastMove,
                        isFlipped = uiState.isFlipped,
                        onSquareClick = viewModel::onSquareClicked,
                        hintMove = uiState.hintMove,
                        premove = uiState.premove,
                        isCustomBoard = uiState.isCustomBoard,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                
                if (uiState.showPromotionDialog) {
                    PromotionDialog(color = uiState.turn, onSelect = { viewModel.promotePawn(it) })
                }
                
                Spacer(modifier = Modifier.height(32.dp))

                // Timers con efecto CRONÓMETRO PREMIUM
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    TimerWidget(
                        label = "Blanco",
                        timeMs = uiState.whiteTimeRemaining,
                        isActive = uiState.turn == com.toust.tositochest.engine.PieceColor.WHITE && uiState.status == "playing",
                        color = SkyBlue,
                        modifier = Modifier.weight(1f)
                    )
                    TimerWidget(
                        label = "Negro",
                        timeMs = uiState.blackTimeRemaining,
                        isActive = uiState.turn == com.toust.tositochest.engine.PieceColor.BLACK && uiState.status == "playing",
                        color = AmberGold,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Badge de Turno
                Surface(
                    color = (if (uiState.turn == com.toust.tositochest.engine.PieceColor.WHITE) SkyBlue else AmberGold).copy(0.1f),
                    shape = CircleShape,
                    border = BorderStroke(1.dp, (if (uiState.turn == com.toust.tositochest.engine.PieceColor.WHITE) SkyBlue else AmberGold).copy(0.4f))
                ) {
                    Text(
                        text = if (uiState.turn == com.toust.tositochest.engine.PieceColor.WHITE) "TURNO BLANCAS ♖" else "TURNO NEGRAS ♜",
                        color = if (uiState.turn == com.toust.tositochest.engine.PieceColor.WHITE) SkyBlue else AmberGold,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                        letterSpacing = 2.sp
                    )
                }

                if (uiState.isCheck) {
                    Spacer(Modifier.height(16.dp))
                    Text("¡JAQUE!", color = SoftRose, fontSize = 28.sp, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
fun TimerWidget(label: String, timeMs: Long, isActive: Boolean, color: Color, modifier: Modifier = Modifier) {
    val minutes = (timeMs / 1000) / 60
    val seconds = (timeMs / 1000) % 60
    val timeStr = String.format("%02d:%02d", minutes, seconds)
    
    Surface(
        color = if (isActive) Color.White.copy(0.1f) else Color.Black.copy(0.2f),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(2.dp, if (isActive) color else Color.White.copy(0.05f)),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label.uppercase(), color = if (isActive) color else Color.White.copy(0.4f), fontWeight = FontWeight.Bold, fontSize = 10.sp)
            Text(timeStr, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
        }
    }
}

@Composable
fun AdminToggle(label: String, isEnabled: Boolean, onToggle: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = Color.White, fontSize = 16.sp)
        Switch(
            checked = isEnabled,
            onCheckedChange = { onToggle() },
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color(0xFFFBBF24),
                checkedTrackColor = Color(0xFFFBBF24).copy(alpha = 0.5f)
            )
        )
    }
}

@Composable
fun AdminButton(label: String, icon: ImageVector, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF38BDF8))
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(label)
    }
}

@Composable
fun AdminEngineSelector(selectedEngine: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text("Fuente Pistas", color = Color.White, fontSize = 16.sp)
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF0F172A)),
            horizontalArrangement = Arrangement.End
        ) {
            val isSF = selectedEngine == "level_7"
            Box(
                modifier = Modifier
                    .background(if (isSF) Color(0xFFFBBF24) else Color.Transparent)
                    .clickable { onSelect("level_7") }
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text("SF18", color = if (isSF) Color.Black else Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Box(
                modifier = Modifier
                    .background(if (!isSF) Color(0xFF8B5CF6) else Color.Transparent)
                    .clickable { onSelect("level_8") }
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text("Lichess", color = if (!isSF) Color.White else Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
