"use client";

import { Users, Utensils, Home, Wrench, Brain, Sparkles, Heart, Sword } from "lucide-react";

// Contextual labels based on value thresholds
function getContextualLabel(value: number): { label: string; colorClass: string } {
  if (value >= 80) return { label: "Thriving", colorClass: "text-[var(--success-green)]" };
  if (value >= 60) return { label: "Good", colorClass: "text-[var(--cyber-cyan)]" };
  if (value >= 40) return { label: "Stable", colorClass: "text-[var(--text-secondary)]" };
  if (value >= 20) return { label: "Low", colorClass: "text-[var(--warning-amber)]" };
  return { label: "Critical", colorClass: "text-[var(--danger-red)]" };
}

interface ResourceBarProps {
  label: string;
  value: number;
  maxValue?: number;
  icon?: React.ReactNode;
  colorClass?: string;
  showValue?: boolean;
  showBar?: boolean;
  showContextLabel?: boolean;
}

export function ResourceBar({
  label,
  value,
  maxValue = 100,
  icon,
  colorClass = "from-[var(--cyber-cyan)] to-[var(--holo-blue)]",
  showValue = true,
  showBar = true,
  showContextLabel = true,
}: ResourceBarProps) {
  // Cap display at 100% but allow internal value to be higher
  const displayValue = Math.min(100, Math.max(0, value));
  const percentage = maxValue === Infinity ? 100 : Math.min(100, Math.max(0, (value / maxValue) * 100));
  const contextual = getContextualLabel(value);

  // Dynamic color based on value
  const getGradient = () => {
    if (displayValue >= 70) return "from-[var(--success-green)] to-[var(--success-green)]/70";
    if (displayValue >= 40) return "from-[var(--warning-amber)] to-[var(--warning-amber)]/70";
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
          <div className="flex items-center gap-2">
            {showContextLabel && maxValue !== Infinity && (
              <span className={`text-[10px] font-body uppercase tracking-wide ${contextual.colorClass}`}>
                {contextual.label}
              </span>
            )}
            <span className="font-data text-xs text-white tabular-nums">
              {maxValue === Infinity ? (
                Math.round(value).toLocaleString()
              ) : (
                `${Math.round(displayValue)}%`
              )}
            </span>
          </div>
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
    showContextLabel?: boolean;
  }> = [
    {
      key: "population",
      label: "Population",
      icon: <Users className="w-3.5 h-3.5" />,
      maxValue: Infinity,
      colorClass: "from-[var(--holo-blue)] to-[var(--plasma-purple)]",
      showContextLabel: false,
    },
    {
      key: "food",
      label: "Food Supply",
      icon: <Utensils className="w-3.5 h-3.5" />,
      colorClass: "dynamic",
    },
    {
      key: "wealth",
      label: "Wealth",
      icon: <Home className="w-3.5 h-3.5" />,
      colorClass: "dynamic",
    },
    {
      key: "technology",
      label: "Technology",
      icon: <Wrench className="w-3.5 h-3.5" />,
      colorClass: "dynamic",
    },
    {
      key: "knowledge",
      label: "Knowledge",
      icon: <Brain className="w-3.5 h-3.5" />,
      colorClass: "dynamic",
    },
    {
      key: "influence",
      label: "Influence",
      icon: <Sparkles className="w-3.5 h-3.5" />,
      colorClass: "dynamic",
    },
    {
      key: "happiness",
      label: "Happiness",
      icon: <Heart className="w-3.5 h-3.5" />,
      colorClass: "dynamic",
    },
    {
      key: "military",
      label: "Military",
      icon: <Sword className="w-3.5 h-3.5" />,
      colorClass: "dynamic",
    },
  ];

  return (
    <div className="space-y-3">
      {resourceConfig.map(({ key, label, icon, maxValue, colorClass, showContextLabel }) => (
        <ResourceBar
          key={key}
          label={label}
          value={resources[key]}
          maxValue={maxValue ?? 100}
          icon={icon}
          colorClass={colorClass}
          showValue
          showContextLabel={showContextLabel ?? true}
        />
      ))}
    </div>
  );
}
