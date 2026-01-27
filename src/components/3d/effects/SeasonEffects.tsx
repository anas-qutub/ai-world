'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SeasonEffectsProps {
  month: number; // 1-12
  isAtWar: boolean;
  territoryName: string;
}

// Climate zones based on territory location
type ClimateZone = 'tropical' | 'desert' | 'temperate' | 'arctic' | 'mediterranean';

// Determine climate zone from territory name
function getClimateZone(territoryName: string): ClimateZone {
  const name = territoryName.toLowerCase();

  // Tropical regions - always warm and sunny
  if (name.includes('africa') || name.includes('congo') || name.includes('nigeria') ||
      name.includes('brazil') || name.includes('amazon') || name.includes('indonesia') ||
      name.includes('india') || name.includes('thailand') || name.includes('vietnam') ||
      name.includes('caribbean') || name.includes('equator') || name.includes('tropical')) {
    return 'tropical';
  }

  // Desert regions - hot and dry
  if (name.includes('sahara') || name.includes('arabia') || name.includes('egypt') ||
      name.includes('libya') || name.includes('morocco') || name.includes('desert') ||
      name.includes('middle east') || name.includes('iran') || name.includes('iraq')) {
    return 'desert';
  }

  // Arctic/cold regions
  if (name.includes('russia') || name.includes('siberia') || name.includes('alaska') ||
      name.includes('canada') || name.includes('nordic') || name.includes('scandinavia') ||
      name.includes('arctic') || name.includes('greenland') || name.includes('iceland')) {
    return 'arctic';
  }

  // Mediterranean
  if (name.includes('italy') || name.includes('greece') || name.includes('spain') ||
      name.includes('mediterranean') || name.includes('turkey')) {
    return 'mediterranean';
  }

  // Default to temperate
  return 'temperate';
}

// Get effective season based on climate zone and month
function getEffectiveSeason(
  month: number,
  climateZone: ClimateZone
): 'winter' | 'spring' | 'summer' | 'fall' {
  // Tropical regions are always summer-like
  if (climateZone === 'tropical') {
    return 'summer';
  }

  // Desert regions are always hot (summer-like but drier)
  if (climateZone === 'desert') {
    return 'summer';
  }

  // Arctic regions have longer winters
  if (climateZone === 'arctic') {
    if (month >= 10 || month <= 4) return 'winter';
    if (month >= 5 && month <= 6) return 'spring';
    return 'summer'; // Short summer
  }

  // Mediterranean has mild winters
  if (climateZone === 'mediterranean') {
    if (month === 12 || month === 1 || month === 2) return 'spring'; // Mild winter
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 9) return 'summer';
    return 'fall';
  }

  // Temperate - normal seasons
  if (month === 12 || month === 1 || month === 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'fall';
}

// Season-based colors and settings
const seasonSettings = {
  winter: {
    skyColor: '#8fa4bf',
    groundTint: '#ddeeff',
    sunColor: '#aaccff',
    sunIntensity: 0.6,
    sunPosition: [10, 4, 10] as [number, number, number],
    ambientIntensity: 0.4,
    fogColor: '#c8d8e8',
    fogDensity: 0.02,
  },
  spring: {
    skyColor: '#87ceeb',
    groundTint: '#90EE90',
    sunColor: '#fff5e0',
    sunIntensity: 1.0,
    sunPosition: [10, 10, 10] as [number, number, number],
    ambientIntensity: 0.5,
    fogColor: '#e8f4e8',
    fogDensity: 0.008,
  },
  summer: {
    skyColor: '#4da6ff',
    groundTint: '#fffacd',
    sunColor: '#fffaf0',
    sunIntensity: 1.3,
    sunPosition: [8, 15, 8] as [number, number, number],
    ambientIntensity: 0.6,
    fogColor: '#f5f5dc',
    fogDensity: 0.005,
  },
  fall: {
    skyColor: '#d4a574',
    groundTint: '#daa520',
    sunColor: '#ffcc88',
    sunIntensity: 0.8,
    sunPosition: [12, 7, 10] as [number, number, number],
    ambientIntensity: 0.45,
    fogColor: '#daa520',
    fogDensity: 0.012,
  },
};

