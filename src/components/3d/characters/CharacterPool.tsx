'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { LowPolyCharacter, CharacterRole, CharacterActivity } from './LowPolyCharacter';

interface CharacterPoolProps {
  population: number;
  food: number;
  military: number;
  happiness: number;
  naturalResources: string[];
  isAtWar: boolean;
  territoryColor: string;
  seed: number;
}

interface CharacterState {
  id: number;
  role: CharacterRole;
  activity: CharacterActivity;
  position: [number, number, number];
  targetPosition: [number, number, number];
  activityTimer: number;
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
  // Generate height using fbm (same as terrain generation)
  let height = fbm(x * 0.04, z * 0.04, seed, 5);

  // Add mountains if territory has mineral resources
  if (hasMountains) {
    const mountainNoise = fbm(x * 0.02, z * 0.02, seed + 500, 3);
    if (mountainNoise > 0.55) {
      height += (mountainNoise - 0.55) * 4;
    }
  }

  // Create a flatter area in the center for buildings (larger flat area)
  const distFromCenter = Math.sqrt(x * x + z * z);
  const flattenFactor = Math.max(0, 1 - distFromCenter / 15);
  height = height * (1 - flattenFactor * 0.8);

  // Scale height (same as terrain generation)
  return height * 4;
}

// Get random position within a zone with proper terrain height
function getRandomPositionInZone(
  zone: 'center' | 'fields' | 'military' | 'market' | 'edge',
  positionSeed: number,
  terrainSeed: number,
  hasMountains: boolean
): [number, number, number] {
  const r = seededRandom(positionSeed);
  const r2 = seededRandom(positionSeed + 1);
  const angle = r * Math.PI * 2;

  let x: number, z: number;

  switch (zone) {
    case 'center':
      const dist1 = 2 + r2 * 6;
      x = Math.cos(angle) * dist1;
      z = Math.sin(angle) * dist1;
      break;

    case 'fields':
      const dist2 = 15 + r2 * 15;
      x = Math.cos(angle) * dist2;
      z = Math.sin(angle) * dist2;
      break;

    case 'military':
      const dist3 = 10 + r2 * 8;
      const militaryAngle = angle * 0.4 + Math.PI;
      x = Math.cos(militaryAngle) * dist3;
      z = Math.sin(militaryAngle) * dist3;
      break;

    case 'market':
      const dist4 = 6 + r2 * 5;
      x = Math.cos(angle) * dist4;
      z = Math.sin(angle) * dist4;
      break;

    case 'edge':
      const dist5 = 20 + r2 * 10;
      x = Math.cos(angle) * dist5;
      z = Math.sin(angle) * dist5;
      break;

    default:
      x = 0;
      z = 0;
  }

  // Calculate terrain height at this position and add offset for character feet
  const terrainY = getTerrainHeight(x, z, terrainSeed, hasMountains);
  const characterOffset = 0.5; // Raise character slightly above ground

  return [x, terrainY + characterOffset, z];
}

// Determine what zone a role should occupy
function getZoneForRole(role: CharacterRole): 'center' | 'fields' | 'military' | 'market' | 'edge' {
  switch (role) {
    case 'soldier':
      return 'military';
    case 'farmer':
      return 'fields';
    case 'miner':
      return 'edge';
    case 'trader':
      return 'market';
    case 'builder':
      return 'center';
    case 'civilian':
    default:
      return 'center';
  }
}

