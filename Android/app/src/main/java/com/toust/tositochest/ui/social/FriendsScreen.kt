package com.toust.tositochest.ui.social

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendsScreen(
    onBack: () -> Unit,
    onNavigateToGame: (String) -> Unit,
    viewModel: SocialViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var usernameInput by remember { mutableStateOf("") }
    var selectedTab by remember { mutableIntStateOf(0) }
    var showTokenDialog by remember { mutableStateOf(false) }
    var showCreateChallengeDialog by remember { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    if (showTokenDialog) {
        LichessTokenDialog(
            initialToken = uiState.lichessToken ?: "",
            onDismiss = { showTokenDialog = false },
            onConfirm = { 
                viewModel.updateLichessToken(it)
                showTokenDialog = false
            }
        )
    }

    if (showCreateChallengeDialog) {
        CreateLichessChallengeDialog(
            onDismiss = { showCreateChallengeDialog = false },
            onConfirm = { username ->
                viewModel.createLichessChallenge(username)
                showCreateChallengeDialog = false
            }
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("COMUNIDAD 👥", fontSize = 18.sp, fontWeight = FontWeight.Black) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { showTokenDialog = true }) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Configurar Lichess",
                            tint = if (uiState.lichessToken != null) Color(0xFF38BDF8) else Color.White
                        )
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
                    .size(250.dp)
                    .offset(x = 200.dp, y = 100.dp)
                    .background(Color(0xFF10B981).copy(alpha = 0.05f), CircleShape)
                    .blur(70.dp)
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(horizontal = 24.dp)
            ) {
                // Add Friend Section
                OutlinedTextField(
                    value = usernameInput,
                    onValueChange = { usernameInput = it },
                    placeholder = { Text("Nombre de usuario (@usuario)", color = Color.White.copy(alpha = 0.3f)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF38BDF8),
                        unfocusedBorderColor = Color.White.copy(alpha = 0.1f),
                        cursorColor = Color(0xFF38BDF8)
                    ),
                    trailingIcon = {
                        IconButton(onClick = { 
                            if (usernameInput.isNotBlank()) {
                                viewModel.sendFriendRequest(usernameInput)
                                usernameInput = ""
                            }
                        }) {
                            Icon(Icons.Default.Add, contentDescription = "Añadir", tint = Color(0xFF38BDF8))
                        }
                    },
                    leadingIcon = {
                        Icon(Icons.Default.Person, contentDescription = null, tint = Color.White.copy(alpha = 0.3f))
                    }
                )

                Spacer(modifier = Modifier.height(24.dp))

                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
                    contentColor = Color(0xFF38BDF8),
                    divider = {}
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("AMIGOS", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = { 
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("SOLICITUDES", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                if (uiState.incomingRequests.isNotEmpty()) {
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Badge(containerColor = Color(0xFFEF4444)) { Text(uiState.incomingRequests.size.toString()) }
                                }
                            }
                        }
                    )
                    Tab(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        text = { 
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("RETOS", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                if (uiState.challenges.isNotEmpty() || uiState.lichessChallenges.isNotEmpty()) {
                                    Spacer(modifier = Modifier.width(4.dp))
                                    val count = uiState.challenges.size + uiState.lichessChallenges.count { it.direction == "in" }
                                    Badge(containerColor = Color(0xFF10B981)) { Text(count.toString()) }
                                }
                            }
                        }
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                if (uiState.isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Color(0xFF38BDF8))
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        when (selectedTab) {
                            0 -> {
                                if (uiState.friends.isEmpty()) {
                                    item { EmptySocialView("Aún no tienes amigos agregados.") }
                                } else {
                                    items(uiState.friends) { friend ->
                                        FriendCard(friend)
                                    }
                                }
                            }
                            1 -> {
                                if (uiState.incomingRequests.isEmpty()) {
                                    item { EmptySocialView("Sin solicitudes pendientes.") }
                                } else {
                                    items(uiState.incomingRequests) { request ->
                                        RequestCard(
                                            request = request,
                                            onAccept = { viewModel.acceptFriendRequest(request) },
                                            onReject = { viewModel.rejectFriendRequest(request.id) }
                                        )
                                    }
                                }
                            }
                            2 -> {
                                item {
                                    if (uiState.lichessToken != null) {
                                        Button(
                                            onClick = { showCreateChallengeDialog = true },
                                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                                            shape = RoundedCornerShape(12.dp),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.3f))
                                        ) {
                                            Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(Modifier.width(8.dp))
                                            Text("NUEVO RETO LICHESS 🌐", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF38BDF8))
                                        }
                                    }
                                }

                                if (uiState.challenges.isEmpty() && uiState.lichessChallenges.isEmpty()) {
                                    item { EmptySocialView("No tienes retos de Tosito ni de Lichess.") }
                                } else {
                                    // Internal Challenges
                                    items(uiState.challenges) { challenge ->
                                        ChallengeCard(
                                            challenge = challenge,
                                            onAccept = { viewModel.acceptChallenge(challenge, onNavigateToGame) },
                                            onReject = { viewModel.rejectChallenge(challenge.id) }
                                        )
                                    }
                                    // Lichess Challenges
                                    items(uiState.lichessChallenges) { challenge ->
                                        LichessChallengeCard(
                                            challenge = challenge,
                                            onAccept = { viewModel.acceptLichessChallenge(challenge.id) },
                                            onDecline = { viewModel.declineLichessChallenge(challenge.id) },
                                            onCancel = { viewModel.cancelLichessChallenge(challenge.id) },
                                            onOpen = {
                                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(challenge.url))
                                                context.startActivity(intent)
                                            }
                                        )
                                    }
                                }
                            }
                        }
                        item { Spacer(modifier = Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
fun LichessTokenDialog(
    initialToken: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var token by remember { mutableStateOf(initialToken) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Configurar Lichess 🌐", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text("Introduce tu Personal Access Token (PAT) de Lichess para poder enviar y aceptar retos.", fontSize = 14.sp)
                Spacer(Modifier.height(16.dp))
                OutlinedTextField(
                    value = token,
                    onValueChange = { token = it },
                    label = { Text("Lichess Token") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(token) }) { Text("GUARDAR") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("CANCELAR") }
        },
        containerColor = Color(0xFF1E293B),
        titleContentColor = Color.White,
        textContentColor = Color.White.copy(alpha = 0.8f)
    )
}

@Composable
fun CreateLichessChallengeDialog(
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var username by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Crear Reto Lichess ⚔️", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text("Introduce el nombre parcial o completo del usuario en Lichess.", fontSize = 14.sp)
                Spacer(Modifier.height(16.dp))
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Usuario de Lichess") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (username.isNotBlank()) onConfirm(username) },
                enabled = username.isNotBlank()
            ) { Text("ENVIAR RETO") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("CANCELAR") }
        },
        containerColor = Color(0xFF1E293B),
        titleContentColor = Color.White,
        textContentColor = Color.White.copy(alpha = 0.8f)
    )
}

