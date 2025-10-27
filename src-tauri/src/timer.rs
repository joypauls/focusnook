do use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;

/// Timer data that can be serialized and sent to the frontend
#[derive(serde::Serialize, Clone, Debug)]
pub struct Timer {
    pub id: String,
    pub name: String,
    pub duration_ms: i64,
    pub remaining_ms: i64,
    pub running: bool,
    pub completed: bool,
    pub created_at: String,
}

/// Global multi-timer state shared via Tauri State
#[derive(Clone, Default)]
pub struct TimerState(Arc<Mutex<MultiTimerInner>>);

#[derive(Default)]
struct MultiTimerInner {
    timers: HashMap<String, TimerInstance>,
}

struct TimerInstance {
    id: String,
    name: String,
    duration_ms: i64,
    remaining_ms: i64,
    target_at: Option<Instant>,
    runner: Option<JoinHandle<()>>,
    cancel_tx: Option<oneshot::Sender<()>>,
    running: bool,
    completed: bool,
    created_at: String,
}

/// Payload sent to frontend on every tick for a specific timer
#[derive(serde::Serialize, Clone)]
struct TimerTickPayload {
    timer_id: String,
    remaining_ms: i64,
    duration_ms: i64,
    running: bool,
}

/// Payload sent to frontend when a timer finishes
#[derive(serde::Serialize, Clone)]
struct TimerDonePayload {
    timer_id: String,
    finished_at: String,
}

impl TimerState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn create_timer(&self, id: String, name: String, duration_ms: i64) -> Result<Timer, String> {
        let mut inner = self.0.lock().unwrap();
        
        if inner.timers.contains_key(&id) {
            return Err("Timer with this ID already exists".to_string());
        }