export function CharacterPool({
  population,
  food,
  military,
  happiness,
  naturalResources,
  isAtWar,
  territoryColor,
  seed,
}: CharacterPoolProps) {
  // Check if terrain has mountains (same logic as ProceduralTerrain)
  const hasMountains = useMemo(() => {
    return naturalResources.some(r =>
      ['gold', 'iron', 'copper', 'silver', 'gems', 'stone', 'coal'].includes(r.toLowerCase())
    );
  }, [naturalResources]);

  // Calculate character distribution
  const distribution = useMemo(() => {
    // Scale population logarithmically (min 15, max 60 visible characters)
    const totalVisible = Math.min(60, Math.max(15, Math.ceil(Math.log10(Math.max(population, 10)) * 18)));

    // Check for specific resource types
    const hasMinerals = naturalResources.some(r =>
      ['gold', 'iron', 'copper', 'silver', 'gems', 'stone', 'coal'].includes(r.toLowerCase())
    );
    const hasFarming = naturalResources.some(r =>
      ['wheat', 'rice', 'corn', 'vegetables', 'fruit'].includes(r.toLowerCase())
    ) || food > 30;

    // Base distribution
    let farmers = hasFarming ? Math.ceil(totalVisible * 0.25) : Math.ceil(totalVisible * 0.1);
    let miners = hasMinerals ? Math.ceil(totalVisible * 0.15) : 0;
    let builders = Math.ceil(totalVisible * 0.1);
    let soldiers = Math.ceil((military / 100) * totalVisible * 0.3);
    let traders = Math.ceil(totalVisible * 0.1);

    // War adjustments
    if (isAtWar) {
      soldiers = Math.ceil(soldiers * 1.5);
      farmers = Math.ceil(farmers * 0.7);
    }

    // Fill remaining with civilians
    const allocated = farmers + miners + builders + soldiers + traders;
    let civilians = Math.max(0, totalVisible - allocated);

    // Happy festivals
    const isFestival = happiness > 70 && !isAtWar;

    return {
      farmers,
      miners,
      builders,
      soldiers,
      traders,
      civilians,
      total: totalVisible,
      isFestival,
    };
  }, [population, food, military, happiness, naturalResources, isAtWar]);

  // Generate initial character states
  const [characters, setCharacters] = useState<CharacterState[]>([]);

  // Initialize characters when distribution changes
  useEffect(() => {
    const newCharacters: CharacterState[] = [];
    let id = 0;

    const createCharacters = (count: number, role: CharacterRole) => {
      for (let i = 0; i < count; i++) {
        const zone = getZoneForRole(role);
        const pos = getRandomPositionInZone(zone, id * 100, seed, hasMountains);
        const targetPos = getRandomPositionInZone(zone, id * 100 + 50, seed, hasMountains);

        // Determine initial activity
        let activity: CharacterActivity = 'idle';
        if (distribution.isFestival && role === 'civilian') {
          activity = 'celebrating';
        } else if (seededRandom(id * 200) > 0.3) {
          activity = role === 'civilian' || role === 'trader' ? 'walking' : 'working';
        }

        newCharacters.push({
          id: id++,
          role,
          activity,
          position: pos,
          targetPosition: targetPos,
          activityTimer: seededRandom(id * 300) * 10 + 3,
        });
      }
    };

    createCharacters(distribution.farmers, 'farmer');
    createCharacters(distribution.miners, 'miner');
    createCharacters(distribution.builders, 'builder');
    createCharacters(distribution.soldiers, 'soldier');
    createCharacters(distribution.traders, 'trader');
    createCharacters(distribution.civilians, 'civilian');

    setCharacters(newCharacters);
  }, [distribution, seed, hasMountains]);

  // Update character activities over time
  useFrame(({ clock }, delta) => {
    setCharacters(prev => {
      return prev.map(char => {
        let newTimer = char.activityTimer - delta;

        if (newTimer <= 0) {
          // Change activity
          const zone = getZoneForRole(char.role);
          const newTarget = getRandomPositionInZone(zone, clock.elapsedTime * 1000 + char.id, seed, hasMountains);

          // Cycle through activities
          let newActivity: CharacterActivity;
          if (distribution.isFestival && char.role === 'civilian') {
            newActivity = seededRandom(clock.elapsedTime + char.id) > 0.5 ? 'celebrating' : 'walking';
          } else if (char.activity === 'idle') {
            newActivity = 'walking';
          } else if (char.activity === 'walking') {
            newActivity = char.role === 'civilian' || char.role === 'trader' ? 'idle' : 'working';
          } else {
            newActivity = 'idle';
          }

          return {
            ...char,
            activity: newActivity,
            targetPosition: newTarget,
            activityTimer: 3 + seededRandom(clock.elapsedTime * 100 + char.id) * 7,
          };
        }

        return { ...char, activityTimer: newTimer };
      });
    });
  });

  // Calculate terrain height for battle and festival positions
  const battleTerrainY = useMemo(() => getTerrainHeight(30, 0, seed, hasMountains), [seed, hasMountains]);
  const festivalTerrainY = useMemo(() => getTerrainHeight(0, 5, seed, hasMountains), [seed, hasMountains]);

  return (
    <group>
      {characters.map(char => (
        <LowPolyCharacter
          key={char.id}
          position={char.position}
          role={char.role}
          activity={char.activity}
          territoryColor={territoryColor}
          targetPosition={char.targetPosition}
          seed={char.id}
        />
      ))}

      {/* War battle scene at edge */}
      {isAtWar && <BattleScene territoryColor={territoryColor} terrainY={battleTerrainY} />}

      {/* Festival area in center during high happiness */}
      {distribution.isFestival && <FestivalArea territoryColor={territoryColor} terrainY={festivalTerrainY} />}
    </group>
  );
}

