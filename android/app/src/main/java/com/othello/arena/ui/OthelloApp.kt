package com.othello.arena.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun OthelloApp(viewModel: OthelloViewModel) {
  val state by viewModel.uiState.collectAsStateWithLifecycle()
  val snackbarHostState = remember { SnackbarHostState() }

  LaunchedEffect(state.message) {
    state.message?.let {
      snackbarHostState.showSnackbar(it)
      viewModel.dismissMessage()
    }
  }

  Box(
    modifier =
      Modifier.fillMaxSize()
        .background(
          Brush.radialGradient(
            colors = listOf(Color(0xFF13291D), MaterialTheme.colorScheme.background),
            center = Offset(0f, 0f),
            radius = 1_400f,
          ),
        ),
  ) {
    AnimatedContent(
      targetState = state.destination,
      transitionSpec = { fadeIn() togetherWith fadeOut() },
      label = "destination",
    ) { destination ->
      when (destination) {
        Destination.SPLASH -> SplashScreen()
        Destination.AUTH ->
          AuthScreen(
            mode = state.authMode,
            isLoading = state.isLoading,
            onModeChange = viewModel::setAuthMode,
            onLogin = viewModel::login,
            onRegister = viewModel::register,
            onGuest = viewModel::playAsGuest,
          )
        Destination.HOME ->
          HomeScreen(
            state = state,
            onFindMatch = viewModel::findMatch,
            onCreateRoom = viewModel::createPrivateRoom,
            onJoinRoom = viewModel::joinPrivateRoom,
            onLeaderboard = viewModel::openLeaderboard,
            onLogout = viewModel::logout,
          )
        Destination.LEADERBOARD ->
          LeaderboardScreen(
            entries = state.leaderboard,
            isLoading = state.leaderboardLoading,
            onRefresh = viewModel::refreshLeaderboard,
            onHome = viewModel::openHome,
          )
        Destination.MATCHMAKING ->
          MatchmakingScreen(
            joinedAt = state.queueJoinedAt ?: System.currentTimeMillis(),
            connection = state.connection,
            onCancel = viewModel::cancelMatchmaking,
          )
        Destination.PRIVATE_ROOM ->
          PrivateRoomScreen(
            roomCode = state.privateRoomCode.orEmpty(),
            connection = state.connection,
            onCancel = viewModel::cancelPrivateRoom,
          )
        Destination.GAME ->
          state.game?.let { game ->
            GameScreen(
              game = game,
              user = state.session?.user,
              connection = state.connection,
              onMove = viewModel::makeMove,
              onResign = viewModel::resign,
              onRematch = viewModel::requestRematch,
              onHome = viewModel::openHome,
            )
          } ?: SplashScreen()
      }
    }

    SnackbarHost(
      hostState = snackbarHostState,
      modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp),
    )
  }
}

@Composable
private fun SplashScreen() {
  Column(
    modifier = Modifier.fillMaxSize(),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    OthelloMark(96)
    Text(
      text = "OTHELLO",
      modifier = Modifier.padding(top = 24.dp),
      color = MaterialTheme.colorScheme.onBackground,
      fontSize = 28.sp,
      letterSpacing = 7.sp,
    )
    CircularProgressIndicator(modifier = Modifier.padding(top = 28.dp).size(24.dp), strokeWidth = 2.dp)
  }
}

@Composable
fun OthelloMark(size: Int = 52) {
  Canvas(modifier = Modifier.size(size.dp).background(Color(0xFF1B8E4B), CircleShape)) {
    drawPiece(center = Offset(this.size.width * 0.38f, this.size.height * 0.5f), radius = this.size.width * 0.22f, Color(0xFF090B0A))
    drawPiece(center = Offset(this.size.width * 0.62f, this.size.height * 0.5f), radius = this.size.width * 0.22f, Color(0xFFF4F7F5))
  }
}

private fun DrawScope.drawPiece(center: Offset, radius: Float, color: Color) {
  drawCircle(Color.Black.copy(alpha = 0.28f), radius = radius, center = center + Offset(0f, radius * 0.12f))
  drawCircle(color, radius = radius, center = center)
  drawCircle(Color.White.copy(alpha = 0.18f), radius = radius * 0.42f, center = center - Offset(radius * 0.25f, radius * 0.25f))
}
