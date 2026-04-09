package com.toust.tositochest.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.toust.tositochest.ui.auth.AuthScreen
import com.toust.tositochest.ui.game.GameScreen
import com.toust.tositochest.ui.profile.ProfileScreen
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.toust.tositochest.ui.admin.AdminScreen
import com.toust.tositochest.ui.review.ReviewScreen

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.toust.tositochest.ui.components.MeshBackground

sealed class Screen(val route: String) {
    object Auth : Screen("auth")
    object Main : Screen("main")
    object Game : Screen("game/{gameId}") {
        fun createRoute(gameId: String) = "game/$gameId"
    }
    object Admin : Screen("admin")
    object Review : Screen("review/{gameId}") {
        fun createRoute(gameId: String) = "review/$gameId"
    }
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    
    Box(modifier = Modifier.fillMaxSize()) {
        // Global Dynamic Background
        MeshBackground()
        
        NavHost(navController = navController, startDestination = Screen.Auth.route) {
            composable(Screen.Auth.route) {
                AuthScreen(onLoginSuccess = { navController.navigate(Screen.Main.route) })
            }
            composable(Screen.Main.route) {
                MainScreen(
                    onNavigateToGame = { gameId -> navController.navigate(Screen.Game.createRoute(gameId)) },
                    onNavigateToReview = { gameId -> navController.navigate(Screen.Review.createRoute(gameId)) },
                    onNavigateToAdmin = { navController.navigate(Screen.Admin.route) },
                    onLogout = {
                        navController.navigate(Screen.Auth.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
            composable(
                route = Screen.Game.route,
                arguments = listOf(navArgument("gameId") { type = NavType.StringType })
            ) { backStackEntry ->
                val gameId = backStackEntry.arguments?.getString("gameId") ?: ""
                GameScreen(
                    gameId = gameId,
                    onBack = { navController.popBackStack() },
                    onReviewClick = { histId ->
                        // Remove Game route and go to Review
                        navController.navigate(Screen.Review.createRoute(histId)) {
                            popUpTo(Screen.Main.route)
                        }
                    }
                )
            }
            composable(Screen.Admin.route) {
                AdminScreen(
                    onBack = { navController.popBackStack() },
                    onRoomView = { roomId -> navController.navigate(Screen.Game.createRoute(roomId)) }
                )
            }
            composable(
                route = Screen.Review.route,
                arguments = listOf(navArgument("gameId") { type = NavType.StringType })
            ) { backStackEntry ->
                val gameId = backStackEntry.arguments?.getString("gameId") ?: ""
                ReviewScreen(
                    gameId = gameId,
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}
