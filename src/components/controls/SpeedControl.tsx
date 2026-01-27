"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Play, Pause, FastForward, Zap, RotateCcw } from "lucide-react";

type Speed = "paused" | "1x" | "10x" | "100x";

export function SpeedControl() {
  const world = useQuery(api.queries.getWorld);
  const setSpeed = useMutation(api.simulation.controls.setSpeed);
  const initWorld = useMutation(api.init.initializeWorld);
  const resetWorld = useMutation(api.init.resetWorld);

  if (!world) {
    return (
      <button
        onClick={() => initWorld()}
        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
      >
        Initialize
      </button>
    );
  }

  const speeds: { value: Speed; icon: React.ReactNode; label: string }[] = [
    { value: "paused", icon: <Pause className="w-4 h-4" />, label: "Pause" },
    { value: "1x", icon: <Play className="w-4 h-4" />, label: "1x" },
    { value: "10x", icon: <FastForward className="w-4 h-4" />, label: "10x" },
    { value: "100x", icon: <Zap className="w-4 h-4" />, label: "Max" },
  ];

  const handleReset = async () => {
    if (confirm("Reset simulation? All data will be erased.")) {
      await resetWorld();
      await initWorld();
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Speed buttons */}
      <div className="flex items-center bg-white/5 rounded-lg p-1">
        {speeds.map(({ value, icon, label }) => (
          <button
            key={value}
            onClick={() => setSpeed({ speed: value })}
            className={`p-2 rounded-md transition-all ${
              world.speed === value
                ? "bg-white/20 text-white"
                : "text-white/50 hover:text-white hover:bg-white/10"
            }`}
            title={label}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Status dot */}
      <div className="flex items-center gap-2 ml-3 px-3 py-1.5 rounded-full bg-white/5">
        <span className={`w-2 h-2 rounded-full ${
          world.status === "running" ? "bg-green-400 animate-pulse" : "bg-amber-400"
        }`} />
        <span className="text-xs text-white/70">
          {world.status === "running" ? "Running" : "Paused"}
        </span>
      </div>

      {/* Reset */}
      <button
        onClick={handleReset}
        className="p-2 ml-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
        title="Reset"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
}
