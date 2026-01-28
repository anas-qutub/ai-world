"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

// Valid territories - LAND MASSES ONLY (no ocean)
const VALID_TERRITORIES = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Australia",
] as const;

// Territory center coordinates for camera focus
const TERRITORY_CENTERS: Record<string, { lat: number; lng: number }> = {
  "North America": { lat: 40, lng: -100 },
  "Europe": { lat: 50, lng: 10 },
  "Africa": { lat: 0, lng: 20 },
  "Asia": { lat: 35, lng: 100 },
  "South America": { lat: -15, lng: -60 },
  "Australia": { lat: -25, lng: 135 },
};

// Simplified continent polygon coordinates [lng, lat] format for GeoJSON
const CONTINENT_POLYGONS: Record<string, number[][][]> = {
  "North America": [[
    [-168, 65], [-168, 72], [-141, 70], [-130, 72], [-120, 75],
    [-85, 75], [-65, 65], [-55, 50], [-67, 45], [-70, 43],
    [-75, 35], [-80, 25], [-85, 20], [-90, 17], [-95, 17],
    [-105, 20], [-117, 32], [-124, 40], [-125, 48], [-130, 55],
    [-140, 60], [-150, 60], [-160, 58], [-168, 65]
  ]],
  "South America": [[
    [-80, 10], [-75, 12], [-60, 10], [-50, 5], [-35, -5],
    [-35, -20], [-40, -22], [-48, -28], [-55, -35], [-65, -55],
    [-75, -50], [-75, -40], [-70, -18], [-80, -5], [-80, 10]
  ]],
  "Europe": [[
    [-10, 36], [-10, 45], [-5, 48], [0, 50], [5, 52],
    [10, 55], [15, 55], [25, 60], [30, 70], [40, 70],
    [50, 55], [45, 45], [40, 42], [30, 40], [25, 35],
    [20, 35], [10, 38], [0, 38], [-10, 36]
  ]],
  "Africa": [[
    [-17, 15], [-15, 28], [-5, 35], [10, 37], [25, 32],
    [35, 30], [42, 12], [50, 12], [50, -10], [42, -25],
    [35, -35], [20, -35], [15, -30], [12, -20], [10, -5],
    [-5, 5], [-15, 10], [-17, 15]
  ]],
  "Asia": [[
    [50, 42], [55, 55], [60, 70], [80, 75], [100, 78],
    [140, 75], [170, 65], [170, 60], [145, 45], [140, 35],
    [130, 30], [120, 22], [105, 10], [95, 5], [80, 8],
    [75, 15], [70, 25], [60, 30], [50, 35], [50, 42]
  ]],
  "Australia": [[
    [113, -20], [115, -35], [120, -35], [130, -32], [140, -38],
    [150, -38], [155, -28], [150, -22], [145, -15], [142, -10],
    [135, -12], [130, -15], [125, -15], [120, -18], [113, -20]
  ]],
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

    import("globe.gl").then(async (GlobeModule) => {
      if (!isMounted || !container) return;

      const Globe = GlobeModule.default;
      const THREE = await import("three");

      const globe = Globe()(container)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-dark.jpg")
        .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
        .showAtmosphere(true)
        .atmosphereColor("#00d4ff")
        .atmosphereAltitude(0.2)
        .pointOfView({ lat: 20, lng: 0, altitude: 2.5 });

      // Add subtle clouds layer
      const CLOUDS_IMG_URL = "//unpkg.com/three-globe/example/img/clouds.png";
      const CLOUDS_ALT = 0.003;
      const CLOUDS_ROTATION_SPEED = -0.004;

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
            opacity: 0.25,
          })
        );
        globe.scene().add(clouds);

        (function rotateClouds() {
          if (!isMounted) return;
          clouds.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180;
          requestAnimationFrame(rotateClouds);
        })();
      });

      // Globe controls
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.3;
      globe.controls().enableZoom = true;
      globe.controls().minDistance = 150;
      globe.controls().maxDistance = 500;

      globeRef.current = globe;

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

  // Handle resize
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

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [isLoading]);

  // Update polygon regions (highlighted territories)
  useEffect(() => {
    if (!globeRef.current || !territories) return;

    // Create GeoJSON features for each territory (LAND ONLY - no ocean)
    const polygonData = territories
      .filter((territory) => VALID_TERRITORIES.includes(territory.name as any))
      .map((territory) => {
      const coords = CONTINENT_POLYGONS[territory.name];
      if (!coords) return null;

      const isSelected = selectedTerritoryId === territory._id;
      const tribeName = (territory as any).tribeName;

      return {
        type: "Feature",
        properties: {
          territory,
          isSelected,
          label: tribeName || territory.name,
          color: territory.color,
        },
        geometry: {
          type: "Polygon",
          coordinates: coords,
        },
      };
    }).filter(Boolean);

    // Clear any existing points data (remove dots)
    globeRef.current.pointsData([]);

    globeRef.current
      .polygonsData(polygonData)
      .polygonCapColor((d: any) => {
        const color = d.properties.color;
        const isSelected = d.properties.isSelected;
        // Parse hex color and add transparency
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const alpha = isSelected ? 0.6 : 0.35;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      })
      .polygonSideColor((d: any) => {
        const color = d.properties.color;
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, 0.2)`;
      })
      .polygonStrokeColor((d: any) => {
        const isSelected = d.properties.isSelected;
        return isSelected ? "#ffffff" : d.properties.color;
      })
      .polygonAltitude((d: any) => d.properties.isSelected ? 0.02 : 0.006)
      .polygonLabel((d: any) => {
        const props = d.properties;
        return `
          <div style="
            background: rgba(0,0,0,0.8);
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid ${props.color};
            font-family: 'Exo 2', sans-serif;
          ">
            <div style="color: ${props.color}; font-weight: 600; font-size: 14px;">
              ${props.label}
            </div>
            <div style="color: rgba(255,255,255,0.6); font-size: 11px; margin-top: 2px;">
              ${props.territory.name}
            </div>
          </div>
        `;
      })
      .onPolygonClick((polygon: any) => {
        if (polygon?.properties?.territory) {
          const territory = polygon.properties.territory;
          onSelectTerritory(territory._id);

          // Stop auto-rotation and focus on region
          const center = TERRITORY_CENTERS[territory.name];
          if (center) {
            globeRef.current.controls().autoRotate = false;
            globeRef.current.pointOfView(
              { lat: center.lat, lng: center.lng, altitude: 1.8 },
              1000
            );
          }
        }
      })
      .onPolygonHover((polygon: any) => {
        if (containerRef.current) {
          containerRef.current.style.cursor = polygon ? "pointer" : "grab";
        }
      });

    // Add territory name labels at center of each region
    const labelData = territories.map((territory) => {
      const center = TERRITORY_CENTERS[territory.name];
      if (!center) return null;

      const tribeName = (territory as any).tribeName;
      const isSelected = selectedTerritoryId === territory._id;

      return {
        lat: center.lat,
        lng: center.lng,
        text: (tribeName || territory.name).toUpperCase(),
        color: isSelected ? "#ffffff" : "rgba(255,255,255,0.8)",
        size: isSelected ? 1.0 : 0.7,
        altitude: isSelected ? 0.04 : 0.015,
      };
    }).filter(Boolean);

    globeRef.current
      .labelsData(labelData)
      .labelLat((d: any) => d.lat)
      .labelLng((d: any) => d.lng)
      .labelText((d: any) => d.text)
      .labelSize((d: any) => d.size)
      .labelDotRadius(0)
      .labelColor((d: any) => d.color)
      .labelResolution(2)
      .labelAltitude((d: any) => d.altitude);

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
            color = "#a855f7";
            strokeWidth = 2;
          } else if (rel.hasTradeAgreement) {
            color = "#22c55e";
            strokeWidth = 1.5;
            dashLength = 0.5;
            dashGap = 0.3;
          } else if (rel.status === "at_war") {
            color = "#ef4444";
            strokeWidth = 3;
          } else if (rel.status === "hostile") {
            color = "#f59e0b";
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
      .arcAltitude(0.1)
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

  // Focus and select territory (used by legend)
  const focusAndSelectTerritory = useCallback((territoryId: Id<"territories">) => {
    if (!globeRef.current || !territories) return;

    const territory = territories.find((t) => t._id === territoryId);
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

    onSelectTerritory(territoryId);
  }, [territories, onSelectTerritory]);

  return (
    <div className="h-full bg-[#030507] relative overflow-hidden">
      {/* Globe container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: "grab" }}
      />

      {/* Loading overlay */}
      {(isLoading || dataLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#030507]">
          <div className="text-center">
            <div className="relative inline-block">
              <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <div className="absolute inset-2 rounded-full border border-cyan-400/30" />
            </div>
            <p className="text-white/40 font-display text-sm tracking-wider mt-4">
              {dataLoading ? "LOADING DATA" : "INITIALIZING GLOBE"}<span className="loading-dots" />
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      {territories && agents && (
        <div className="absolute bottom-4 left-4 z-20 bg-black/70 backdrop-blur-md rounded-xl p-4 border border-white/10">
          <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-3 font-medium">
            Civilizations
          </h4>
          <div className="space-y-1">
            {territories.map((territory) => {
              const tribeName = (territory as any).tribeName;
              const isSelected = selectedTerritoryId === territory._id;

              return (
                <button
                  key={territory._id}
                  onClick={() => focusAndSelectTerritory(territory._id)}
                  className={`flex items-center gap-3 w-full px-2 py-1.5 rounded-lg transition-all ${
                    isSelected
                      ? "bg-white/15"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{
                      backgroundColor: territory.color,
                      boxShadow: isSelected ? `0 0 8px ${territory.color}` : 'none'
                    }}
                  />
                  <span className={`text-xs truncate ${isSelected ? 'text-white' : 'text-white/70'}`}>
                    {tribeName || territory.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Relationship legend */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-medium">
              Relations
            </h4>
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-purple-500 rounded" />
                <span className="text-white/50">Alliance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-green-500 rounded" style={{ background: 'repeating-linear-gradient(90deg, #22c55e 0, #22c55e 3px, transparent 3px, transparent 5px)' }} />
                <span className="text-white/50">Trade</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500 rounded" />
                <span className="text-white/50">War</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
