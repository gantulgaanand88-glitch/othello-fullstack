package com.othello.arena.data

import android.content.Context
import com.othello.arena.BuildConfig
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient

class OthelloRepository(
  private val api: ApiClient,
  private val sessionStore: SessionStore,
  private val realtime: RealtimeClient,
) {
  val events: SharedFlow<RealtimeEvent> = realtime.events
  val connection: StateFlow<ConnectionState> = realtime.connection

  suspend fun restoreSession(): UserSession? = sessionStore.load()?.also { realtime.connect(it.token) }

  suspend fun login(email: String, password: String): UserSession =
    persist(api.login(email, password))

  suspend fun register(username: String, email: String, password: String): UserSession =
    persist(api.register(username, email, password))

  suspend fun guest(): UserSession = persist(api.guest())

  suspend fun loadLeaderboard(): List<LeaderboardEntry> = api.leaderboard()

  suspend fun updateUser(session: UserSession) = sessionStore.save(session)

  suspend fun logout() {
    realtime.disconnect()
    sessionStore.clear()
  }

  fun close() = realtime.disconnect()

  fun reconnect(session: UserSession) = realtime.connect(session.token)
  fun joinQueue(rating: Int) = realtime.joinQueue(rating)
  fun leaveQueue() = realtime.leaveQueue()
  fun createRoom() = realtime.createRoom()
  fun joinRoom(code: String) = realtime.joinRoom(code)
  fun cancelRoom() = realtime.cancelRoom()
  fun makeMove(gameId: String, row: Int, col: Int) = realtime.makeMove(gameId, row, col)
  fun resign(gameId: String) = realtime.resign(gameId)
  fun requestRematch(gameId: String) = realtime.requestRematch(gameId)

  private suspend fun persist(response: AuthResponse): UserSession {
    val session = UserSession(response.token, response.user)
    sessionStore.save(session)
    realtime.connect(session.token)
    return session
  }
}

class AppContainer(context: Context) {
  private val json = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    explicitNulls = false
  }

  private val httpClient =
    OkHttpClient.Builder()
      .connectTimeout(15, TimeUnit.SECONDS)
      .readTimeout(20, TimeUnit.SECONDS)
      .writeTimeout(20, TimeUnit.SECONDS)
      .retryOnConnectionFailure(true)
      .build()

  val repository =
    OthelloRepository(
      api = ApiClient(BuildConfig.API_BASE_URL, httpClient, json),
      sessionStore = SessionStore(context.applicationContext, json),
      realtime = RealtimeClient(BuildConfig.SOCKET_URL, httpClient, json),
    )
}
