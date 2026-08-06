package com.othello.arena.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.othello.arena.data.ActiveGame
import com.othello.arena.data.AuthUser
import com.othello.arena.data.ConnectionState
import com.othello.arena.data.GameResult
import com.othello.arena.data.GameStatus
import com.othello.arena.data.MoveRecord
import com.othello.arena.data.PlayerColor
import com.othello.arena.data.rankLabel
import kotlinx.coroutines.delay

@Composable
fun GameScreen(
  game: ActiveGame,
  user: AuthUser?,
  connection: ConnectionState,
  onMove: (Int, Int) -> Unit,
  onResign: () -> Unit,
  onRematch: () -> Unit,
  onHome: () -> Unit,
) {
  var showResignDialog by remember { mutableStateOf(false) }
  BackHandler(enabled = game.state.gameStatus == GameStatus.PLAYING) { showResignDialog = true }

  BoxWithConstraints(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
    val wide = maxWidth >= 720.dp
    if (wide) {
      Row(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        horizontalArrangement = Arrangement.spacedBy(22.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
          GameHeader(game, connection)
          OthelloBoard(game, onMove, Modifier.fillMaxWidth().widthIn(max = 620.dp).padding(top = 14.dp))
        }
        GameSidebar(
          game = game,
          user = user,
          onResign = { showResignDialog = true },
          modifier = Modifier.weight(0.72f).widthIn(max = 420.dp),
        )
      }
    } else {
      LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        item { GameHeader(game, connection) }
        item { OpponentCard(game) }
        item { OthelloBoard(game, onMove, Modifier.fillMaxWidth()) }
        item { YourPlayerCard(game, user) }
        item { ReconnectNotice(game) }
        item { MoveStrip(game.state.moveHistory) }
        item {
          OutlinedButton(
            onClick = { showResignDialog = true },
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            enabled = game.state.gameStatus == GameStatus.PLAYING,
          ) {
            Text("Resign game")
          }
        }
      }
    }
  }

  if (showResignDialog) {
    AlertDialog(
      onDismissRequest = { showResignDialog = false },
      title = { Text("Resign this game?") },
      text = { Text("The match will end immediately and count as a loss.") },
      confirmButton = {
        Button(onClick = { showResignDialog = false; onResign() }) { Text("Resign") }
      },
      dismissButton = { TextButton(onClick = { showResignDialog = false }) { Text("Keep playing") } },
    )
  }

  if (game.result != null) {
    GameOverDialog(game, onRematch, onHome)
  }
}

@Composable
private fun GameHeader(game: ActiveGame, connection: ConnectionState) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    Column {
      Text("LIVE MATCH", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
      Text(
        if (game.state.currentPlayer == game.yourColor) "Your turn" else "${game.opponent.username}'s turn",
        modifier = Modifier.padding(top = 2.dp),
        fontSize = 23.sp,
        fontWeight = FontWeight.Bold,
      )
    }
    ConnectionLabel(connection)
  }
}

@Composable
private fun GameSidebar(game: ActiveGame, user: AuthUser?, onResign: () -> Unit, modifier: Modifier = Modifier) {
  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    OpponentCard(game)
    YourPlayerCard(game, user)
    ReconnectNotice(game)
    MoveStrip(game.state.moveHistory)
    OutlinedButton(
      onClick = onResign,
      modifier = Modifier.fillMaxWidth(),
      enabled = game.state.gameStatus == GameStatus.PLAYING,
    ) {
      Text("Resign game")
    }
  }
}

@Composable
private fun OpponentCard(game: ActiveGame) {
  val opponentColor = if (game.yourColor == PlayerColor.BLACK) PlayerColor.WHITE else PlayerColor.BLACK
  val score = if (opponentColor == PlayerColor.BLACK) game.state.blackScore else game.state.whiteScore
  PlayerCard(
    username = game.opponent.username,
    rating = game.opponent.rating,
    color = opponentColor,
    score = score,
    isTurn = game.state.currentPlayer == opponentColor && game.state.gameStatus == GameStatus.PLAYING,
    label = "OPPONENT",
  )
}

