"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Play, Pause, FastForward, Zap, RotateCcw, Radio } from "lucide-react";

type Speed = "paused" | "1x" | "10x" | "100x";

export function SpeedControl() {
  const world = useQuery(api.queries.getWorld);
  const setSpeed = useMutation(api.simulation.controls.setSpeed);
  const initWorld = useMutation(api.init.initializeWorld);
  const resetWorld = useMutation(api.init.resetWorld);

  if (!world) {
    return (
      <div className="flex items-center justify-center">
        <button
          onClick={() => initWorld()}
          className="btn-command px-6 py-3 bg-gradient-to-r from-[var(--cyber-cyan)]/20 to-[var(--holo-blue)]/20
                     border border-[var(--cyber-cyan)]/50 text-[var(--cyber-cyan)] rounded-lg
                     font-display text-sm tracking-wider hover:bg-[var(--cyber-cyan)]/30 transition-all"
        >
          INITIALIZE SIMULATION
        </button>
      </div>
    );
  }

  const speeds: { value: Speed; label: string; icon: React.ReactNode; color?: string }[] = [
    { value: "paused", label: "HALT", icon: <Pause className="w-4 h-4" /> },
    { value: "1x", label: "1X", icon: <Play className="w-4 h-4" />, color: "var(--success-green)" },
    { value: "10x", label: "10X", icon: <FastForward className="w-4 h-4" />, color: "var(--warning-amber)" },
    { value: "100x", label: "MAX", icon: <Zap className="w-4 h-4" />, color: "var(--danger-red)" },
  ];

  const handleReset = async () => {
    if (confirm("⚠️ CONFIRM WORLD RESET\n\nAll simulation data will be erased. This action cannot be undone.")) {
      await resetWorld();
      await initWorld();
    }
  };

  const currentSpeedConfig = speeds.find(s => s.value === world.speed);

  return (
    <div className="flex items-center justify-between">
      {/* Speed Controls */}
      <div className="flex items-center gap-4">
        <div className="text-[10px] text-[var(--text-muted)] font-display tracking-widest uppercase">
          Time Control
        </div>

        <div className="flex items-center gap-1 p-1 bg-[var(--void)] rounded-lg border border-[var(--border-dim)]">
          {speeds.map(({ value, label, icon, color }) => (
            <button
              key={value}
              onClick={() => setSpeed({ speed: value })}
              className={`btn-command flex items-center gap-2 px-4 py-2 rounded-md text-xs font-display tracking-wider transition-all duration-300 ${
                world.speed === value
                  ? "text-[var(--void)] shadow-lg"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
              }`}
              style={{
                backgroundColor: world.speed === value ? (color || "var(--text-primary)") : undefined,
                boxShadow: world.speed === value ? `0 0 20px ${color || "var(--text-primary)"}40` : undefined,
              }}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-display tracking-wider ${
            world.status === "running"
              ? "bg-[var(--success-green)]/10 text-[var(--success-green)] border border-[var(--success-green)]/30"
              : "bg-[var(--warning-amber)]/10 text-[var(--warning-amber)] border border-[var(--warning-amber)]/30"
          }`}>
            <span className={`relative flex h-2.5 w-2.5`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                world.status === "running" ? "bg-[var(--success-green)]" : "bg-[var(--warning-amber)]"
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                world.status === "running" ? "bg-[var(--success-green)]" : "bg-[var(--warning-amber)]"
              }`} />
            </span>
            <Radio className="w-3.5 h-3.5" />
            {world.status === "running" ? "SIMULATING" : "STANDBY"}
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="btn-command p-2.5 text-[var(--text-muted)] hover:text-[var(--danger-red)]
                     hover:bg-[var(--danger-red)]/10 rounded-lg transition-all duration-300
                     border border-transparent hover:border-[var(--danger-red)]/30"
          title="Reset Simulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
