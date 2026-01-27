"use client";

import { useState, lazy, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { WorldMap } from "@/components/simulation/WorldMap";
import { TerritoryPanel } from "@/components/simulation/TerritoryPanel";
import { SpeedControl } from "@/components/controls/SpeedControl";
import { TimeDisplay } from "@/components/controls/TimeDisplay";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { HistoryTimeline } from "@/components/feed/HistoryTimeline";
import { StatsDashboard } from "@/components/simulation/StatsDashboard";
import { Id } from "../../convex/_generated/dataModel";
import { Globe2, Activity, Clock, BarChart3 } from "lucide-react";

// Lazy load 3D modal for better initial page load
const CivilizationModal = lazy(() =>
  import("@/components/3d/CivilizationModal").then(mod => ({ default: mod.CivilizationModal }))
);

export default function Home() {
  const [selectedTerritoryId, setSelectedTerritoryId] =
    useState<Id<"territories"> | null>(null);
  const [feedView, setFeedView] = useState<"activity" | "history" | "stats">("activity");
  const [show3DModal, setShow3DModal] = useState(false);

  // Fetch selected territory data for 3D modal
  const selectedTerritoryData = useQuery(
    api.queries.getTerritoryWithAgent,
    selectedTerritoryId ? { id: selectedTerritoryId } : "skip"
  );

  return (
    <div className="h-screen flex flex-col bg-[var(--void)] text-white overflow-hidden relative">
      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg opacity-50" />

      {/* Noise overlay for texture */}
      <div className="absolute inset-0 noise-overlay pointer-events-none" />

      {/* Header - Command Center Style */}
      <header className="flex-shrink-0 relative z-10">
        <div className="px-6 py-4 border-b border-[var(--border-dim)] bg-gradient-to-r from-[var(--panel)] via-[var(--panel-elevated)] to-[var(--panel)]">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--cyber-cyan)] to-[var(--holo-blue)] flex items-center justify-center">
                  <Globe2 className="w-7 h-7 text-[var(--void)]" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-br from-[var(--cyber-cyan)] to-[var(--holo-blue)] rounded-lg blur opacity-30 -z-10" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-wider">
                  <span className="text-glow-cyan">AI</span>
                  <span className="text-white ml-2">WORLD</span>
                </h1>
                <p className="text-[var(--text-secondary)] text-sm font-body tracking-wide">
                  AUTONOMOUS CIVILIZATION SIMULATOR
                </p>
              </div>
            </div>

            {/* Time Display */}
            <TimeDisplay />
          </div>
        </div>

        {/* Decorative line */}
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--cyber-cyan)] to-transparent opacity-30" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        {/* Map Area */}
        <div className="flex-1 relative">
          {/* Corner decorations */}
          <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-[var(--cyber-cyan)] opacity-40 z-20" />
          <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-[var(--cyber-cyan)] opacity-40 z-20" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-[var(--cyber-cyan)] opacity-40 z-20" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-[var(--cyber-cyan)] opacity-40 z-20" />

          <WorldMap
            selectedTerritoryId={selectedTerritoryId}
            onSelectTerritory={(id) => {
              setSelectedTerritoryId(id);
              setShow3DModal(true); // Go directly to 3D view
            }}
          />
        </div>

        {/* Right Sidebar - Control Panel */}
        <aside className="w-[420px] flex flex-col border-l border-[var(--border-dim)] bg-gradient-to-b from-[var(--panel-elevated)] to-[var(--panel)]">
          {/* Territory Panel */}
          <div className="flex-1 overflow-hidden">
            <TerritoryPanel
              territoryId={selectedTerritoryId}
              onClose={() => setSelectedTerritoryId(null)}
              onOpen3D={() => setShow3DModal(true)}
            />
          </div>

          {/* Divider with glow */}
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-glow)] to-transparent" />

          {/* Feed Section */}
          <div className="h-72 flex flex-col overflow-hidden">
            {/* Tab buttons - Command style */}
            <div className="flex border-b border-[var(--border-dim)] bg-[var(--panel)]">
              {[
                { id: "activity" as const, label: "LIVE FEED", icon: Activity },
                { id: "history" as const, label: "ARCHIVE", icon: Clock },
                { id: "stats" as const, label: "ANALYTICS", icon: BarChart3 },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setFeedView(id)}
                  className={`flex-1 px-3 py-2.5 text-xs font-display tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
                    feedView === id
                      ? "text-[var(--cyber-cyan)] bg-[var(--cyber-cyan)]/5 border-b-2 border-[var(--cyber-cyan)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Feed content */}
            <div className="flex-1 overflow-hidden">
              {feedView === "activity" ? (
                <ActivityFeed limit={20} />
              ) : feedView === "history" ? (
                <HistoryTimeline />
              ) : (
                <StatsDashboard />
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* Footer Controls - Command Bar */}
      <footer className="flex-shrink-0 relative z-10">
        {/* Decorative line */}
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--cyber-cyan)] to-transparent opacity-30" />

        <div className="px-6 py-3 bg-gradient-to-r from-[var(--panel)] via-[var(--panel-elevated)] to-[var(--panel)] border-t border-[var(--border-dim)]">
          <SpeedControl />
        </div>
      </footer>

      {/* 3D Civilization Modal */}
      {show3DModal && selectedTerritoryId && selectedTerritoryData && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-[var(--void)] flex items-center justify-center">
            <div className="text-[var(--cyber-cyan)] font-display text-sm tracking-wider animate-pulse">
              LOADING 3D VIEW...
            </div>
          </div>
        }>
          <CivilizationModal
            territoryId={selectedTerritoryId}
            territoryName={selectedTerritoryData.territory.name}
            territoryColor={selectedTerritoryData.territory.color}
            onClose={() => setShow3DModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
