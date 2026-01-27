'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface ProceduralTerrainProps {
  seed: number;
  naturalResources: string[];
  territoryColor: string;
}

// Simple seeded random number generator
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// 2D Noise function using seeded random
function noise2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

// Smooth noise interpolation
function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smooth interpolation
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

// Fractal Brownian Motion for more natural terrain
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

// Calculate terrain height at a given x,z position (must match terrain generation)
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

// Get color based on height
function getTerrainColor(height: number, hasWater: boolean): THREE.Color {
  if (hasWater && height < 0.15) {
    // Underwater sand
    return new THREE.Color(0.76, 0.7, 0.5);
  } else if (height < 0.3) {
    // Grass
    return new THREE.Color(0.35, 0.55, 0.3);
  } else if (height < 0.5) {
    // Light grass
    return new THREE.Color(0.45, 0.62, 0.35);
  } else if (height < 0.7) {
    // Dirt/rock
    return new THREE.Color(0.55, 0.45, 0.35);
  } else {
    // Stone
    return new THREE.Color(0.5, 0.48, 0.45);
  }
}

export function ProceduralTerrain({
  seed,
  naturalResources,
  territoryColor,
}: ProceduralTerrainProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const waterRef = useRef<THREE.Mesh>(null);

  const hasWater = naturalResources.some(r =>
    ['fish', 'water', 'pearls', 'coral', 'salt'].includes(r.toLowerCase())
  );

  const hasMountains = naturalResources.some(r =>
    ['gold', 'iron', 'copper', 'silver', 'gems', 'stone', 'coal'].includes(r.toLowerCase())
  );

  const geometry = useMemo(() => {
    const size = 80; // Much larger terrain
    const segments = 128; // More detail
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);

      // Generate height using fbm (adjusted for larger scale)
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

      // Scale height
      const finalHeight = height * 4;
      positions.setZ(i, finalHeight);

      // Set vertex color based on height
      const color = getTerrainColor(height, hasWater);

      // Add slight variation
      const variation = (seededRandom(seed + i) - 0.5) * 0.1;
      colors[i * 3] = Math.min(1, Math.max(0, color.r + variation));
      colors[i * 3 + 1] = Math.min(1, Math.max(0, color.g + variation));
      colors[i * 3 + 2] = Math.min(1, Math.max(0, color.b + variation));
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.rotateX(-Math.PI / 2);

    return geo;
  }, [seed, hasWater, hasMountains]);

  // Water animation
  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.position.y = -0.1 + Math.sin(clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <group>
      {/* Main terrain */}
      <mesh ref={meshRef} geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          flatShading
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Water plane if territory has water resources */}
      {hasWater && (
        <mesh
          ref={waterRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.1, 0]}
          receiveShadow
        >
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial
            color="#2a6495"
            transparent
            opacity={0.7}
            roughness={0.2}
            metalness={0.3}
          />
        </mesh>
      )}

      {/* Ground base to prevent seeing under terrain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* Decorative rocks around edges */}
      <TerrainDecorations seed={seed} hasWater={hasWater} hasMountains={hasMountains} />
    </group>
  );
}

// Rocks and other terrain decorations
function TerrainDecorations({
  seed,
  hasWater,
  hasMountains,
}: {
  seed: number;
  hasWater: boolean;
  hasMountains: boolean;
}) {
  const rocks = useMemo(() => {
    const items: Array<{
      position: [number, number, number];
      scale: [number, number, number];
      rotation: number;
    }> = [];

    const rockCount = hasMountains ? 60 : 35;

    for (let i = 0; i < rockCount; i++) {
      const angle = seededRandom(seed + i * 10) * Math.PI * 2;
      const dist = 15 + seededRandom(seed + i * 20) * 20;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Calculate terrain height at this position
      const terrainY = getTerrainHeight(x, z, seed, hasMountains);

      items.push({
        position: [x, terrainY + 0.3, z], // Place on top of terrain
        scale: [
          0.5 + seededRandom(seed + i * 40) * 1.0,
          0.5 + seededRandom(seed + i * 50) * 1.2,
          0.5 + seededRandom(seed + i * 60) * 1.0,
        ],
        rotation: seededRandom(seed + i * 70) * Math.PI * 2,
      });
    }

    return items;
  }, [seed, hasMountains]);

  const trees = useMemo(() => {
    const items: Array<{
      position: [number, number, number];
      scale: number;
    }> = [];

    const treeCount = hasWater ? 40 : 70;

    for (let i = 0; i < treeCount; i++) {
      const angle = seededRandom(seed + i * 100) * Math.PI * 2;
      const dist = 10 + seededRandom(seed + i * 110) * 25;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Don't place in water or too close to center
      if (hasWater && Math.sqrt(x * x + z * z) < 8) continue;

      // Calculate terrain height at this position
      const terrainY = getTerrainHeight(x, z, seed, hasMountains);

      items.push({
        position: [x, terrainY, z], // Place on terrain surface
        scale: 0.8 + seededRandom(seed + i * 120) * 0.7,
      });
    }

    return items;
  }, [seed, hasWater, hasMountains]);

  return (
    <group>
      {/* Rocks */}
      {rocks.map((rock, i) => (
        <mesh
          key={`rock-${i}`}
          position={rock.position}
          scale={rock.scale}
          rotation={[0, rock.rotation, 0]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#5a5a6a"
            flatShading
            roughness={0.9}
          />
        </mesh>
      ))}

      {/* Low-poly trees */}
      {trees.map((tree, i) => (
        <LowPolyTree
          key={`tree-${i}`}
          position={tree.position}
          scale={tree.scale}
        />
      ))}
    </group>
  );
}

// Simple low-poly tree
function LowPolyTree({
  position,
  scale,
}: {
  position: [number, number, number];
  scale: number;
}) {
  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 0.8, 6]} />
        <meshStandardMaterial color="#5c4033" flatShading />
      </mesh>

      {/* Foliage layers */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <coneGeometry args={[0.6, 0.8, 6]} />
        <meshStandardMaterial color="#2d5a27" flatShading />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[0.45, 0.7, 6]} />
        <meshStandardMaterial color="#3d6a37" flatShading />
      </mesh>
      <mesh position={[0, 1.9, 0]} castShadow>
        <coneGeometry args={[0.3, 0.5, 6]} />
        <meshStandardMaterial color="#4d7a47" flatShading />
      </mesh>
    </group>
  );
}
