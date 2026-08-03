package com.othello.arena

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.othello.arena.data.AppContainer
import com.othello.arena.theme.OthelloTheme
import com.othello.arena.ui.OthelloApp
import com.othello.arena.ui.OthelloViewModel

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    enableEdgeToEdge()
    setContent {
      OthelloTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
          val container = remember { AppContainer(applicationContext) }
          val appViewModel: OthelloViewModel = viewModel(factory = OthelloViewModel.factory(container.repository))
          OthelloApp(viewModel = appViewModel)
        }
      }
    }
  }
}
