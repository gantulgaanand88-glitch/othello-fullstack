package com.othello.arena.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.othello.arena.data.AuthUser
import com.othello.arena.data.ConnectionState
import com.othello.arena.data.LeaderboardEntry
import kotlinx.coroutines.delay

@Composable
fun HomeScreen(
  state: OthelloUiState,
  onFindMatch: () -> Unit,
  onCreateRoom: () -> Unit,
  onJoinRoom: (String) -> Unit,
  onLeaderboard: () -> Unit,
  onLogout: () -> Unit,
) {
  val user = state.session?.user ?: return
  var joinCode by remember { mutableStateOf("") }

  Column(
    modifier =
      Modifier.fillMaxSize()
        .safeDrawingPadding()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 20.dp, vertical = 16.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Column(modifier = Modifier.fillMaxWidth().widthIn(max = 760.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          OthelloMark(48)
          Column(Modifier.padding(start = 12.dp)) {
            Text("OTHELLO ARENA", fontWeight = FontWeight.Bold, letterSpacing = 1.8.sp)
            ConnectionLabel(state.connection)
          }
        }
        TextButton(onClick = onLogout) { Text("Logout") }
      }

      Card(
        modifier = Modifier.fillMaxWidth().padding(top = 22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      ) {
        Column(Modifier.padding(20.dp)) {
          Text("Welcome back", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
          Text(
            text = user.username,
            modifier = Modifier.padding(top = 2.dp),
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
          )
          Row(
            modifier = Modifier.fillMaxWidth().padding(top = 18.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
          ) {
            StatTile("RATING", user.rating.toString(), Modifier.weight(1f))
            StatTile("RANK", user.rank, Modifier.weight(1f))
            StatTile("WINS", user.wins.toString(), Modifier.weight(1f))
          }
        }
      }

      Text(
        text = "PLAY",
        modifier = Modifier.padding(top = 28.dp, bottom = 10.dp),
        color = MaterialTheme.colorScheme.primary,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 2.sp,
      )
      Button(
        onClick = onFindMatch,
        modifier = Modifier.fillMaxWidth().height(58.dp),
        enabled = !state.isLoading,
      ) {
        if (state.isLoading) CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
        else Text("Find ranked match", fontWeight = FontWeight.Bold, fontSize = 16.sp)
      }

      Card(
        modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      ) {
        Column(Modifier.padding(18.dp)) {
          Text("Private match", fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
          Text(
            "Create a room or enter a friend's six-character code.",
            modifier = Modifier.padding(top = 4.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 13.sp,
          )
          OutlinedButton(
            onClick = onCreateRoom,
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp).height(48.dp),
            enabled = !state.isLoading,
          ) {
            Text("Create private room")
          }
          Row(
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            OutlinedTextField(
              value = joinCode,
              onValueChange = { value -> joinCode = value.uppercase().filter(Char::isLetterOrDigit).take(6) },
              modifier = Modifier.weight(1f),
              label = { Text("Room code") },
              singleLine = true,
              keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
            )
            Button(onClick = { onJoinRoom(joinCode) }, enabled = !state.isLoading) { Text("Join") }
          }
        }
      }

      OutlinedButton(
        onClick = onLeaderboard,
        modifier = Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 28.dp).height(52.dp),
      ) {
        Text("View global leaderboard")
      }
    }
  }
}

@Composable
private fun StatTile(label: String, value: String, modifier: Modifier = Modifier) {
  Column(
    modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp)).padding(12.dp),
  ) {
    Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, letterSpacing = 1.sp)
    Text(
      value,
      modifier = Modifier.padding(top = 5.dp),
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      fontWeight = FontWeight.Bold,
      fontSize = 17.sp,
    )
  }
}

@Composable
fun ConnectionLabel(connection: ConnectionState) {
  val (color, label) =
    when (connection) {
      ConnectionState.CONNECTED -> MaterialTheme.colorScheme.primary to "Live server connected"
      ConnectionState.CONNECTING -> Color(0xFFFBBF24) to "Connecting…"
      ConnectionState.DISCONNECTED -> MaterialTheme.colorScheme.error to "Reconnecting…"
    }
  Row(verticalAlignment = Alignment.CenterVertically) {
    Box(Modifier.size(7.dp).background(color, CircleShape))
    Text(label, modifier = Modifier.padding(start = 6.dp), color = color, fontSize = 11.sp)
  }
}

