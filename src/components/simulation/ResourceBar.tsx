"use client";

import { Users, Utensils, Home, Wrench, Brain, Sparkles, Heart, Sword } from "lucide-react";

interface ResourceBarProps {
  label: string;
  value: number;
  maxValue?: number;
  icon?: React.ReactNode;
  colorClass?: string;
  showValue?: boolean;
}

export function ResourceBar({
  label,
  value,
  maxValue = 100,
  icon,
  colorClass = "from-[var(--cyber-cyan)] to-[var(--holo-blue)]",
  showValue = true,
}: ResourceBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));

  // Dynamic color based on value
  const getGradient = () => {
    if (percentage >= 70) return "from-[var(--success-green)] to-[var(--success-green)]/70";
    if (percentage >= 40) return "from-[var(--warning-amber)] to-[var(--warning-amber)]/70";
    return "from-[var(--danger-red)] to-[var(--danger-red)]/70";
  };

  const gradient = colorClass === "dynamic" ? getGradient() : colorClass;

  return (
    <div className="group">
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-[var(--text-muted)] group-hover:text-[var(--cyber-cyan)] transition-colors">{icon}</span>}
          <span className="text-[11px] text-[var(--text-secondary)] font-body uppercase tracking-wide">{label}</span>
        </div>
        {showValue && (
          <span className="font-data text-xs text-white tabular-nums">
            {typeof value === "number" ? value.toFixed(0) : value}
            <span className="text-[var(--text-muted)]">/{maxValue}</span>
          </span>
        )}
      </div>
      <div className="relative h-2 bg-[var(--void)] rounded-full overflow-hidden border border-[var(--border-dim)]">
        {/* Background glow */}
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gradient} opacity-20 blur-sm`}
          style={{ width: `${percentage}%` }}
        />
        {/* Main bar */}
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gradient} transition-all duration-700 ease-out resource-bar`}
          style={{ width: `${percentage}%` }}
        />
        {/* Highlight line */}
        <div
          className="absolute top-0 left-0 h-px bg-white/30"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ResourceGridProps {
  resources: {
    population: number;
    wealth: number;
    food: number;
    technology: number;
    military: number;
    happiness: number;
    influence: number;
    knowledge: number;
  };
}

export function ResourceGrid({ resources }: ResourceGridProps) {
  const resourceConfig: Array<{
    key: keyof ResourceGridProps["resources"];
    label: string;
    icon: React.ReactNode;
    maxValue?: number;
    colorClass?: string;
  }> = [
    {
      key: "population",
      label: "Population",
      icon: <Users className="w-3.5 h-3.5" />,
      maxValue: 200,
      colorClass: "from-[var(--holo-blue)] to-[var(--plasma-purple)]"
    },
    {
      key: "food",
      label: "Food Supply",
      icon: <Utensils className="w-3.5 h-3.5" />,
      colorClass: "dynamic"
    },
    {
      key: "wealth",
      label: "Shelter",
      icon: <Home className="w-3.5 h-3.5" />,
      colorClass: "from-[var(--warning-amber)] to-[var(--warning-amber)]/60"
    },
    {
      key: "technology",
      label: "Technology",
      icon: <Wrench className="w-3.5 h-3.5" />,
      colorClass: "from-[var(--cyber-cyan)] to-[var(--holo-blue)]"
    },
    {
      key: "knowledge",
      label: "Wisdom",
      icon: <Brain className="w-3.5 h-3.5" />,
      colorClass: "from-[var(--plasma-purple)] to-[var(--plasma-purple)]/60"
    },
    {
      key: "influence",
      label: "Culture",
      icon: <Sparkles className="w-3.5 h-3.5" />,
      colorClass: "from-[var(--success-green)] to-[var(--cyber-cyan)]"
    },
    {
      key: "happiness",
      label: "Morale",
      icon: <Heart className="w-3.5 h-3.5" />,
      colorClass: "dynamic"
    },
    {
      key: "military",
      label: "Military",
      icon: <Sword className="w-3.5 h-3.5" />,
      colorClass: "from-[var(--danger-red)] to-[var(--warning-amber)]"
    },
  ];

  return (
    <div className="space-y-3">
      {resourceConfig.map(({ key, label, icon, maxValue, colorClass }) => (
        <ResourceBar
          key={key}
          label={label}
          value={resources[key]}
          maxValue={maxValue || 100}
          icon={icon}
          colorClass={colorClass}
          showValue
        />
      ))}
    </div>
  );
}
