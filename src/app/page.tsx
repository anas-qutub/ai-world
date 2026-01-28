"use client";

import { useState, lazy, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GlobeMap } from "@/components/simulation/GlobeMap";
import { TerritoryPanel } from "@/components/simulation/TerritoryPanel";
import { SpeedControl } from "@/components/controls/SpeedControl";
import { TimeDisplay } from "@/components/controls/TimeDisplay";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { HistoryTimeline } from "@/components/feed/HistoryTimeline";
import { StatsDashboard } from "@/components/simulation/StatsDashboard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
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
  const [isLoading, setIsLoading] = useState(true);

  // Fetch selected territory data for 3D modal
  const selectedTerritoryData = useQuery(
    api.queries.getTerritoryWithAgent,
    selectedTerritoryId ? { id: selectedTerritoryId } : "skip"
  );

  // Show loading screen on initial load
  if (isLoading) {
    return <LoadingScreen onLoadComplete={() => setIsLoading(false)} minDisplayTime={2500} />;
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] text-white overflow-hidden animate-fade-in">
      {/* Header - Clean and minimal */}
      <header className="flex-shrink-0 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-sm">
        <div className="px-6 py-3 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Globe2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                AI World
              </h1>
              <p className="text-xs text-white/50">
                Autonomous Civilization Simulator
              </p>
            </div>
          </div>

          {/* Center - Speed Controls */}
          <SpeedControl />

          {/* Right - Time Display */}
          <TimeDisplay />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Map Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Globe or 3D View */}
          {show3DModal && selectedTerritoryId && selectedTerritoryData ? (
            <Suspense fallback={
              <div className="absolute inset-0 bg-[#0a0a0f] flex items-center justify-center">
                <div className="text-white/50 text-sm">
                  Loading 3D view...
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
          ) : (
            <GlobeMap
              selectedTerritoryId={selectedTerritoryId}
              onSelectTerritory={(id) => {
                setSelectedTerritoryId(id);
                setShow3DModal(true);
              }}
            />
          )}

          {/* Hint overlay - shows when no territory selected */}
          {!selectedTerritoryId && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none animate-fade-in">
              <div className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
                <p className="text-white/50 text-sm">
                  Click on a civilization to explore
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Only shows when territory is selected */}
        <aside
          className={`flex flex-col border-l border-white/10 bg-[#0d0d14] transition-all duration-300 ease-out ${
            selectedTerritoryId
              ? "w-[400px] opacity-100"
              : "w-0 opacity-0 overflow-hidden"
          }`}
        >
          <div className="w-[400px] h-full flex flex-col">
            {/* Territory Panel */}
            <div className="flex-1 overflow-hidden">
              <TerritoryPanel
                territoryId={selectedTerritoryId}
                onClose={() => setSelectedTerritoryId(null)}
                onOpen3D={() => setShow3DModal(true)}
              />
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10" />

            {/* Feed Section */}
            <div className="h-72 flex flex-col overflow-hidden">
              {/* Tab buttons */}
              <div className="flex border-b border-white/10">
                {[
                  { id: "activity" as const, label: "Live Feed", icon: Activity },
                  { id: "history" as const, label: "Archive", icon: Clock },
                  { id: "stats" as const, label: "Analytics", icon: BarChart3 },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setFeedView(id)}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                      feedView === id
                        ? "text-cyan-400 bg-cyan-400/5 border-b-2 border-cyan-400"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
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
          </div>
        </aside>
      </main>
    </div>
  );
}
