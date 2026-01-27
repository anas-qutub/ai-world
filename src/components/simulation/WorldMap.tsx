"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Line,
  Marker,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Center coordinates for each territory (for drawing relationship lines)
const TERRITORY_CENTERS: Record<string, [number, number]> = {
  "North America": [-100, 40],
  "Europe": [10, 50],
  "Africa": [20, 0],
  "Asia": [100, 35],
  "South America": [-60, -15],
  "Australia": [135, -25],
};

// Map country codes to our territories
const TERRITORY_MAPPING: Record<string, string> = {
  // North America
  USA: "North America", CAN: "North America", MEX: "North America",
  GTM: "North America", BLZ: "North America", SLV: "North America",
  HND: "North America", NIC: "North America", CRI: "North America",
  PAN: "North America", CUB: "North America", JAM: "North America",
  HTI: "North America", DOM: "North America",
  // Europe
  GBR: "Europe", FRA: "Europe", DEU: "Europe", ITA: "Europe",
  ESP: "Europe", PRT: "Europe", NLD: "Europe", BEL: "Europe",
  CHE: "Europe", AUT: "Europe", POL: "Europe", CZE: "Europe",
  SVK: "Europe", HUN: "Europe", ROU: "Europe", BGR: "Europe",
  GRC: "Europe", SWE: "Europe", NOR: "Europe", FIN: "Europe",
  DNK: "Europe", IRL: "Europe", UKR: "Europe", BLR: "Europe",
  LTU: "Europe", LVA: "Europe", EST: "Europe", MDA: "Europe",
  HRV: "Europe", SVN: "Europe", BIH: "Europe", SRB: "Europe",
  MNE: "Europe", MKD: "Europe", ALB: "Europe",
  // Africa
  EGY: "Africa", LBY: "Africa", TUN: "Africa", DZA: "Africa",
  MAR: "Africa", NGA: "Africa", ZAF: "Africa", KEN: "Africa",
  ETH: "Africa", TZA: "Africa", COD: "Africa", SDN: "Africa",
  AGO: "Africa", MOZ: "Africa", GHA: "Africa", CIV: "Africa",
  CMR: "Africa", SEN: "Africa", MLI: "Africa", NER: "Africa",
  TCD: "Africa", MRT: "Africa", NAM: "Africa", BWA: "Africa",
  ZMB: "Africa", ZWE: "Africa", MWI: "Africa", UGA: "Africa",
  RWA: "Africa", BDI: "Africa", SSD: "Africa", CAF: "Africa",
  COG: "Africa", GAB: "Africa", GNQ: "Africa", SOM: "Africa",
  ERI: "Africa", DJI: "Africa", MDG: "Africa", MUS: "Africa",
  SYC: "Africa", LSO: "Africa", SWZ: "Africa", BEN: "Africa",
  TGO: "Africa", BFA: "Africa", GIN: "Africa", SLE: "Africa",
  LBR: "Africa", GMB: "Africa", GNB: "Africa", CPV: "Africa",
  STP: "Africa", COM: "Africa",
  // Asia
  CHN: "Asia", JPN: "Asia", KOR: "Asia", PRK: "Asia",
  MNG: "Asia", TWN: "Asia", VNM: "Asia", THA: "Asia",
  MMR: "Asia", LAO: "Asia", KHM: "Asia", MYS: "Asia",
  SGP: "Asia", IDN: "Asia", PHL: "Asia", IND: "Asia",
  PAK: "Asia", BGD: "Asia", NPL: "Asia", BTN: "Asia",
  LKA: "Asia", AFG: "Asia", IRN: "Asia", IRQ: "Asia",
  SYR: "Asia", JOR: "Asia", LBN: "Asia", ISR: "Asia",
  PSE: "Asia", SAU: "Asia", YEM: "Asia", OMN: "Asia",
  ARE: "Asia", QAT: "Asia", BHR: "Asia", KWT: "Asia",
  TUR: "Asia", GEO: "Asia", ARM: "Asia", AZE: "Asia",
  KAZ: "Asia", UZB: "Asia", TKM: "Asia", TJK: "Asia",
  KGZ: "Asia", RUS: "Asia",
  // South America
  BRA: "South America", ARG: "South America", CHL: "South America",
  PER: "South America", COL: "South America", VEN: "South America",
  ECU: "South America", BOL: "South America", PRY: "South America",
  URY: "South America", GUY: "South America", SUR: "South America",
  GUF: "South America",
  // Australia/Oceania
  AUS: "Australia", NZL: "Australia", PNG: "Australia",
  FJI: "Australia", SLB: "Australia", VUT: "Australia",
  NCL: "Australia",
};

