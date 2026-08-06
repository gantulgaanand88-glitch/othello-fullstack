package com.othello.arena.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.othello.arena.theme.OthelloTheme
import org.junit.Rule
import org.junit.Test

class AuthScreenTest {
  @get:Rule val composeRule = createComposeRule()

  @Test
  fun loginScreen_exposesNativeEntryPoints() {
    composeRule.setContent {
      OthelloTheme {
        AuthScreen(
          mode = AuthMode.LOGIN,
          isLoading = false,
          onModeChange = {},
          onLogin = { _, _ -> },
          onRegister = { _, _, _, _, _ -> },
          onGuest = {},
        )
      }
    }

    composeRule.onNodeWithText("OTHELLO ARENA").assertIsDisplayed()
    composeRule.onNodeWithText("Enter arena").assertIsDisplayed()
    composeRule.onNodeWithText("Play instantly as guest").assertIsDisplayed()
  }

  @Test
  fun registerScreen_exposesAccountRequirements() {
    composeRule.setContent {
      OthelloTheme {
        AuthScreen(
          mode = AuthMode.REGISTER,
          isLoading = false,
          onModeChange = {},
          onLogin = { _, _ -> },
          onRegister = { _, _, _, _, _ -> },
          onGuest = {},
        )
      }
    }

    composeRule.onNodeWithText("At least 8 characters").fetchSemanticsNode()
    composeRule.onNodeWithText("I confirm that I am at least 13 years old.").fetchSemanticsNode()
    composeRule.onNodeWithText("I agree to the Terms of Service and Privacy Policy.").fetchSemanticsNode()
  }
}
