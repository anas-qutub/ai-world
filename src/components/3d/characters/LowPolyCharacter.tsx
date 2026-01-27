'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type CharacterRole = 'farmer' | 'miner' | 'builder' | 'soldier' | 'civilian' | 'trader';
export type CharacterActivity = 'idle' | 'walking' | 'working' | 'celebrating';

interface LowPolyCharacterProps {
  position: [number, number, number];
  role: CharacterRole;
  activity: CharacterActivity;
  territoryColor: string;
  targetPosition?: [number, number, number];
  seed: number;
}

// Role-based colors
const roleColors: Record<CharacterRole, { body: string; accent: string }> = {
  farmer: { body: '#4a7c3f', accent: '#8b7355' },
  miner: { body: '#666666', accent: '#cc8833' },
  builder: { body: '#8b7355', accent: '#cc9944' },
  soldier: { body: '#8b4513', accent: '#aa2222' },
  civilian: { body: '#6688aa', accent: '#886644' },
  trader: { body: '#885577', accent: '#ccaa44' },
};

// Simple seeded random
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function LowPolyCharacter({
  position,
  role,
  activity,
  territoryColor,
  targetPosition,
  seed,
}: LowPolyCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);

  const colors = roleColors[role];
  const bodyColor = useMemo(() => new THREE.Color(colors.body), [colors.body]);
  const accentColor = useMemo(() => new THREE.Color(colors.accent), [colors.accent]);
  const territoryColorObj = useMemo(() => new THREE.Color(territoryColor), [territoryColor]);

  // Animation phase based on seed for variation
  const animationOffset = useMemo(() => seededRandom(seed) * Math.PI * 2, [seed]);

  // Movement state
  const currentPos = useRef(new THREE.Vector3(...position));
  const currentRotation = useRef(0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const time = clock.elapsedTime + animationOffset;
    const walkSpeed = 0.8;
    const moveSpeed = 0.02;

    // Handle movement towards target
    if (targetPosition && activity === 'walking') {
      const target = new THREE.Vector3(...targetPosition);
      const direction = target.clone().sub(currentPos.current);
      const distance = direction.length();

      if (distance > 0.1) {
        direction.normalize();
        currentPos.current.add(direction.multiplyScalar(moveSpeed));

        // Face movement direction
        currentRotation.current = Math.atan2(direction.x, direction.z);
      }
    }

    // Update position
    groupRef.current.position.copy(currentPos.current);
    groupRef.current.rotation.y = currentRotation.current;

    // Animate limbs based on activity
    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    const leftLeg = leftLegRef.current;
    const rightLeg = rightLegRef.current;

    if (!leftArm || !rightArm || !leftLeg || !rightLeg) return;

    switch (activity) {
      case 'walking':
        // Walk animation
        const walkSwing = Math.sin(time * 4) * 0.5;
        leftArm.rotation.x = walkSwing;
        rightArm.rotation.x = -walkSwing;
        leftLeg.rotation.x = -walkSwing * 0.6;
        rightLeg.rotation.x = walkSwing * 0.6;

        // Slight body bob
        groupRef.current.position.y = currentPos.current.y + Math.abs(Math.sin(time * 8)) * 0.03;
        break;

      case 'working':
        // Work animation (tool swing or repetitive motion)
        if (role === 'miner' || role === 'builder') {
          // Pickaxe/hammer swing
          const swing = Math.sin(time * 3) * 0.8;
          rightArm.rotation.x = -1.5 + swing;
          rightArm.rotation.z = -0.3;
          leftArm.rotation.x = -0.5;
        } else if (role === 'farmer') {
          // Bending motion
          const bend = Math.sin(time * 2) * 0.3;
          groupRef.current.rotation.x = bend * 0.5;
          leftArm.rotation.x = -0.5 + bend;
          rightArm.rotation.x = -0.5 + bend;
        } else {
          // Generic work motion
          const workMotion = Math.sin(time * 2.5) * 0.4;
          leftArm.rotation.x = workMotion;
          rightArm.rotation.x = -workMotion;
        }
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        break;

      case 'celebrating':
        // Jump and wave arms
        const jumpPhase = Math.sin(time * 4);
        groupRef.current.position.y = currentPos.current.y + Math.max(0, jumpPhase) * 0.2;

        // Arms up waving
        leftArm.rotation.x = -2.5 + Math.sin(time * 6) * 0.3;
        rightArm.rotation.x = -2.5 + Math.sin(time * 6 + 1) * 0.3;
        leftArm.rotation.z = 0.5 + Math.sin(time * 6) * 0.2;
        rightArm.rotation.z = -0.5 - Math.sin(time * 6 + 1) * 0.2;

        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        break;

      case 'idle':
      default:
        // Subtle breathing/idle animation
        const breathe = Math.sin(time * 1.5) * 0.05;
        groupRef.current.scale.y = 1 + breathe;

        leftArm.rotation.x = Math.sin(time * 0.8) * 0.1;
        rightArm.rotation.x = Math.sin(time * 0.8 + 0.5) * 0.1;
        leftArm.rotation.z = 0.2;
        rightArm.rotation.z = -0.2;
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        break;
    }
  });

  // Determine if character has a tool
  const hasTool = role === 'miner' || role === 'builder' || role === 'soldier' || role === 'farmer';

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.2, 0.25, 0.12]} />
        <meshStandardMaterial color={bodyColor} flatShading />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.47, 0]} castShadow>
        <boxGeometry args={[0.14, 0.14, 0.14]} />
        <meshStandardMaterial color="#e8c9a0" flatShading />
      </mesh>

      {/* Hair/helmet */}
      {role === 'soldier' ? (
        <mesh position={[0, 0.54, 0]} castShadow>
          <boxGeometry args={[0.16, 0.08, 0.16]} />
          <meshStandardMaterial color={territoryColorObj} flatShading />
        </mesh>
      ) : (
        <mesh position={[0, 0.53, -0.01]} castShadow>
          <boxGeometry args={[0.13, 0.06, 0.12]} />
          <meshStandardMaterial color="#4a3728" flatShading />
        </mesh>
      )}

      {/* Left Arm */}
      <mesh
        ref={leftArmRef}
        position={[0.14, 0.3, 0]}
        castShadow
      >
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color="#e8c9a0" flatShading />
      </mesh>

      {/* Right Arm */}
      <mesh
        ref={rightArmRef}
        position={[-0.14, 0.3, 0]}
        castShadow
      >
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color="#e8c9a0" flatShading />
      </mesh>

      {/* Left Leg */}
      <mesh
        ref={leftLegRef}
        position={[0.05, 0.08, 0]}
        castShadow
      >
        <boxGeometry args={[0.07, 0.16, 0.07]} />
        <meshStandardMaterial color={accentColor} flatShading />
      </mesh>

      {/* Right Leg */}
      <mesh
        ref={rightLegRef}
        position={[-0.05, 0.08, 0]}
        castShadow
      >
        <boxGeometry args={[0.07, 0.16, 0.07]} />
        <meshStandardMaterial color={accentColor} flatShading />
      </mesh>

      {/* Tools/accessories based on role */}
      {role === 'soldier' && (
        // Shield
        <mesh position={[0.18, 0.25, 0.08]} rotation={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.02, 0.15, 0.12]} />
          <meshStandardMaterial color={territoryColorObj} flatShading />
        </mesh>
      )}

      {role === 'miner' && (
        // Pickaxe
        <group position={[-0.2, 0.35, 0]} rotation={[0, 0, -0.5]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.25, 4]} />
            <meshStandardMaterial color="#5c4033" flatShading />
          </mesh>
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.1, 0.03, 0.02]} />
            <meshStandardMaterial color="#666666" flatShading />
          </mesh>
        </group>
      )}

      {role === 'farmer' && (
        // Hoe/rake
        <group position={[-0.2, 0.35, 0]} rotation={[0, 0, -0.3]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.3, 4]} />
            <meshStandardMaterial color="#5c4033" flatShading />
          </mesh>
          <mesh position={[0, 0.14, 0.02]} rotation={[0.5, 0, 0]} castShadow>
            <boxGeometry args={[0.06, 0.02, 0.05]} />
            <meshStandardMaterial color="#666666" flatShading />
          </mesh>
        </group>
      )}

      {role === 'builder' && (
        // Hammer
        <group position={[-0.2, 0.35, 0]} rotation={[0, 0, -0.4]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 4]} />
            <meshStandardMaterial color="#5c4033" flatShading />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[0.06, 0.04, 0.04]} />
            <meshStandardMaterial color="#666666" flatShading />
          </mesh>
        </group>
      )}

      {role === 'trader' && (
        // Bag
        <mesh position={[0.15, 0.2, 0.08]} castShadow>
          <boxGeometry args={[0.08, 0.1, 0.06]} />
          <meshStandardMaterial color="#8b7355" flatShading />
        </mesh>
      )}
    </group>
  );
}
