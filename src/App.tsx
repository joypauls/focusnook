import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Navbar } from "./components/Navbar";
import { SettingsMenu, SoundSettings } from "./components/SettingsMenu";

type AppScreen = "dashboard" | "create" | "timer";

interface Timer {
  id: string;
  name: string;
  duration_ms: number;
  remaining_ms: number;
  running: boolean;
  completed: boolean;
  created_at: string;
}

function msToMMSS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function CreateTimerScreen({ onStartTimer, onDashboard, activeTimerCount }: { 
  onStartTimer: (duration: number, name: string) => void;
  onDashboard: () => void;
  activeTimerCount?: number;
}) {
  const [minutes, setMinutes] = useState(25);
  const [sessionName, setSessionName] = useState("Focus Session");

  const quickPresets = [
    { name: "Quick Focus", minutes: 15 },
    { name: "Pomodoro", minutes: 25 },
    { name: "Deep Work", minutes: 45 },
    { name: "Long Focus", minutes: 90 },
  ];

  const handleStart = () => {
    onStartTimer(minutes * 60 * 1000, sessionName);
  };

  return (
    <div className="w-full max-w-lg mx-4 rounded-3xl p-8 border border-white/10 bg-white/5 backdrop-blur">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={onDashboard}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-sm"
          >
            ← Dashboard
          </button>
          <div className="text-center flex-1">
            <h1 className="text-3xl font-semibold">Create Timer</h1>
          </div>
          <div className="w-[84px]"></div>
        </div>
        <p className="text-sm text-white/60">Set up your focus session</p>
        {!!activeTimerCount && (
          <div className="text-xs text-emerald-400 mt-2">
            {activeTimerCount} timer{activeTimerCount > 1 ? "s" : ""} running in background
          </div>
        )}
      </header>

      <div className="space-y-6">
        <div>
          <label className="block text-sm text-white/70 mb-2">Session Name</label>
          <input 
            type="text" 
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-cyan-300/40"
            placeholder="What are you focusing on?"
          />
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-3">Duration</label>
          <div className="flex items-center gap-4 mb-4">
            <input 
              type="number" 
              min={1} 
              max={180}
              value={minutes}
              onChange={(e) => setMinutes(parseInt(e.target.value || "1", 10))}
              className="w-24 bg-white/10 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-cyan-300/40 text-center"
            />
            <span className="text-white/70">minutes</span>
            <div className="text-white/50 text-sm">({msToMMSS(minutes * 60 * 1000)})</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {quickPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => setMinutes(preset.minutes)}
                className={`p-3 rounded-xl border transition ${
                  minutes === preset.minutes 
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-300' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="font-medium text-sm">{preset.name}</div>
                <div className="text-xs text-white/60">{preset.minutes}m</div>
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handleStart}
          className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:ring-2 ring-emerald-300/50 transition font-medium text-lg"
        >
          Start Timer
        </button>

        <div className="text-xs text-white/55 leading-relaxed text-center">
          Tip: Choose a duration that feels achievable. You can always start another session when this one completes.
        </div>
      </div>
    </div>
  );
}

function TimerScreen({ 
  duration_ms, 
  remaining_ms, 
  running, 
  donePulse,
  timerName,
  onNewTimer,
  onStart,
  onPause,
  onResume,
  onReset,
  onDashboard
}: {
  duration_ms: number;
  remaining_ms: number;
  running: boolean;
  donePulse: boolean;
  timerName?: string;
  onNewTimer: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onDashboard?: () => void;
}) {
  const progress = useMemo(() => {
    const d = duration_ms || 1;
    return 1 - Math.min(Math.max(remaining_ms / d, 0), 1);
  }, [remaining_ms, duration_ms]);

  const size = 280, stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;

  return (
    <div className={["w-full max-w-2xl mx-4 rounded-3xl p-8 border border-white/10 bg-white/5 backdrop-blur", donePulse ? "ring-4 ring-emerald-400/30" : ""].join(" ")}>
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onDashboard && (
            <button 
              onClick={onDashboard}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-sm"
            >
              ← Dashboard
            </button>
          )}
          <div>
            <h1 className="text-2xl font-semibold">{timerName || "Focus Timer"}</h1>
            <p className="text-sm text-white/60 mt-1">Stay focused and productive</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onNewTimer}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 transition text-sm text-emerald-300"
          >
            + New Timer
          </button>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center mb-8">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="rotate-[-90deg]">
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="white" strokeOpacity="0.08" strokeWidth={stroke}/>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#grad)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} className="transition-[stroke-dasharray] duration-300 ease-out"/>
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="font-mono text-7xl tracking-wider select-none">{msToMMSS(remaining_ms)}</div>
              <div className="mt-2 text-sm text-white/60">
                {running ? "Running" : remaining_ms === 0 ? "Complete" : "Paused"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <div className="w-full text-center text-xs text-white/40 mb-2">
          Debug: running={running.toString()}, remaining={remaining_ms}, duration={duration_ms}
        </div>
        
        {!running ? (
          remaining_ms === duration_ms ? (
            <button onClick={onStart} className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:ring-2 ring-emerald-300/50 transition font-medium">
              Start Timer
            </button>
          ) : remaining_ms > 0 ? (
            <button onClick={onResume} className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 focus:ring-2 ring-cyan-300/50 transition font-medium">
              Resume
            </button>
          ) : (
            <button onClick={onReset} className="px-6 py-3 rounded-xl bg-slate-500 hover:bg-slate-400 focus:ring-2 ring-slate-300/50 transition font-medium">
              Reset to Start
            </button>
          )
        ) : (
          <button onClick={onPause} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 focus:ring-2 ring-amber-300/50 transition font-medium">
            Pause
          </button>
        )}
        
        {remaining_ms !== duration_ms && (
          <button onClick={onReset} className="px-6 py-3 rounded-xl bg-rose-500/90 hover:bg-rose-500 focus:ring-2 ring-rose-300/50 transition font-medium">
            Reset
          </button>
        )}
      </div>

      {remaining_ms === 0 && (
        <div className="mt-6 text-center">
          <div className="text-emerald-400 font-medium mb-2">🎉 Session Complete!</div>
          <p className="text-sm text-white/60">Great work! Ready for another session?</p>
        </div>
      )}
    </div>
  );
}

function DashboardScreen({ 
  timers, 
  onSelectTimer, 
  onCreateNew,
  onDeleteTimer
}: { 
  timers: Timer[];
  onSelectTimer: (timerId: string) => void;
  onCreateNew: () => void;
  onDeleteTimer: (timerId: string) => void;
}) {
  const activeTimers = timers.filter(t => !t.completed);
  const completedTimers = timers.filter(t => t.completed);

  return (
    <div key={`dashboard-${timers.length}-${timers.map(t => t.id).join('-')}`} className="w-full max-w-4xl mx-4">
      <header className="mb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold mb-2">Timer Dashboard</h1>
          <p className="text-sm text-white/60">Manage your focus sessions</p>
        </div>
        
        <div className="flex justify-center gap-4">
          <button 
            onClick={onCreateNew}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:ring-2 ring-emerald-300/50 transition font-medium flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Timer
          </button>
          
          {timers.length > 0 && (
            <div className="text-sm text-white/60 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              {timers.filter(t => t.running).length} running • {timers.filter(t => t.completed).length} completed
            </div>
          )}
        </div>
      </header>

      {activeTimers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-medium mb-4 text-white/90">Active Timers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full min-h-0">
            {activeTimers.map((timer) => (
              <TimerCard
                key={timer.id}
                timer={timer}
                onClick={() => onSelectTimer(timer.id)}
                onDelete={() => onDeleteTimer(timer.id)}
              />
            ))}
          </div>
        </div>
      )}

      {completedTimers.length > 0 && (
        <div>
          <h2 className="text-xl font-medium mb-4 text-white/60">Completed</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full min-h-0">
            {completedTimers.slice(0, 6).map((timer) => (
              <TimerCard
                key={timer.id}
                timer={timer}
                onClick={() => onSelectTimer(timer.id)}
                onDelete={() => onDeleteTimer(timer.id)}
                dimmed
              />
            ))}
          </div>
        </div>
      )}

      {timers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-white/40 mb-4 text-6xl">⏰</div>
          <h3 className="text-xl font-medium mb-2 text-white/60">No timers yet</h3>
          <p className="text-white/40 mb-6">Create your first focus session to get started</p>
          <button 
            onClick={onCreateNew}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:ring-2 ring-emerald-300/50 transition font-medium mb-6"
          >
            Create Timer
          </button>
          <div className="text-xs text-white/30 space-y-1">
            <p>💡 You can create multiple timers and switch between them</p>
            <p>Click on any timer card to view details and controls</p>
            <p>⌘+N to create new timer • ⌘+D for dashboard • ESC to go back</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TimerCard({ 
  timer, 
  onClick, 
  onDelete,
  dimmed = false 
}: { 
  timer: Timer; 
  onClick: () => void; 
  onDelete?: () => void;
  dimmed?: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const progress = useMemo(() => {
    const d = timer.duration_ms || 1;
    return 1 - Math.min(Math.max(timer.remaining_ms / d, 0), 1);
  }, [timer.remaining_ms, timer.duration_ms]);

  const getStatusColor = () => {
    if (timer.completed) return "text-emerald-400";
    if (timer.running) return "text-cyan-400";
    return "text-amber-400";
  };

  const getStatusText = () => {
    if (timer.completed) return "Complete";
    if (timer.running) return "Running";
    return "Paused";
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-all text-left w-full cursor-pointer ${
        dimmed 
          ? "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]" 
          : "border-white/10 bg-white/5 hover:bg-white/10 hover:scale-[1.02]"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-medium truncate flex-1 ${dimmed ? "text-white/40" : "text-white/90"}`}>
          {timer.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full border ${
            dimmed ? "border-white/5 text-white/30" : `border-current/20 ${getStatusColor()}`
          }`}>
            {getStatusText()}
          </span>
          {onDelete && !showDeleteConfirm && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className={`p-1.5 rounded-full transition-colors hover:scale-110 ${
                dimmed 
                  ? "text-white/20 hover:text-white/40 hover:bg-white/5" 
                  : "text-white/40 hover:text-red-400 hover:bg-red-500/20"
              }`}
              title="Delete timer"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18"/>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          )}
          {onDelete && showDeleteConfirm && (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }}
                className="px-2 py-1 text-xs rounded bg-red-500 hover:bg-red-400 text-white"
                title="Confirm delete"
                type="button"
              >
                Delete
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white"
                title="Cancel"
                type="button"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className={`font-mono text-2xl mb-2 ${dimmed ? "text-white/30" : "text-white"}`}>
        {msToMMSS(timer.remaining_ms)}
      </div>
      
      <div className={`w-full h-2 rounded-full overflow-hidden ${dimmed ? "bg-white/5" : "bg-white/10"}`}>
        <div 
          className={`h-full transition-all duration-300 ${
            dimmed ? 'bg-white/20' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      
      <div className={`text-xs mt-2 ${dimmed ? "text-white/25" : "text-white/50"}`}>
        {timer.duration_ms === timer.remaining_ms ? "Ready to start" : `${Math.round(progress * 100)}% complete`}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("dashboard");
  const [timers, setTimers] = useState<Timer[]>([]);
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);
  const [donePulse, setDonePulse] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>({
    soundFile: "/beep1.mp3",
    volume: 0.5
  });

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // Keyboard shortcuts
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "n":
            e.preventDefault();
            setScreen("create");
            break;
          case "d":
            e.preventDefault();
            setScreen("dashboard");
            break;
          case "Escape":
            e.preventDefault();
            if (screen !== "dashboard") {
              setScreen("dashboard");
            }
            break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);

    // Load timers from Rust backend
    const loadTimers = async () => {
      try {
        const backendTimers = await invoke<Timer[]>("get_all_timers");
        setTimers(backendTimers);
      } catch (error) {
        console.error("Failed to load timers:", error);
      }
    };

    loadTimers();

    // Listen for timer tick events from Rust backend
    const setupTimerListeners = async () => {
      const unlistenTick = await listen<{timer_id: string, remaining_ms: number, duration_ms: number, running: boolean}>("timer:tick", (event) => {
        const { timer_id, remaining_ms } = event.payload;
        setTimers(prevTimers => 
          prevTimers.map(timer => 
            timer.id === timer_id 
              ? { ...timer, remaining_ms, running: true, completed: false }
              : timer
          )
        );
      });

      const unlistenDone = await listen<{timer_id: string, finished_at: string}>("timer:done", (event) => {
        const { timer_id } = event.payload;
        setTimers(prevTimers => 
          prevTimers.map(timer => {
            if (timer.id === timer_id) {
              // Timer just completed - play sound according to settings
              if (soundSettings.soundFile !== "none") {
                const audio = new Audio(soundSettings.soundFile);
                audio.volume = soundSettings.volume;
                audio.play().catch(() => {});
              }
              setDonePulse(true);
              setTimeout(() => setDonePulse(false), 1200);
              
              return { ...timer, remaining_ms: 0, running: false, completed: true };
            }
            return timer;
          })
        );
      });

      unsubs.push(unlistenTick, unlistenDone);
    };

    setupTimerListeners();

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      unsubs.forEach((u) => u());
    };
  }, []);

  const handleStartTimer = async (duration: number, name: string) => {
    try {
      const timerId = Date.now().toString();
      
      const newTimer = await invoke<Timer>("make_timer", {
        id: timerId,
        name: name,
        durationMs: duration
      });
      
      await invoke("start_timer", { 
        timerId: newTimer.id
      });
      
      const startedTimer = { ...newTimer, running: true };
      setTimers(prev => [...prev, startedTimer]);
      
      setSelectedTimerId(newTimer.id);
      setScreen("timer");
    } catch (error) {
      console.error("Failed to create timer:", error);
      alert(`Failed to create timer: ${(error as any)?.message || error}`);
    }
  };

  const handleSelectTimer = (timerId: string) => {
    setSelectedTimerId(timerId);
    setScreen("timer");
  };

  const handleNewTimer = () => {
    setScreen("create");
    setDonePulse(false);
  };

  const handleDashboard = () => {
    setScreen("dashboard");
    setSelectedTimerId(null);
  };

  const selectedTimer = timers.find(t => t.id === selectedTimerId);

  const start = async (timerId: string) => { 
    try {
      await invoke("start_timer", { timerId: timerId });
    } catch (error) {
      console.error("Failed to start timer:", error);
    }
  };
  
  const pause = async (timerId: string) => { 
    try {
      await invoke("pause_timer", { timerId: timerId });
      setTimers(prev => prev.map(t => 
        t.id === timerId ? { ...t, running: false } : t
      ));
    } catch (error) {
      console.error("Failed to pause timer:", error);
    }
  };
  
  const resume = async (timerId: string) => { 
    try {
      await invoke("resume_timer", { timerId: timerId });
    } catch (error) {
      console.error("Failed to resume timer:", error);
    }
  };
  
  const reset = async (timerId: string) => { 
    try {
      await invoke("reset_timer", { timerId: timerId });
      setTimers(prev => prev.map(t => 
        t.id === timerId ? { ...t, remaining_ms: t.duration_ms, running: false, completed: false } : t
      ));
    } catch (error) {
      console.error("Failed to reset timer:", error);
    }
  };

  const deleteTimer = async (timerId: string) => {
    try {
      await invoke("delete_timer", { timerId: timerId });
      setTimers(prev => prev.filter(t => t.id !== timerId));
      
      if (selectedTimerId === timerId) {
        setScreen("dashboard");
        setSelectedTimerId(null);
      }
    } catch (error) {
      console.error("Failed to delete timer:", error);
    }
  };

  return (
    <div className="relative min-h-screen w-screen bg-gradient-to-b from-[#2d1b3d] to-[#1a0d25] text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-[#2d1b3d] to-[#1a0d25]" />
      
      <Navbar onSettingsClick={() => setSettingsOpen(true)} />
      
      <SettingsMenu
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={soundSettings}
        onSettingsChange={setSoundSettings}
      />
      
      <div className="relative z-10 w-full flex justify-center p-4 py-8 pt-20">
        {screen === "dashboard" ? (
          <DashboardScreen
            timers={timers}
            onSelectTimer={handleSelectTimer}
            onCreateNew={handleNewTimer}
            onDeleteTimer={deleteTimer}
          />
        ) : screen === "create" ? (
          <CreateTimerScreen 
            onStartTimer={handleStartTimer} 
            onDashboard={handleDashboard}
            activeTimerCount={timers.filter(t => t.running).length}
          />
        ) : selectedTimer ? (
          <TimerScreen
            duration_ms={selectedTimer.duration_ms}
            remaining_ms={selectedTimer.remaining_ms}
            running={selectedTimer.running}
            donePulse={donePulse}
            timerName={selectedTimer.name}
            onNewTimer={handleNewTimer}
            onStart={() => start(selectedTimer.id)}
            onPause={() => pause(selectedTimer.id)}
            onResume={() => resume(selectedTimer.id)}
            onReset={() => reset(selectedTimer.id)}
            onDashboard={handleDashboard}
          />
        ) : (
          <div className="text-center">
            <div className="text-white/60">Timer not found</div> 
            <button 
              onClick={handleDashboard}
              className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-sm"
            >
              ← Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
