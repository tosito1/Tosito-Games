package com.toust.tositochest.ui.lobby

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.toust.tositochest.ui.theme.AmberGold
import com.toust.tositochest.ui.theme.DeepIndigo
import com.toust.tositochest.ui.theme.EmeraldGreen
import com.toust.tositochest.ui.theme.SkyBlue
import com.toust.tositochest.ui.theme.SoftRose

@Composable
fun LobbyScreen(
    viewModel: LobbyViewModel = viewModel(),
    onStartGame: (String) -> Unit,
    onAdminClick: () -> Unit,
    onMastersClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var joinCode by remember { mutableStateOf("") }

    LaunchedEffect(uiState.roomCreatedId) {
        uiState.roomCreatedId?.let { roomId ->
            onStartGame(roomId)
            viewModel.resetRoomCreated()
        }
    }

    Scaffold(
        containerColor = Color.Transparent, // El fondo MeshBackground se ve detrás
        floatingActionButton = {
            if (uiState.selectedTab == 0) {
                ExtendedFloatingActionButton(
                    onClick = { viewModel.createRoom() },
                    containerColor = AmberGold,
                    contentColor = DeepIndigo,
                    shape = RoundedCornerShape(24.dp),
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("NUEVA PARTIDA", fontWeight = FontWeight.ExtraBold) },
                    elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 8.dp)
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // --- HEADER / PROFILE CARD ---
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
                    .background(Color.White.copy(0.05f), RoundedCornerShape(24.dp))
                    .border(BorderStroke(1.dp, Color.White.copy(0.1f)), RoundedCornerShape(24.dp))
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            modifier = Modifier.size(56.dp),
                            shape = CircleShape,
                            color = SkyBlue.copy(0.2f),
                            border = BorderStroke(2.dp, SkyBlue)
                        ) {
                            Icon(
                                imageVector = Icons.Default.AccountCircle,
                                contentDescription = null,
                                tint = SkyBlue,
                                modifier = Modifier.padding(8.dp)
                            )
                        }
                        Spacer(Modifier.width(16.dp))
                        Column {
                            Text(
                                text = "¡Hola, Maestro!",
                                color = Color.White.copy(0.7f),
                                fontSize = 14.sp
                            )
                            Text(
                                text = "Tosito Chess",
                                color = Color.White,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                    
                    Row {
                        IconButton(
                            onClick = onMastersClick,
                            modifier = Modifier.background(SkyBlue.copy(0.1f), CircleShape)
                        ) {
                            Icon(Icons.Default.EmojiEvents, null, tint = SkyBlue)
                        }
                        if (uiState.isAdmin) {
                            Spacer(Modifier.width(8.dp))
                            IconButton(
                                onClick = onAdminClick,
                                modifier = Modifier.background(AmberGold.copy(0.1f), CircleShape)
                            ) {
                                Icon(Icons.Default.Settings, null, tint = AmberGold)
                            }
                        }
                    }
                }
            }

            // --- NAVIGATION TABS ---
            Row(
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .fillMaxWidth()
                    .height(56.dp)
                    .background(Color.Black.copy(0.2f), CircleShape)
                    .padding(4.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                val tabs = listOf(
                    Triple(0, "Mundo", Icons.Default.Public),
                    Triple(1, "Bot", Icons.Default.SmartToy),
                    Triple(2, "Historial", Icons.Default.History)
                )
                
                tabs.forEach { (index, label, icon) ->
                    val isSelected = uiState.selectedTab == index
                    val animColor by animateColorAsState(if (isSelected) DeepIndigo else Color.White.copy(0.5f))
                    val animBg by animateColorAsState(if (isSelected) SkyBlue else Color.Transparent)

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .background(animBg, CircleShape)
                            .clickable { viewModel.onTabSelected(index) },
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(icon, null, tint = animColor, modifier = Modifier.size(18.dp))
                            if (isSelected) {
                                Spacer(Modifier.width(8.dp))
                                Text(label, color = animColor, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }

            // --- CONTENT AREA WITH TRANSITIONS ---
            AnimatedContent(
                targetState = uiState.selectedTab,
                transitionSpec = {
                    if (targetState > initialState) {
                        slideInHorizontally { it } + fadeIn() togetherWith slideOutHorizontally { -it } + fadeOut()
                    } else {
                        slideInHorizontally { -it } + fadeIn() togetherWith slideOutHorizontally { it } + fadeOut()
                    }.using(SizeTransform(clip = false))
                },
                label = "TabContent"
            ) { targetTab ->
                Column(modifier = Modifier.fillMaxSize()) {
                    when (targetTab) {
                        0 -> OnlineTab(uiState, viewModel, joinCode, onJoinCodeChange = { joinCode = it })
                        1 -> AiTab(uiState, viewModel)
                        2 -> HistoryTab(uiState)
                    }
                }
            }
        }
    }
}

@Composable
fun OnlineTab(uiState: LobbyUiState, viewModel: LobbyViewModel, joinCode: String, onJoinCodeChange: (String) -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        // Migration Panel (Glass Version)
        if (uiState.isAdmin) {
            AdminPanel(viewModel, uiState.isMigrating)
            Spacer(Modifier.height(16.dp))
        }

        Text("Unirse a una sala", color = Color.White, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 12.dp))
        
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = joinCode,
                onValueChange = { onJoinCodeChange(it.uppercase()) },
                placeholder = { Text("CÓDIGO", color = Color.White.copy(0.3f)) },
                modifier = Modifier.weight(1f).height(56.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = SkyBlue,
                    unfocusedBorderColor = Color.White.copy(0.1f),
                    focusedTextColor = Color.White
                ),
                shape = RoundedCornerShape(16.dp),
                singleLine = true
            )
            Spacer(Modifier.width(12.dp))
            Button(
                onClick = { if (joinCode.length == 6) viewModel.joinRoom(joinCode) },
                enabled = joinCode.length == 6 && !uiState.isLoading,
                modifier = Modifier.height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SkyBlue),
                shape = RoundedCornerShape(16.dp)
            ) {
                Text("ENTRAR", fontWeight = FontWeight.Bold)
            }
        }

        Spacer(Modifier.height(24.dp))
        Text("Salas Disponibles", color = Color.White, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 12.dp))
        
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(uiState.rooms) { room ->
                RoomCardPremium(room) { viewModel.joinRoom(room.id) }
            }
            if (uiState.rooms.isEmpty()) {
                item {
                    Text("No hay salas públicas, crea una nueva.", color = Color.White.copy(0.4f), fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
fun AdminPanel(viewModel: LobbyViewModel, isMigrating: Boolean) {
    Surface(
        color = AmberGold.copy(0.1f),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, AmberGold.copy(0.2f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Admin Contenidos", color = AmberGold, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AdminButton("Aperturas", AmberGold) { viewModel.migrateOpenings() }
                AdminButton("Ejercicios", EmeraldGreen) { viewModel.migrateExercises() }
                AdminButton("Maestros", SkyBlue) { viewModel.migrateHistoricalGames() }
            }
        }
    }
}

@Composable
fun AdminButton(label: String, color: Color, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.height(36.dp).clickable { onClick() },
        color = color.copy(0.1f),
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, color.copy(0.3f))
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 12.dp)) {
            Text(label, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun AiTab(uiState: LobbyUiState, viewModel: LobbyViewModel) {
    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 24.dp, end = 24.dp, top = 24.dp, bottom = 120.dp), // Extra bottom padding for floating button
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text("Desafía a la Máquina", color = Color.White, fontWeight = FontWeight.Black, fontSize = 28.sp)
                Text("Escoge tu oponente", color = Color.White.copy(0.4f), modifier = Modifier.padding(bottom = 24.dp))
            }

            val levels = listOf(
                "level_1" to "Mono con Teclado (Muy Fácil)",
                "level_2" to "Principiante Estratega",
                "level_3" to "Aficionado Local",
                "level_4" to "Jugador de Club",
                "level_5" to "Experto (Cuidado ⚠️)",
                "level_6" to "Maestro Local (CPU MAX)",
                "level_pc" to "💻 El Motor de mi PC",
                "level_7" to "Super Computador ☁️ (Cloud AI)",
                "level_8" to "Lichess Stockfish v16 🏆"
            )

            items(levels) { (id, label) ->
                val isSelected = uiState.aiLevel == id
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.setAiLevel(id) },
                    color = if (isSelected) SkyBlue.copy(0.1f) else Color.White.copy(0.04f),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, if (isSelected) SkyBlue else Color.White.copy(0.05f))
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = isSelected,
                            onClick = { viewModel.setAiLevel(id) },
                            colors = RadioButtonDefaults.colors(selectedColor = SkyBlue, unselectedColor = Color.White.copy(0.3f))
                        )
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(
                                text = label.split(" (").first(),
                                color = if (isSelected) Color.White else Color.White.copy(0.8f),
                                fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium
                            )
                            if (label.contains("(")) {
                                Text(
                                    text = "(" + label.split(" (").last(),
                                    color = if (isSelected) SkyBlue else Color.White.copy(0.4f),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }
        }

        // Floating Start Button Wrapper (Glassmorphism effect)
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, DeepIndigo.copy(0.9f)),
                        startY = 0.0f
                    )
                )
                .padding(24.dp)
        ) {
            Button(
                onClick = { viewModel.startAiGame() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .shadow(16.dp, RoundedCornerShape(20.dp), spotColor = EmeraldGreen),
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen),
                shape = RoundedCornerShape(20.dp),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
            ) {
                Text("INICIAR BATALLA 🔥", fontWeight = FontWeight.Black, fontSize = 18.sp, letterSpacing = 1.sp)
            }
        }
    }
}

