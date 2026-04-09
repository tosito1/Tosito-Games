package com.toust.tositochest.ui.game

import androidx.compose.animation.core.animateOffsetAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.times
import androidx.compose.ui.window.Dialog
import com.toust.tositochest.R
import com.toust.tositochest.engine.ChessPiece
import com.toust.tositochest.engine.PieceColor
import com.toust.tositochest.engine.PieceType

@Composable
fun ChessBoard(
    board: Array<Array<ChessPiece?>>,
    selectedSquare: Pair<Int, Int>?,
    validMoves: List<Pair<Int, Int>>,
    lastMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    lastMoveQualityColor: Color? = null,
    bestMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    onSquareClick: (Int, Int) -> Unit,
    isFlipped: Boolean = false,
    hintMove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    isCustomBoard: Boolean = false,
    premove: Pair<Pair<Int, Int>, Pair<Int, Int>>? = null,
    isMini: Boolean = false,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current

    // Feedback táctico cuando el tablero cambia (turno o movimiento)
    LaunchedEffect(board) {
        if (lastMove != null) {
            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
        }
    }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .padding(4.dp)
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(Color.White.copy(alpha = 0.05f), Color.White.copy(alpha = 0.02f))
                ),
                shape = RoundedCornerShape(8.dp)
            )
            .border(
                BorderStroke(1.dp, Color.White.copy(alpha = 0.1f)),
                shape = RoundedCornerShape(8.dp)
            )
    ) {
        val squareSize = maxWidth / 8
        
        // Grid Layer (Empty Squares)
        Column {
            val rowRange = if (isFlipped) (7 downTo 0) else (0..7)
            val colRange = if (isFlipped) (7 downTo 0) else (0..7)
            
            for (row in rowRange) {
                Row(modifier = Modifier.weight(1f)) {
                    for (col in colRange) {
                        val isSelected = selectedSquare?.first == row && selectedSquare.second == col
                        val isLastMove = lastMove != null && (
                            (row == lastMove.first.first && col == lastMove.first.second) ||
                            (row == lastMove.second.first && col == lastMove.second.second)
                        )
                        val isHint = hintMove != null && (
                            (row == hintMove.first.first && col == hintMove.first.second) ||
                            (row == hintMove.second.first && col == hintMove.second.second)
                        )
                        
                        val showRank = col == if (isFlipped) 7 else 0
                        val showFile = row == if (isFlipped) 0 else 7
                        val rankLabel = if (showRank) (8 - row).toString() else null
                        val fileLabel = if (showFile) ('A' + col).toString() else null

                        Square(
                            row = row,
                            col = col,
                            piece = null, // No renderizamos la pieza aquí
                            isSelected = isSelected,
                            isValidDestination = validMoves.contains(row to col),
                            isLastMove = isLastMove,
                            isHint = isHint,
                            isPremove = premove != null && (
                                (row == premove.first.first && col == premove.first.second) ||
                                (row == premove.second.first && col == premove.second.second)
                            ),
                            isCustomBoard = isCustomBoard,
                            rankLabel = if (isMini) null else rankLabel,
                            fileLabel = if (isMini) null else fileLabel,
                            isMini = isMini,
                            onClick = { 
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                onSquareClick(row, col) 
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        // Pieces Layer (Animated)
        for (r in 0..7) {
            for (c in 0..7) {
                val piece = board[r][c] ?: continue
                
                // Calculamos la posición visual considerando el flip
                val visualRow = if (isFlipped) 7 - r else r
                val visualCol = if (isFlipped) 7 - c else c
                
                val offset by animateOffsetAsState(
                    targetValue = androidx.compose.ui.geometry.Offset(
                        x = with(androidx.compose.ui.platform.LocalDensity.current) { (visualCol * squareSize).toPx() },
                        y = with(androidx.compose.ui.platform.LocalDensity.current) { (visualRow * squareSize).toPx() }
                    ),
                    animationSpec = tween(durationMillis = 350, easing = androidx.compose.animation.core.FastOutSlowInEasing),
                    label = "PieceMove_${piece.id}"
                )

                Image(
                    painter = painterResource(id = getPieceResource(piece.type, piece.color)),
                    contentDescription = null,
                    modifier = Modifier
                        .size(squareSize)
                        .offset { androidx.compose.ui.unit.IntOffset(offset.x.toInt(), offset.y.toInt()) }
                        .padding(4.dp)
                )
            }
        }
        
        // Arrows Overlay
        androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
            val squareWidth = size.width / 8f
            val squareHeight = size.height / 8f
            
            fun drawArrow(move: Pair<Pair<Int, Int>, Pair<Int, Int>>, color: Color) {
                // Determine screen coordinates based on board flip
                val sRow = if (isFlipped) 7 - move.first.first else move.first.first
                val sCol = if (isFlipped) 7 - move.first.second else move.first.second
                val eRow = if (isFlipped) 7 - move.second.first else move.second.first
                val eCol = if (isFlipped) 7 - move.second.second else move.second.second
                
                val centerStartX = sCol * squareWidth + squareWidth / 2f
                val centerStartY = sRow * squareHeight + squareHeight / 2f
                val centerEndX = eCol * squareWidth + squareWidth / 2f
                val centerEndY = eRow * squareHeight + squareHeight / 2f
                
                val dx = centerEndX - centerStartX
                val dy = centerEndY - centerStartY
                val length = kotlin.math.sqrt(dx * dx + dy * dy)
                if (length < 1f) return
                
                // Normalize direction
                val nx = dx / length
                val ny = dy / length
                
                // Adjust start and end points so they don't cover the entire piece
                val startOffset = squareWidth * 0.15f
                val endOffset = squareWidth * 0.30f
                
                // If it's a very short move (e.g. one square), reduce offsets
                val finalStartOffset = if (length < squareWidth * 1.5f) startOffset * 0.5f else startOffset
                val finalEndOffset = if (length < squareWidth * 1.5f) endOffset * 0.8f else endOffset
                
                val startX = centerStartX + nx * finalStartOffset
                val startY = centerStartY + ny * finalStartOffset
                val endX = centerEndX - nx * finalEndOffset
                val endY = centerEndY - ny * finalEndOffset
                
                val strokeW = squareWidth * 0.18f
                
                // Line with Shadow
                drawLine(
                    color = Color.Black.copy(alpha = 0.3f),
                    start = androidx.compose.ui.geometry.Offset(startX + 2f, startY + 2f),
                    end = androidx.compose.ui.geometry.Offset(endX + 2f, endY + 2f),
                    strokeWidth = strokeW,
                    cap = androidx.compose.ui.graphics.StrokeCap.Round
                )
                // Main Line
                drawLine(
                    color = color,
                    start = androidx.compose.ui.geometry.Offset(startX, startY),
                    end = androidx.compose.ui.geometry.Offset(endX, endY),
                    strokeWidth = strokeW,
                    cap = androidx.compose.ui.graphics.StrokeCap.Round
                )
                
                // Draw arrowhead
                val angle = kotlin.math.atan2(dy, dx)
                val arrowLen = squareWidth * 0.35f
                val arrowWidth = squareWidth * 0.35f
                
                val path = androidx.compose.ui.graphics.Path().apply {
                    moveTo(endX + nx * (arrowLen * 0.5f), endY + ny * (arrowLen * 0.5f))
                    
                    val baseMidX = endX - nx * (arrowLen * 0.5f)
                    val baseMidY = endY - ny * (arrowLen * 0.5f)
                    
                    val p1X = baseMidX - (arrowWidth / 2f) * kotlin.math.sin(angle)
                    val p1Y = baseMidY + (arrowWidth / 2f) * kotlin.math.cos(angle)
                    val p2X = baseMidX + (arrowWidth / 2f) * kotlin.math.sin(angle)
                    val p2Y = baseMidY - (arrowWidth / 2f) * kotlin.math.cos(angle)
                    
                    lineTo(p1X.toFloat(), p1Y.toFloat())
                    lineTo(p2X.toFloat(), p2Y.toFloat())
                    close()
                }
                
                // Arrowhead shadow
                drawPath(path = path, color = Color.Black.copy(alpha = 0.3f))
                // Arrowhead main
                drawPath(path = path, color = color)
            }
            
            // Draw best move first (so it's underneath if they overlap)
            if (bestMove != null) {
                drawArrow(bestMove, Color(0xFF10B981).copy(alpha = 0.65f)) // Cyan/Green
            }
            // Draw actual move
            if (lastMove != null && lastMoveQualityColor != null) {
                drawArrow(lastMove, lastMoveQualityColor.copy(alpha = 0.85f))
            }
        }
    }
}

@Composable
fun Square(
    row: Int,
    col: Int,
    piece: ChessPiece?,
    isSelected: Boolean,
    isValidDestination: Boolean,
    isLastMove: Boolean = false,
    isHint: Boolean = false,
    isPremove: Boolean = false,
    isCustomBoard: Boolean = false,
    rankLabel: String? = null,
    fileLabel: String? = null,
    isMini: Boolean = false,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isLight = (row + col) % 2 == 0
    val (lightColor, darkColor) = if (isCustomBoard) {
        Color(0xFFEEEED2) to Color(0xFF769656) // Classic Green
    } else {
        Color(0xFFFDE68A) to Color(0xFF92400E) // Premium Gold
    }
    val baseColor = if (isLight) lightColor.copy(alpha = 0.9f) else darkColor.copy(alpha = 0.9f)
    
    val highlightColor = when {
        isSelected -> Color(0xFF38BDF8).copy(alpha = 0.6f)
        isPremove -> Color(0xFFF43F5E).copy(alpha = 0.5f) // Rose/Red for premove
        isHint -> Color(0xFF10B981).copy(alpha = 0.6f)
        isValidDestination -> Color(0xFF10B981).copy(alpha = 0.4f)
        isLastMove -> Color(0xFFFBBF24).copy(alpha = 0.3f)
        else -> Color.Transparent
    }

    val labelColor = if (isLight) Color(0xFF769656) else Color(0xFFEEEED2)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(baseColor)
            .border(BorderStroke(if (isMini) 0.05.dp else 0.1.dp, Color.Black.copy(alpha = 0.05f)))
            .clickable(enabled = !isMini, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        // Highlight Layer
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(highlightColor)
        )
        // Internal Rank Label (Numbers)
        if (rankLabel != null) {
            Text(
                text = rankLabel,
                color = labelColor,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(start = 2.dp, top = 2.dp)
            )
        }

        // Internal File Label (Letters)
        if (fileLabel != null) {
            Text(
                text = fileLabel,
                color = labelColor,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 2.dp, bottom = 2.dp)
            )
        }

        if (isLastMove) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .border(BorderStroke(3.dp, Color(0xFFFBBF24).copy(alpha = 0.7f)))
            )
            // Small indicator dot in the corner
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .padding(2.dp)
                    .background(Color(0xFFFBBF24), CircleShape)
                    .align(Alignment.TopEnd)
            )
        }

        if (isValidDestination) {
            Box(
                modifier = Modifier
                    .size(if (piece == null) 16.dp else 44.dp)
                    .background(
                        color = if (piece == null) Color(0xFF38BDF8).copy(0.3f) else Color.Transparent,
                        shape = RoundedCornerShape(50)
                    )
                    .let { 
                        if (piece != null) it.border(3.dp, Color(0xFF10B981).copy(0.5f), RoundedCornerShape(50)) 
                        else it 
                    }
            )
        }
        
        if (piece != null) {
            Image(
                painter = painterResource(id = getPieceResource(piece.type, piece.color)),
                contentDescription = null,
                modifier = Modifier
                    .fillMaxSize(0.9f)
            )
        }
    }
}

