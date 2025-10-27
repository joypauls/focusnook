use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;

/// Global timer state shared via Tauri State
#[derive(Clone, Default)]
pub struct TimerState(Arc<Mutex<Inner>>);

#[derive(Default)]
struct Inner {
    remaining_ms: i64,
    target_at: Option<Instant>,
    runner: Option<JoinHandle<()>>,
    cancel_tx: Option<oneshot::Sender<()>>,
    running: bool,
    initial_ms: i64,
}

/// Payload sent to frontend on every tick
#[derive(serde::Serialize, Clone)]
struct TickPayload {
    remaining_ms: i64,
    initial_ms: i64,
    running: bool,
}

/// Payload sent to frontend when timer finishes
#[derive(serde::Serialize, Clone)]
struct DonePayload {
    finished_at: String,
}

impl TimerState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_running(&self) -> bool {
        self.0.lock().unwrap().running
    }

    pub fn remaining(&self) -> i64 {
        self.0.lock().unwrap().remaining_ms
    }

    pub fn set_initial(&self, ms: i64) {
        let mut inner = self.0.lock().unwrap();
        inner.initial_ms = ms;
        inner.remaining_ms = ms;
    }

    pub fn start(&self, app: AppHandle, duration_ms: i64) {
        let mut inner = self.0.lock().unwrap();

        // Cancel existing timer if running
        if let Some(tx) = inner.cancel_tx.take() {
            let _ = tx.send(());
        }
        if let Some(handle) = inner.runner.take() {
            handle.abort();
        }

        inner.initial_ms = duration_ms;
        inner.target_at = Some(Instant::now() + Duration::from_millis(duration_ms as u64));
        inner.running = true;

        let (tx, mut rx) = oneshot::channel::<()>();
        inner.cancel_tx = Some(tx);
        let state = self.clone();

        inner.runner = Some(tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1));
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        let mut guard = (state.0).lock().unwrap();
                        let now = Instant::now();
                        let remaining = guard.target_at
                            .map(|t| (t.saturating_duration_since(now)).as_millis() as i64)
                            .unwrap_or(0);
                        guard.remaining_ms = remaining.max(0);

                        let payload = TickPayload {
                            remaining_ms: guard.remaining_ms,
                            initial_ms: guard.initial_ms,
                            running: guard.running
                        };
                        drop(guard);
                        let _ = app.emit("timer:tick", payload);

                        if remaining <= 0 {
                            let mut g = (state.0).lock().unwrap();
                            g.running = false;
                            g.target_at = None;
                            g.cancel_tx = None;
                            drop(g);
                            let payload = DonePayload {
                                finished_at: chrono::Utc::now().to_rfc3339()
                            };
                            let _ = app.emit("timer:done", payload);
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
    }

    pub fn pause(&self) {
        let mut inner = self.0.lock().unwrap();
        if !inner.running {
            return;
        }
        if let Some(tx) = inner.cancel_tx.take() {
            let _ = tx.send(());
        }
        if let Some(handle) = inner.runner.take() {
            handle.abort();
        }
        if let Some(target) = inner.target_at {
            let now = Instant::now();
            inner.remaining_ms = (target.saturating_duration_since(now)).as_millis() as i64;
        }
        inner.target_at = None;
        inner.running = false;
    }

    pub fn resume(&self, app: AppHandle) {
        let remaining_snapshot;
        {
            let inner = self.0.lock().unwrap();
            if inner.running {
                return;
            }
            remaining_snapshot = if inner.remaining_ms > 0 {
                inner.remaining_ms
            } else {
                inner.initial_ms
            };
        }
        self.start(app, remaining_snapshot);
    }

    pub fn reset(&self) {
        let mut inner = self.0.lock().unwrap();
        if let Some(tx) = inner.cancel_tx.take() {
            let _ = tx.send(());
        }
        if let Some(handle) = inner.runner.take() {
            handle.abort();
        }
        inner.remaining_ms = inner.initial_ms;
        inner.target_at = None;
        inner.running = false;
    }
}