        let timer_instance = TimerInstance {
            id: id.clone(),
            name: name.clone(),
            duration_ms,
            remaining_ms: duration_ms,
            target_at: None,
            runner: None,
            cancel_tx: None,
            running: false,
            completed: false,
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        inner.timers.insert(id.clone(), timer_instance);
        
        Ok(Timer {
            id,
            name,
            duration_ms,
            remaining_ms: duration_ms,
            running: false,
            completed: false,
            created_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    pub fn get_all_timers(&self) -> Vec<Timer> {
        let inner = self.0.lock().unwrap();
        inner.timers.values().map(|instance| Timer {
            id: instance.id.clone(),
            name: instance.name.clone(),
            duration_ms: instance.duration_ms,
            remaining_ms: instance.remaining_ms,
            running: instance.running,
            completed: instance.completed,
            created_at: instance.created_at.clone(),
        }).collect()
    }

    pub fn delete_timer(&self, timer_id: &str) -> Result<(), String> {
        let mut inner = self.0.lock().unwrap();
        
        if let Some(mut timer) = inner.timers.remove(timer_id) {
            // Cancel the timer if it's running
            if let Some(tx) = timer.cancel_tx.take() {
                let _ = tx.send(());
            }
            if let Some(handle) = timer.runner.take() {
                handle.abort();
            }
            Ok(())
        } else {
            Err("Timer not found".to_string())
        }
    }

    pub fn start_timer(&self, app: AppHandle, timer_id: &str) -> Result<(), String> {
        let mut inner = self.0.lock().unwrap();
        
        let timer = inner.timers.get_mut(timer_id)
            .ok_or("Timer not found")?;

        // Cancel existing runner if any
        if let Some(tx) = timer.cancel_tx.take() {
            let _ = tx.send(());
        }
        if let Some(handle) = timer.runner.take() {
            handle.abort();
        }

        timer.target_at = Some(Instant::now() + Duration::from_millis(timer.remaining_ms as u64));
        timer.running = true;
        timer.completed = false;

        // Emit immediate state update to frontend
        let immediate_payload = TimerTickPayload {
            timer_id: timer_id.to_string(),
            remaining_ms: timer.remaining_ms,
            duration_ms: timer.duration_ms,
            running: timer.running
        };
        let _ = app.emit("timer:tick", immediate_payload);

        let (tx, mut rx) = oneshot::channel::<()>();
        timer.cancel_tx = Some(tx);
        
        let state = self.clone();
        let id = timer_id.to_string();

        timer.runner = Some(tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1));
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        let remaining = {
                            let mut guard = state.0.lock().unwrap();
                            if let Some(timer) = guard.timers.get_mut(&id) {
                                let now = Instant::now();
                                let remaining = timer.target_at
                                    .map(|t| (t.saturating_duration_since(now)).as_millis() as i64)
                                    .unwrap_or(0);
                                timer.remaining_ms = remaining.max(0);

                                let payload = TimerTickPayload {
                                    timer_id: id.clone(),
                                    remaining_ms: timer.remaining_ms,
                                    duration_ms: timer.duration_ms,
                                    running: timer.running
                                };
                                let _ = app.emit("timer:tick", payload);
                                remaining
                            } else {
                                0 // Timer was deleted
                            }
                        };

                        if remaining <= 0 {
                            let mut guard = state.0.lock().unwrap();
                            if let Some(timer) = guard.timers.get_mut(&id) {
                                timer.running = false;
                                timer.completed = true;
                                timer.target_at = None;
                                timer.cancel_tx = None;
                                
                                let payload = TimerDonePayload {
                                    timer_id: id.clone(),
                                    finished_at: chrono::Utc::now().to_rfc3339()
                                };
                                let _ = app.emit("timer:done", payload);
                            }
                            break;
                        }
                    }
                    _ = &mut rx => {
                        // timer cancelled
                        break;
                    }
                }
            }
        }));

        Ok(())
    }

    pub fn pause_timer(&self, app: AppHandle, timer_id: &str) -> Result<(), String> {
        let mut inner = self.0.lock().unwrap();
        
        let timer = inner.timers.get_mut(timer_id)
            .ok_or("Timer not found")?;

        if !timer.running {
            return Ok(());
        }

        if let Some(tx) = timer.cancel_tx.take() {
            let _ = tx.send(());
        }
        if let Some(handle) = timer.runner.take() {
            handle.abort();
        }

        if let Some(target) = timer.target_at {
            let now = Instant::now();
            timer.remaining_ms = (target.saturating_duration_since(now)).as_millis() as i64;
        }
        timer.target_at = None;
        timer.running = false;

        // Emit immediate state update to frontend
        let payload = TimerTickPayload {
            timer_id: timer_id.to_string(),
            remaining_ms: timer.remaining_ms,
            duration_ms: timer.duration_ms,
            running: timer.running
        };
        let _ = app.emit("timer:tick", payload);

        Ok(())
    }

    pub fn resume_timer(&self, app: AppHandle, timer_id: &str) -> Result<(), String> {
        {
            let inner = self.0.lock().unwrap();
            let timer = inner.timers.get(timer_id)
                .ok_or("Timer not found")?;
            
            if timer.running {
                return Ok(());
            }
        }
        
        self.start_timer(app, timer_id)
    }

    pub fn reset_timer(&self, app: AppHandle, timer_id: &str) -> Result<(), String> {
        let mut inner = self.0.lock().unwrap();
        
        let timer = inner.timers.get_mut(timer_id)
            .ok_or("Timer not found")?;

        if let Some(tx) = timer.cancel_tx.take() {
            let _ = tx.send(());
        }
        if let Some(handle) = timer.runner.take() {
            handle.abort();
        }

        timer.remaining_ms = timer.duration_ms;
        timer.target_at = None;
        timer.running = false;
        timer.completed = false;

        // Emit immediate state update to frontend
        let payload = TimerTickPayload {
            timer_id: timer_id.to_string(),
            remaining_ms: timer.remaining_ms,
            duration_ms: timer.duration_ms,
            running: timer.running
        };
        let _ = app.emit("timer:tick", payload);

        Ok(())
    }
}
