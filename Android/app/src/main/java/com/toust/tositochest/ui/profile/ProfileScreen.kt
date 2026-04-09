package com.toust.tositochest.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel = viewModel(),
    onLoggedOut: () -> Unit,
    onAdminClick: () -> Unit,
    onBack: () -> Unit,
    onReviewClick: (String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState.isLoggedOut) {
        if (uiState.isLoggedOut) {
            onLoggedOut()
        }
    }

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
                .offset(x = 200.dp, y = (-100).dp)
                .background(Color(0xFF38BDF8).copy(alpha = 0.15f), CircleShape)
                .blur(80.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            // Top Navigation Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onBack) {
                    Text("← VOLVER", color = Color.White.copy(alpha = 0.6f), fontWeight = FontWeight.Bold)
                }
                
                IconButton(
                    onClick = { viewModel.signOut() },
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFEF4444).copy(alpha = 0.1f))
                        .border(1.dp, Color(0xFFEF4444).copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                ) {
                    Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = "Cerrar Sesión", tint = Color(0xFFEF4444))
                }
            }

            LazyColumn(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                item {
                    // Spacer(modifier = Modifier.height(40.dp)) // Reducimos espacio inicial
                
                // Avatar with Glow
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.size(140.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(130.dp)
                            .background(Color(0xFF38BDF8).copy(alpha = 0.2f), CircleShape)
                            .blur(20.dp)
                    )
                    if (uiState.photoUrl != null) {
                        AsyncImage(
                            model = uiState.photoUrl,
                            contentDescription = "Foto de perfil",
                            modifier = Modifier
                                .size(120.dp)
                                .clip(CircleShape)
                                .border(2.dp, Color(0xFF38BDF8).copy(alpha = 0.5f), CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Surface(
                            modifier = Modifier.size(120.dp),
                            shape = CircleShape,
                            color = Color.White.copy(alpha = 0.05f)
                        ) {
                            Icon(
                                Icons.Default.Person,
                                contentDescription = null,
                                tint = Color.White.copy(alpha = 0.3f),
                                modifier = Modifier.padding(32.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = uiState.name,
                    color = Color.White,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )
                
                // Username Section
                var isEditingUsername by remember { mutableStateOf(false) }
                var usernameDraft by remember(uiState.username) { mutableStateOf(uiState.username) }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(top = 4.dp)
                ) {
                    if (isEditingUsername) {
                        OutlinedTextField(
                            value = usernameDraft,
                            onValueChange = { usernameDraft = it },
                            modifier = Modifier.width(200.dp),
                            textStyle = LocalTextStyle.current.copy(color = Color.White, textAlign = TextAlign.Center),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF38BDF8),
                                unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                            ),
                            placeholder = { Text("@usuario", color = Color.White.copy(alpha = 0.2f)) }
                        )
                        IconButton(onClick = { 
                            viewModel.updateUsername(usernameDraft)
                            isEditingUsername = false 
                        }) {
                            Icon(Icons.Default.Check, contentDescription = "Guardar", tint = Color(0xFF10B981))
                        }
                    } else {
                        Text(
                            text = if (uiState.username.isEmpty()) "Sin @usuario" else "@${uiState.username}",
                            color = Color(0xFF38BDF8),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Medium
                        )
                        IconButton(onClick = { isEditingUsername = true }) {
                            Icon(Icons.Default.Edit, contentDescription = "Editar", tint = Color.White.copy(alpha = 0.3f), modifier = Modifier.size(16.dp))
                        }
                    }
                }

                if (uiState.usernameError != null) {
                    Text(uiState.usernameError!!, color = Color(0xFFF43F5E), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                }

                Text(
                    text = uiState.email,
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 16.sp,
                    modifier = Modifier.padding(top = 8.dp)
                )

                Spacer(modifier = Modifier.height(48.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = "Tus Estadísticas", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    IconButton(
                        onClick = { viewModel.forceRecalculate() },
                        modifier = Modifier.size(32.dp).background(Color.White.copy(alpha = 0.05f), CircleShape)
                    ) {
                        Icon(androidx.compose.material.icons.Icons.Default.Refresh, contentDescription = "Sincronizar", tint = Color.White.copy(alpha = 0.6f), modifier = Modifier.size(16.dp))
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    StatCard(label = "Victorias", value = uiState.stats.wins.toString(), modifier = Modifier.weight(1f))
                    StatCard(label = "Elo", value = uiState.stats.elo.toString(), modifier = Modifier.weight(1f))
                    StatCard(label = "Derrotas", value = uiState.stats.losses.toString(), modifier = Modifier.weight(1f))
                }

                if (uiState.isAdmin) {
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = onAdminClick,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFBBF24).copy(alpha = 0.1f)),
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFBBF24).copy(alpha = 0.5f))
                    ) {
                        Icon(Icons.Default.Settings, contentDescription = null, tint = Color(0xFFFBBF24))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("PANEL DE CONTROL 👑", color = Color(0xFFFBBF24), fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(48.dp))
                
                Text(
                    text = "PARTIDAS RECIENTES",
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Start
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            if (uiState.gamesHistory.isEmpty()) {
                item {
                    Text(
                        text = "No hay partidas registradas aún.",
                        color = Color.White.copy(alpha = 0.2f),
                        fontSize = 14.sp,
                        modifier = Modifier.padding(vertical = 32.dp)
                    )
                }
            } else {
                items(uiState.gamesHistory) { game ->
                    GameHistoryCard(game, onReviewClick = { onReviewClick(game.id) })
                    Spacer(modifier = Modifier.height(12.dp))
                }
            }

            item {
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}
}

@Composable
fun GameHistoryCard(game: GameHistory, onReviewClick: () -> Unit) {
    Surface(
        color = Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)),
        modifier = Modifier.fillMaxWidth().clickable { onReviewClick() }
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                if (!game.title.isNullOrBlank()) {
                    Text(
                        text = "\"${game.title}\"",
                        color = Color(0xFFFBBF24),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                }
                Text(
                    text = "vs ${game.opponent}",
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = game.getFormattedDate(),
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 12.sp
                )
            }
            Text(
                text = game.result,
                color = if (game.result.contains("Ganan las Blancas") || game.result.contains("Gana el Humano")) 
                    Color(0xFF10B981) else Color(0xFFF43F5E),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .background(Color.White.copy(alpha = 0.03f), RoundedCornerShape(20.dp))
            .border(androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(20.dp))
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = value, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text(text = label, color = Color.White.copy(alpha = 0.4f), fontSize = 12.sp)
        }
    }
}
