"use client";

import { Doc } from "../../../convex/_generated/dataModel";
import {
  Zap,
  Handshake,
  Swords,
  CloudLightning,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Info,
  Bot,
  Crown,
} from "lucide-react";

interface EventCardProps {
  event: Doc<"events"> & {
    territoryName?: string;
    targetTerritoryName?: string;
  };
}

export function EventCard({ event }: EventCardProps) {
  const getIcon = () => {
    switch (event.type) {
      case "decision":
        return <Bot className="w-4 h-4" />;
      case "trade":
        return <Handshake className="w-4 h-4" />;
      case "alliance":
        return <Crown className="w-4 h-4" />;
      case "war":
        return <Swords className="w-4 h-4" />;
      case "disaster":
        return <CloudLightning className="w-4 h-4" />;
      case "breakthrough":
        return <Lightbulb className="w-4 h-4" />;
      case "crisis":
        return <AlertTriangle className="w-4 h-4" />;
      case "population_boom":
        return <TrendingUp className="w-4 h-4" />;
      case "system":
        return <Info className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getSeverityConfig = () => {
    switch (event.severity) {
      case "positive":
        return {
          borderColor: "var(--success-green)",
          iconColor: "text-[var(--success-green)]",
          titleColor: "text-[var(--success-green)]",
          glowColor: "rgba(126, 231, 135, 0.1)",
        };
      case "negative":
        return {
          borderColor: "var(--warning-amber)",
          iconColor: "text-[var(--warning-amber)]",
          titleColor: "text-[var(--warning-amber)]",
          glowColor: "rgba(255, 166, 87, 0.1)",
        };
      case "critical":
        return {
          borderColor: "var(--danger-red)",
          iconColor: "text-[var(--danger-red)]",
          titleColor: "text-[var(--danger-red)]",
          glowColor: "rgba(255, 107, 107, 0.15)",
        };
      case "info":
      default:
        return {
          borderColor: "var(--holo-blue)",
          iconColor: "text-[var(--holo-blue)]",
          titleColor: "text-[var(--holo-blue)]",
          glowColor: "rgba(88, 166, 255, 0.1)",
        };
    }
  };

  const config = getSeverityConfig();
  const timeAgo = getTimeAgo(event.createdAt);

  return (
    <div
      className="panel rounded-lg p-3 transition-all duration-300 hover:translate-x-1 card-lift relative overflow-hidden group"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: config.borderColor,
        backgroundColor: config.glowColor,
      }}
    >
      {/* Animated glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, ${config.glowColor}, transparent)`,
        }}
      />

      <div className="flex items-start gap-3 relative">
        {/* Icon with pulse effect */}
        <div className={`${config.iconColor} mt-0.5 relative`}>
          {getIcon()}
          {event.severity === "critical" && (
            <div className="absolute inset-0 animate-ping opacity-50">
              {getIcon()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`font-body font-medium text-sm truncate`} style={{ color: config.borderColor }}>
              {event.title}
            </h4>
            <span className="text-[10px] text-[var(--text-muted)] font-data whitespace-nowrap px-1.5 py-0.5 bg-[var(--void)] rounded">
              T{event.tick.toString().padStart(3, '0')}
            </span>
          </div>
          <p className="text-[var(--text-secondary)] text-xs mt-1.5 line-clamp-2 leading-relaxed">
            {event.description}
          </p>
          <div className="text-[10px] text-[var(--text-muted)] mt-2 font-data">{timeAgo}</div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