// Battle scene when at war
function BattleScene({ territoryColor, terrainY }: { territoryColor: string; terrainY: number }) {
  return (
    <group position={[30, terrainY + 0.5, 0]}>
      {/* Battle smoke/dust - larger area */}
      {[...Array(10)].map((_, i) => (
        <mesh
          key={`dust-${i}`}
          position={[
            (i - 5) * 2,
            1 + Math.sin(i) * 0.5,
            Math.cos(i * 2) * 2,
          ]}
        >
          <sphereGeometry args={[0.6 + i * 0.15, 6, 6]} />
          <meshStandardMaterial
            color="#8b4513"
            transparent
            opacity={0.3}
          />
        </mesh>
      ))}

      {/* Red glow indicating battle */}
      <pointLight
        position={[0, 2, 0]}
        color="#ff3300"
        intensity={4}
        distance={15}
        decay={2}
      />
    </group>
  );
}

// Festival decorations
function FestivalArea({ territoryColor, terrainY }: { territoryColor: string; terrainY: number }) {
  return (
    <group position={[0, terrainY + 0.3, 0]}>
      {/* Bonfire in center */}
      <group position={[0, 0, 5]}>
        {/* Fire pit - larger */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[1, 1.2, 0.4, 8]} />
          <meshStandardMaterial color="#4a4a4a" flatShading />
        </mesh>
        {/* Fire glow */}
        <pointLight
          position={[0, 1, 0]}
          color="#ff6600"
          intensity={5}
          distance={12}
          decay={2}
        />
        {/* Flame mesh - larger */}
        <mesh position={[0, 1, 0]}>
          <coneGeometry args={[0.6, 1.5, 6]} />
          <meshStandardMaterial
            color="#ff4400"
            emissive="#ff6600"
            emissiveIntensity={0.5}
            transparent
            opacity={0.8}
          />
        </mesh>
      </group>

      {/* Banners around - spread out more */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * 8;
        const z = Math.sin(rad) * 8;
        return (
          <group key={`banner-${i}`} position={[x, 0, z]}>
            {/* Pole - taller */}
            <mesh position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 3, 4]} />
              <meshStandardMaterial color="#5c4033" flatShading />
            </mesh>
            {/* Banner - larger */}
            <mesh position={[0.25, 2.5, 0]}>
              <boxGeometry args={[0.4, 0.7, 0.02]} />
              <meshStandardMaterial color={territoryColor} flatShading />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
