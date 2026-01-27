'use client';

import { X, Maximize2 } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { CivilizationScene } from './CivilizationScene';
import { Id } from '../../../convex/_generated/dataModel';

interface CivilizationModalProps {
  territoryId: Id<'territories'>;
  territoryName: string;
  territoryColor: string;
  onClose: () => void;
}

function LoadingScreen() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--void)]">
      <div className="text-center">
        <div className="relative mb-4">
          <div className="w-16 h-16 border-2 border-[var(--cyber-cyan)] border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-2 border-[var(--holo-blue)] border-b-transparent rounded-full animate-spin-slow" />
        </div>
        <p className="text-[var(--cyber-cyan)] font-display text-sm tracking-wider animate-pulse">
          INITIALIZING 3D ENVIRONMENT
        </p>
        <p className="text-[var(--text-muted)] text-xs mt-2">
          Generating terrain and buildings...
        </p>
      </div>
    </div>
  );
}

export function CivilizationModal({
  territoryId,
  territoryName,
  territoryColor,
  onClose,
}: CivilizationModalProps) {
  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--void)]">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-4">
          <div
            className="w-3 h-8 rounded"
            style={{ backgroundColor: territoryColor }}
          />
          <div>
            <h2 className="font-display text-xl text-white tracking-wider">
              {territoryName.toUpperCase()}
            </h2>
            <p className="text-[var(--text-muted)] text-xs font-body">
              3D CIVILIZATION VIEW
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded transition-colors group"
            title="Close (Escape)"
          >
            <X className="w-6 h-6 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 z-10 text-[var(--text-muted)] text-xs space-y-1 bg-black/40 px-3 py-2 rounded backdrop-blur-sm">
        <p><span className="text-[var(--cyber-cyan)]">Drag</span> to rotate</p>
        <p><span className="text-[var(--cyber-cyan)]">Scroll</span> to zoom</p>
        <p><span className="text-[var(--cyber-cyan)]">ESC</span> to close</p>
      </div>

      {/* 3D Scene */}
      <Suspense fallback={<LoadingScreen />}>
        <CivilizationScene
          territoryId={territoryId}
          territoryColor={territoryColor}
        />
      </Suspense>
    </div>
  );
}