interface WorldMapProps {
  selectedTerritoryId: Id<"territories"> | null;
  onSelectTerritory: (id: Id<"territories">) => void;
}

export function WorldMap({
  selectedTerritoryId,
  onSelectTerritory,
}: WorldMapProps) {
  const territories = useQuery(api.queries.getTerritories);
  const agents = useQuery(api.queries.getTerritoriesWithAgents);
  const relationships = useQuery(api.queries.getRelationships);
  const world = useQuery(api.queries.getWorld);

  if (!territories || !agents) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--void)]">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-full border-2 border-[var(--cyber-cyan)] border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full border border-[var(--cyber-cyan)]/30" />
          </div>
          <p className="text-[var(--text-muted)] font-display text-sm tracking-wider mt-4">
            LOADING MAP<span className="loading-dots" />
          </p>
        </div>
      </div>
    );
  }

  const territoryByName = new Map(territories.map((t) => [t.name, t]));
  const territoryById = new Map(territories.map((t) => [t._id.toString(), t]));
  const selectedTerritory = territories.find((t) => t._id === selectedTerritoryId);

  // Build relationship lines
  const relationshipLines: Array<{
    from: [number, number];
    to: [number, number];
    type: "alliance" | "trade" | "war" | "hostile";
    color: string;
  }> = [];

  if (relationships) {
    relationships.forEach((rel) => {
      const t1 = territoryById.get(rel.territory1Id.toString());
      const t2 = territoryById.get(rel.territory2Id.toString());

      if (t1 && t2) {
        const from = TERRITORY_CENTERS[t1.name];
        const to = TERRITORY_CENTERS[t2.name];

        if (from && to) {
          if (rel.hasAlliance) {
            relationshipLines.push({ from, to, type: "alliance", color: "var(--plasma-purple)" });
          } else if (rel.hasTradeAgreement) {
            relationshipLines.push({ from, to, type: "trade", color: "var(--success-green)" });
          } else if (rel.status === "at_war") {
            relationshipLines.push({ from, to, type: "war", color: "var(--danger-red)" });
          } else if (rel.status === "hostile") {
            relationshipLines.push({ from, to, type: "hostile", color: "var(--warning-amber)" });
          }
        }
      }
    });
  }

  const getCountryColor = (geo: any) => {
    const countryCode = geo.properties?.ISO_A3 || geo.id;
    const territoryName = TERRITORY_MAPPING[countryCode];

    if (!territoryName) return "#0a0e14";

    const territory = territoryByName.get(territoryName);
    if (!territory) return "#0a0e14";

    const isSelected = selectedTerritory?.name === territoryName;
    return isSelected ? territory.color : `${territory.color}88`;
  };

  const handleCountryClick = (geo: any) => {
    const countryCode = geo.properties?.ISO_A3 || geo.id;
    const territoryName = TERRITORY_MAPPING[countryCode];

    if (territoryName) {
      const territory = territoryByName.get(territoryName);
      if (territory) onSelectTerritory(territory._id);
    }
  };

  return (
    <div className="h-full bg-[var(--void)] relative overflow-hidden">
      {/* Hex pattern overlay */}
      <div className="absolute inset-0 hex-pattern pointer-events-none z-10 opacity-30" />

      {/* Map */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 120, center: [0, 30] }}
        className="w-full h-full"
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const countryCode = geo.properties?.ISO_A3 || geo.id;
                const territoryName = TERRITORY_MAPPING[countryCode];
                const isClickable = !!territoryName;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getCountryColor(geo)}
                    stroke="#1a1f26"
                    strokeWidth={0.5}
                    onClick={() => isClickable && handleCountryClick(geo)}
                    style={{
                      default: { outline: "none", cursor: isClickable ? "pointer" : "default" },
                      hover: {
                        fill: isClickable
                          ? `${territoryByName.get(territoryName!)?.color || "#4b5563"}dd`
                          : "#0a0e14",
                        outline: "none",
                        cursor: isClickable ? "pointer" : "default",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* Relationship lines */}
          {relationshipLines.map((line, idx) => (
            <Line
              key={`line-${idx}`}
              from={line.from}
              to={line.to}
              stroke={line.color}
              strokeWidth={line.type === "alliance" ? 2 : line.type === "war" ? 3 : 1.5}
              strokeLinecap="round"
              strokeDasharray={line.type === "trade" ? "4 2" : line.type === "hostile" ? "2 2" : undefined}
              style={{ pointerEvents: "none", filter: `drop-shadow(0 0 3px ${line.color})` }}
            />
          ))}

          {/* Territory markers */}
          {territories.map((territory) => {
            const center = TERRITORY_CENTERS[territory.name];
            if (!center) return null;
            const tribeName = (territory as any).tribeName;

            return (
              <Marker key={territory._id} coordinates={center}>
                <circle
                  r={5}
                  fill={territory.color}
                  stroke="#fff"
                  strokeWidth={1.5}
                  onClick={() => onSelectTerritory(territory._id)}
                  style={{
                    cursor: "pointer",
                    filter: `drop-shadow(0 0 6px ${territory.color})`,
                  }}
                />
                {tribeName && (
                  <text
                    textAnchor="middle"
                    y={-12}
                    style={{
                      fontFamily: "'Orbitron', monospace",
                      fontSize: "8px",
                      fontWeight: 600,
                      fill: "#fff",
                      textShadow: "0 0 4px #000, 0 0 8px #000",
                      pointerEvents: "none",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {tribeName.toUpperCase()}
                  </text>
                )}
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-20 panel panel-glow rounded-lg p-4 max-h-72 overflow-y-auto min-w-[180px]">
        <h4 className="text-[10px] font-display text-[var(--text-muted)] uppercase tracking-widest mb-3">
          Civilizations
        </h4>
        <div className="space-y-1.5">
          {territories.map((territory) => {
            const agent = agents.find((a) => a.territory._id === territory._id)?.agent;
            const tribeName = (territory as any).tribeName;
            const isSelected = selectedTerritoryId === territory._id;

            return (
              <button
                key={territory._id}
                onClick={() => onSelectTerritory(territory._id)}
                className={`flex items-center gap-3 w-full px-2.5 py-2 rounded-lg transition-all duration-200 group ${
                  isSelected
                    ? "bg-white/10"
                    : "hover:bg-white/5"
                }`}
                style={{
                  borderLeft: isSelected ? `3px solid ${territory.color}` : "3px solid transparent",
                }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 transition-all duration-200 group-hover:scale-110"
                  style={{
                    backgroundColor: territory.color,
                    boxShadow: isSelected ? `0 0 8px ${territory.color}` : undefined,
                  }}
                />
                <span className="text-xs text-white truncate font-body">
                  {tribeName || territory.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Relationship legend */}
        {relationshipLines.length > 0 && (
          <>
            <div className="h-px bg-[var(--border-dim)] my-3" />
            <h4 className="text-[10px] font-display text-[var(--text-muted)] uppercase tracking-widest mb-2">
              Relations
            </h4>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-[var(--plasma-purple)] rounded" style={{ boxShadow: "0 0 4px var(--plasma-purple)" }} />
                <span className="text-[var(--text-secondary)]">Alliance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-[var(--success-green)] rounded" style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--success-green) 0, var(--success-green) 3px, transparent 3px, transparent 5px)" }} />
                <span className="text-[var(--text-secondary)]">Trade</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-[var(--danger-red)] rounded" style={{ boxShadow: "0 0 4px var(--danger-red)" }} />
                <span className="text-[var(--text-secondary)]">War</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
