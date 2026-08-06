package com.othello.arena.data

import io.socket.client.IO
import io.socket.client.Socket
import java.net.URI
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import org.json.JSONObject

enum class ConnectionState { DISCONNECTED, CONNECTING, CONNECTED }

sealed interface RealtimeEvent {
  data class QueueJoined(val payload: QueueJoinedEvent) : RealtimeEvent
  data object QueueLeft : RealtimeEvent
  data class GameFound(val payload: GameFoundEvent) : RealtimeEvent
  data class GameResumed(val payload: GameFoundEvent) : RealtimeEvent
  data class GameRejoined(val payload: GameRejoinedEvent) : RealtimeEvent
  data class GameUpdated(val payload: GameUpdateEvent) : RealtimeEvent
  data class GameOver(val payload: GameOverEvent) : RealtimeEvent
  data class RatingUpdated(val payload: RatingUpdateEvent) : RealtimeEvent
  data class RoomCreated(val payload: RoomCreatedEvent) : RealtimeEvent
  data object RoomCancelled : RealtimeEvent
  data class OpponentDisconnected(val payload: OpponentDisconnectedEvent) : RealtimeEvent
  data object OpponentReconnected : RealtimeEvent
  data object RematchRequested : RealtimeEvent
  data class Failure(val message: String) : RealtimeEvent
}

