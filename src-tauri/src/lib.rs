// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod timer;

use tauri::{App, AppHandle, Manager};
use timer::{TimerState, Timer};

#[tauri::command]
async fn create_timer(
  state: tauri::State<'_, TimerState>,
  id: String,
  name: String,
  duration_ms: i64
) -> Result<Timer, String> {
  println!("create_timer called with id: {}, name: {}, duration_ms: {}", id, name, duration_ms);
  let result = state.create_timer(id, name, duration_ms);
  match &result {
    Ok(timer) => println!("Timer created successfully: {:?}", timer),
    Err(e) => println!("Failed to create timer: {}", e),
  }
  result
}

#[tauri::command]
async fn get_all_timers(state: tauri::State<'_, TimerState>) -> Result<Vec<Timer>, String> {
  Ok(state.get_all_timers())
}

#[tauri::command]
async fn delete_timer(
  state: tauri::State<'_, TimerState>,
  timer_id: String
) -> Result<(), String> {
  state.delete_timer(&timer_id)
}

#[tauri::command]
async fn start_timer(
  app: AppHandle,
  state: tauri::State<'_, TimerState>,
  timer_id: String
) -> Result<(), String> {
  println!("start_timer called with timer_id: {}", timer_id);
  let result = state.start_timer(app, &timer_id);
  match &result {
    Ok(_) => println!("Timer started successfully"),
    Err(e) => println!("Failed to start timer: {}", e),
  }
  result
}

#[tauri::command]
async fn pause_timer(
  app: AppHandle,
  state: tauri::State<'_, TimerState>,
  timer_id: String
) -> Result<(), String> {
  state.pause_timer(app, &timer_id)
}

#[tauri::command]
async fn resume_timer(
  app: AppHandle,
  state: tauri::State<'_, TimerState>,
  timer_id: String
) -> Result<(), String> {
  state.resume_timer(app, &timer_id)
}

#[tauri::command]
async fn reset_timer(
  app: AppHandle,
  state: tauri::State<'_, TimerState>,
  timer_id: String
) -> Result<(), String> {
  state.reset_timer(app, &timer_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app: &mut App| {
      app.manage(TimerState::new());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      create_timer,
      get_all_timers,
      delete_timer,
      start_timer,
      pause_timer,
      resume_timer,
      reset_timer
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
