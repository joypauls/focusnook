import { useEffect, useMemo, useState } from "react";
type AppScreen = 'dashboard' | 'create' | 'timer';

interface Timer {
  id: string;
  name: string;
  duration: number;
  remaining: number;
  running: boolean;
  completed: boolean;
  createdAt: Date;
}

function msToMMSS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function CreateTimerScreen({ onStartTimer, onDashboard }: { 
  onStartTimer: (duration: number, name: string) => void;
  onDashboard: () => void;
}) {
  const [minutes, setMinutes] = useState(25);
  const [sessionName, setSessionName] = useState('Focus Session');

  const quickPresets = [
    { name: 'Quick Focus', minutes: 15 },
    { name: 'Pomodoro', minutes: 25 },
    { name: 'Deep Work', minutes: 45 },
    { name: 'Long Focus', minutes: 90 },
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
          <div className="w-[84px]"></div> {/* Spacer for balance */}
        </div>
        <p className="text-sm text-white/60">Set up your focus session</p>
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
  duration, 
  remaining, 
  running, 
  donePulse,
  onNewTimer,
  onStart,
  onPause,
  onResume,
  onReset,
  onDashboard
}: {
  duration: number;
  remaining: number;
  running: boolean;
  donePulse: boolean;
  onNewTimer: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onDashboard?: () => void;
}) {
  const progress = useMemo(() => {
    const d = duration || 1;
    return 1 - Math.min(Math.max(remaining / d, 0), 1);
  }, [remaining, duration]);

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
            <h1 className="text-2xl font-semibold">Focus Timer</h1>
            <p className="text-sm text-white/60 mt-1">Stay focused and productive</p>
          </div>
        </div>
        <button 
          onClick={onNewTimer}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-sm"
        >
          New Timer
        </button>
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
              <div className="font-mono text-7xl tracking-wider select-none">{msToMMSS(remaining)}</div>
              <div className="mt-2 text-sm text-white/60">
                {running ? "Running" : remaining === 0 ? "Complete" : "Paused"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {!running ? (
          remaining === duration ? (
            <button onClick={onStart} className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:ring-2 ring-emerald-300/50 transition font-medium">
              Start Timer
            </button>
          ) : remaining > 0 ? (
            <button onClick={onResume} className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 focus:ring-2 ring-cyan-300/50 transition font-medium">
              Resume
            </button>
          ) : null
        ) : (
          <button onClick={onPause} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 focus:ring-2 ring-amber-300/50 transition font-medium">
            Pause
          </button>
        )}
        
        {remaining !== duration && (
          <button onClick={onReset} className="px-6 py-3 rounded-xl bg-rose-500/90 hover:bg-rose-500 focus:ring-2 ring-rose-300/50 transition font-medium">
            Reset
          </button>
        )}
      </div>

      {remaining === 0 && (
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
  onCreateNew 
}: { 
  timers: Timer[];
  onSelectTimer: (timerId: string) => void;
  onCreateNew: () => void;
}) {
  const activeTimers = timers.filter(t => !t.completed);
  const completedTimers = timers.filter(t => t.completed);

  return (
    <div className="w-full max-w-4xl mx-4">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold mb-2">Timer Dashboard</h1>
        <p className="text-sm text-white/60">Manage your focus sessions</p>
      </header>

      <div className="flex justify-center mb-8">
        <button 
          onClick={onCreateNew}
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:ring-2 ring-emerald-300/50 transition font-medium"
        >
          + New Timer
        </button>
      </div>

      {activeTimers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-medium mb-4 text-white/90">Active Timers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTimers.map((timer) => (
              <TimerCard
                key={timer.id}
                timer={timer}
                onClick={() => onSelectTimer(timer.id)}
              />
            ))}
          </div>
        </div>
      )}

      {completedTimers.length > 0 && (
        <div>
          <h2 className="text-xl font-medium mb-4 text-white/60">Completed</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedTimers.slice(0, 6).map((timer) => (
              <TimerCard
                key={timer.id}
                timer={timer}
                onClick={() => onSelectTimer(timer.id)}
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
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:ring-2 ring-emerald-300/50 transition font-medium"
          >
            Create Timer
          </button>
        </div>
      )}
    </div>
  );
}

