'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface BuildingGeneratorProps {
  wealth: number;
  technology: number;
  population: number;
  governance: string;
  territoryColor: string;
  seed: number;
  naturalResources?: string[];
}

// Simple seeded random
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// 2D Noise function using seeded random (same as terrain)
function noise2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

// Smooth noise interpolation (same as terrain)
function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = noise2D(ix, iy, seed);
  const n10 = noise2D(ix + 1, iy, seed);
  const n01 = noise2D(ix, iy + 1, seed);
  const n11 = noise2D(ix + 1, iy + 1, seed);

  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;

  return nx0 * (1 - sy) + nx1 * sy;
}

// Fractal Brownian Motion (same as terrain)
function fbm(x: number, y: number, seed: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency, seed + i * 100);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

// Calculate terrain height at a given x,z position (must match ProceduralTerrain)
function getTerrainHeight(x: number, z: number, seed: number, hasMountains: boolean): number {
  let height = fbm(x * 0.04, z * 0.04, seed, 5);

  if (hasMountains) {
    const mountainNoise = fbm(x * 0.02, z * 0.02, seed + 500, 3);
    if (mountainNoise > 0.55) {
      height += (mountainNoise - 0.55) * 4;
    }
  }

  const distFromCenter = Math.sqrt(x * x + z * z);
  const flattenFactor = Math.max(0, 1 - distFromCenter / 15);
  height = height * (1 - flattenFactor * 0.8);

  return height * 4;
}

// Parse hex color to THREE.Color
function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// Darken a color
function darkenColor(color: THREE.Color, factor: number): THREE.Color {
  return new THREE.Color(
    color.r * factor,
    color.g * factor,
    color.b * factor
  );
}

export function BuildingGenerator({
  wealth,
  technology,
  population,
  governance,
  territoryColor,
  seed,
  naturalResources = [],
}: BuildingGeneratorProps) {
  const baseColor = useMemo(() => hexToColor(territoryColor), [territoryColor]);

  // Check if terrain has mountains (same logic as ProceduralTerrain)
  const hasMountains = useMemo(() => {
    return naturalResources.some(r =>
      ['gold', 'iron', 'copper', 'silver', 'gems', 'stone', 'coal'].includes(r.toLowerCase())
    );
  }, [naturalResources]);

  // Calculate building count based on population and wealth
  const buildingCount = useMemo(() => {
    const popFactor = Math.ceil(Math.log10(Math.max(population, 10)) * 5);
    const wealthFactor = Math.ceil(wealth / 20);
    return Math.min(popFactor + wealthFactor, 40); // More buildings
  }, [population, wealth]);

  // Building heights based on technology
  const maxStories = useMemo(() => {
    if (technology < 20) return 1;
    if (technology < 40) return 2;
    if (technology < 60) return 3;
    if (technology < 80) return 4;
    return 5;
  }, [technology]);

  // Get terrain height at center for central building
  const centerTerrainY = useMemo(() => getTerrainHeight(0, 0, seed, hasMountains), [seed, hasMountains]);

  // Generate residential building positions in rings
  const buildings = useMemo(() => {
    const items: Array<{
      position: [number, number, number];
      width: number;
      height: number;
      depth: number;
      roofType: 'flat' | 'peaked' | 'dome';
      color: THREE.Color;
    }> = [];

    for (let i = 0; i < buildingCount; i++) {
      // Spiral placement - spread out more
      const angle = (i / buildingCount) * Math.PI * 2 + seededRandom(seed + i * 10) * 0.8;
      const ring = Math.floor(i / 8) + 1;
      const dist = 4 + ring * 3.5 + seededRandom(seed + i * 20) * 2;

      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Calculate terrain height at this position
      const terrainY = getTerrainHeight(x, z, seed, hasMountains);

      const stories = Math.max(1, Math.floor(seededRandom(seed + i * 30) * maxStories) + 1);
      const height = stories * 0.8; // Taller buildings
      const width = 0.6 + seededRandom(seed + i * 40) * 0.5; // Larger buildings
      const depth = 0.6 + seededRandom(seed + i * 50) * 0.5;

      // Roof type based on technology
      let roofType: 'flat' | 'peaked' | 'dome' = 'flat';
      if (technology > 30) {
        const roofRoll = seededRandom(seed + i * 60);
        roofType = roofRoll < 0.5 ? 'peaked' : 'flat';
      }

      // Color variation
      const colorVariation = 0.8 + seededRandom(seed + i * 70) * 0.4;
      const buildingColor = new THREE.Color(
        0.6 * colorVariation,
        0.55 * colorVariation,
        0.5 * colorVariation
      );

      items.push({
        position: [x, terrainY + height / 2 + 0.2, z], // Placed on terrain
        width,
        height,
        depth,
        roofType,
        color: buildingColor,
      });
    }

    return items;
  }, [buildingCount, maxStories, seed, technology, hasMountains]);

  return (
    <group>
      {/* Central building based on governance */}
      <CentralBuilding
        governance={governance}
        technology={technology}
        territoryColor={baseColor}
        seed={seed}
        terrainY={centerTerrainY}
      />

      {/* Residential buildings */}
      {buildings.map((building, i) => (
        <Building
          key={`building-${i}`}
          position={building.position}
          width={building.width}
          height={building.height}
          depth={building.depth}
          roofType={building.roofType}
          color={building.color}
          territoryColor={baseColor}
        />
      ))}

      {/* Market stalls if high enough wealth */}
      {wealth > 50 && (
        <MarketArea seed={seed} territoryColor={baseColor} hasMountains={hasMountains} />
      )}

      {/* Military structures if high military */}
      {/* (military barracks are handled elsewhere in activities) */}
    </group>
  );
}

