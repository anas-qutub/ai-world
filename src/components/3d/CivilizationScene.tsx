'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { ProceduralTerrain } from './terrain/ProceduralTerrain';
import { BuildingGenerator } from './buildings/BuildingGenerator';
import { CharacterPool } from './characters/CharacterPool';
import { SeasonEffects } from './effects/SeasonEffects';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';

interface CivilizationSceneProps {
  territoryId: Id<'territories'>;
  territoryColor: string;
}

function SceneContent({
  territoryId,
  territoryColor,
}: CivilizationSceneProps) {
  // Fetch territory data
  const territoryData = useQuery(api.queries.getTerritoryWithAgent, {
    id: territoryId,
  });

  // Fetch relationships to check for wars
  const relationships = useQuery(api.queries.getTerritoryRelationships, {
    territoryId,
  });

  // Fetch world state for time/season
  const world = useQuery(api.queries.getWorld);

  const isAtWar = useMemo(() => {
    return relationships?.some(r => r.status === 'at_war') ?? false;
  }, [relationships]);

  const territory = territoryData?.territory;
  const month = world?.month ?? 6;

  // Parse natural resources
  const naturalResources = useMemo(() => {
    return (territory as any)?.naturalResources as string[] ?? [];
  }, [territory]);

  // Calculate terrain seed from territory name
  const terrainSeed = useMemo(() => {
    if (!territory?.name) return 12345;
    let hash = 0;
    for (let i = 0; i < territory.name.length; i++) {
      hash = ((hash << 5) - hash) + territory.name.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }, [territory?.name]);

  if (!territory) {
    return null;
  }

  // Get governance type
  const governance = (territory as any)?.governance ?? 'none';

  return (
    <>
      {/* Season-based lighting and effects */}
      <SeasonEffects
        month={month}
        isAtWar={isAtWar}
        territoryName={territory.name}
      />

      {/* Procedural terrain */}
      <ProceduralTerrain
        seed={terrainSeed}
        naturalResources={naturalResources}
        territoryColor={territoryColor}
      />

      {/* Buildings based on territory stats */}
      <BuildingGenerator
        wealth={territory.wealth}
        technology={territory.technology}
        population={territory.population}
        governance={governance}
        territoryColor={territoryColor}
        seed={terrainSeed}
        naturalResources={naturalResources}
      />

      {/* Animated characters */}
      <CharacterPool
        population={territory.population}
        food={territory.food}
        military={territory.military}
        happiness={territory.happiness}
        naturalResources={naturalResources}
        isAtWar={isAtWar}
        territoryColor={territoryColor}
        seed={terrainSeed}
      />
    </>
  );
}

export function CivilizationScene({
  territoryId,
  territoryColor,
}: CivilizationSceneProps) {
  return (
    <Canvas
      shadows
      camera={{
        position: [40, 30, 40],
        fov: 50,
        near: 0.1,
        far: 500,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      style={{ background: '#0a0a0f' }}
    >
      <Suspense fallback={null}>
        <SceneContent
          territoryId={territoryId}
          territoryColor={territoryColor}
        />
      </Suspense>

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={0.2}
        target={[0, 0, 0]}
        autoRotate={false}
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
