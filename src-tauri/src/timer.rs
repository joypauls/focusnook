use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use chrono::Utc;

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
        let mut inner = self.0.lock().map_err(|_| "Failed to lock timer state".to_string())?;
        
        if inner.timers.contains_key(&id) {
            return Err("Timer with this ID already exists".to_string());
        }

        let created_at = Utc::now().to_rfc3339();
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
            created_at: created_at.clone(),
        };

        inner.timers.insert(id.clone(), timer_instance);
        
        Ok(Timer {
            id,
            name,
            duration_ms,
            remaining_ms: duration_ms,
            running: false,
            completed: false,
            created_at,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_timer() {
        let state = TimerState::new();
        let timer = state.create_timer(
            "test1".to_string(),
            "Test Timer".to_string(),
            5000
        ).unwrap();

        assert_eq!(timer.id, "test1");
        assert_eq!(timer.name, "Test Timer");
        assert_eq!(timer.duration_ms, 5000);
        assert_eq!(timer.remaining_ms, 5000);
        assert!(!timer.running);
        assert!(!timer.completed);
    }

    #[test]
    fn test_create_duplicate_timer_fails() {
        let state = TimerState::new();
        
        // Create first timer
        state.create_timer("test1".to_string(), "Test Timer".to_string(), 5000).unwrap();
        
        // Try to create duplicate - should fail
        let result = state.create_timer("test1".to_string(), "Duplicate Timer".to_string(), 3000);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Timer with this ID already exists");
    }

    #[test]
    fn test_get_all_timers() {
        let state = TimerState::new();
        
        // Initially empty
        assert_eq!(state.get_all_timers().len(), 0);
        
        // Add a timer
        state.create_timer("test1".to_string(), "Test Timer 1".to_string(), 5000).unwrap();
        let timers = state.get_all_timers();
        assert_eq!(timers.len(), 1);
        assert_eq!(timers[0].id, "test1");
        
        // Add another timer
        state.create_timer("test2".to_string(), "Test Timer 2".to_string(), 3000).unwrap();
        let timers = state.get_all_timers();
        assert_eq!(timers.len(), 2);
    }

    #[test]
    fn test_delete_timer() {
        let state = TimerState::new();
        
        // Create timer
        state.create_timer("test1".to_string(), "Test Timer".to_string(), 5000).unwrap();
        assert_eq!(state.get_all_timers().len(), 1);
        
        // Delete timer
        let result = state.delete_timer("test1");
        assert!(result.is_ok());
        assert_eq!(state.get_all_timers().len(), 0);
        
        // Try to delete non-existent timer
        let result = state.delete_timer("nonexistent");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Timer not found");
    }

    #[test]
    fn test_timer_initial_state() {
        let state = TimerState::new();
        let timer = state.create_timer(
            "test1".to_string(),
            "Test Timer".to_string(),
            10000
        ).unwrap();

        // Timer should start in a stopped state
        assert!(!timer.running);
        assert!(!timer.completed);
        assert_eq!(timer.remaining_ms, timer.duration_ms);
        assert!(!timer.created_at.is_empty());
    }

    #[test]
    fn test_timer_not_found_operations() {
        let state = TimerState::new();
        
        // We can't easily test the start/pause/resume/reset functions without a proper AppHandle
        // but we can at least test that error handling works for timer lookup
        {
            let inner = state.0.lock().unwrap();
            assert!(inner.timers.get("nonexistent").is_none());
        }
    }

    #[test]
    fn test_create_timer_with_zero_duration() {
        let state = TimerState::new();
        let timer = state.create_timer(
            "zero_timer".to_string(),
            "Zero Duration Timer".to_string(),
            0
        ).unwrap();

        assert_eq!(timer.duration_ms, 0);
        assert_eq!(timer.remaining_ms, 0);
        assert!(!timer.running);
        assert!(!timer.completed);
    }

    #[test]
    fn test_create_timer_with_negative_duration() {
        let state = TimerState::new();
        let timer = state.create_timer(
            "negative_timer".to_string(),
            "Negative Duration Timer".to_string(),
            -1000
        ).unwrap();

        // System allows negative durations (might be intentional behavior)
        assert_eq!(timer.duration_ms, -1000);
        assert_eq!(timer.remaining_ms, -1000);
    }

    #[test]
    fn test_timer_created_at_timestamp() {
        let state = TimerState::new();
        let before = chrono::Utc::now();
        
        let timer = state.create_timer(
            "timestamp_test".to_string(),
            "Timestamp Test".to_string(),
            5000
        ).unwrap();
        
        let after = chrono::Utc::now();
        
        // Parse the timestamp and verify it's within reasonable bounds
        let created_at = chrono::DateTime::parse_from_rfc3339(&timer.created_at).unwrap();
        let created_at_utc = created_at.with_timezone(&chrono::Utc);
        assert!(created_at_utc >= before);
        assert!(created_at_utc <= after);
    }

    #[test]
    fn test_multiple_timer_management() {
        let state = TimerState::new();
        
        // Create multiple timers with different properties
        let _timer1 = state.create_timer("short".to_string(), "Short Timer".to_string(), 1000).unwrap();
        let _timer2 = state.create_timer("long".to_string(), "Long Timer".to_string(), 60000).unwrap();
        let _timer3 = state.create_timer("medium".to_string(), "Medium Timer".to_string(), 10000).unwrap();
        
        let all_timers = state.get_all_timers();
        assert_eq!(all_timers.len(), 3);
        
        // Verify we can find each timer by ID
        let timer_ids: std::collections::HashSet<String> = all_timers.iter().map(|t| t.id.clone()).collect();
        assert!(timer_ids.contains("short"));
        assert!(timer_ids.contains("long"));
        assert!(timer_ids.contains("medium"));
        
        // Delete one timer and verify count
        state.delete_timer("medium").unwrap();
        assert_eq!(state.get_all_timers().len(), 2);
        
        // Verify the right timer was deleted
        let remaining_ids: std::collections::HashSet<String> = state.get_all_timers().iter().map(|t| t.id.clone()).collect();
        assert!(remaining_ids.contains("short"));
        assert!(remaining_ids.contains("long"));
        assert!(!remaining_ids.contains("medium"));
    }

    #[test]
    fn test_timer_name_handling() {
        let state = TimerState::new();
        
        // Test empty name
        let timer1 = state.create_timer("empty_name".to_string(), "".to_string(), 5000).unwrap();
        assert_eq!(timer1.name, "");
        
        // Test long name
        let long_name = "A".repeat(1000);
        let timer2 = state.create_timer("long_name".to_string(), long_name.clone(), 5000).unwrap();
        assert_eq!(timer2.name, long_name);
        
        // Test name with special characters
        let special_name = "Timer with émojis 🕐 and symbols!@#$%^&*()";
        let timer3 = state.create_timer("special_name".to_string(), special_name.to_string(), 5000).unwrap();
        assert_eq!(timer3.name, special_name);
    }

    #[test]
    fn test_timer_id_edge_cases() {
        let state = TimerState::new();
        
        // Test empty ID
        let timer1 = state.create_timer("".to_string(), "Empty ID Timer".to_string(), 5000).unwrap();
        assert_eq!(timer1.id, "");
        
        // Test very long ID
        let long_id = "x".repeat(1000);
        let timer2 = state.create_timer(long_id.clone(), "Long ID Timer".to_string(), 5000).unwrap();
        assert_eq!(timer2.id, long_id);
        
        // Verify both timers exist
        assert_eq!(state.get_all_timers().len(), 2);
    }
}
