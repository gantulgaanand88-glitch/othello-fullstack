package com.othello.arena.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.CreationExtras
import com.othello.arena.data.ActiveGame
import com.othello.arena.data.ApiException
import com.othello.arena.data.AuthUser
import com.othello.arena.data.ConnectionState
import com.othello.arena.data.GameFoundEvent
import com.othello.arena.data.GameStatus
import com.othello.arena.data.LeaderboardEntry
import com.othello.arena.data.OthelloRepository
import com.othello.arena.data.RealtimeEvent
import com.othello.arena.data.UserSession
import com.othello.arena.data.rankLabel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class Destination { SPLASH, AUTH, HOME, LEADERBOARD, MATCHMAKING, PRIVATE_ROOM, GAME }

enum class AuthMode { LOGIN, REGISTER }

data class OthelloUiState(
  val destination: Destination = Destination.SPLASH,
  val authMode: AuthMode = AuthMode.LOGIN,
  val session: UserSession? = null,
  val connection: ConnectionState = ConnectionState.DISCONNECTED,
  val isLoading: Boolean = false,
  val message: String? = null,
  val queueJoinedAt: Long? = null,
  val privateRoomCode: String? = null,
  val game: ActiveGame? = null,
  val leaderboard: List<LeaderboardEntry> = emptyList(),
  val leaderboardLoading: Boolean = false,
)

class OthelloViewModel(private val repository: OthelloRepository) : ViewModel() {
  private val _uiState = MutableStateFlow(OthelloUiState())
  val uiState: StateFlow<OthelloUiState> = _uiState.asStateFlow()

  init {
    viewModelScope.launch { repository.events.collect(::handleRealtimeEvent) }
    viewModelScope.launch {
      repository.connection.collect { connection -> _uiState.update { it.copy(connection = connection) } }
    }
    viewModelScope.launch {
      runCatching { repository.restoreSession() }
        .onSuccess { session ->
          _uiState.update {
            it.copy(
              destination = if (session == null) Destination.AUTH else Destination.HOME,
              session = session,
            )
          }
        }
        .onFailure { error ->
          _uiState.update { it.copy(destination = Destination.AUTH, message = error.userMessage()) }
        }
    }
  }

  fun setAuthMode(mode: AuthMode) = _uiState.update { it.copy(authMode = mode, message = null) }

  fun login(email: String, password: String) {
    if (email.isBlank() || password.isBlank()) {
      showMessage("Enter your email and password.")
      return
    }
    authenticate { repository.login(email, password) }
  }

  fun register(username: String, email: String, password: String) {
    if (username.length !in 3..20) {
      showMessage("Username must be 3–20 characters.")
      return
    }
    if (email.isBlank() || password.length < 6) {
      showMessage("Enter a valid email and a password of at least 6 characters.")
      return
    }
    authenticate { repository.register(username, email, password) }
  }

  fun playAsGuest() = authenticate { repository.guest() }

  fun logout() {
    viewModelScope.launch {
      _uiState.value.game?.takeIf { it.state.gameStatus == GameStatus.PLAYING }?.let { repository.resign(it.gameId) }
      repository.logout()
      _uiState.value = OthelloUiState(destination = Destination.AUTH)
    }
  }

  fun openHome() {
    when (_uiState.value.destination) {
      Destination.MATCHMAKING -> repository.leaveQueue()
      Destination.PRIVATE_ROOM -> repository.cancelRoom()
      else -> Unit
    }
    _uiState.update {
      it.copy(
        destination = Destination.HOME,
        queueJoinedAt = null,
        privateRoomCode = null,
        game = if (it.game?.state?.gameStatus == GameStatus.FINISHED) null else it.game,
        message = null,
      )
    }
  }

  fun openLeaderboard() {
    _uiState.update { it.copy(destination = Destination.LEADERBOARD) }
    refreshLeaderboard()
  }

  fun refreshLeaderboard() {
    if (_uiState.value.leaderboardLoading) return
    _uiState.update { it.copy(leaderboardLoading = true) }
    viewModelScope.launch {
      runCatching { repository.loadLeaderboard() }
        .onSuccess { entries -> _uiState.update { it.copy(leaderboard = entries, leaderboardLoading = false) } }
        .onFailure { error ->
          _uiState.update { it.copy(leaderboardLoading = false, message = error.userMessage()) }
        }
    }
  }

  fun findMatch() {
    val user = _uiState.value.session?.user ?: return
    repository.joinQueue(user.rating)
    _uiState.update { it.copy(isLoading = true, message = null) }
  }

  fun cancelMatchmaking() {
    repository.leaveQueue()
    _uiState.update { it.copy(destination = Destination.HOME, queueJoinedAt = null, isLoading = false) }
  }

  fun createPrivateRoom() {
    repository.createRoom()
    _uiState.update { it.copy(isLoading = true, message = null) }
  }

  fun joinPrivateRoom(code: String) {
    if (code.trim().length != 6) {
      showMessage("Enter the 6-character room code.")
      return
    }
    repository.joinRoom(code)
    _uiState.update { it.copy(isLoading = true, message = null) }
  }

  fun cancelPrivateRoom() {
    repository.cancelRoom()
    _uiState.update { it.copy(destination = Destination.HOME, privateRoomCode = null, isLoading = false) }
  }