// Individual building component
function Building({
  position,
  width,
  height,
  depth,
  roofType,
  color,
  territoryColor,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  roofType: 'flat' | 'peaked' | 'dome';
  color: THREE.Color;
  territoryColor: THREE.Color;
}) {
  const roofColor = darkenColor(territoryColor, 0.7);

  return (
    <group position={position}>
      {/* Main building body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>

      {/* Roof */}
      {roofType === 'peaked' && (
        <mesh
          position={[0, height / 2 + 0.15, 0]}
          castShadow
        >
          <coneGeometry args={[Math.max(width, depth) * 0.8, 0.3, 4]} />
          <meshStandardMaterial color={roofColor} flatShading />
        </mesh>
      )}

      {roofType === 'flat' && (
        <mesh
          position={[0, height / 2 + 0.03, 0]}
          castShadow
        >
          <boxGeometry args={[width + 0.05, 0.06, depth + 0.05]} />
          <meshStandardMaterial color={roofColor} flatShading />
        </mesh>
      )}

      {/* Simple door */}
      <mesh position={[0, -height / 2 + 0.1, depth / 2 + 0.01]}>
        <planeGeometry args={[0.15, 0.2]} />
        <meshStandardMaterial color="#3d2817" />
      </mesh>

      {/* Window */}
      {height > 0.5 && (
        <mesh position={[0, 0, depth / 2 + 0.01]}>
          <planeGeometry args={[0.1, 0.1]} />
          <meshStandardMaterial color="#7799aa" />
        </mesh>
      )}
    </group>
  );
}

