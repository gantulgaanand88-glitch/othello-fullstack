package com.othello.arena.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ModelsTest {
  private val json = Json { ignoreUnknownKeys = true }

  @Test
  fun gameState_decodesServerPayload() {
    val payload =
      """
      {
        "board": [[null,"black"],["white",null]],
        "currentPlayer": "white",
        "legalMoves": [[1,1]],
        "moveHistory": [],
        "blackScore": 2,
        "whiteScore": 2,
        "gameStatus": "playing",
        "winner": null
      }
      """.trimIndent()

    val state = json.decodeFromString<GameState>(payload)

    assertEquals(PlayerColor.WHITE, state.currentPlayer)
    assertEquals(PlayerColor.BLACK, state.board[0][1])
    assertNull(state.board[1][1])
    assertEquals(listOf(1, 1), state.legalMoves.single())
  }

  @Test
  fun rankLabels_matchServerThresholds() {
    assertEquals("Beginner", rankLabel(999))
    assertEquals("Intermediate", rankLabel(1000))
    assertEquals("Advanced", rankLabel(1400))
    assertEquals("Expert", rankLabel(1800))
    assertEquals("Master", rankLabel(2200))
  }

  @Test
  fun registerRequest_includesRequiredAgeConfirmation() {
    val request = RegisterRequest("player_one", "player@example.com", "password123", ageConfirmed = true)

    val encoded = json.encodeToString(request)
    val decoded = json.decodeFromString<RegisterRequest>(encoded)

    assertEquals(true, decoded.ageConfirmed)
  }
}
