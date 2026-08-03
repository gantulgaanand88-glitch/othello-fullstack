package com.othello.arena.data

import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class ApiException(message: String, val statusCode: Int? = null) : IOException(message)

class ApiClient(
  baseUrl: String,
  private val client: OkHttpClient,
  private val json: Json,
) {
  private val baseUrl = baseUrl.trimEnd('/')
  private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

  suspend fun login(email: String, password: String): AuthResponse =
    post("/auth/login", LoginRequest(email.trim(), password))

  suspend fun register(username: String, email: String, password: String): AuthResponse =
    post("/auth/register", RegisterRequest(username.trim(), email.trim(), password))

  suspend fun guest(): AuthResponse = postEmpty("/auth/guest")

  suspend fun leaderboard(): List<LeaderboardEntry> = get("/leaderboard")

  private suspend inline fun <reified RequestType, reified ResponseType> post(
    path: String,
    body: RequestType,
  ): ResponseType =
    execute(
      Request.Builder()
        .url(baseUrl + path)
        .post(json.encodeToString(body).toRequestBody(jsonMediaType))
        .build(),
    )

  private suspend inline fun <reified ResponseType> postEmpty(path: String): ResponseType =
    execute(
      Request.Builder()
        .url(baseUrl + path)
        .post("{}".toRequestBody(jsonMediaType))
        .build(),
    )

  private suspend inline fun <reified ResponseType> get(path: String): ResponseType =
    execute(Request.Builder().url(baseUrl + path).get().build())

  private suspend inline fun <reified ResponseType> execute(request: Request): ResponseType =
    withContext(Dispatchers.IO) {
      client.newCall(request).execute().use { response ->
        val responseBody = response.body?.string().orEmpty()
        if (!response.isSuccessful) {
          val message =
            try {
              json.decodeFromString<MessageEvent>(responseBody).message
            } catch (_: SerializationException) {
              "Request failed (${response.code})."
            }
          throw ApiException(message, response.code)
        }

        try {
          json.decodeFromString<ResponseType>(responseBody)
        } catch (error: SerializationException) {
          throw ApiException("The server returned an invalid response.").also { it.initCause(error) }
        }
      }
    }
}