@Composable
fun HistoryTab(uiState: LobbyUiState) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (uiState.historyGames.isEmpty()) {
            item { Text("Aún no has librado ninguna batalla.", color = Color.White.copy(0.4f)) }
        }
        items(uiState.historyGames) { game ->
            HistoryCardPremium(game)
        }
    }
}

@Composable
fun RoomCardPremium(room: Room, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable { onClick() },
        color = Color.White.copy(0.03f),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Color.White.copy(0.05f))
    ) {
        Row(modifier = Modifier.padding(20.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(room.id, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                Text(room.status.uppercase(), color = SkyBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Icon(Icons.Default.Add, null, tint = SkyBlue)
        }
    }
}

@Composable
fun HistoryGameCard(game: HistoryGame) { /* No se usa, usando Premium */ }

@Composable
fun HistoryCardPremium(game: HistoryGame) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White.copy(0.03f),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Color.White.copy(0.05f))
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(game.date, color = SkyBlue, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text(game.opponent, color = Color.White, fontWeight = FontWeight.Bold)
                Text("${game.moves} jugadas", color = Color.White.copy(0.4f), fontSize = 11.sp)
            }
            Text(game.result, color = if (game.result.contains("Ganó") || game.result.contains("1-")) EmeraldGreen else SoftRose, fontWeight = FontWeight.ExtraBold)
        }
    }
}
