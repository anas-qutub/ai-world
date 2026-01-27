"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ResourceGrid } from "./ResourceBar";
import { FlagDisplay } from "./FlagDisplay";
import { X, Users, Landmark, Bot, Handshake, Crown, Flag, ScrollText, BookOpen, Sparkles, Heart, Gem, Shield, Box } from "lucide-react";

interface TerritoryPanelProps {
  territoryId: Id<"territories"> | null;
  onClose: () => void;
  onOpen3D?: () => void;
}

export function TerritoryPanel({ territoryId, onClose, onOpen3D }: TerritoryPanelProps) {
  const data = useQuery(
    api.queries.getTerritoryWithAgent,
    territoryId ? { id: territoryId } : "skip"
  );

  const relationships = useQuery(
    api.queries.getTerritoryRelationships,
    territoryId ? { territoryId } : "skip"
  );

  const decisions = useQuery(
    api.queries.getTerritoryDecisions,
    territoryId ? { territoryId, limit: 5 } : "skip"
  );

  if (!territoryId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8">
          <div className="relative inline-block mb-4">
            <Landmark className="w-16 h-16 text-[var(--text-muted)] opacity-30" />
            <div className="absolute inset-0 animate-pulse">
              <Landmark className="w-16 h-16 text-[var(--cyber-cyan)] opacity-10" />
            </div>
          </div>
          <p className="text-[var(--text-muted)] font-display text-sm tracking-wider uppercase">
            Select Territory
          </p>
          <p className="text-[var(--text-muted)] text-xs mt-2 opacity-60">
            Click a region on the map to view details
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[var(--cyber-cyan)] font-display text-sm tracking-wider">
          LOADING<span className="loading-dots" />
        </div>
      </div>
    );
  }

  const { territory, agent } = data;

  // Type assertion for optional fields
  const tribeName = (territory as any).tribeName;
  const governance = (territory as any).governance || "none";
  const leaderName = (territory as any).leaderName;
  const governmentName = (territory as any).governmentName;
  const traditions = (territory as any).traditions as Array<{name: string; description: string; createdAtTick?: number}> | undefined;
  const flag = (territory as any).flag;
  const languageWords = (territory as any).languageWords as Array<{word: string; meaning: string; type?: string}> | undefined;
  const languageNotes = (territory as any).languageNotes;
  const originStory = (territory as any).originStory;
  const beliefs = (territory as any).beliefs;
  const naturalResources = (territory as any).naturalResources as string[] | undefined;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "allied":
        return "text-[var(--success-green)] bg-[var(--success-green)]/10 border-[var(--success-green)]/30";
      case "friendly":
        return "text-[var(--holo-blue)] bg-[var(--holo-blue)]/10 border-[var(--holo-blue)]/30";
      case "neutral":
        return "text-[var(--text-secondary)] bg-white/5 border-white/10";
      case "tense":
        return "text-[var(--warning-amber)] bg-[var(--warning-amber)]/10 border-[var(--warning-amber)]/30";
      case "hostile":
        return "text-[var(--danger-red)] bg-[var(--danger-red)]/10 border-[var(--danger-red)]/30";
      case "at_war":
        return "text-[var(--danger-red)] bg-[var(--danger-red)]/20 border-[var(--danger-red)]/50";
      default:
        return "text-[var(--text-secondary)] bg-white/5 border-white/10";
    }
  };

  const formatAction = (action: string) => {
    return action.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="p-4 border-b border-[var(--border-dim)] bg-gradient-to-r from-transparent via-[var(--panel-elevated)] to-transparent relative"
        style={{
          borderLeftColor: territory.color,
          borderLeftWidth: 3,
        }}
      >
        {/* Glow effect from territory color */}
        <div
          className="absolute left-0 top-0 bottom-0 w-32 opacity-20 pointer-events-none"
          style={{
            background: `linear-gradient(to right, ${territory.color}, transparent)`,
          }}
        />

        <div className="flex items-start justify-between relative">
          <div className="flex items-start gap-4">
            <FlagDisplay description={flag} territoryColor={territory.color} size="md" />
            <div>
              <h2 className="font-display text-lg font-bold tracking-wide text-white">
                {tribeName ? `THE ${tribeName.toUpperCase()}` : territory.name.toUpperCase()}
              </h2>
              {tribeName && (
                <div className="text-xs text-[var(--text-muted)] font-body">{territory.name}</div>
              )}
              {agent && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Bot className="w-3.5 h-3.5 text-[var(--plasma-purple)]" />
                  <span className="text-xs text-[var(--plasma-purple)] font-body">{agent.personality}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onOpen3D && (
              <button
                onClick={onOpen3D}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--cyber-cyan)]/10 hover:bg-[var(--cyber-cyan)]/20 border border-[var(--cyber-cyan)]/30 rounded text-[var(--cyber-cyan)] text-xs font-display tracking-wider transition-all duration-300 hover:shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                title="Enter 3D View"
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D VIEW</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded transition-colors text-[var(--text-muted)] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 stagger-children">
        {/* Governance & Culture */}
        <section>
          <h3 className="text-[10px] font-display text-[var(--text-muted)] uppercase tracking-widest mb-3 flex items-center gap-2">
            <Crown className="w-3.5 h-3.5 text-[var(--warning-amber)]" />
            Governance & Culture
          </h3>
          <div className="space-y-2">
            {/* Government */}
            <div className="panel rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-[var(--cyber-cyan)]" />
                <span className="text-[var(--text-secondary)]">Government:</span>
                <span className="text-white font-body">
                  {governance === "none" ? "Tribal (No formal structure)" : governmentName || governance}
                </span>
              </div>
              {leaderName && (
                <div className="flex items-center gap-2 text-sm mt-2 ml-6">
                  <span className="text-[var(--text-secondary)]">Leader:</span>
                  <span className="text-[var(--warning-amber)] font-body">{leaderName}</span>
                </div>
              )}
            </div>

            {/* Origin Story */}
            {originStory && (
              <div className="panel rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-[var(--plasma-purple)] mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="font-display tracking-wider">ORIGIN</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed">{originStory}</p>
              </div>
            )}

            {/* Language Dictionary */}
            {languageWords && languageWords.length > 0 && (
              <div className="panel rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-[var(--holo-blue)] mb-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="font-display tracking-wider">LEXICON</span>
                  {languageNotes && (
                    <span className="text-[var(--text-muted)] text-[10px]">({languageNotes})</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {languageWords.map((word, idx) => (
                    <div key={idx} className="flex items-baseline gap-2 text-xs">
                      <span className="text-[var(--cyber-cyan)] font-data">{word.word}</span>
                      <span className="text-[var(--text-muted)]">=</span>
                      <span className="text-[var(--text-secondary)]">{word.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Traditions */}
            {traditions && traditions.length > 0 && (
              <div className="panel rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-[var(--warning-amber)] mb-2">
                  <ScrollText className="w-3.5 h-3.5" />
                  <span className="font-display tracking-wider">TRADITIONS</span>
                </div>
                <div className="space-y-2">
                  {traditions.map((tradition, idx) => (
                    <div key={idx} className="border-l-2 border-[var(--warning-amber)]/30 pl-3">
                      <div className="text-xs text-white font-body font-medium">{tradition.name}</div>
                      <p className="text-[10px] text-[var(--text-muted)]">{tradition.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Beliefs */}
            {beliefs && (
              <div className="panel rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-[var(--plasma-purple)] mb-2">
                  <Heart className="w-3.5 h-3.5" />
                  <span className="font-display tracking-wider">BELIEFS</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{beliefs}</p>
              </div>
            )}

            {/* Flag */}
            {flag && (
              <div className="panel rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-[var(--success-green)] mb-2">
                  <Flag className="w-3.5 h-3.5" />
                  <span className="font-display tracking-wider">BANNER</span>
                </div>
                <div className="flex items-start gap-3">
                  <FlagDisplay description={flag} territoryColor={territory.color} size="lg" />
                  <p className="text-[10px] text-[var(--text-muted)] flex-1">{flag}</p>
                </div>
              </div>
            )}

            {/* No culture yet message */}
            {!tribeName && governance === "none" && (!traditions || traditions.length === 0) && (!languageWords || languageWords.length === 0) && (
              <p className="text-[var(--text-muted)] text-xs italic px-1">
                This civilization has not yet developed its cultural identity.
              </p>
            )}
          </div>
        </section>

        {/* Resources */}
        <section>
          <h3 className="text-[10px] font-display text-[var(--text-muted)] uppercase tracking-widest mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[var(--cyber-cyan)]" />
            Civilization Status
          </h3>
          <div className="panel rounded-lg p-3">
            <ResourceGrid resources={territory} />
          </div>

          {/* Natural Resources */}
          {naturalResources && naturalResources.length > 0 && (
            <div className="panel rounded-lg p-3 mt-2">
              <div className="flex items-center gap-2 text-xs text-[var(--success-green)] mb-2">
                <Gem className="w-3.5 h-3.5" />
                <span className="font-display tracking-wider">NATURAL RESOURCES</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {naturalResources.map((resource, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-[var(--success-green)]/10 text-[var(--success-green)] border border-[var(--success-green)]/20 rounded text-xs capitalize font-body"
                  >
                    {resource}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Relationships */}
        <section>
          <h3 className="text-[10px] font-display text-[var(--text-muted)] uppercase tracking-widest mb-3 flex items-center gap-2">
            <Handshake className="w-3.5 h-3.5 text-[var(--holo-blue)]" />
            Diplomatic Relations
          </h3>
          {relationships && relationships.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {relationships.map((rel) => (
                <div
                  key={rel._id}
                  className="panel rounded-lg p-2.5 card-lift"
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-white text-xs font-body font-medium truncate">
                      {rel.otherTerritoryName}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-display tracking-wider ${getStatusColor(rel.status)}`}>
                      {rel.status.toUpperCase().replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                    <span className="font-data">Trust: {rel.trust}</span>
                    {rel.hasTradeAgreement && (
                      <span className="text-[var(--success-green)]">Trade</span>
                    )}
                    {rel.hasAlliance && (
                      <span className="text-[var(--plasma-purple)]">Alliance</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-xs italic">No diplomatic relations established</p>
          )}
        </section>

        {/* Recent Decisions */}
        <section>
          <h3 className="text-[10px] font-display text-[var(--text-muted)] uppercase tracking-widest mb-3">
            Recent Actions
          </h3>
          {decisions && decisions.length > 0 ? (
            <div className="space-y-2">
              {decisions.map((decision) => (
                <div
                  key={decision._id}
                  className="panel rounded-lg p-3"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-white text-xs font-body font-medium">
                      {formatAction(decision.action)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-data">
                      T{decision.tick.toString().padStart(3, '0')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                    {decision.reasoning}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-xs italic">No recorded actions</p>
          )}
        </section>
      </div>
    </div>
  );
}
