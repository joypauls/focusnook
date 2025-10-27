// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod timer;

use tauri::{App, AppHandle, Manager};
use timer::TimerState;

#[tauri::command]
async fn start_timer(
  app: AppHandle,
  state: tauri::State<'_, TimerState>,
  duration_ms: i64
) -> Result<(), String> {
  state.set_initial(duration_ms);
  state.start(app, duration_ms);
  Ok(())
}

#[tauri::command]
async fn pause_timer(state: tauri::State<'_, TimerState>) -> Result<(), String> {
  state.pause();
  Ok(())
}

#[tauri::command]
async fn resume_timer(
  app: AppHandle,
  state: tauri::State<'_, TimerState>
) -> Result<(), String> {
  state.resume(app);
  Ok(())
}

#[tauri::command]
async fn reset_timer(state: tauri::State<'_, TimerState>) -> Result<(), String> {
  state.reset();
  Ok(())
}

#[tauri::command]
async fn remaining_ms(state: tauri::State<'_, TimerState>) -> Result<i64, String> {
  Ok(state.remaining())
}

#[tauri::command]
async fn is_running(state: tauri::State<'_, TimerState>) -> Result<bool, String> {
  Ok(state.is_running())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app: &mut App| {
      app.manage(TimerState::new());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      start_timer,
      pause_timer,
      resume_timer,
      reset_timer,
      remaining_ms,
      is_running
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
