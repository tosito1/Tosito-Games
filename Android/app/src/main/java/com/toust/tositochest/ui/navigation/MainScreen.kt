package com.toust.tositochest.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.toust.tositochest.ui.training.TrainingHubScreen
import com.toust.tositochest.ui.exercises.ExercisesScreen
import com.toust.tositochest.ui.lobby.LobbyScreen
import com.toust.tositochest.ui.openings.OpeningsScreen
import com.toust.tositochest.ui.profile.ProfileScreen
import com.toust.tositochest.ui.social.FriendsScreen
import com.toust.tositochest.ui.challenges.SurvivalModeScreen
import com.toust.tositochest.ui.masters.MasterGamesScreen

sealed class BottomNavItem(val route: String, val title: String, val icon: ImageVector) {
    object Lobby : BottomNavItem("lobby", "Inicio", Icons.Default.Home)
    object Friends : BottomNavItem("friends", "Amigos", Icons.Default.Person)
    object Training : BottomNavItem("training", "Entrenar", Icons.Default.Star)
    object Profile : BottomNavItem("profile", "Perfil", Icons.Default.AccountCircle)
}

@Composable
fun MainScreen(
    onNavigateToGame: (String) -> Unit,
    onNavigateToReview: (String) -> Unit,
    onNavigateToAdmin: () -> Unit,
    onLogout: () -> Unit
) {
    val navController = rememberNavController()
    val items = listOf(
        BottomNavItem.Lobby,
        BottomNavItem.Friends,
        BottomNavItem.Training,
        BottomNavItem.Profile
    )

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xFF0F172A),
                contentColor = Color.White
            ) {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination

                items.forEach { screen ->
                    val selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.title) },
                        label = { Text(screen.title) },
                        selected = selected,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color.White,
                            selectedTextColor = Color.White,
                            indicatorColor = Color(0xFF38BDF8),
                            unselectedIconColor = Color.LightGray,
                            unselectedTextColor = Color.LightGray
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = BottomNavItem.Lobby.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(BottomNavItem.Lobby.route) {
                LobbyScreen(
                    onStartGame = { gameId -> onNavigateToGame(gameId) },
                    onAdminClick = { onNavigateToAdmin() },
                    onMastersClick = { navController.navigate("masters") }
                )
            }
            composable(BottomNavItem.Friends.route) {
                FriendsScreen(
                    onBack = { navController.popBackStack() },
                    onNavigateToGame = { gameId -> onNavigateToGame(gameId) }
                )
            }
            composable(BottomNavItem.Training.route) {
                TrainingHubScreen(
                    onNavigateToExercises = { navController.navigate("exercises") },
                    onNavigateToOpenings = { navController.navigate("openings") },
                    onNavigateToChallenges = { navController.navigate("challenges") },
                    onNavigateToMasters = { navController.navigate("masters") }
                )
            }
            composable("masters") {
                // MastersScreen will be here
                MasterGamesScreen(onBack = { navController.popBackStack() })
            }
            composable("challenges") {
                SurvivalModeScreen(
                    onBack = { navController.popBackStack() }
                )
            }
            composable("openings") {
                OpeningsScreen(
                    onBack = { navController.popBackStack() }
                )
            }
            composable("exercises") {
                ExercisesScreen(
                    onBack = { navController.popBackStack() }
                )
            }
            composable(BottomNavItem.Profile.route) {
                ProfileScreen(
                    onLoggedOut = { onLogout() },
                    onAdminClick = { onNavigateToAdmin() },
                    onBack = { navController.popBackStack() },
                    onReviewClick = { gameId -> onNavigateToReview(gameId) }
                )
            }
        }
    }
}
