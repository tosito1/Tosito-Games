package com.toust.tositochest.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.blur
import androidx.compose.ui.unit.dp
import com.toust.tositochest.ui.theme.DeepIndigo
import com.toust.tositochest.ui.theme.SkyBlue
import com.toust.tositochest.ui.theme.SoftRose
import com.toust.tositochest.ui.theme.AmberGold

@Composable
fun MeshBackground() {
    val infiniteTransition = rememberInfiniteTransition()

    // Animación para el primer blob (SkyBlue)
    val blob1OffsetX by infiniteTransition.animateFloat(
        initialValue = 0.2f,
        targetValue = 0.8f,
        animationSpec = infiniteRepeatable(
            animation = tween(15000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    val blob1OffsetY by infiniteTransition.animateFloat(
        initialValue = 0.1f,
        targetValue = 0.4f,
        animationSpec = infiniteRepeatable(
            animation = tween(18000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )

    // Animación para el segundo blob (SoftRose)
    val blob2OffsetX by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 0.3f,
        animationSpec = infiniteRepeatable(
            animation = tween(22000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    val blob2OffsetY by infiniteTransition.animateFloat(
        initialValue = 0.7f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(
            animation = tween(20000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )

    // Animación para el tercer blob (AmberGold)
    val blob3OffsetX by infiniteTransition.animateFloat(
        initialValue = 0.1f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(
            animation = tween(25000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )

    Canvas(
        modifier = Modifier
            .fillMaxSize()
            .blur(100.dp) // El desenfoque crea el efecto de malla fluida
    ) {
        // Fondo base oscuro
        drawRect(color = DeepIndigo)

        // Blob 1
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(SkyBlue.copy(alpha = 0.4f), Color.Transparent),
                center = Offset(size.width * blob1OffsetX, size.height * blob1OffsetY),
                radius = size.width * 0.8f
            ),
            radius = size.width * 0.8f,
            center = Offset(size.width * blob1OffsetX, size.height * blob1OffsetY)
        )

        // Blob 2
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(SoftRose.copy(alpha = 0.3f), Color.Transparent),
                center = Offset(size.width * blob2OffsetX, size.height * blob2OffsetY),
                radius = size.width * 0.7f
            ),
            radius = size.width * 0.7f,
            center = Offset(size.width * blob2OffsetX, size.height * blob2OffsetY)
        )

        // Blob 3
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(AmberGold.copy(alpha = 0.2f), Color.Transparent),
                center = Offset(size.width * blob3OffsetX, size.height * 0.5f),
                radius = size.width * 0.6f
            ),
            radius = size.width * 0.6f,
            center = Offset(size.width * blob3OffsetX, size.height * 0.5f)
        )
    }
}