class RealtimeClient(
  private val socketUrl: String,
  private val httpClient: OkHttpClient,
  private val json: Json,
) {
  private val _events = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 64)
  val events: SharedFlow<RealtimeEvent> = _events.asSharedFlow()

  private val _connection = MutableStateFlow(ConnectionState.DISCONNECTED)
  val connection: StateFlow<ConnectionState> = _connection.asStateFlow()

  private var socket: Socket? = null
  private var token: String? = null
  private var activeGameId: String? = null

  fun connect(authToken: String) {
    if (socket != null && token == authToken) {
      if (socket?.connected() == false) {
        _connection.value = ConnectionState.CONNECTING
        socket?.connect()
      }
      return
    }

    disconnect()
    token = authToken
    _connection.value = ConnectionState.CONNECTING

    val options =
      IO.Options.builder()
        .setForceNew(true)
        .setAuth(mapOf("token" to authToken))
        .setReconnection(true)
        .setReconnectionAttempts(Int.MAX_VALUE)
        .setReconnectionDelay(500)
        .setReconnectionDelayMax(5_000)
        .setRandomizationFactor(0.35)
        .setTimeout(15_000)
        .build()
        .also {
          it.callFactory = httpClient
          it.webSocketFactory = httpClient
        }

    socket = IO.socket(URI.create(socketUrl), options).also(::registerListeners)
    socket?.connect()
  }

  fun disconnect() {
    socket?.off()
    socket?.disconnect()
    socket = null
    token = null
    activeGameId = null
    _connection.value = ConnectionState.DISCONNECTED
  }

  fun joinQueue(@Suppress("UNUSED_PARAMETER") rating: Int) = emit("joinQueue")

  fun leaveQueue() = emit("leaveQueue")

  fun createRoom() = emit("createRoom")

  fun joinRoom(roomCode: String) =
    emit("joinRoom", JSONObject().put("roomCode", roomCode.trim().uppercase()))

  fun cancelRoom() = emit("cancelRoom")

  fun makeMove(gameId: String, row: Int, col: Int) =
    emit("makeMove", JSONObject().put("gameId", gameId).put("row", row).put("col", col))

  fun resign(gameId: String) = emit("resign", JSONObject().put("gameId", gameId))

  fun requestRematch(gameId: String) = emit("requestRematch", JSONObject().put("gameId", gameId))

  private fun emit(event: String, payload: JSONObject? = null) {
    val activeSocket = socket
    if (activeSocket?.connected() != true) {
      _events.tryEmit(RealtimeEvent.Failure("Still connecting to the game server. Try again in a moment."))
      return
    }
    if (payload == null) activeSocket.emit(event) else activeSocket.emit(event, payload)
  }

  private fun registerListeners(activeSocket: Socket) {
    activeSocket.on(Socket.EVENT_CONNECT) {
      _connection.value = ConnectionState.CONNECTED
      activeGameId?.let { gameId -> activeSocket.emit("rejoinGame", JSONObject().put("gameId", gameId)) }
    }
    activeSocket.on(Socket.EVENT_DISCONNECT) { _connection.value = ConnectionState.DISCONNECTED }
    activeSocket.on(Socket.EVENT_CONNECT_ERROR) { args ->
      _connection.value = ConnectionState.DISCONNECTED
      _events.tryEmit(RealtimeEvent.Failure("Unable to connect to the game server. Retrying…"))
    }

    activeSocket.on("queueJoined") { args -> decode<QueueJoinedEvent>(args)?.let { _events.tryEmit(RealtimeEvent.QueueJoined(it)) } }
    activeSocket.on("queueLeft") { _events.tryEmit(RealtimeEvent.QueueLeft) }
    activeSocket.on("gameFound") { args ->
      decode<GameFoundEvent>(args)?.let {
        activeGameId = it.gameId
        _events.tryEmit(RealtimeEvent.GameFound(it))
      }
    }
    activeSocket.on("gameResumed") { args -> decode<GameFoundEvent>(args)?.let { _events.tryEmit(RealtimeEvent.GameResumed(it)) } }
    activeSocket.on("gameRejoined") { args ->
      decode<GameRejoinedEvent>(args)?.let {
        activeGameId = it.gameId
        _events.tryEmit(RealtimeEvent.GameRejoined(it))
      }
    }
    activeSocket.on("gameUpdate") { args -> decode<GameUpdateEvent>(args)?.let { _events.tryEmit(RealtimeEvent.GameUpdated(it)) } }
    activeSocket.on("gameOver") { args ->
      decode<GameOverEvent>(args)?.let {
        activeGameId = null
        _events.tryEmit(RealtimeEvent.GameOver(it))
      }
    }
    activeSocket.on("ratingUpdate") { args -> decode<RatingUpdateEvent>(args)?.let { _events.tryEmit(RealtimeEvent.RatingUpdated(it)) } }
    activeSocket.on("roomCreated") { args -> decode<RoomCreatedEvent>(args)?.let { _events.tryEmit(RealtimeEvent.RoomCreated(it)) } }
    activeSocket.on("roomCancelled") { _events.tryEmit(RealtimeEvent.RoomCancelled) }
    activeSocket.on("opponentDisconnected") { args ->
      decode<OpponentDisconnectedEvent>(args)?.let { _events.tryEmit(RealtimeEvent.OpponentDisconnected(it)) }
    }
    activeSocket.on("opponentReconnected") { _events.tryEmit(RealtimeEvent.OpponentReconnected) }
    activeSocket.on("rematchRequested") { _events.tryEmit(RealtimeEvent.RematchRequested) }
    activeSocket.on("roomError") { args -> decode<MessageEvent>(args)?.let { _events.tryEmit(RealtimeEvent.Failure(it.message)) } }
    activeSocket.on("invalidMove") { args -> decode<InvalidMoveEvent>(args)?.let { _events.tryEmit(RealtimeEvent.Failure(it.reason)) } }
    activeSocket.on("serverError") { args -> decode<MessageEvent>(args)?.let { _events.tryEmit(RealtimeEvent.Failure(it.message)) } }
    activeSocket.on("error") { args -> decode<MessageEvent>(args)?.let { _events.tryEmit(RealtimeEvent.Failure(it.message)) } }
  }

  private inline fun <reified T> decode(args: Array<out Any>): T? {
    val raw = args.firstOrNull() ?: return null
    return try {
      json.decodeFromString<T>(raw.toString())
    } catch (_: SerializationException) {
      _events.tryEmit(RealtimeEvent.Failure("The game server sent an invalid update."))
      null
    }
  }
}
