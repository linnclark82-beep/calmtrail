"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Session = { id: string; startedAt: string; durationSec: number; pattern: string };

type BreathPattern = { inhale: number; hold: number; exhale: number };
const DEFAULT_PATTERN: BreathPattern = { inhale: 4, hold: 2, exhale: 6 };

export default function MeditationApp() {
  const [minutes, setMinutes] = useState(5);
  const [pattern, setPattern] = useState<BreathPattern>(DEFAULT_PATTERN);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(pattern.inhale);
  const [history, setHistory] = useState<Session[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [ambientOn, setAmbientOn] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const phaseTickRef = useRef<NodeJS.Timeout | null>(null);

  // Load + persist history
  useEffect(() => {
    const raw = localStorage.getItem("meditation_history_v1");
    if (raw) setHistory(JSON.parse(raw));
  }, []);
  useEffect(() => {
    localStorage.setItem("meditation_history_v1", JSON.stringify(history));
  }, [history]);

  // handlereset seconds when minutes changes (idle only)
  useEffect(() => { if (!isRunning) setSecondsLeft(minutes * 60); }, [minutes, isRunning]);

  // Deriveds
  const totalPhase = pattern.inhale + pattern.hold + pattern.exhale;
  const progress = useMemo(() => 1 - secondsLeft / (minutes * 60 || 1), [secondsLeft, minutes]);
  const label = phase === "inhale" ? "Breathe in" : phase === "hold" ? "Hold" : "Exhale slowly";

  // Phase chime
  const chime = () => {
    if (!soundOn) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = phase === "inhale" ? 523.25 : phase === "hold" ? 659.25 : 392; // C5/E5/G4
      g.gain.value = 0.001;
      const t = ctx.currentTime;
      o.start();
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.stop(t + 0.4);
    } catch {}
  };

  // Ambient audio
  useEffect(() => {
    if (!ambientRef.current) return;
    ambientRef.current.loop = true;
    ambientRef.current.volume = 0.35;
    if (ambientOn) ambientRef.current.play().catch(() => {});
    else ambientRef.current.pause();
  }, [ambientOn]);

  // Start / stop
// Start / stop
const start = () => {
  if (isRunning) return;
  setIsRunning(true);
  setPhase("inhale");
  setPhaseSecondsLeft(pattern.inhale);

  // countdown (total time)
  timerRef.current = setInterval(() => {
    setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
  }, 1000);

  // phase countdown + phase cycling
  phaseTickRef.current = setInterval(() => {
    setPhaseSecondsLeft((p) => {
      if (p > 1) return p - 1;

      // switch phase
      setPhase((prev) => {
        const next: "inhale" | "hold" | "exhale" =
          prev === "inhale" ? "hold" : prev === "hold" ? "exhale" : "inhale";

        const nextSeconds =
          next === "inhale"
            ? pattern.inhale
            : next === "hold"
            ? pattern.hold
            : pattern.exhale;

        // prime the next phase seconds
        setPhaseSecondsLeft(nextSeconds);
        return next;
      });

const handleReset = () => {
  if (timerRef.current) clearInterval(timerRef.current);
  if (phaseTickRef.current) clearInterval(phaseTickRef.current);
  timerRef.current = null;
  phaseTickRef.current = null;

  setIsRunning(false);
  setSecondsLeft(minutes * 60);
  setPhase("inhale");
  setPhaseSecondsLeft(DEFAULT_PATTERN.inhale);
};


      const stop = (completed = false) => {
  if (timerRef.current) clearInterval(timerRef.current);
  if (phaseTickRef.current) clearInterval(phaseTickRef.current);
  timerRef.current = null;
  phaseTickRef.current = null;
  setIsRunning(false);
};

const handlereset = () => {
  if (timerRef.current) clearInterval(timerRef.current);
  if (phaseTickRef.current) clearInterval(phaseTickRef.current);
  timerRef.current = null;
  phaseTickRef.current = null;
  setIsRunning(false);
  setSecondsLeft(minutes * 60);
  setPhase("inhale");
  setPhaseSecondsLeft(DEFAULT_PATTERN.inhale);
};

      // we consumed the last second of the previous phase
      return 0; // still return a number to satisfy TS
    });
  }, 1000);
};

const stop = (completed = false) => {
  if (timerRef.current) clearInterval(timerRef.current);
  if (phaseTickRef.current) clearInterval(phaseTickRef.current);
  timerRef.current = null;
  phaseTickRef.current = null;
  setIsRunning(false);
};
  // Auto-finish
  useEffect(() => { if (isRunning && secondsLeft <= 0) stop(true); }, [secondsLeft, isRunning]);

  // Helpers
  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(Math.floor(s%60)).padStart(2,"0")}`;

  // Streaks (consecutive days with a session ending today)
  const streak = useMemo(() => {
    if (history.length === 0) return 0;
    const days = new Set(history.map(h => new Date(h.startedAt).toDateString()));
    let count = 0;
    const d = new Date();
    while (days.has(d.toDateString())) {
      count++; d.setDate(d.getDate() - 1);
    }
    return count;
  }, [history]);

  const weekTotalMin = useMemo(() => {
    const now = new Date(); const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // Sun
    return Math.round(history.filter(h => new Date(h.startedAt) >= start)
      .reduce((sum,h)=> sum + h.durationSec/60, 0));
  }, [history]);

const handleReset = () => {
  if (timerRef.current) clearInterval(timerRef.current);
  if (phaseTickRef.current) clearInterval(phaseTickRef.current);
  timerRef.current = null;
  phaseTickRef.current = null;

  setIsRunning(false);
  setSecondsLeft(minutes * 60);
  setPhase("inhale");
  setPhaseSecondsLeft(DEFAULT_PATTERN.inhale);
};


  return (
    <div className="min-h-screen text-white relative">
      {/* Naturist background */}
      <div className="absolute inset-0 -z-10" style={{
        backgroundImage:
          "radial-gradient(1100px 700px at 70% 15%, rgba(54,130,92,.5), transparent), radial-gradient(800px 600px at 20% 80%, rgba(34,64,128,.45), transparent), linear-gradient(180deg, #0b3d2e 0%, #0c2b3a 40%, #0b1d2a 100%)",
        filter: "saturate(1.05)"
      }} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-semibold">CalmTrail • Guided Breathing</h1>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-xl bg-white/10 px-3 py-1">Streak: <b>{streak}</b> day{streak===1?"":"s"}</span>
            <span className="rounded-xl bg-white/10 px-3 py-1">This week: <b>{weekTotalMin}</b> min</span>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={soundOn} onChange={e=>setSoundOn(e.target.checked)} />Chimes</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={ambientOn} onChange={e=>setAmbientOn(e.target.checked)} />Ambient</label>
            <audio ref={ambientRef} src="/ambient.mp3" />
          </div>
        </header>

        {/* Timer + controls */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <h2 className="text-lg font-medium mb-2">Timer</h2>
            <div className="flex items-center gap-2">
              {[5,10,15,20].map(m=>(
                <button key={m} disabled={isRunning} onClick={()=>setMinutes(m)}
                  className={`rounded-xl px-3 py-2 ${minutes===m?"bg-white text-black":"bg-white/10"}`}>{m} min</button>
              ))}
              <input type="number" min={1} max={120} disabled={isRunning} value={minutes}
                onChange={e=>setMinutes(Number(e.target.value||1))}
                className="ml-auto w-24 rounded-xl bg-white/10 px-3 py-2 outline-none"/>
            </div>
            <div className="mt-4 text-5xl tabular-nums text-center">{fmt(secondsLeft)}</div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-white" style={{ width: `${progress*100}%` }} />
            </div>
            <div className="mt-4 flex gap-2">
              {!isRunning
                ? <button onClick={start} className="rounded-xl bg-white px-4 py-2 text-black">Start</button>
                : <button onClick={()=>stop(true)} className="rounded-xl bg-white px-4 py-2 text-black">Finish</button>}
             <button onClick={handleReset} disabled={isRunning} className="rounded-xl bg-white/10 px-4 py-2">
  reset
</button>
            </div>
          </div>

          {/* Coach + animation */}
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur sm:col-span-2">
            <h2 className="text-lg font-medium">Coach</h2>
            <p className="opacity-80">Follow the prompt. The circle expands as you inhale and contracts as you exhale.</p>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col items-center justify-center">
                <div className="text-2xl font-semibold mb-2">{label}</div>
                <div className="text-sm opacity-80">{phaseSecondsLeft}s left</div>
                <BreathCircle key={`${phase}-${isRunning}-${pattern.inhale}-${pattern.hold}-${pattern.exhale}`}
                  phase={phase} running={isRunning} pattern={pattern} />
              </div>

              <div>
                <h3 className="mb-2 font-medium">Pattern</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(["inhale","hold","exhale"] as const).map((k)=>(
                    <div key={k} className="rounded-xl bg-white/10 p-2 text-center">
                      <div className="text-xs opacity-70 capitalize">{k}</div>
                      <input type="number" min={k==="hold"?0:2} max={16} disabled={isRunning}
                        value={(pattern as any)[k]}
                        onChange={(e)=>setPattern({...pattern,[k]:Number(e.target.value||0)})}
                        className="w-full rounded-lg bg-white/10 px-2 py-1 text-center"/>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <button disabled={isRunning} onClick={()=>setPattern({inhale:4,hold:4,exhale:4})} className="rounded-xl bg-white/10 px-3 py-2">Box 4-4-4</button>
                  <button disabled={isRunning} onClick={()=>setPattern({inhale:4,hold:7,exhale:8})} className="rounded-xl bg-white/10 px-3 py-2">4-7-8</button>
                  <button disabled={isRunning} onClick={()=>setPattern(DEFAULT_PATTERN)} className="rounded-xl bg-white/10 px-3 py-2">Slow 4-2-6</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="mt-8 rounded-2xl bg-white/10 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium">Your sessions</h2>
            <button
              onClick={()=>{
                const header="startedAt,durationSec,minutes,pattern\n";
                const rows=history.map(r=>`${r.startedAt},${r.durationSec},${(r.durationSec/60).toFixed(1)},${r.pattern}`);
                const blob=new Blob([header+rows.join("\n")],{type:"text/csv"});
                const url=URL.createObjectURL(blob);
                const a=document.createElement("a"); a.href=url; a.download="meditation-history.csv"; a.click(); URL.revokeObjectURL(url);
              }}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm"
            >Export CSV</button>
          </div>
          {history.length===0 ? <p className="opacity-80">No sessions yet. Hit Start and breathe.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/80"><tr><th className="py-2">Started</th><th className="py-2">Minutes</th><th className="py-2">Pattern</th></tr></thead>
                <tbody>
                  {history.map(h=>(
                    <tr key={h.id} className="border-t border-white/10">
                      <td className="py-2">{new Date(h.startedAt).toLocaleString([], {dateStyle:"medium", timeStyle:"short"})}</td>
                      <td className="py-2">{(h.durationSec/60).toFixed(1)}</td>
                      <td className="py-2">{h.pattern}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs opacity-70">
          Built with Next.js + Tailwind. Data stays in your browser. Add to Home Screen to use like an app.
        </footer>
      </main>
    </div>
  );
}

/** Expanding/contracting circle synced to pattern */
function BreathCircle({
  phase, running, pattern
}: {
  phase: "inhale" | "hold" | "exhale";
  running: boolean;
  pattern: { inhale: number; hold: number; exhale: number };
}) {
  const total = pattern.inhale + pattern.hold + pattern.exhale;
  const inhalePct = (pattern.inhale / total) * 100;
  const holdPct = ((pattern.inhale + pattern.hold) / total) * 100;

  return (
    <div className="mt-4 flex h-64 w-64 items-center justify-center">
      <div className="relative grid place-items-center rounded-full border border-white/30 bg-white/5 shadow-2xl"
           style={{ width: 240, height: 240 }}>
        <div className={`relative z-10 grid place-items-center rounded-full bg-white/20 backdrop-blur transition-all duration-1000
                         ${running ? "animate-[pulseBreath_var(--cycle)_linear_infinite]" : ""}`}
             style={{ width: 120, height: 120, ["--cycle" as any]: `${total}s` }}>
          <div className="text-lg font-semibold drop-shadow">
            {phase === "inhale" ? "Inhale" : phase === "hold" ? "Hold" : "Exhale"}
          </div>
        </div>
        <style>{`
          @keyframes pulseBreath {
            0% { transform: scale(0.9); }
            ${inhalePct}% { transform: scale(1.08); }
            ${holdPct}% { transform: scale(1.08); }
            100% { transform: scale(0.9); }
          }
        `}</style>
      </div>
    </div>
  );
}
const [phaseSecondsLeft, setPhaseSecondsLeft] = useState<number>(DEFAULT_PATTERN.inhale);