// Central building based on governance type
function CentralBuilding({
  governance,
  technology,
  territoryColor,
  seed,
  terrainY,
}: {
  governance: string;
  technology: number;
  territoryColor: THREE.Color;
  seed: number;
  terrainY: number;
}) {
  const buildingColor = new THREE.Color(0.7, 0.65, 0.55);
  const accentColor = darkenColor(territoryColor, 0.8);

  switch (governance) {
    case 'none':
      // Campfire circle
      return (
        <group position={[0, terrainY, 0]}>
          {/* Fire pit */}
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.4, 0.5, 0.1, 8]} />
            <meshStandardMaterial color="#4a4a4a" flatShading />
          </mesh>
          {/* Fire logs */}
          {[0, 60, 120, 180, 240, 300].map((angle, i) => (
            <mesh
              key={`log-${i}`}
              position={[
                Math.cos((angle * Math.PI) / 180) * 0.25,
                0.1,
                Math.sin((angle * Math.PI) / 180) * 0.25,
              ]}
              rotation={[0, (angle * Math.PI) / 180, Math.PI / 6]}
            >
              <cylinderGeometry args={[0.04, 0.04, 0.3, 5]} />
              <meshStandardMaterial color="#5c4033" flatShading />
            </mesh>
          ))}
          {/* Fire glow */}
          <pointLight
            position={[0, 0.3, 0]}
            color="#ff6600"
            intensity={2}
            distance={3}
            decay={2}
          />
        </group>
      );

    case 'council':
      // Round meeting hall
      return (
        <group position={[0, terrainY, 0]}>
          <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.2, 1.4, 1.2, 12]} />
            <meshStandardMaterial color={buildingColor} flatShading />
          </mesh>
          {/* Conical roof */}
          <mesh position={[0, 1.4, 0]} castShadow>
            <coneGeometry args={[1.6, 0.8, 12]} />
            <meshStandardMaterial color={accentColor} flatShading />
          </mesh>
          {/* Entrance */}
          <mesh position={[0, 0.3, 1.3]}>
            <boxGeometry args={[0.5, 0.6, 0.3]} />
            <meshStandardMaterial color={buildingColor} flatShading />
          </mesh>
        </group>
      );

    case 'chief':
    case 'monarchy':
      // Tall palace
      const palaceHeight = 1.5 + technology / 100;
      return (
        <group position={[0, terrainY, 0]}>
          {/* Main tower */}
          <mesh position={[0, palaceHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.5, palaceHeight, 1.5]} />
            <meshStandardMaterial color={buildingColor} flatShading />
          </mesh>
          {/* Tower top */}
          <mesh position={[0, palaceHeight + 0.3, 0]} castShadow>
            <coneGeometry args={[1, 0.6, 4]} />
            <meshStandardMaterial color={accentColor} flatShading />
          </mesh>
          {/* Side towers */}
          {[[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1]].map((pos, i) => (
            <group key={`tower-${i}`} position={pos as [number, number, number]}>
              <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.3, 0.35, 1, 6]} />
                <meshStandardMaterial color={buildingColor} flatShading />
              </mesh>
              <mesh position={[0, 1.1, 0]} castShadow>
                <coneGeometry args={[0.4, 0.4, 6]} />
                <meshStandardMaterial color={accentColor} flatShading />
              </mesh>
            </group>
          ))}
          {/* Banner */}
          <mesh position={[0, palaceHeight + 0.8, 0]}>
            <boxGeometry args={[0.02, 0.4, 0.2]} />
            <meshStandardMaterial color={territoryColor} />
          </mesh>
        </group>
      );

    case 'democracy':
      // Columned building (like a capitol)
      return (
        <group position={[0, terrainY, 0]}>
          {/* Platform */}
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.5, 0.2, 2]} />
            <meshStandardMaterial color="#888888" flatShading />
          </mesh>
          {/* Main building */}
          <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 1, 1.5]} />
            <meshStandardMaterial color={buildingColor} flatShading />
          </mesh>
          {/* Triangular roof */}
          <mesh position={[0, 1.4, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <extrudeGeometry
              args={[
                new THREE.Shape([
                  new THREE.Vector2(-1, 0),
                  new THREE.Vector2(0, 0.5),
                  new THREE.Vector2(1, 0),
                ]),
                { depth: 2, bevelEnabled: false },
              ]}
            />
            <meshStandardMaterial color={accentColor} flatShading />
          </mesh>
          {/* Columns */}
          {[-0.7, 0, 0.7].map((x, i) => (
            <mesh
              key={`column-${i}`}
              position={[x, 0.6, 1]}
              castShadow
            >
              <cylinderGeometry args={[0.08, 0.1, 1, 8]} />
              <meshStandardMaterial color="#cccccc" flatShading />
            </mesh>
          ))}
        </group>
      );

    case 'theocracy':
      // Temple with spire
      return (
        <group position={[0, terrainY, 0]}>
          {/* Base */}
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 0.6, 2]} />
            <meshStandardMaterial color={buildingColor} flatShading />
          </mesh>
          {/* Mid section */}
          <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.4, 1.5]} />
            <meshStandardMaterial color={buildingColor} flatShading />
          </mesh>
          {/* Spire */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <coneGeometry args={[0.6, 1.2, 8]} />
            <meshStandardMaterial color={accentColor} flatShading />
          </mesh>
          {/* Glowing orb at top */}
          <mesh position={[0, 2.2, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial
              color={territoryColor}
              emissive={territoryColor}
              emissiveIntensity={0.5}
            />
          </mesh>
          <pointLight
            position={[0, 2.2, 0]}
            color={territoryColor}
            intensity={1}
            distance={4}
            decay={2}
          />
        </group>
      );

    case 'dictatorship':
      // Imposing fortress-like building
      return (
        <group position={[0, terrainY, 0]}>
          {/* Main block */}
          <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 1.6, 2]} />
            <meshStandardMaterial color="#4a4a4a" flatShading />
          </mesh>
          {/* Watchtowers */}
          {[[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1]].map((pos, i) => (
            <group key={`watchtower-${i}`} position={pos as [number, number, number]}>
              <mesh position={[0, 1, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.5, 2, 0.5]} />
                <meshStandardMaterial color="#3a3a3a" flatShading />
              </mesh>
              <mesh position={[0, 2.1, 0]} castShadow>
                <boxGeometry args={[0.6, 0.2, 0.6]} />
                <meshStandardMaterial color="#2a2a2a" flatShading />
              </mesh>
            </group>
          ))}
          {/* Flag */}
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[0.03, 0.6, 0.3]} />
            <meshStandardMaterial color={territoryColor} />
          </mesh>
        </group>
      );

    default:
      // Simple hut for unknown governance
      return (
        <group position={[0, terrainY, 0]}>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.8, 1, 0.8, 8]} />
            <meshStandardMaterial color="#8b7355" flatShading />
          </mesh>
          <mesh position={[0, 0.9, 0]} castShadow>
            <coneGeometry args={[1.2, 0.6, 8]} />
            <meshStandardMaterial color="#654321" flatShading />
          </mesh>
        </group>
      );
  }
}

