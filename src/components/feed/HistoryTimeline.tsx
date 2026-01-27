"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Clock, ChevronDown, ChevronUp, Database } from "lucide-react";

type EventType = "decision" | "trade" | "alliance" | "war" | "disaster" | "breakthrough" | "crisis" | "population_boom" | "birth" | "death" | "system";

const eventTypeLabels: Record<EventType, string> = {
  decision: "Decisions",
  trade: "Trade",
  alliance: "Alliances",
  war: "Wars",
  disaster: "Disasters",
  breakthrough: "Discoveries",
  crisis: "Crises",
  population_boom: "Growth",
  birth: "Births",
  death: "Deaths",
  system: "System",
};

const eventTypeColors: Record<EventType, string> = {
  decision: "var(--holo-blue)",
  trade: "var(--success-green)",
  alliance: "var(--plasma-purple)",
  war: "var(--danger-red)",
  disaster: "var(--warning-amber)",
  breakthrough: "var(--cyber-cyan)",
  crisis: "var(--warning-amber)",
  population_boom: "var(--success-green)",
  birth: "var(--success-green)",
  death: "var(--text-muted)",
  system: "var(--text-muted)",
};

export function HistoryTimeline() {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<EventType | "all">("all");

  const events = useQuery(api.queries.getRecentEvents, { limit: expanded ? 100 : 30 });
  const world = useQuery(api.queries.getWorld);

  if (!events || !world) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[var(--cyber-cyan)] font-display text-sm tracking-wider">
          LOADING<span className="loading-dots" />
        </div>
      </div>
    );
  }

  const filteredEvents = filter === "all"
    ? events
    : events.filter(e => e.type === filter);

  // Group events by year/month
  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const year = Math.floor(event.tick / 12) + 2025;
    const month = (event.tick % 12) + 1;
    const key = `YEAR ${year - 2024} // CYCLE ${month}`;

    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(event);
    return acc;
  }, {} as Record<string, typeof events>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border-dim)] flex items-center justify-between bg-[var(--panel)]">
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as EventType | "all")}
            className="text-[10px] bg-[var(--void)] text-[var(--text-secondary)] rounded px-2 py-1.5 border border-[var(--border-dim)]
                       font-display tracking-wider focus:outline-none focus:border-[var(--cyber-cyan)]/50"
          >
            <option value="all">ALL EVENTS</option>
            {Object.entries(eventTypeLabels).map(([type, label]) => (
              <option key={type} value={type}>{label.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 hover:bg-white/5 rounded transition-colors text-[var(--text-muted)] hover:text-[var(--cyber-cyan)]"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-3">
        {Object.entries(groupedEvents).length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
            <p className="text-[var(--text-muted)] text-xs font-display tracking-wider">NO RECORDS FOUND</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedEvents).map(([period, periodEvents]) => (
              <div key={period}>
                {/* Period header */}
                <div className="sticky top-0 bg-[var(--panel)] text-[10px] text-[var(--text-muted)] font-display tracking-widest py-1.5 mb-2 border-b border-[var(--border-dim)]/50">
                  {period}
                </div>
                {/* Events in period */}
                <div className="space-y-1.5 pl-3 border-l border-[var(--border-dim)]">
                  {periodEvents.map((event) => (
                    <div key={event._id} className="relative pl-4 group">
                      {/* Timeline dot with glow */}
                      <div
                        className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full transition-all duration-300 group-hover:scale-125"
                        style={{
                          backgroundColor: eventTypeColors[event.type as EventType] || "var(--text-muted)",
                          boxShadow: `0 0 6px ${eventTypeColors[event.type as EventType] || "transparent"}`,
                        }}
                      />
                      {/* Event content */}
                      <div className="text-xs">
                        <div className="text-white font-body font-medium group-hover:text-[var(--cyber-cyan)] transition-colors">
                          {event.title}
                        </div>
                        <div className="text-[var(--text-muted)] line-clamp-1 text-[10px] mt-0.5">
                          {event.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="px-3 py-2 border-t border-[var(--border-dim)] text-[10px] flex justify-between items-center bg-[var(--panel)]">
        <span className="text-[var(--text-muted)] font-data">
          {filteredEvents.length} records
        </span>
        <span className="text-[var(--cyber-cyan)] font-display tracking-wider">
          Y{Math.floor(world.tick / 12) + 1}.C{(world.tick % 12) + 1}
        </span>
      </div>
    </div>
  );
}
