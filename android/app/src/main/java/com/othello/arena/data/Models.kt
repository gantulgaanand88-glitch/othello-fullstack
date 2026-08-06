package com.othello.arena.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class PlayerColor {
  @SerialName("black") BLACK,
  @SerialName("white") WHITE,
}

@Serializable
enum class GameWinner {
  @SerialName("black") BLACK,
  @SerialName("white") WHITE,
  @SerialName("draw") DRAW,
}

@Serializable
enum class GameStatus {
  @SerialName("playing") PLAYING,
  @SerialName("finished") FINISHED,
}

@Serializable
enum class GameResult {
  @SerialName("win") WIN,
  @SerialName("loss") LOSS,
  @SerialName("draw") DRAW,
}

@Serializable
data class AuthUser(
  val id: String,
  val username: String,
  val email: String = "",
  val rating: Int,
  val rank: String,
  val gamesPlayed: Int,
  val wins: Int,
  val losses: Int,
  val draws: Int,
  val isGuest: Boolean = false,
)

@Serializable data class AuthResponse(val token: String, val user: AuthUser)

@Serializable data class LoginRequest(val email: String, val password: String)

@Serializable
data class RegisterRequest(
  val username: String,
  val email: String,
  val password: String,
  val ageConfirmed: Boolean,
)

@Serializable
data class ApiErrorResponse(
  val message: String,
  val errors: Map<String, List<String>> = emptyMap(),
)

@Serializable
data class LeaderboardEntry(
  val id: String,
  val position: Int,
  val username: String,
  val rating: Int,
  val rank: String,
  val gamesPlayed: Int,
  val wins: Int,
  val losses: Int,
  val draws: Int,
)

@Serializable
data class MoveRecord(
  val player: PlayerColor,
  val row: Int,
  val col: Int,
  val flipped: List<List<Int>> = emptyList(),
  val resultingPlayer: PlayerColor? = null,
  val blackScore: Int,
  val whiteScore: Int,
  val timestamp: String,
)

@Serializable
data class GameState(
  val board: List<List<PlayerColor?>>,
  val currentPlayer: PlayerColor,
  val legalMoves: List<List<Int>>,
  val moveHistory: List<MoveRecord>,
  val blackScore: Int,
  val whiteScore: Int,
  val gameStatus: GameStatus,
  val winner: GameWinner? = null,
)

@Serializable
data class OpponentSummary(
  val id: String,
  val username: String,
  val rating: Int,
)

@Serializable data class QueueJoinedEvent(val joinedAt: Long)

@Serializable
data class GameFoundEvent(
  val gameId: String,
  val yourColor: PlayerColor,
  val opponent: OpponentSummary,
  val state: GameState,
)

@Serializable
data class GameRejoinedEvent(
  val gameId: String,
  val yourColor: PlayerColor,
  val state: GameState,
  val remainingTime: Long? = null,
)

@Serializable
data class GameUpdateEvent(
  val state: GameState,
  val lastMove: MoveRecord? = null,
  val flipped: List<List<Int>> = emptyList(),
)

@Serializable
data class GameOverEvent(
  val result: GameResult,
  val reason: String,
  val winner: GameWinner? = null,
  val finalState: GameState,
)

@Serializable data class RatingUpdateEvent(val newRating: Int, val ratingChange: Int)

@Serializable data class RoomCreatedEvent(val roomCode: String)

@Serializable data class MessageEvent(val message: String)

@Serializable data class InvalidMoveEvent(val reason: String)

@Serializable
data class OpponentDisconnectedEvent(
  val userId: String? = null,
  val reconnectDeadline: Long? = null,
)

data class UserSession(val token: String, val user: AuthUser)

data class ActiveGame(
  val gameId: String,
  val yourColor: PlayerColor,
  val opponent: OpponentSummary,
  val state: GameState,
  val lastMove: MoveRecord? = null,
  val flipped: List<List<Int>> = emptyList(),
  val result: GameResult? = null,
  val gameOverReason: String? = null,
  val ratingChange: Int? = null,
  val opponentReconnectDeadline: Long? = null,
  val rematchRequested: Boolean = false,
)

fun rankLabel(rating: Int): String =
  when {
    rating < 1000 -> "Beginner"
    rating < 1400 -> "Intermediate"
    rating < 1800 -> "Advanced"
    rating < 2200 -> "Expert"
    else -> "Master"
  }
