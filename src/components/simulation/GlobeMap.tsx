"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

// Territory center coordinates [lat, lng]
const TERRITORY_CENTERS: Record<string, { lat: number; lng: number }> = {
  "North America": { lat: 40, lng: -100 },
  "Europe": { lat: 50, lng: 10 },
  "Africa": { lat: 0, lng: 20 },
  "Asia": { lat: 35, lng: 100 },
  "South America": { lat: -15, lng: -60 },
  "Australia": { lat: -25, lng: 135 },
};

interface GlobeMapProps {
  selectedTerritoryId: Id<"territories"> | null;
  onSelectTerritory: (id: Id<"territories">) => void;
}

export function GlobeMap({
  selectedTerritoryId,
  onSelectTerritory,
}: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const territories = useQuery(api.queries.getTerritories);
  const agents = useQuery(api.queries.getTerritoriesWithAgents);
  const relationships = useQuery(api.queries.getRelationships);

  // Initialize globe
  useEffect(() => {
    if (!containerRef.current || globeRef.current) return;

    let isMounted = true;
    const container = containerRef.current;

    // Dynamic import for globe.gl (browser-only library)
    import("globe.gl").then(async (GlobeModule) => {
      if (!isMounted || !container) return;

      const Globe = GlobeModule.default;
      const THREE = await import("three");

      const globe = Globe()(container)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
        .showAtmosphere(true)
        .atmosphereColor("#00d4ff")
        .atmosphereAltitude(0.25)
        .pointOfView({ lat: 20, lng: 0, altitude: 2.5 });

      // Add clouds layer
      const CLOUDS_IMG_URL = "//unpkg.com/three-globe/example/img/clouds.png";
      const CLOUDS_ALT = 0.004;
      const CLOUDS_ROTATION_SPEED = -0.006;

      new THREE.TextureLoader().load(CLOUDS_IMG_URL, (cloudsTexture) => {
        if (!isMounted) return;
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(
            globe.getGlobeRadius() * (1 + CLOUDS_ALT),
            75,
            75
          ),
          new THREE.MeshPhongMaterial({
            map: cloudsTexture,
            transparent: true,
            opacity: 0.4,
          })
        );
        globe.scene().add(clouds);

        // Animate clouds rotation
        (function rotateClouds() {
          if (!isMounted) return;
          clouds.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180;
          requestAnimationFrame(rotateClouds);
        })();
      });

      // Enable auto-rotation
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.3;
      globe.controls().enableZoom = true;
      globe.controls().minDistance = 150;
      globe.controls().maxDistance = 500;

      globeRef.current = globe;

      // Set initial size based on container
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        globe.width(width).height(height);
      }

      setIsLoading(false);
    }).catch((err) => {
      console.error("Failed to load globe:", err);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      if (globeRef.current) {
        globeRef.current._destructor?.();
        globeRef.current = null;
      }
    };
  }, []);

  // Handle resize with ResizeObserver for more reliable sizing
  useEffect(() => {
    if (!containerRef.current) return;

    const handleResize = () => {
      if (globeRef.current && containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          globeRef.current.width(width).height(height);
        }
      }
    };

    // Use ResizeObserver for reliable container size tracking
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);

    // Also listen to window resize as fallback
    window.addEventListener("resize", handleResize);

    // Initial size
    handleResize();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [isLoading]); // Re-run when loading completes

  // Update points (territory markers)
  useEffect(() => {
    if (!globeRef.current || !territories) return;

    const territoryById = new Map(territories.map((t) => [t._id.toString(), t]));

    const pointsData = territories.map((territory) => {
      const center = TERRITORY_CENTERS[territory.name];
      if (!center) return null;

      const isSelected = selectedTerritoryId === territory._id;
      const tribeName = (territory as any).tribeName;

      return {
        lat: center.lat,
        lng: center.lng,
        size: isSelected ? 1.5 : 0.8,
        color: territory.color,
        territory,
        label: tribeName || territory.name,
        isSelected,
      };
    }).filter(Boolean);

    globeRef.current
      .pointsData(pointsData)
      .pointAltitude((d: any) => d.isSelected ? 0.1 : 0.02)
      .pointColor((d: any) => d.color)
      .pointRadius((d: any) => d.size)
      .pointResolution(12)
      .onPointClick((point: any) => {
        if (point?.territory) {
          onSelectTerritory(point.territory._id);
          // Stop auto-rotation and focus on point
          globeRef.current.controls().autoRotate = false;
          globeRef.current.pointOfView(
            { lat: point.lat, lng: point.lng, altitude: 1.8 },
            1000
          );
        }
      })
      .onPointHover((point: any) => {
        if (containerRef.current) {
          containerRef.current.style.cursor = point ? "pointer" : "grab";
        }
      });

    // Add labels
    globeRef.current
      .labelsData(pointsData)
      .labelLat((d: any) => d.lat)
      .labelLng((d: any) => d.lng)
      .labelText((d: any) => d.label?.toUpperCase() || "")
      .labelSize((d: any) => d.isSelected ? 1.2 : 0.8)
      .labelDotRadius((d: any) => 0)
      .labelColor((d: any) => d.isSelected ? "#ffffff" : "rgba(255,255,255,0.7)")
      .labelResolution(2)
      .labelAltitude((d: any) => d.isSelected ? 0.12 : 0.03);

  }, [territories, selectedTerritoryId, onSelectTerritory]);

  // Update arcs (relationship lines)
  useEffect(() => {
    if (!globeRef.current || !territories || !relationships) return;

    const territoryById = new Map(territories.map((t) => [t._id.toString(), t]));

    const arcsData: any[] = [];

    relationships.forEach((rel) => {
      const t1 = territoryById.get(rel.territory1Id.toString());
      const t2 = territoryById.get(rel.territory2Id.toString());

      if (t1 && t2) {
        const from = TERRITORY_CENTERS[t1.name];
        const to = TERRITORY_CENTERS[t2.name];

        if (from && to) {
          let color = "";
          let strokeWidth = 1;
          let dashLength = 0;
          let dashGap = 0;

          if (rel.hasAlliance) {
            color = "#a855f7"; // Purple
            strokeWidth = 2;
          } else if (rel.hasTradeAgreement) {
            color = "#22c55e"; // Green
            strokeWidth = 1.5;
            dashLength = 0.5;
            dashGap = 0.3;
          } else if (rel.status === "at_war") {
            color = "#ef4444"; // Red
            strokeWidth = 3;
          } else if (rel.status === "hostile") {
            color = "#f59e0b"; // Amber
            strokeWidth = 1.5;
            dashLength = 0.2;
            dashGap = 0.2;
          }

          if (color) {
            arcsData.push({
              startLat: from.lat,
              startLng: from.lng,
              endLat: to.lat,
              endLng: to.lng,
              color,
              strokeWidth,
              dashLength,
              dashGap,
            });
          }
        }
      }
    });

    globeRef.current
      .arcsData(arcsData)
      .arcColor((d: any) => d.color)
      .arcStroke((d: any) => d.strokeWidth)
      .arcDashLength((d: any) => d.dashLength || 1)
      .arcDashGap((d: any) => d.dashGap || 0)
      .arcDashAnimateTime(2000)
      .arcAltitude(0.15)
      .arcAltitudeAutoScale(0.3);

  }, [territories, relationships]);

  // Focus on selected territory
  useEffect(() => {
    if (!globeRef.current || !territories || !selectedTerritoryId) return;

    const territory = territories.find((t) => t._id === selectedTerritoryId);
    if (territory) {
      const center = TERRITORY_CENTERS[territory.name];
      if (center) {
        globeRef.current.controls().autoRotate = false;
        globeRef.current.pointOfView(
          { lat: center.lat, lng: center.lng, altitude: 1.8 },
          1000
        );
      }
    }
  }, [selectedTerritoryId, territories]);

  const dataLoading = !territories || !agents;

  return (
    <div className="h-full bg-[var(--void)] relative overflow-hidden">
      {/* Globe container - always rendered so ref exists */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: "grab" }}
      />

      {/* Loading overlay */}
      {(isLoading || dataLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--void)]">
          <div className="text-center">
            <div className="relative inline-block">
              <div className="w-16 h-16 rounded-full border-2 border-[var(--cyber-cyan)] border-t-transparent animate-spin" />
              <div className="absolute inset-2 rounded-full border border-[var(--cyber-cyan)]/30" />
            </div>
            <p className="text-[var(--text-muted)] font-display text-sm tracking-wider mt-4">
              {dataLoading ? "LOADING DATA" : "INITIALIZING GLOBE"}<span className="loading-dots" />
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      {territories && agents && (
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
        {relationships && relationships.length > 0 && (
          <>
            <div className="h-px bg-[var(--border-dim)] my-3" />
            <h4 className="text-[10px] font-display text-[var(--text-muted)] uppercase tracking-widest mb-2">
              Relations
            </h4>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-[#a855f7] rounded" style={{ boxShadow: "0 0 4px #a855f7" }} />
                <span className="text-[var(--text-secondary)]">Alliance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-[#22c55e] rounded" style={{ backgroundImage: "repeating-linear-gradient(90deg, #22c55e 0, #22c55e 3px, transparent 3px, transparent 5px)" }} />
                <span className="text-[var(--text-secondary)]">Trade</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-[#ef4444] rounded" style={{ boxShadow: "0 0 4px #ef4444" }} />
                <span className="text-[var(--text-secondary)]">War</span>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 z-20 text-[10px] text-[var(--text-muted)] font-body">
        <div className="panel rounded px-3 py-2 space-y-1">
          <p><span className="text-[var(--cyber-cyan)]">Drag</span> to rotate</p>
          <p><span className="text-[var(--cyber-cyan)]">Scroll</span> to zoom</p>
          <p><span className="text-[var(--cyber-cyan)]">Click</span> territory to select</p>
        </div>
      </div>
    </div>
  );
}