  fun makeMove(row: Int, col: Int) {
    val game = _uiState.value.game ?: return
    if (game.state.gameStatus != GameStatus.PLAYING || game.state.currentPlayer != game.yourColor) return
    if (game.state.legalMoves.none { it.getOrNull(0) == row && it.getOrNull(1) == col }) return
    repository.makeMove(game.gameId, row, col)
  }

  fun resign() {
    _uiState.value.game?.let { repository.resign(it.gameId) }
  }

  fun requestRematch() {
    _uiState.value.game?.let { game ->
      repository.requestRematch(game.gameId)
      _uiState.update { state -> state.copy(game = game.copy(rematchRequested = true), message = "Rematch requested.") }
    }
  }

  fun dismissMessage() = _uiState.update { it.copy(message = null) }

  private fun authenticate(block: suspend () -> UserSession) {
    if (_uiState.value.isLoading) return
    _uiState.update { it.copy(isLoading = true, message = null) }
    viewModelScope.launch {
      runCatching { block() }
        .onSuccess { session ->
          _uiState.update {
            it.copy(destination = Destination.HOME, session = session, isLoading = false, message = null)
          }
        }
        .onFailure { error -> _uiState.update { it.copy(isLoading = false, message = error.userMessage()) } }
    }
  }

  private suspend fun handleRealtimeEvent(event: RealtimeEvent) {
    when (event) {
      is RealtimeEvent.QueueJoined ->
        _uiState.update {
          it.copy(
            destination = Destination.MATCHMAKING,
            queueJoinedAt = event.payload.joinedAt,
            isLoading = false,
          )
        }
      RealtimeEvent.QueueLeft ->
        _uiState.update { it.copy(destination = Destination.HOME, queueJoinedAt = null, isLoading = false) }
      is RealtimeEvent.GameFound -> showGame(event.payload)
      is RealtimeEvent.GameResumed -> showGame(event.payload, "Game reconnected.")
      is RealtimeEvent.GameRejoined ->
        _uiState.update { state ->
          val currentGame = state.game
          if (currentGame == null || currentGame.gameId != event.payload.gameId) {
            state.copy(message = "The game reconnected, but its local state was unavailable.")
          } else {
            state.copy(
              destination = Destination.GAME,
              game =
                currentGame.copy(
                  yourColor = event.payload.yourColor,
                  state = event.payload.state,
                  opponentReconnectDeadline = null,
                ),
              message = "Game reconnected.",
            )
          }
        }
      is RealtimeEvent.GameUpdated ->
        _uiState.update { state ->
          state.copy(
            game = state.game?.copy(
              state = event.payload.state,
              lastMove = event.payload.lastMove,
              flipped = event.payload.flipped,
              opponentReconnectDeadline = null,
            ),
          )
        }
      is RealtimeEvent.GameOver ->
        _uiState.update { state ->
          state.copy(
            game = state.game?.copy(
              state = event.payload.finalState,
              result = event.payload.result,
              gameOverReason = event.payload.reason,
              opponentReconnectDeadline = null,
            ),
          )
        }
      is RealtimeEvent.RatingUpdated -> {
        val currentSession = _uiState.value.session ?: return
        val updatedUser: AuthUser =
          currentSession.user.copy(
            rating = event.payload.newRating,
            rank = rankLabel(event.payload.newRating),
          )
        val updatedSession = currentSession.copy(user = updatedUser)
        repository.updateUser(updatedSession)
        _uiState.update { state ->
          state.copy(
            session = updatedSession,
            game = state.game?.copy(ratingChange = event.payload.ratingChange),
          )
        }
      }
      is RealtimeEvent.RoomCreated ->
        _uiState.update {
          it.copy(
            destination = Destination.PRIVATE_ROOM,
            privateRoomCode = event.payload.roomCode,
            isLoading = false,
          )
        }
      RealtimeEvent.RoomCancelled ->
        _uiState.update { it.copy(destination = Destination.HOME, privateRoomCode = null, isLoading = false) }
      is RealtimeEvent.OpponentDisconnected ->
        _uiState.update { state ->
          state.copy(
            game =
              state.game?.copy(
                opponentReconnectDeadline = event.payload.reconnectDeadline ?: System.currentTimeMillis() + 30_000,
              ),
          )
        }
      RealtimeEvent.OpponentReconnected ->
        _uiState.update { state ->
          state.copy(game = state.game?.copy(opponentReconnectDeadline = null), message = "Opponent reconnected.")
        }
      RealtimeEvent.RematchRequested ->
        _uiState.update { it.copy(message = "Your opponent wants a rematch.") }
      is RealtimeEvent.Failure ->
        _uiState.update { it.copy(isLoading = false, message = event.message) }
    }
  }

  private fun showGame(payload: GameFoundEvent, message: String? = null) {
    _uiState.update {
      it.copy(
        destination = Destination.GAME,
        queueJoinedAt = null,
        privateRoomCode = null,
        isLoading = false,
        message = message,
        game = ActiveGame(payload.gameId, payload.yourColor, payload.opponent, payload.state),
      )
    }
  }

  private fun showMessage(message: String) = _uiState.update { it.copy(message = message) }

  override fun onCleared() {
    repository.close()
    super.onCleared()
  }

  companion object {
    fun factory(repository: OthelloRepository): ViewModelProvider.Factory =
      object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
          OthelloViewModel(repository) as T
      }
  }
}

private fun Throwable.userMessage(): String =
  when (this) {
    is ApiException -> message ?: "The request failed."
    else -> message?.takeIf { it.isNotBlank() } ?: "Something went wrong. Check your connection and try again."
  }
