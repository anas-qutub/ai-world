"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Calendar, Zap } from "lucide-react";

const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export function TimeDisplay() {
  const world = useQuery(api.queries.getWorld);

  if (!world) {
    return (
      <div className="panel rounded-lg px-4 py-3">
        <div className="text-[var(--text-muted)] font-display text-sm tracking-wider">
          INITIALIZING<span className="loading-dots" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Date Display */}
      <div className="panel panel-glow rounded-lg px-5 py-3 corner-brackets">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-[var(--cyber-cyan)]" />
          <div>
            <div className="text-[10px] text-[var(--text-muted)] font-display tracking-widest uppercase">
              Current Date
            </div>
            <div className="font-display text-xl font-bold tracking-wide">
              <span className="text-[var(--cyber-cyan)]">{MONTH_NAMES[world.month - 1]}</span>
              <span className="text-white ml-2">{world.year.toString().padStart(3, '0')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Turn Counter */}
      <div className="panel panel-glow rounded-lg px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Zap className="w-5 h-5 text-[var(--warning-amber)]" />
            <div className="absolute inset-0 animate-ping">
              <Zap className="w-5 h-5 text-[var(--warning-amber)] opacity-30" />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] font-display tracking-widest uppercase">
              Cycle
            </div>
            <div className="font-data text-xl font-bold text-[var(--warning-amber)]">
              {world.tick.toString().padStart(4, '0')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
