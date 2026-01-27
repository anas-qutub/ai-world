"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function TimeDisplay() {
  const world = useQuery(api.queries.getWorld);

  if (!world) {
    return (
      <div className="text-[var(--text-muted)] text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-[var(--text-muted)]">Year</span>
      <span className="font-semibold text-white tabular-nums">{world.tick}</span>
    </div>
  );
}