@Composable
fun LichessChallengeCard(
    challenge: LichessChallenge,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onCancel: () -> Unit,
    onOpen: () -> Unit
) {
    Surface(
        color = Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.3f))
    ) {
        Column(modifier = Modifier.padding(16.dp).fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(modifier = Modifier.size(32.dp), shape = CircleShape, color = Color(0xFF38BDF8).copy(alpha = 0.2f)) {
                    Icon(Icons.Default.Public, contentDescription = null, tint = Color(0xFF38BDF8), modifier = Modifier.padding(6.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (challenge.direction == "in") "Reto de ${challenge.challengerName}" else "Reto para ${challenge.challengerName}",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${challenge.variant} • ${if (challenge.rated) "Ranked" else "Casual"} • ${challenge.speed}",
                        color = Color.White.copy(alpha = 0.5f),
                        fontSize = 12.sp
                    )
                }
                if (challenge.status == "accepted") {
                    IconButton(onClick = onOpen) {
                        Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = "Abrir Partida", tint = Color(0xFF10B981))
                    }
                }
            }
            
            if (challenge.status == "created") {
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                    if (challenge.direction == "in") {
                        Button(
                            onClick = onAccept,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("ACEPTAR", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(8.dp))
                        OutlinedButton(
                            onClick = onDecline,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFEF4444))
                        ) {
                            Text("RECHAZAR", color = Color(0xFFEF4444), fontSize = 10.sp)
                        }
                    } else {
                        OutlinedButton(
                            onClick = onCancel,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.3f))
                        ) {
                            Text("CANCELAR", color = Color.White, fontSize = 10.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EmptySocialView(text: String) {
    Box(modifier = Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) {
        Text(text, color = Color.White.copy(alpha = 0.2f), fontSize = 14.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
fun FriendCard(friend: Friend) {
    Surface(
        color = Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (friend.photoUrl != null) {
                AsyncImage(
                    model = friend.photoUrl,
                    contentDescription = null,
                    modifier = Modifier.size(40.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Surface(modifier = Modifier.size(40.dp), shape = CircleShape, color = Color.White.copy(alpha = 0.1f)) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = Color.White.copy(alpha = 0.3f), modifier = Modifier.padding(8.dp))
                }
            }
            Spacer(modifier = Modifier.width(16.dp))
            Text(friend.displayName, color = Color.White, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            
            Button(
                onClick = { /* TODO: Implement internal challenge logic */ },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981).copy(alpha = 0.1f)),
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.5f))
            ) {
                Text("RETAR ⚔️", color = Color(0xFF10B981), fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun RequestCard(request: FriendRequest, onAccept: () -> Unit, onReject: () -> Unit) {
    Surface(
        color = Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(request.fromName, color = Color.White, fontWeight = FontWeight.Bold)
                Text("Quiere ser tu amigo", color = Color.White.copy(alpha = 0.4f), fontSize = 12.sp)
            }
            IconButton(onClick = onAccept, modifier = Modifier.background(Color(0xFF10B981).copy(alpha = 0.1f), CircleShape)) {
                Icon(Icons.Default.Check, contentDescription = "Aceptar", tint = Color(0xFF10B981))
            }
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(onClick = onReject, modifier = Modifier.background(Color(0xFFEF4444).copy(alpha = 0.1f), CircleShape)) {
                Icon(Icons.Default.Close, contentDescription = "Rechazar", tint = Color(0xFFEF4444))
            }
        }
    }
}

@Composable
fun ChallengeCard(challenge: GameChallenge, onAccept: () -> Unit, onReject: () -> Unit) {
    Surface(
        color = Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.3f))
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("${challenge.fromName} te desafía", color = Color.White, fontWeight = FontWeight.Bold)
                Text("¿Aceptas el duelo?", color = Color(0xFF10B981), fontSize = 12.sp)
            }
            Button(
                onClick = onAccept,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("ACEPTAR ⚔️", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(onClick = onReject, modifier = Modifier.background(Color(0xFFEF4444).copy(alpha = 0.1f), CircleShape)) {
                Icon(Icons.Default.Close, contentDescription = "Rechazar", tint = Color(0xFFEF4444))
            }
        }
    }
}