@Composable
private fun YourPlayerCard(game: ActiveGame, user: AuthUser?) {
  val score = if (game.yourColor == PlayerColor.BLACK) game.state.blackScore else game.state.whiteScore
  PlayerCard(
    username = user?.username ?: "You",
    rating = user?.rating ?: 1200,
    color = game.yourColor,
    score = score,
    isTurn = game.state.currentPlayer == game.yourColor && game.state.gameStatus == GameStatus.PLAYING,
    label = "YOU",
  )
}

@Composable
private fun PlayerCard(
  username: String,
  rating: Int,
  color: PlayerColor,
  score: Int,
  isTurn: Boolean,
  label: String,
) {
  val borderColor = if (isTurn) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = androidx.compose.foundation.BorderStroke(1.dp, borderColor),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(14.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Box(
        modifier =
          Modifier.size(42.dp)
            .background(if (color == PlayerColor.BLACK) Color(0xFF090B0A) else Color(0xFFF2F4F3), CircleShape),
      )
      Column(Modifier.weight(1f).padding(start = 12.dp)) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, letterSpacing = 1.5.sp)
        Text(username, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        Text("$rating • ${rankLabel(rating)}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
      }
      Column(horizontalAlignment = Alignment.End) {
        Text("SCORE", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp)
        Text(score.toString(), fontWeight = FontWeight.Bold, fontSize = 28.sp)
      }
    }
  }
}

@Composable
private fun OthelloBoard(game: ActiveGame, onMove: (Int, Int) -> Unit, modifier: Modifier = Modifier) {
  val legalMoves = remember(game.state.legalMoves) {
    game.state.legalMoves.mapNotNull { move ->
      val row = move.getOrNull(0) ?: return@mapNotNull null
      val col = move.getOrNull(1) ?: return@mapNotNull null
      row to col
    }.toSet()
  }
  val lastMove = game.lastMove?.let { it.row to it.col }
  val canMove = game.state.currentPlayer == game.yourColor && game.state.gameStatus == GameStatus.PLAYING

  Canvas(
    modifier =
      modifier
        .aspectRatio(1f)
        .clip(RoundedCornerShape(20.dp))
        .background(Color(0xFF0B3A24))
        .pointerInput(game.gameId, game.state.moveHistory.size, canMove) {
          detectTapGestures { offset ->
            if (!canMove) return@detectTapGestures
            val cell = size.width / 8f
            val row = (offset.y / cell).toInt().coerceIn(0, 7)
            val col = (offset.x / cell).toInt().coerceIn(0, 7)
            if ((row to col) in legalMoves) onMove(row, col)
          }
        },
  ) {
    val cell = size.width / 8f
    for (row in 0..7) {
      for (col in 0..7) {
        val topLeft = Offset(col * cell, row * cell)
        drawRect(
          color = if ((row + col) % 2 == 0) Color(0xFF16834B) else Color(0xFF147543),
          topLeft = topLeft,
          size = Size(cell, cell),
        )
        if (lastMove == row to col) {
          drawRect(
            color = Color(0xFFFBBF24),
            topLeft = topLeft + Offset(2.5f, 2.5f),
            size = Size(cell - 5f, cell - 5f),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4f),
          )
        }

        val piece = game.state.board.getOrNull(row)?.getOrNull(col)
        if (piece != null) drawBoardPiece(topLeft + Offset(cell / 2f, cell / 2f), cell * 0.37f, piece)
        else if (canMove && (row to col) in legalMoves) {
          drawCircle(Color.White.copy(alpha = 0.42f), radius = cell * 0.105f, center = topLeft + Offset(cell / 2f, cell / 2f))
        }
      }
    }
    for (line in 1..7) {
      drawLine(Color.Black.copy(alpha = 0.18f), Offset(line * cell, 0f), Offset(line * cell, size.height), 1.5f)
      drawLine(Color.Black.copy(alpha = 0.18f), Offset(0f, line * cell), Offset(size.width, line * cell), 1.5f)
    }
  }
}

