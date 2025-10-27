import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type TickPayload = { remaining_ms: number; initial_ms: number; running: boolean };

function msToMMSS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function App() {
  const [duration, setDuration] = useState(25 * 60 * 1000);
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const [donePulse, setDonePulse] = useState(false);

  const progress = useMemo(() => {
    const d = duration || 1;
    return 1 - Math.min(Math.max(remaining / d, 0), 1);
  }, [remaining, duration]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    listen<TickPayload>("timer:tick", (ev) => {
      setRemaining(ev.payload.remaining_ms);
      setRunning(ev.payload.running);
    }).then((off) => unsubs.push(off));

    listen("timer:done", () => {
      setRunning(false);
      setRemaining(0);
      setDonePulse(true);
      const audio = new Audio("/beep1.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
      setTimeout(() => setDonePulse(false), 1200);
    }).then((off) => unsubs.push(off));

    (async () => {
      const r: number = await invoke("remaining_ms");
      const is: boolean = await invoke("is_running");
      setRemaining(typeof r === "number" ? r : duration);
      setRunning(!!is);
    })();

    return () => unsubs.forEach((u) => u());
  }, []);

  const start = async () => { await invoke("start_timer", { durationMs: duration }); setRunning(true); };
  const pause = async () => { await invoke("pause_timer"); setRunning(false); };
  const resume = async () => { await invoke("resume_timer"); setRunning(true); };
  const reset = async () => { await invoke("reset_timer"); setRemaining(duration); setRunning(false); };

  const size = 260, stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0e1014] to-[#0a0b0e] text-white flex items-center justify-center">
      <div className={["w-full max-w-xl mx-4 rounded-3xl p-8 border border-white/10 bg-white/5 backdrop-blur", donePulse ? "ring-4 ring-emerald-400/30" : ""].join(" ")}>
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Focus Timer</h1>
          <p className="text-sm text-white/60 mt-1">Reliable Rust timing • Gentle cues • ND-friendly design</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col items-center justify-center">
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
                  <div className="font-mono text-6xl tracking-wider select-none">{msToMMSS(remaining)}</div>
                  <div className="mt-1 text-xs text-white/60">{running ? "Running" : remaining === 0 ? "Complete" : "Paused"}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-white/70">Duration (minutes)</label>
            <input type="number" min={1} max={180}
              value={Math.floor(duration / 60000)}
              onChange={(e) => {
                const mins = parseInt(e.target.value || "0", 10);
                const ms = Math.max(60_000, mins * 60_000);
                setDuration(ms);
                if (!running) setRemaining(ms);
              }}
              className="mt-2 w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 ring-cyan-300/40"
            />

            <div className="mt-6 flex flex-wrap gap-3">
              {!running ? (
                <button onClick={start} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:ring-2 ring-emerald-300/50 transition">Start</button>
              ) : (
                <button onClick={pause} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 focus:ring-2 ring-amber-300/50 transition">Pause</button>
              )}
              {!running && remaining !== duration && remaining > 0 && (
                <button onClick={resume} className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 focus:ring-2 ring-cyan-300/50 transition">Resume</button>
              )}
              <button onClick={reset} className="px-5 py-2.5 rounded-xl bg-rose-500/90 hover:bg-rose-500 focus:ring-2 ring-rose-300/50 transition">Reset</button>
            </div>

            <div className="mt-6 text-xs text-white/55 leading-relaxed">
              Tip: keep visual motion subtle and predictable. Colors are chosen for low-stim visibility. Sounds fade gently; no sharp alarms.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