@Composable
fun MatchmakingScreen(joinedAt: Long, connection: ConnectionState, onCancel: () -> Unit) {
  var now by remember(joinedAt) { mutableLongStateOf(System.currentTimeMillis()) }
  LaunchedEffect(joinedAt) {
    while (true) {
      now = System.currentTimeMillis()
      delay(1_000)
    }
  }
  val elapsed = ((now - joinedAt).coerceAtLeast(0) / 1_000).toInt()
  val time = "%02d:%02d".format(elapsed / 60, elapsed % 60)

  Column(
    modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(28.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    OthelloMark(84)
    Text("Finding your opponent", modifier = Modifier.padding(top = 28.dp), fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Text(
      text = if (elapsed >= 10) "Expanded rating range for a faster match" else "Searching close to your rating",
      modifier = Modifier.padding(top = 10.dp),
      color = MaterialTheme.colorScheme.onSurfaceVariant,
      textAlign = TextAlign.Center,
    )
    Text(time, modifier = Modifier.padding(top = 28.dp), color = MaterialTheme.colorScheme.primary, fontSize = 38.sp, fontWeight = FontWeight.Bold)
    ConnectionLabel(connection)
    OutlinedButton(onClick = onCancel, modifier = Modifier.padding(top = 32.dp).width(180.dp).height(50.dp)) { Text("Cancel search") }
  }
}

@Composable
fun PrivateRoomScreen(roomCode: String, connection: ConnectionState, onCancel: () -> Unit) {
  Column(
    modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(28.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    Text("PRIVATE ROOM", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
    Text("Share this code", modifier = Modifier.padding(top = 14.dp), fontSize = 25.sp, fontWeight = FontWeight.Bold)
    Card(
      modifier = Modifier.padding(top = 24.dp),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
      Text(roomCode, modifier = Modifier.padding(horizontal = 30.dp, vertical = 20.dp), color = MaterialTheme.colorScheme.primary, fontSize = 38.sp, fontWeight = FontWeight.Bold, letterSpacing = 7.sp)
    }
    Text("Waiting for the second player…", modifier = Modifier.padding(top = 22.dp, bottom = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
    ConnectionLabel(connection)
    OutlinedButton(onClick = onCancel, modifier = Modifier.padding(top = 28.dp).height(50.dp)) { Text("Cancel room") }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaderboardScreen(
  entries: List<LeaderboardEntry>,
  isLoading: Boolean,
  onRefresh: () -> Unit,
  onHome: () -> Unit,
) {
  Scaffold(
    containerColor = Color.Transparent,
    topBar = {
      TopAppBar(
        title = { Text("Global leaderboard", fontWeight = FontWeight.Bold) },
        navigationIcon = { TextButton(onClick = onHome) { Text("Back") } },
        actions = { TextButton(onClick = onRefresh, enabled = !isLoading) { Text("Refresh") } },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background.copy(alpha = 0.94f)),
      )
    },
  ) { padding ->
    if (isLoading && entries.isEmpty()) {
      Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    } else {
      LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 12.dp),
      ) {
        items(entries, key = { it.id }) { entry -> LeaderboardRow(entry) }
        if (entries.isEmpty()) {
          item { Text("No ranked players yet.", modifier = Modifier.fillMaxWidth().padding(40.dp), textAlign = TextAlign.Center) }
        }
      }
    }
  }
}

@Composable
private fun LeaderboardRow(entry: LeaderboardEntry) {
  Row(
    modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp).background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp)).padding(16.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text("#${entry.position}", modifier = Modifier.width(48.dp), color = if (entry.position <= 3) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.Bold)
    Column(Modifier.weight(1f)) {
      Text(entry.username, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
      Text("${entry.rank} • ${entry.wins} wins", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
    }
    Text(entry.rating.toString(), fontWeight = FontWeight.Bold, fontSize = 18.sp)
  }
}