// Market area with stalls
function MarketArea({
  seed,
  territoryColor,
  hasMountains,
}: {
  seed: number;
  territoryColor: THREE.Color;
  hasMountains: boolean;
}) {
  const stalls = useMemo(() => {
    const items: Array<{
      position: [number, number, number];
      rotation: number;
    }> = [];

    const stallCount = 8; // More stalls
    const startAngle = seededRandom(seed + 1000) * Math.PI * 2;

    for (let i = 0; i < stallCount; i++) {
      const angle = startAngle + (i / stallCount) * Math.PI * 1.2;
      const dist = 8 + seededRandom(seed + i * 50) * 4; // Spread out more
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Calculate terrain height at stall position
      const terrainY = getTerrainHeight(x, z, seed, hasMountains);

      items.push({
        position: [x, terrainY + 0.2, z], // Placed on terrain
        rotation: angle + Math.PI,
      });
    }

    return items;
  }, [seed, hasMountains]);

  const canopyColor = darkenColor(territoryColor, 0.9);

  return (
    <group>
      {stalls.map((stall, i) => (
        <group
          key={`stall-${i}`}
          position={stall.position}
          rotation={[0, stall.rotation, 0]}
        >
          {/* Counter */}
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.5, 0.4]} />
            <meshStandardMaterial color="#8b7355" flatShading />
          </mesh>
          {/* Canopy poles */}
          <mesh position={[-0.35, 0.6, -0.15]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.8, 4]} />
            <meshStandardMaterial color="#654321" flatShading />
          </mesh>
          <mesh position={[0.35, 0.6, -0.15]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.8, 4]} />
            <meshStandardMaterial color="#654321" flatShading />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, 1, 0]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.9, 0.02, 0.5]} />
            <meshStandardMaterial color={canopyColor} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
