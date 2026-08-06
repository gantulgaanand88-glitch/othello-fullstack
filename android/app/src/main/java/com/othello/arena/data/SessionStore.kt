package com.othello.arena.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val Context.sessionDataStore by preferencesDataStore(name = "othello_session")

class SessionStore(
  context: Context,
  private val json: Json,
) {
  private val dataStore = context.sessionDataStore

  suspend fun load(): UserSession? {
    val preferences = dataStore.data.first()
    val token = preferences[TOKEN_KEY] ?: return null
    val userJson = preferences[USER_KEY] ?: return null
    return try {
      UserSession(token, json.decodeFromString<AuthUser>(userJson))
    } catch (_: SerializationException) {
      clear()
      null
    }
  }

  suspend fun save(session: UserSession) {
    dataStore.edit { preferences ->
      preferences[TOKEN_KEY] = session.token
      preferences[USER_KEY] = json.encodeToString(session.user)
    }
  }

  suspend fun clear() {
    dataStore.edit { it.clear() }
  }

  companion object {
    private val TOKEN_KEY = stringPreferencesKey("token")
    private val USER_KEY = stringPreferencesKey("user")
  }
}
