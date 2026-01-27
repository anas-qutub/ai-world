"use client";

interface FlagDisplayProps {
  description?: string;
  territoryColor: string;
  size?: "sm" | "md" | "lg";
}

// Parse flag description to extract visual elements
function parseFlagDescription(description: string): {
  background: string;
  symbol: string | null;
  symbolColor: string;
  pattern: "solid" | "horizontal" | "vertical" | "diagonal" | "circle" | "star";
  secondaryColor: string | null;
} {
  const desc = description.toLowerCase();

  // Default values
  let background = "#2563eb"; // blue
  let symbol: string | null = null;
  let symbolColor = "#fbbf24"; // gold
  let pattern: "solid" | "horizontal" | "vertical" | "diagonal" | "circle" | "star" = "solid";
  let secondaryColor: string | null = null;

  // Parse colors
  if (desc.includes("red")) background = "#dc2626";
  else if (desc.includes("blue")) background = "#2563eb";
  else if (desc.includes("green")) background = "#16a34a";
  else if (desc.includes("gold") || desc.includes("yellow")) background = "#eab308";
  else if (desc.includes("purple")) background = "#9333ea";
  else if (desc.includes("black")) background = "#1f2937";
  else if (desc.includes("white")) background = "#f3f4f6";
  else if (desc.includes("orange")) background = "#ea580c";
  else if (desc.includes("brown")) background = "#92400e";

  // Parse patterns
  if (desc.includes("stripe") || desc.includes("band")) {
    if (desc.includes("horizontal")) pattern = "horizontal";
    else if (desc.includes("vertical")) pattern = "vertical";
    else if (desc.includes("diagonal")) pattern = "diagonal";
    else pattern = "horizontal"; // default stripe
    secondaryColor = desc.includes("white") ? "#f3f4f6" :
                     desc.includes("gold") ? "#eab308" :
                     desc.includes("red") ? "#dc2626" : "#ffffff";
  }

  // Parse symbols
  if (desc.includes("sun")) {
    symbol = "☀";
    symbolColor = "#fbbf24";
  } else if (desc.includes("moon")) {
    symbol = "☽";
    symbolColor = "#e5e7eb";
  } else if (desc.includes("star")) {
    symbol = "★";
    symbolColor = "#fbbf24";
    pattern = "star";
  } else if (desc.includes("tree")) {
    symbol = "🌲";
    symbolColor = "#16a34a";
  } else if (desc.includes("mountain")) {
    symbol = "⛰";
    symbolColor = "#6b7280";
  } else if (desc.includes("wave") || desc.includes("water") || desc.includes("river")) {
    symbol = "〰";
    symbolColor = "#3b82f6";
  } else if (desc.includes("eagle") || desc.includes("bird")) {
    symbol = "🦅";
  } else if (desc.includes("wolf")) {
    symbol = "🐺";
  } else if (desc.includes("bear")) {
    symbol = "🐻";
  } else if (desc.includes("fire") || desc.includes("flame")) {
    symbol = "🔥";
  } else if (desc.includes("circle")) {
    pattern = "circle";
    symbolColor = desc.includes("white") ? "#ffffff" : "#fbbf24";
  } else if (desc.includes("cross")) {
    symbol = "✚";
    symbolColor = "#ffffff";
  } else if (desc.includes("spear") || desc.includes("arrow")) {
    symbol = "↑";
    symbolColor = "#ffffff";
  }

  return { background, symbol, symbolColor, pattern, secondaryColor };
}

export function FlagDisplay({ description, territoryColor, size = "md" }: FlagDisplayProps) {
  const sizeClasses = {
    sm: "w-8 h-6",
    md: "w-16 h-12",
    lg: "w-24 h-18",
  };

  const symbolSizes = {
    sm: "text-xs",
    md: "text-lg",
    lg: "text-2xl",
  };

  // If no description, show a simple flag with territory color
  if (!description) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-sm border border-[var(--border-dim)] shadow-lg overflow-hidden`}
        style={{
          backgroundColor: territoryColor,
          boxShadow: `0 0 8px ${territoryColor}40`,
        }}
      />
    );
  }

  const { background, symbol, symbolColor, pattern, secondaryColor } = parseFlagDescription(description);

  // Render based on pattern
  const renderPattern = () => {
    switch (pattern) {
      case "horizontal":
        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1" style={{ backgroundColor: background }} />
            <div className="flex-1" style={{ backgroundColor: secondaryColor || "#ffffff" }} />
            <div className="flex-1" style={{ backgroundColor: background }} />
          </div>
        );
      case "vertical":
        return (
          <div className="w-full h-full flex">
            <div className="flex-1" style={{ backgroundColor: background }} />
            <div className="flex-1" style={{ backgroundColor: secondaryColor || "#ffffff" }} />
            <div className="flex-1" style={{ backgroundColor: background }} />
          </div>
        );
      case "diagonal":
        return (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${background} 50%, ${secondaryColor || "#ffffff"} 50%)`,
            }}
          />
        );
      case "circle":
        return (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: background }}
          >
            <div
              className={`rounded-full ${size === "sm" ? "w-3 h-3" : size === "md" ? "w-6 h-6" : "w-10 h-10"}`}
              style={{
                backgroundColor: symbolColor,
                boxShadow: `0 0 6px ${symbolColor}`,
              }}
            />
          </div>
        );
      case "star":
        return (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: background }}
          >
            <span
              className={symbolSizes[size]}
              style={{
                color: symbolColor,
                textShadow: `0 0 4px ${symbolColor}`,
              }}
            >
              ★
            </span>
          </div>
        );
      default: // solid
        return (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: background }}
          >
            {symbol && (
              <span
                className={symbolSizes[size]}
                style={{
                  color: symbolColor,
                  textShadow: `0 0 4px ${symbolColor}`,
                }}
              >
                {symbol}
              </span>
            )}
          </div>
        );
    }
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-sm border border-[var(--border-dim)] shadow-lg overflow-hidden transition-transform duration-200 hover:scale-105`}
      style={{
        boxShadow: `0 0 8px ${background}40`,
      }}
    >
      {renderPattern()}
    </div>
  );
}