@Composable
fun PromotionDialog(
    color: PieceColor,
    onSelect: (PieceType) -> Unit
) {
    Dialog(onDismissRequest = {}) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    "Promoción de Peón",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val pieces = listOf(PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT)
                    pieces.forEach { type ->
                            Box(
                                modifier = Modifier
                                    .size(64.dp)
                                    .background(Color.White.copy(0.1f), RoundedCornerShape(8.dp))
                                    .clickable { onSelect(type) },
                                contentAlignment = Alignment.Center
                            ) {
                                Image(
                                    painter = painterResource(id = getPieceResource(type, color)),
                                    contentDescription = null,
                                    modifier = Modifier
                                        .size(44.dp)
                                        .shadow(elevation = 1.dp, shape = CircleShape)
                                )
                            }
                    }
                }
            }
        }
    }
}

fun getPieceResource(type: PieceType, color: PieceColor): Int {
    return when (color) {
        PieceColor.WHITE -> when (type) {
            PieceType.PAWN -> R.drawable.ic_white_pawn_v
            PieceType.ROOK -> R.drawable.ic_white_rook_v
            PieceType.KNIGHT -> R.drawable.ic_white_knight_v
            PieceType.BISHOP -> R.drawable.ic_white_bishop_v
            PieceType.QUEEN -> R.drawable.ic_white_queen_v
            PieceType.KING -> R.drawable.ic_white_king_v
        }
        PieceColor.BLACK -> when (type) {
            PieceType.PAWN -> R.drawable.ic_black_pawn_v
            PieceType.ROOK -> R.drawable.ic_black_rook_v
            PieceType.KNIGHT -> R.drawable.ic_black_knight_v
            PieceType.BISHOP -> R.drawable.ic_black_bishop_v
            PieceType.QUEEN -> R.drawable.ic_black_queen_v
            PieceType.KING -> R.drawable.ic_black_king_v
        }
    }
}
