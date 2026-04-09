package com.toust.tositochest.ui.admin

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScreen(
    onBack: () -> Unit,
    onRoomView: (String) -> Unit,
    viewModel: AdminViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { 
                    Text("PANEL DE CONTROL 👑", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color(0xFFFBBF24)) 
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.fetchData() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refrescar", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color.Transparent,
                    titleContentColor = Color.White
                )
            )
        },
        containerColor = Color.Transparent
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(Color(0xFF020617), Color(0xFF0F172A), Color(0xFF1E293B))
                    )
                )
        ) {
            // Decorative Blur
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .offset(x = (-50).dp, y = (100).dp)
                    .background(Color(0xFFFBBF24).copy(alpha = 0.05f), CircleShape)
                    .blur(60.dp)
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
                    contentColor = Color(0xFFFBBF24),
                    divider = @Composable { HorizontalDivider(color = Color.White.copy(alpha = 0.05f)) }
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("USUARIOS", fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.Person, contentDescription = null) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = { Text("SALAS ACTIVAS", fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.List, contentDescription = null) }
                    )
                    Tab(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        text = { Text("APERTURAS", fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.Star, contentDescription = null) }
                    )
                    Tab(
                        selected = selectedTab == 3,
                        onClick = { selectedTab = 3 },
                        text = { Text("EJERCICIOS", fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.Build, contentDescription = null) }
                    )
                }

                if (uiState.isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Color(0xFFFBBF24))
                    }
                } else {
                    // Stats Summary Header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Surface(
                            modifier = Modifier.weight(1f),
                            color = Color.White.copy(alpha = 0.05f),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${uiState.totalUsers}", color = Color(0xFFFBBF24), fontSize = 24.sp, fontWeight = FontWeight.Black)
                                Text("USUARIOS", color = Color.White.copy(alpha = 0.4f), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Surface(
                            modifier = Modifier.weight(1f),
                            color = Color.White.copy(alpha = 0.05f),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${uiState.totalActiveRooms}", color = Color(0xFF38BDF8), fontSize = 24.sp, fontWeight = FontWeight.Black)
                                Text("SALAS", color = Color.White.copy(alpha = 0.4f), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    if (selectedTab == 1 && uiState.rooms.isNotEmpty()) {
                        Button(
                            onClick = { viewModel.deleteAllRooms() },
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444).copy(alpha = 0.1f)),
                            border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.3f)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("CERRAR TODAS LAS SALAS", color = Color(0xFFEF4444), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        if (selectedTab == 0) {
                            items(uiState.users) { user ->
                                UserCard(
                                    user = user, 
                                    onRoleToggle = { viewModel.updateUserRole(user.uid, user.role) },
                                    onResetStats = { viewModel.resetUserStats(user.uid) },
                                    onDeleteHistory = { viewModel.deleteUserHistory(user.uid) }
                                )
                            }
                        } else if (selectedTab == 1) {
                            if (uiState.rooms.isEmpty()) {
                                item { Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { Text("No hay salas activas.", color = Color.White.copy(alpha = 0.3f)) } }
                            } else {
                                items(uiState.rooms) { room -> RoomCard(room = room, onView = { onRoomView(room.id) }, onDelete = { viewModel.deleteRoom(room.id) }) }
                            }
                        } else if (selectedTab == 2) {
                            item { AddOpeningForm(onAdd = { n, e, d, ml, ms -> viewModel.addOpening(n, e, d, ml, ms) }) }
                            items(uiState.openings) { op ->
                                OpeningAdminCard(op, onDelete = { viewModel.deleteOpening(op.id) })
                            }
                        } else if (selectedTab == 3) {
                            item { AddExerciseForm(onAdd = { t, d, f, s -> viewModel.addExercise(t, d, f, s) }) }
                            items(uiState.exercises) { ex ->
                                ExerciseAdminCard(ex, onDelete = { viewModel.deleteExercise(ex.id) })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun UserCard(user: AdminUser, onRoleToggle: () -> Unit, onResetStats: () -> Unit, onDeleteHistory: () -> Unit) {
    Surface(
        color = Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (user.photoUrl != null) {
                AsyncImage(
                    model = user.photoUrl,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Surface(modifier = Modifier.size(48.dp), shape = CircleShape, color = Color.White.copy(alpha = 0.1f)) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = Color.White.copy(alpha = 0.5f), modifier = Modifier.padding(8.dp))
                }
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(user.displayName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(user.email, color = Color.White.copy(alpha = 0.4f), fontSize = 12.sp)
                Text(
                    text = if (user.role == "admin") "👑 ADMINISTRADOR" else "👤 JUGADOR",
                    color = if (user.role == "admin") Color(0xFFFBBF24) else Color(0xFF38BDF8),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("W: ${user.wins}", color = Color(0xFF10B981), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("L: ${user.losses}", color = Color(0xFFF43F5E), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("T: ${user.totalGames}", color = Color.White.copy(alpha = 0.6f), fontSize = 10.sp)
                }
                
                // Admin Quick Actions
                Row(modifier = Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "RESET",
                        modifier = Modifier.clickable { onResetStats() },
                        color = Color(0xFF38BDF8),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "LIMPIAR HISTORIAL",
                        modifier = Modifier.clickable { onDeleteHistory() },
                        color = Color(0xFFEF4444),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            
            Button(
                onClick = onRoleToggle,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (user.role == "admin") Color(0xFFEF4444).copy(alpha = 0.1f) else Color(0xFFFBBF24).copy(alpha = 0.1f)
                ),
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(1.dp, if (user.role == "admin") Color(0xFFEF4444).copy(alpha = 0.5f) else Color(0xFFFBBF24).copy(alpha = 0.5f))
            ) {
                Text(
                    if (user.role == "admin") "DEGRADAR" else "PROMOVER",
                    color = if (user.role == "admin") Color(0xFFEF4444) else Color(0xFFFBBF24),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun RoomCard(room: AdminRoom, onView: () -> Unit, onDelete: () -> Unit) {
    Surface(
        color = Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (room.id.startsWith("LIVE_IA_")) "PARTIDA CONTRA IA" else "SALA: ${room.id}",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Text(
                    text = "Estado: ${room.status} • Turno: ${room.turn}",
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 12.sp
                )
                Text(
                    text = "B: ${room.white ?: "-"} • N: ${room.black ?: "-"}",
                    color = Color.White.copy(alpha = 0.3f),
                    fontSize = 10.sp
                )
            }
            
            IconButton(
                onClick = onView,
                modifier = Modifier.background(Color(0xFF38BDF8).copy(alpha = 0.1f), CircleShape)
            ) {
                Icon(Icons.Default.List, contentDescription = "Ver Partida", tint = Color(0xFF38BDF8))
            }

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(
                onClick = onDelete,
                modifier = Modifier.background(Color(0xFFEF4444).copy(alpha = 0.1f), CircleShape)
            ) {
                Icon(Icons.Default.Delete, contentDescription = "Cerrar Sala", tint = Color(0xFFEF4444))
            }
        }
    }
}

@Composable
fun OpeningAdminCard(opening: AdminOpening, onDelete: () -> Unit) {
    Surface(color = Color.White.copy(alpha = 0.05f), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(opening.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("ECO: ${opening.eco} • Movimientos: ${opening.moves_san.size}", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
            }
            IconButton(onClick = onDelete, modifier = Modifier.background(Color(0xFFEF4444).copy(alpha = 0.1f), CircleShape)) {
                Icon(Icons.Default.Delete, contentDescription = "Eliminar", tint = Color(0xFFEF4444))
            }
        }
    }
}

@Composable
fun ExerciseAdminCard(exercise: AdminExercise, onDelete: () -> Unit) {
    Surface(color = Color.White.copy(alpha = 0.05f), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(exercise.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("Solución: ${exercise.solution.size} pasos", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
            }
            IconButton(onClick = onDelete, modifier = Modifier.background(Color(0xFFEF4444).copy(alpha = 0.1f), CircleShape)) {
                Icon(Icons.Default.Delete, contentDescription = "Eliminar", tint = Color(0xFFEF4444))
            }
        }
    }
}

@Composable
fun AddOpeningForm(onAdd: (String, String, String, List<String>, List<String>) -> Unit) {
    var name by remember { mutableStateOf("") }
    var eco by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var moves_lan by remember { mutableStateOf("") }
    var moves_san by remember { mutableStateOf("") }

    Surface(color = Color.White.copy(alpha = 0.05f), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("AÑADIR NUEVA APERTURA", color = Color(0xFFFBBF24), fontWeight = FontWeight.Bold, fontSize = 12.sp)
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nombre") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = eco, onValueChange = { eco = it }, label = { Text("ECO (ej. C50)") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Descripción") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = moves_lan, onValueChange = { moves_lan = it }, label = { Text("LAN (ej. e2e4,e7e5)") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = moves_san, onValueChange = { moves_san = it }, label = { Text("SAN (ej. e4,e5)") }, modifier = Modifier.fillMaxWidth())
            
            Button(
                onClick = { 
                    if (name.isNotEmpty() && moves_lan.isNotEmpty()) {
                        onAdd(name, eco, desc, moves_lan.split(",").map{it.trim()}, moves_san.split(",").map{it.trim()})
                        name = ""; eco = ""; desc = ""; moves_lan = ""; moves_san = ""
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
            ) { Text("GUARDAR APERTURA", color = Color.White, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
fun AddExerciseForm(onAdd: (String, String, String, List<String>) -> Unit) {
    var title by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var fen by remember { mutableStateOf("") }
    var solLAN by remember { mutableStateOf("") }

    Surface(color = Color.White.copy(alpha = 0.05f), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("AÑADIR NUEVO EJERCICIO", color = Color(0xFFFBBF24), fontWeight = FontWeight.Bold, fontSize = 12.sp)
            OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Título") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Descripción") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = fen, onValueChange = { fen = it }, label = { Text("FEN Inicial") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = solLAN, onValueChange = { solLAN = it }, label = { Text("Solución LAN (ej. e2e4,e7e5)") }, modifier = Modifier.fillMaxWidth())
            
            Button(
                onClick = { 
                    if (title.isNotEmpty() && fen.isNotEmpty() && solLAN.isNotEmpty()) {
                        onAdd(title, desc, fen.trim(), solLAN.split(",").map{it.trim()})
                        title = ""; desc = ""; fen = ""; solLAN = ""
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF38BDF8))
            ) { Text("GUARDAR EJERCICIO", color = Color.White, fontWeight = FontWeight.Bold) }
        }
    }
}
