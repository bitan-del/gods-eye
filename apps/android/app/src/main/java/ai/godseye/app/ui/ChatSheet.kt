package ai.godseye.app.ui

import androidx.compose.runtime.Composable
import ai.godseye.app.MainViewModel
import ai.godseye.app.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