export function SeasonEffects({ month, isAtWar, territoryName }: SeasonEffectsProps) {
  const climateZone = getClimateZone(territoryName);
  const season = getEffectiveSeason(month, climateZone);
  const baseSettings = seasonSettings[season];

  // Apply climate-specific modifications
  const settings = useMemo(() => {
    const modified = { ...baseSettings };

    if (climateZone === 'tropical') {
      // Tropical: bright, vibrant, high sun
      modified.skyColor = '#3498db';
      modified.sunIntensity = 1.5;
      modified.sunPosition = [6, 18, 6] as [number, number, number];
      modified.ambientIntensity = 0.7;
      modified.groundTint = '#2ecc71';
    } else if (climateZone === 'desert') {
      // Desert: hot, hazy, intense sun
      modified.skyColor = '#e8d4a8';
      modified.sunColor = '#ffdd88';
      modified.sunIntensity = 1.6;
      modified.sunPosition = [5, 20, 5] as [number, number, number];
      modified.fogColor = '#d4c4a0';
      modified.fogDensity = 0.015;
      modified.groundTint = '#c9b896';
    } else if (climateZone === 'arctic') {
      // Arctic: cold, low sun, bluish tint
      modified.skyColor = '#b8c9d9';
      modified.sunIntensity = modified.sunIntensity * 0.7;
      modified.ambientIntensity = 0.35;
    }

    return modified;
  }, [baseSettings, climateZone]);

  // Apply war tint if at war
  const skyColor = isAtWar
    ? new THREE.Color(settings.skyColor).lerp(new THREE.Color('#330000'), 0.3)
    : new THREE.Color(settings.skyColor);

  const sunColor = isAtWar
    ? new THREE.Color(settings.sunColor).lerp(new THREE.Color('#ff6600'), 0.2)
    : new THREE.Color(settings.sunColor);

  return (
    <>
      {/* Sky background */}
      <color attach="background" args={[skyColor]} />

      {/* Fog for atmosphere */}
      <fog attach="fog" args={[settings.fogColor, 40, 150]} />

      {/* Ambient light */}
      <ambientLight
        intensity={settings.ambientIntensity}
        color={isAtWar ? '#ffcccc' : '#ffffff'}
      />

      {/* Hemisphere light for natural outdoor feeling */}
      <hemisphereLight
        color={settings.skyColor}
        groundColor={settings.groundTint}
        intensity={0.5}
      />

      {/* Main directional sun light */}
      <directionalLight
        position={settings.sunPosition}
        intensity={settings.sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0001}
      />

      {/* Season-specific particles - only in appropriate climates */}
      {season === 'winter' && climateZone !== 'tropical' && climateZone !== 'desert' && <SnowParticles />}
      {season === 'fall' && climateZone === 'temperate' && <LeafParticles />}

      {/* War fire glow at edge */}
      {isAtWar && <WarEffects />}
    </>
  );
}

// Snow particles for winter
function SnowParticles() {
  const particlesRef = useRef<THREE.Points>(null);

  const { geometry, velocities } = useMemo(() => {
    const count = 500;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      vel[i] = 0.5 + Math.random() * 0.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    return { geometry: geo, velocities: vel };
  }, []);

  useFrame((_, delta) => {
    if (!particlesRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length / 3; i++) {
      // Fall down
      positions[i * 3 + 1] -= velocities[i] * delta * 2;

      // Drift sideways slightly
      positions[i * 3] += Math.sin(Date.now() * 0.001 + i) * delta * 0.2;

      // Reset when below ground
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 15;
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.08}
        color="#ffffff"
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

// Falling leaves for fall
function LeafParticles() {
  const particlesRef = useRef<THREE.Points>(null);

  const { geometry, velocities } = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    const col = new Float32Array(count * 3);

    const leafColors = [
      new THREE.Color('#d4a574'),
      new THREE.Color('#cd853f'),
      new THREE.Color('#8b4513'),
      new THREE.Color('#b8860b'),
    ];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 10 + 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      vel[i] = 0.3 + Math.random() * 0.3;

      const color = leafColors[Math.floor(Math.random() * leafColors.length)];
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    return { geometry: geo, velocities: vel };
  }, []);

  useFrame((_, delta) => {
    if (!particlesRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length / 3; i++) {
      // Fall down slowly
      positions[i * 3 + 1] -= velocities[i] * delta;

      // Drift and swirl
      const swirl = Math.sin(Date.now() * 0.002 + i * 0.5);
      positions[i * 3] += swirl * delta * 0.5;
      positions[i * 3 + 2] += Math.cos(Date.now() * 0.002 + i * 0.3) * delta * 0.3;

      // Reset when below ground
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 10 + Math.random() * 5;
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
      />
    </points>
  );
}

// War effects - distant fires and red sky glow
function WarEffects() {
  const flickerRef = useRef(0);

  useFrame(({ clock }) => {
    flickerRef.current = 0.8 + Math.sin(clock.elapsedTime * 10) * 0.2;
  });

  return (
    <group>
      {/* Distant fire glow */}
      <pointLight
        position={[15, 2, 0]}
        color="#ff3300"
        intensity={3}
        distance={20}
        decay={2}
      />
      <pointLight
        position={[-15, 2, 10]}
        color="#ff6600"
        intensity={2}
        distance={15}
        decay={2}
      />

      {/* Smoke columns at horizon */}
      {[
        [12, 3, 5],
        [-10, 2.5, 8],
        [8, 2, -10],
      ].map((pos, i) => (
        <mesh key={`smoke-${i}`} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.3, 0.8, 4, 6]} />
          <meshStandardMaterial
            color="#333333"
            transparent
            opacity={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}