private fun DrawScope.drawBoardPiece(center: Offset, radius: Float, color: PlayerColor) {
  drawCircle(Color.Black.copy(alpha = 0.35f), radius, center + Offset(0f, radius * 0.13f))
  val colors =
    if (color == PlayerColor.BLACK) listOf(Color(0xFF4B514E), Color(0xFF050606))
    else listOf(Color.White, Color(0xFFCBD2CE))
  drawCircle(brush = Brush.radialGradient(colors, center = center - Offset(radius * 0.3f, radius * 0.35f), radius = radius * 1.35f), radius = radius, center = center)
  drawCircle(Color.White.copy(alpha = 0.22f), radius * 0.18f, center - Offset(radius * 0.34f, radius * 0.38f))
}

@Composable
private fun MoveStrip(moves: List<MoveRecord>) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
  ) {
    Column(Modifier.padding(vertical = 13.dp)) {
      Text("MOVE HISTORY", modifier = Modifier.padding(horizontal = 14.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
      if (moves.isEmpty()) {
        Text("Moves will appear here.", modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
      } else {
        LazyRow(
          modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
          contentPadding = PaddingValues(horizontal = 14.dp),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          itemsIndexed(moves, key = { index, move -> "${move.timestamp}-$index" }) { index, move ->
            val coordinate = "${('a'.code + move.col).toChar()}${move.row + 1}"
            Row(
              modifier = Modifier.background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 7.dp),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Box(Modifier.size(9.dp).background(if (move.player == PlayerColor.BLACK) Color.Black else Color.White, CircleShape))
              Text("${index + 1}. $coordinate", modifier = Modifier.padding(start = 6.dp), fontFamily = FontFamily.Monospace, fontSize = 12.sp)
            }
          }
        }
      }
    }
  }
}

@Composable
private fun ReconnectNotice(game: ActiveGame) {
  val deadline = game.opponentReconnectDeadline ?: return
  var now by remember(deadline) { mutableLongStateOf(System.currentTimeMillis()) }
  LaunchedEffect(deadline) {
    while (now < deadline) {
      delay(1_000)
      now = System.currentTimeMillis()
    }
  }
  val seconds = ((deadline - now).coerceAtLeast(0) / 1_000).toInt()
  Text(
    "Opponent reconnecting • ${seconds}s grace period",
    modifier = Modifier.fillMaxWidth().background(Color(0x33FBBF24), RoundedCornerShape(12.dp)).padding(12.dp),
    color = Color(0xFFFBBF24),
    textAlign = TextAlign.Center,
    fontSize = 13.sp,
  )
}

@Composable
private fun GameOverDialog(game: ActiveGame, onRematch: () -> Unit, onHome: () -> Unit) {
  val (title, color) =
    when (game.result) {
      GameResult.WIN -> "Victory" to MaterialTheme.colorScheme.primary
      GameResult.LOSS -> "Defeat" to MaterialTheme.colorScheme.error
      GameResult.DRAW -> "Draw" to Color(0xFFFBBF24)
      null -> return
    }
  val reason =
    when (game.gameOverReason) {
      "resignation" -> "The game ended by resignation."
      "disconnect-forfeit" -> "A player did not reconnect in time."
      "move-timeout" -> "The move timer expired."
      else -> "Final score ${game.state.blackScore}–${game.state.whiteScore}."
    }

  AlertDialog(
    onDismissRequest = {},
    title = { Text(title, color = color, fontSize = 30.sp, fontWeight = FontWeight.Bold) },
    text = {
      Column {
        Text(reason)
        Text(
          "Black ${game.state.blackScore}  •  White ${game.state.whiteScore}",
          modifier = Modifier.padding(top = 12.dp),
          fontWeight = FontWeight.SemiBold,
        )
        game.ratingChange?.let { change ->
          Text(
            text = "Rating ${if (change >= 0) "+" else ""}$change",
            modifier = Modifier.padding(top = 8.dp),
            color = if (change >= 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
          )
        }
      }
    },
    confirmButton = {
      Button(onClick = onRematch, enabled = !game.rematchRequested) {
        Text(if (game.rematchRequested) "Waiting…" else "Rematch")
      }
    },
    dismissButton = { TextButton(onClick = onHome) { Text("Home") } },
  )
}