function TimerCard({ 
  timer, 
  onClick, 
  dimmed = false 
}: { 
  timer: Timer; 
  onClick: () => void; 
  dimmed?: boolean;
}) {
  const progress = useMemo(() => {
    const d = timer.duration || 1;
    return 1 - Math.min(Math.max(timer.remaining / d, 0), 1);
  }, [timer.remaining, timer.duration]);

  const getStatusColor = () => {
    if (timer.completed) return 'text-emerald-400';
    if (timer.running) return 'text-cyan-400';
    return 'text-amber-400';
  };

  const getStatusText = () => {
    if (timer.completed) return 'Complete';
    if (timer.running) return 'Running';
    return 'Paused';
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-2xl border transition-all text-left w-full ${
        dimmed 
          ? 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]' 
          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:scale-[1.02]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-medium truncate ${dimmed ? 'text-white/40' : 'text-white/90'}`}>
          {timer.name}
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full border ${
          dimmed ? 'border-white/5 text-white/30' : `border-current/20 ${getStatusColor()}`
        }`}>
          {getStatusText()}
        </span>
      </div>
      
      <div className={`font-mono text-2xl mb-2 ${dimmed ? 'text-white/30' : 'text-white'}`}>
        {msToMMSS(timer.remaining)}
      </div>
      
      <div className={`w-full h-2 rounded-full overflow-hidden ${dimmed ? 'bg-white/5' : 'bg-white/10'}`}>
        <div 
          className={`h-full transition-all duration-300 ${
            dimmed ? 'bg-white/20' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      
      <div className={`text-xs mt-2 ${dimmed ? 'text-white/25' : 'text-white/50'}`}>
        {timer.duration === timer.remaining ? 'Ready to start' : `${Math.round(progress * 100)}% complete`}
      </div>
    </button>
  );
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('dashboard');
  const [timers, setTimers] = useState<Timer[]>([]);
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);
  const [donePulse, setDonePulse] = useState(false);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // For now, simulate timer updates in frontend until backend is updated
    const interval = setInterval(() => {
      setTimers(prevTimers => 
        prevTimers.map(timer => {
          if (!timer.running || timer.completed) return timer;
          
          const newRemaining = Math.max(0, timer.remaining - 1000);
          const completed = newRemaining === 0;
          
          if (completed && !timer.completed) {
            // Timer just completed
            const audio = new Audio("/beep1.mp3");
            audio.volume = 0.5;
            audio.play().catch(() => {});
            setDonePulse(true);
            setTimeout(() => setDonePulse(false), 1200);
          }
          
          return {
            ...timer,
            remaining: newRemaining,
            running: !completed,
            completed
          };
        })
      );
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubs.forEach((u) => u());
    };
  }, []);

  const handleStartTimer = async (duration: number, name: string) => {
    const newTimer: Timer = {
      id: Date.now().toString(),
      name,
      duration,
      remaining: duration,
      running: true,
      completed: false,
      createdAt: new Date()
    };
    
    setTimers(prev => [...prev, newTimer]);
    setSelectedTimerId(newTimer.id);
    setScreen('timer');
  };

  const handleSelectTimer = (timerId: string) => {
    setSelectedTimerId(timerId);
    setScreen('timer');
  };

  const handleNewTimer = () => {
    setScreen('create');
    setDonePulse(false);
  };

  const handleDashboard = () => {
    setScreen('dashboard');
    setSelectedTimerId(null);
  };

  const selectedTimer = timers.find(t => t.id === selectedTimerId);

  const start = async (timerId: string) => { 
    setTimers(prev => prev.map(t => 
      t.id === timerId ? { ...t, running: true } : t
    ));
  };
  
  const pause = async (timerId: string) => { 
    setTimers(prev => prev.map(t => 
      t.id === timerId ? { ...t, running: false } : t
    ));
  };
  
  const resume = async (timerId: string) => { 
    setTimers(prev => prev.map(t => 
      t.id === timerId ? { ...t, running: true } : t
    ));
  };
  
  const reset = async (timerId: string) => { 
    setTimers(prev => prev.map(t => 
      t.id === timerId ? { ...t, remaining: t.duration, running: false, completed: false } : t
    ));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0e1014] to-[#0a0b0e] text-white flex items-center justify-center">
      {screen === 'dashboard' ? (
        <DashboardScreen
          timers={timers}
          onSelectTimer={handleSelectTimer}
          onCreateNew={handleNewTimer}
        />
      ) : screen === 'create' ? (
        <CreateTimerScreen 
          onStartTimer={handleStartTimer} 
          onDashboard={handleDashboard}
        />
      ) : selectedTimer ? (
        <TimerScreen
          duration={selectedTimer.duration}
          remaining={selectedTimer.remaining}
          running={selectedTimer.running}
          donePulse={donePulse}
          onNewTimer={handleNewTimer}
          onStart={() => start(selectedTimer.id)}
          onPause={() => pause(selectedTimer.id)}
          onResume={() => resume(selectedTimer.id)}
          onReset={() => reset(selectedTimer.id)}
          onDashboard={handleDashboard}
        />
      ) : (
        <div>Timer not found</div>
      )}
    </div>
  );
}
