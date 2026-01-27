"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { EventCard } from "./EventCard";
import { Radio } from "lucide-react";

interface ActivityFeedProps {
  limit?: number;
}

export function ActivityFeed({ limit = 30 }: ActivityFeedProps) {
  const events = useQuery(api.queries.getRecentEvents, { limit });

  if (!events) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[var(--cyber-cyan)] font-display text-sm tracking-wider">
          SYNCING<span className="loading-dots" />
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="relative mb-4">
          <Radio className="w-10 h-10 text-[var(--text-muted)] opacity-30" />
          <div className="absolute inset-0 animate-ping">
            <Radio className="w-10 h-10 text-[var(--cyber-cyan)] opacity-10" />
          </div>
        </div>
        <p className="text-[var(--text-muted)] font-display text-xs tracking-wider uppercase">No Transmissions</p>
        <p className="text-[var(--text-muted)] text-[10px] mt-1 opacity-60">Initialize simulation to begin</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 stagger-children">
        {events.map((event) => (
          <EventCard key={event._id} event={event} />
        ))}
      </div>
    </div>
  );
}
