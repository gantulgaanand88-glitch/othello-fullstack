package com.othello.arena.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val ArenaColorScheme =
  darkColorScheme(
    primary = ArenaGreen,
    onPrimary = ArenaBackground,
    primaryContainer = ArenaGreenDark,
    onPrimaryContainer = ArenaText,
    secondary = ArenaMint,
    background = ArenaBackground,
    onBackground = ArenaText,
    surface = ArenaSurface,
    onSurface = ArenaText,
    surfaceVariant = ArenaSurfaceHigh,
    onSurfaceVariant = ArenaMuted,
    outline = ArenaOutline,
    error = ArenaError,
  )

@Composable
fun OthelloTheme(
  content: @Composable () -> Unit,
) {
  MaterialTheme(colorScheme = ArenaColorScheme, typography = Typography, content = content)
}
