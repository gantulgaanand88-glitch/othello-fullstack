package com.othello.arena.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun AuthScreen(
  mode: AuthMode,
  isLoading: Boolean,
  onModeChange: (AuthMode) -> Unit,
  onLogin: (String, String) -> Unit,
  onRegister: (String, String, String) -> Unit,
  onGuest: () -> Unit,
) {
  var username by remember { mutableStateOf("") }
  var email by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }

  Column(
    modifier =
      Modifier.fillMaxSize()
        .imePadding()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 24.dp, vertical = 40.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().widthIn(max = 480.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      OthelloMark(72)
      Text(
        text = "OTHELLO ARENA",
        modifier = Modifier.padding(top = 20.dp),
        fontSize = 24.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 4.sp,
      )
      Text(
        text = "Native. Real-time. Competitive.",
        modifier = Modifier.padding(top = 8.dp, bottom = 28.dp),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )

      SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
        AuthMode.entries.forEachIndexed { index, authMode ->
          SegmentedButton(
            selected = mode == authMode,
            onClick = { onModeChange(authMode) },
            shape = SegmentedButtonDefaults.itemShape(index, AuthMode.entries.size),
            label = { Text(if (authMode == AuthMode.LOGIN) "Login" else "Register") },
          )
        }
      }

      Spacer(Modifier.height(20.dp))

      if (mode == AuthMode.REGISTER) {
        OutlinedTextField(
          value = username,
          onValueChange = { if (it.length <= 20) username = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("Username") },
          singleLine = true,
          enabled = !isLoading,
          keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
        )
        Spacer(Modifier.height(12.dp))
      }

      OutlinedTextField(
        value = email,
        onValueChange = { email = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Email") },
        singleLine = true,
        enabled = !isLoading,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
      )
      Spacer(Modifier.height(12.dp))
      OutlinedTextField(
        value = password,
        onValueChange = { password = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Password") },
        singleLine = true,
        enabled = !isLoading,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
      )

      Button(
        onClick = {
          if (mode == AuthMode.LOGIN) onLogin(email, password)
          else onRegister(username, email, password)
        },
        modifier = Modifier.fillMaxWidth().padding(top = 20.dp).height(52.dp),
        enabled = !isLoading,
      ) {
        if (isLoading) CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp)
        else Text(if (mode == AuthMode.LOGIN) "Enter arena" else "Create account", fontWeight = FontWeight.SemiBold)
      }

      Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        HorizontalDivider(Modifier.weight(1f))
        Text("OR", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        HorizontalDivider(Modifier.weight(1f))
      }

      OutlinedButton(
        onClick = onGuest,
        modifier = Modifier.fillMaxWidth().height(52.dp),
        enabled = !isLoading,
      ) {
        Text("Play instantly as guest")
      }
      Text(
        text = "Guest matches are unranked.",
        modifier = Modifier.padding(top = 12.dp),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        fontSize = 12.sp,
      )
    }
  }
}
